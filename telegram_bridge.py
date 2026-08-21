#!/usr/bin/env python3
"""Telegram bridge — receive prompts via bot and run them with opencode.

Commands:
  /ajuda        show help
  /projetos     list available projects
  /projeto <n>  select project (venice-app, geral)
  /status       current project + busy state
  /run <prompt> run prompt on the selected project
  <any message> same as /run
  /cancel       cancel the running task

Security: only whitelisted chat_ids can send commands. The bridge replies
only to those chats. Do NOT share the bot token.

Run: python3 -u telegram_bridge.py
"""

import json, os, subprocess, sys, time
import requests

API = "https://api.telegram.org/bot{token}/{method}"

TOKEN = os.environ.get("TELEGRAM_BOT_TOKEN", "8991867771:AAGSHzih0hDIo_V6FdFt8wVmx1H5fd-QQls")
ALLOWED_CHATS = {int(os.environ.get("TELEGRAM_ALLOWED_CHATS", "8618255024"))}

PROJECTS = {
    "venice-app": "/Users/albertalves/os/treino-ai/venice-app",
    "geral": "/Users/albertalves/geral",
}

MODEL = "deepseek/deepseek-v4-flash"
POLL_SECONDS = 5

state = {"project": "venice-app", "busy": False, "proc": None}

def call(method, **kwargs):
    r = requests.post(API.format(token=TOKEN, method=method), json=kwargs, timeout=120)
    return r.json()

def send(chat_id, text):
    for chunk in (text[i:i + 3800] for i in range(0, len(text), 3800)):
        call("sendMessage", chat_id=chat_id, text=chunk)

def help_text():
    return (
        "Comandos:\n"
        "/projetos - lista projetos\n"
        "/projeto <nome> - seleciona (venice-app, geral)\n"
        "/status - projeto atual e se está ocupado\n"
        "/cancel - cancela a tarefa em execução\n"
        "Qualquer outra mensagem vira prompt pro opencode\n"
        f"\nProjeto atual: {state['project']}"
    )

def run_opencode(chat_id, prompt):
    proj = state["project"]
    workdir = PROJECTS[proj]
    send(chat_id, f"Rodando no projeto `{proj}`... (pode demorar)")

    env = dict(os.environ)
    env["OPENCODE_DISABLE_OUTPUT"] = "1"
    cmd = [
        "opencode", "run", "--format", "json", "--model", MODEL, prompt
    ]
    try:
        proc = subprocess.Popen(
            cmd, cwd=workdir, env=env,
            stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True
        )
        state["proc"] = proc
        stdout, stderr = proc.communicate(timeout=1800)
        state["proc"] = None
    except subprocess.TimeoutExpired:
        proc.kill()
        state["proc"] = None
        send(chat_id, "Timeout: tarefa demorou mais de 30min e foi cancelada.")
        return
    except Exception as e:
        state["proc"] = None
        send(chat_id, f"Erro ao iniciar: {e}")
        return

    texts, files = [], set()
    for line in stdout.splitlines():
        try:
            ev = json.loads(line)
        except Exception:
            continue
        part = ev.get("part", {})
        if ev.get("type") == "text" and part.get("type") == "text":
            texts.append(part.get("text", ""))
        elif part.get("type") == "tool-invocation":
            inv = part.get("toolInvocation", {})
            if inv.get("tool") == "edit":
                fp = inv.get("state", {}).get("input", {}).get("filePath")
                if fp:
                    files.add(fp.replace("/Users/albertalves/", "~/"))
            elif inv.get("tool") == "write":
                fp = inv.get("state", {}).get("input", {}).get("filePath")
                if fp:
                    files.add(fp.replace("/Users/albertalves/", "~/"))

    body = "\n".join(t for t in texts if t.strip()) or "(sem resposta de texto)"
    reply = body.strip()
    if files:
        reply += "\n\nArquivos alterados:\n" + "\n".join(sorted(files))
    if proc.returncode != 0:
        reply += f"\n\n(exit code {proc.returncode})"
    send(chat_id, reply)

def handle(chat_id, text):
    text = (text or "").strip()
    if not text:
        return
    if text == "/ajuda":
        send(chat_id, help_text())
    elif text == "/projetos":
        send(chat_id, "Projetos:\n" + "\n".join(
            f"{n} -> {p}" for n, p in PROJECTS.items()
        ) + f"\n\nAtual: {state['project']}")
    elif text.startswith("/projeto"):
        name = text.split(None, 1)[1] if len(text.split(None, 1)) > 1 else ""
        if name in PROJECTS:
            state["project"] = name
            send(chat_id, f"Projeto atual: {name}")
        else:
            send(chat_id, f"Projeto inválido. Disponíveis: {', '.join(PROJECTS)}")
    elif text == "/status":
        busy = "ocupado" if state["busy"] else "livre"
        send(chat_id, f"Projeto: {state['project']} | Status: {busy}")
    elif text == "/cancel":
        if state["proc"]:
            state["proc"].kill()
            send(chat_id, "Tarefa cancelada.")
        else:
            send(chat_id, "Nada em execução.")
    else:
        if state["busy"]:
            send(chat_id, "Ainda executando outra tarefa. Envie /cancel ou espere.")
            return
        prompt = text[5:].strip() if text.startswith("/run ") else text
        state["busy"] = True
        try:
            run_opencode(chat_id, prompt)
        finally:
            state["busy"] = False

def main():
    offset = None
    print(f"Bridge online. Chats permitidos: {ALLOWED_CHATS}")
    while True:
        try:
            params = {"timeout": 30}
            if offset:
                params["offset"] = offset
            r = requests.get(
                API.format(token=TOKEN, method="getUpdates"), params=params, timeout=60
            )
            data = r.json()
            if not data.get("ok"):
                print(f"API error: {data}")
                time.sleep(POLL_SECONDS)
                continue
            for upd in data["result"]:
                offset = upd["update_id"] + 1
                msg = upd.get("message") or {}
                chat_id = msg.get("chat", {}).get("id")
                text = msg.get("text")
                if not chat_id or text is None:
                    continue
                if chat_id not in ALLOWED_CHATS:
                    print(f"Ignored chat {chat_id}")
                    continue
                print(f"[{chat_id}] {text[:120]}")
                try:
                    handle(chat_id, text)
                except Exception as e:
                    send(chat_id, f"Erro interno: {e}")
        except requests.RequestException as e:
            print(f"Network error: {e}")
            time.sleep(POLL_SECONDS)

if __name__ == "__main__":
    main()
