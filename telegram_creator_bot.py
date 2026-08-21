#!/usr/bin/env python3
"""Telegram creator bot — gera carrosséis (1080x1350) e reels (1080x1920)
a partir de um tema, usando Firecrawl (notícias), DeepSeek (roteiro),
Fish Audio (narração) e os templates do projeto.

Comandos:
  /ajuda                    ajuda
  /carrossel <tema>         gera carrossel direto (ou /carrossel sem tema = guiado)
  /reel <tema>              gera reel direto (ou /reel sem tema = guiado)
  /noticia                  resumo de notícias agora
  /status                   estado atual
  /cancel                   cancela geração em andamento

Imagens: envie fotos ou URLs junto do tema (até 2 p/ carrossel, 1 p/ reel).
Sem imagens, o bot busca da notícia ou gera via IA.
Notificação diária: NOTIF_HOUR:NOTIF_MIN (padrão 08:00).

Run: python3 -u telegram_creator_bot.py
"""

import json, os, re, subprocess, sys, threading, time, datetime
from urllib.parse import urlparse
import requests
from PIL import Image, ImageDraw, ImageFilter, ImageFont


API = "https://api.telegram.org/bot{token}/{method}"
FILE_API = "https://api.telegram.org/file/bot{token}/{path}"

TOKEN = os.environ.get("TELEGRAM_CREATOR_BOT_TOKEN",
                       "8910534035:AAH3KTKTI_VGQztXRq-gbat9ZV-ghtblVlI")
ALLOWED = int(os.environ.get("ALLOWED_USER_ID", "8618255024"))
NOTIF_CHAT = int(os.environ.get("NOTIF_CHAT_ID", "8618255024"))
NOTIF_HOUR = int(os.environ.get("NOTIF_HOUR", "8"))
NOTIF_MIN = int(os.environ.get("NOTIF_MIN", "0"))
POLL_SECONDS = 4

FAL_API_KEY = os.environ.get("FAL_KEY", "")
FONT_TITLE_URL = "https://raw.githubusercontent.com/google/fonts/main/ofl/librebaskerville/LibreBaskerville%5Bwght%5D.ttf"
FONT_BODY_URL = "https://github.com/google/fonts/raw/main/ofl/inter/Inter%5Bopsz%2Cwght%5D.ttf"

import content_ai
import reel_generator
import carousel_template as ct

state = {"busy": False, "proc": None, "cancel": False,
         "mode": None, "pending_images": [], "pending_link": None}
lock = threading.Lock()

WORK = "/tmp/warren_bot"
os.makedirs(WORK, exist_ok=True)


# ── Telegram helpers ────────────────────────────────────────────────

def call(method, **kwargs):
    r = requests.post(API.format(token=TOKEN, method=method), json=kwargs, timeout=120)
    return r.json()


def send(chat_id, text):
    for chunk in (text[i:i + 3800] for i in range(0, len(text), 3800)):
        call("sendMessage", chat_id=chat_id, text=chunk)


def send_typing(chat_id):
    call("sendChatAction", chat_id=chat_id, action="typing")


def send_media_group(chat_id, paths, caption=None):
    media = [{"type": "photo", "media": f"attach://s{i}"} for i in range(len(paths))]
    if caption:
        media[0]["caption"] = caption
    files = {}
    handles = []
    try:
        for i, p in enumerate(paths):
            f = open(p, "rb")
            handles.append(f)
            files[f"s{i}"] = f
        r = requests.post(
            API.format(token=TOKEN, method="sendMediaGroup"),
            data={"chat_id": chat_id, "media": json.dumps(media)}, files=files, timeout=600,
        )
        return r.json()
    finally:
        for f in handles:
            f.close()


def send_video(chat_id, path, caption=None):
    with open(path, "rb") as f:
        data = {"chat_id": chat_id}
        if caption:
            data["caption"] = caption
        r = requests.post(
            API.format(token=TOKEN, method="sendVideo"),
            data=data, files={"video": f}, timeout=600,
        )
    return r.json()


# ── Recursos (fontes, downloads, imagens) ───────────────────────────

def ensure_fonts():
    if not os.path.exists("/tmp/LibreBaskerville-Regular.ttf"):
        try:
            r = requests.get(FONT_TITLE_URL, timeout=60)
            open("/tmp/LibreBaskerville-Regular.ttf", "wb").write(r.content)
        except Exception:
            pass
    if not os.path.exists("/tmp/Inter-SemiBold.ttf"):
        try:
            r = requests.get(FONT_BODY_URL, timeout=60)
            open("/tmp/Inter-SemiBold.ttf", "wb").write(r.content)
        except Exception:
            pass


def download_url(url, dest):
    r = requests.get(url, timeout=90)
    r.raise_for_status()
    with open(dest, "wb") as f:
        f.write(r.content)
    return dest


def download_telegram_photo(file_id, dest):
    info = call("getFile", file_id=file_id)
    if not info.get("ok"):
        raise RuntimeError("getFile falhou")
    fp = info["result"]["file_path"]
    r = requests.get(FILE_API.format(token=TOKEN, path=fp), timeout=90)
    r.raise_for_status()
    with open(dest, "wb") as f:
        f.write(r.content)
    return dest


def extract_urls(text):
    return re.findall(r"https?://\S+", text or "")


def article_urls_in(text):
    return [u for u in extract_urls(text)
            if not re.match(r"https?://.*\.(jpg|jpeg|png|webp)", u.lower())]


def resolve_images(chat_id, message):
    """Returns list of local image paths from photos + URLs in the message."""
    imgs = []
    for photo in (message.get("photo") or []):
        try:
            dest = os.path.join(WORK, f"photo_{int(time.time()*1000)}_{len(imgs)}.jpg")
            download_telegram_photo(photo["file_id"], dest)
            imgs.append(dest)
        except Exception as e:
            send(chat_id, f"Erro ao baixar foto: {e}")
    for url in extract_urls(message.get("text", ""))[:2]:
        if not re.match(r"https?://.*\.(jpg|jpeg|png|webp)", url.lower()):
            continue
        try:
            dest = os.path.join(WORK, f"url_{int(time.time()*1000)}_{len(imgs)}.jpg")
            download_url(url, dest)
            imgs.append(dest)
        except Exception as e:
            send(chat_id, f"Erro ao baixar {url}: {e}")
    return imgs


def news_image(topic):
    for n in content_ai.search_news(topic, limit=3):
        if n.get("image"):
            try:
                dest = os.path.join(WORK, f"news_{int(time.time()*1000)}.jpg")
                return download_url(n["image"], dest)
            except Exception:
                continue
    return None


def generate_image(prompt):
    if not FAL_API_KEY:
        return None
    try:
        r = requests.post(
            "https://queue.fal.run/fal-ai/flux-pro/v1.1-ultra",
            headers={"Authorization": f"Key {FAL_API_KEY}"},
            json={"prompt": prompt, "image_size": "portrait_4_5"},
            timeout=60,
        )
        r.raise_for_status()
        job = r.json()
        for _ in range(30):
            st = requests.get(job["status_url"], timeout=30).json()
            if st.get("status") == "COMPLETED":
                resp = requests.get(job["response_url"], timeout=30).json()
                url = resp["images"][0]["url"]
                dest = os.path.join(WORK, f"gen_{int(time.time()*1000)}.jpg")
                return download_url(url, dest)
            if st.get("status") in ("FAILED", "CANCELLED"):
                return None
            time.sleep(3)
    except Exception:
        return None
    return None


def placeholder_image(dest, text_lines):
    img = Image.new("RGB", (ct.W, ct.H), "#0a0a0a")
    draw = ImageDraw.Draw(img)
    draw.ellipse([-200, -300, 700, 600], fill="#141414")
    draw.ellipse([500, 800, 1300, 1600], fill="#101010")
    img = img.filter(ImageFilter.GaussianBlur(60))
    draw = ImageDraw.Draw(img)
    draw.text((80, 700), "SEM IMAGEM", fill="#333333")
    img.save(dest, "JPEG", quality=90, exif=b"")
    return dest


def pick_image(chat_id, topic, user_images):
    if user_images:
        return user_images[0]
    img = news_image(topic)
    if img:
        return img
    img = generate_image(f"cinematic dark moody macro photograph about {topic}, "
                         f"black background, premium editorial style, no text")
    if img:
        return img
    dest = os.path.join(WORK, "placeholder.jpg")
    return placeholder_image(dest, [])


def fit_font_size(font_path, lines, max_size, min_size, max_width=900):
    """Shrink font until all lines fit the slide width."""
    size = max_size
    while size >= min_size:
        f = ImageFont.truetype(font_path, size)
        if all(f.getbbox(l)[2] <= max_width for l in lines):
            return size
        size -= 2
    return min_size


# ── Geração ─────────────────────────────────────────────────────────

def build_carousel(chat_id, topic, images, plan=None):
    ensure_fonts()
    send_typing(chat_id)
    news = []
    if plan is None:
        send(chat_id, "Buscando notícias...")
        news = content_ai.search_news(topic, limit=3)
        send(chat_id, "Escrevendo roteiro com DeepSeek...")
        plan = content_ai.carousel_plan(topic, news)

    if not images:
        img1 = pick_image(chat_id, topic, [])
    else:
        img1 = images[0]
    img2 = images[1] if len(images) > 1 else img1

    out_dir = os.path.join(WORK, f"carousel_{int(time.time()*1000)}")
    os.makedirs(out_dir, exist_ok=True)

    slides = plan["slides"]
    send(chat_id, "Renderizando slides...")
    paths = []
    for i, s in enumerate(slides):
        check_cancel(chat_id)
        photo = img1 if i % 2 == 0 else img2
        out = os.path.join(out_dir, f"slide_{i+1:02d}.jpg")
        ct.create_premium_slide(
            photo_path=photo,
            title_lines=s["title_lines"],
            body_lines=s["body_lines"],
            output_path=out,
            slide_num=f"{i+1}/{len(slides)}",
            title_size=fit_font_size("/tmp/LibreBaskerville-Regular.ttf",
                                     s["title_lines"], 62, 40),
            body_size=fit_font_size("/tmp/Inter-SemiBold.ttf",
                                    s["body_lines"], 30, 20),
        )
        paths.append(out)

    caption = f"{plan['cover_title']}\n\n{news[0]['title'] if news else topic}\n{news[0]['url'] if news else ''}".strip()
    send(chat_id, "Enviando...")
    resp = send_media_group(chat_id, paths, caption[:1000])
    if not (resp or {}).get("ok"):
        send(chat_id, f"Erro ao enviar: {resp}")
    return paths


def build_reel(chat_id, topic, images, plan=None):
    ensure_fonts()
    send_typing(chat_id)
    news = []
    if plan is None:
        send(chat_id, "Buscando notícias...")
        news = content_ai.search_news(topic, limit=3)
        send(chat_id, "Escrevendo roteiro com DeepSeek...")
        plan = content_ai.reel_plan(topic, news)

    img = pick_image(chat_id, topic, images)
    out_dir = os.path.join(WORK, f"reel_{int(time.time()*1000)}")

    send(chat_id, "Gerando narração (Fish Audio)...")
    try:
        final = reel_generator.generate_reel(
            img_path=img,
            segments=plan["segments"],
            source_label=plan["source_label"],
            out_dir=out_dir,
        )
    except Exception as e:
        send(chat_id, f"Erro no reel: {e}")
        return None

    check_cancel(chat_id)
    caption = f"{topic.upper()}\n{news[0]['title'] if news else ''}".strip()[:1000]
    send(chat_id, "Enviando vídeo...")
    resp = send_video(chat_id, final, caption)
    if not (resp or {}).get("ok"):
        send(chat_id, f"Erro ao enviar: {resp}")
    return final


def check_cancel(chat_id):
    if state["cancel"]:
        state["cancel"] = False
        send(chat_id, "Cancelado.")
        raise SystemExit


# ── Handler ─────────────────────────────────────────────────────────

def run_link_research(chat_id, url, kind=None):
    """Deep research: scrape article -> DeepSeek plan -> images -> build (or ask format)."""
    state["busy"] = True
    try:
        send(chat_id, "Fazendo deep research no artigo...")
        data = content_ai.scrape_article(url)
        if not data:
            send(chat_id, "Não consegui ler o artigo. Tente outro link ou use /carrossel <tema>.")
            return
        send(chat_id, f"Artigo: {data['title'][:250]}\n\nEscrevendo legenda e roteiro com DeepSeek...")
        plan = content_ai.article_plan(data["title"], data["content"])

        images = []
        for u in data["images"][:3]:
            try:
                dest = os.path.join(WORK, f"article_{int(time.time()*1000)}_{len(images)}.jpg")
                download_url(u, dest)
                images.append(dest)
            except Exception:
                continue
        if not images:
            send(chat_id, "Sem imagens no artigo. Buscando imagens da notícia...")
            for n in content_ai.search_news(data["title"], limit=3):
                if n.get("image"):
                    try:
                        dest = os.path.join(WORK, f"news_{int(time.time()*1000)}.jpg")
                        images.append(download_url(n["image"], dest))
                        break
                    except Exception:
                        continue

        if kind:
            if kind == "carousel":
                build_carousel(chat_id, data["title"], images, plan=plan)
            else:
                build_reel(chat_id, data["title"], images, plan=plan)
            send(chat_id, f"Legenda:\n\n{plan.get('caption', '')}")
            return

        state["pending_link"] = {"plan": plan, "images": images,
                                 "title": data["title"]}
        state["mode"] = "link"
        send(chat_id, f"Legenda pronta:\n\n{plan.get('caption', '')}\n\n"
                      f"Quer que eu gere: 1) Carrossel  2) Reel  3) Ambos?")
    except Exception as e:
        send(chat_id, f"Erro no deep research: {e}")
    finally:
        state["busy"] = False


def handle(chat_id, message):
    text = (message.get("text") or "").strip()
    photos = message.get("photo") or []

    if photos:
        imgs = resolve_images(chat_id, message)
        state["pending_images"].extend(imgs)
        send(chat_id, f"{len(imgs)} imagem(ns) recebida(s). Envie o tema, ou uma mensagem "
                      f"de /carrossel ou /reel para gerar.")
        return

    if not text:
        return

    if text.startswith("/") and not text.startswith("/run"):
        cmd = text.split()[0]
        cmd = {"/reels": "/reel", "/carousel": "/carrossel",
               "/carousels": "/carrossel"}.get(cmd, cmd)
        arg = text[len(text.split()[0]):].strip()

        if cmd in ("/ajuda", "/help", "/start"):
            send(chat_id, (
                "Comandos:\n"
                "/carrossel <tema> - gera carrossel 1080x1350\n"
                "/reel <tema> - gera reel 1080x1920 com narração\n"
                "/carrossel (sem tema) - fluxo guiado\n"
                "/reel (sem tema) - fluxo guiado\n"
                "/noticia - resumo de notícias agora\n"
                "/status - estado\n"
                "/cancel - cancela\n\n"
                "Link de notícia: envie um link e o bot faz deep research,\n"
                "extrai as imagens, escreve a legenda e gera o post.\n"
                "Dica: envie fotos/URLs de imagem junto do tema para usar as suas."
            ))
        elif cmd == "/carrossel":
            if arg:
                if article_urls_in(arg) and not state["busy"]:
                    run_link_research(chat_id, article_urls_in(arg)[0], kind="carousel")
                else:
                    theme = re.sub(r"https?://\S+", "", arg).strip() or arg
                    run_generation(chat_id, "carousel", theme, resolve_images(chat_id, message))
            else:
                state["mode"] = "carousel"
                state["pending_images"] = []
                send(chat_id, "Qual o tema do carrossel? (pode enviar imagens antes)")
        elif cmd == "/reel":
            if arg:
                if article_urls_in(arg) and not state["busy"]:
                    run_link_research(chat_id, article_urls_in(arg)[0], kind="reel")
                else:
                    theme = re.sub(r"https?://\S+", "", arg).strip() or arg
                    run_generation(chat_id, "reel", theme, resolve_images(chat_id, message))
            else:
                state["mode"] = "reel"
                state["pending_images"] = []
                send(chat_id, "Qual o tema do reel? (pode enviar imagens antes)")
        elif cmd == "/noticia":
            send(chat_id, "Buscando notícias...")
            try:
                send(chat_id, content_ai.daily_summary("crypto market macro"))
            except Exception as e:
                send(chat_id, f"Erro: {e}")
        elif cmd == "/status":
            busy = "ocupado" if state["busy"] else "livre"
            mode = state["mode"] or "nenhum"
            send(chat_id, f"Status: {busy} | Modo guiado: {mode} | "
                          f"{len(state['pending_images'])} imagem(ns) pendente(s)")
        elif cmd == "/cancel":
            state["cancel"] = True
            state["mode"] = None
            state["pending_link"] = None
            state["pending_images"] = []
            if state["proc"]:
                state["proc"].kill()
            send(chat_id, "Cancelando...")
        else:
            send(chat_id, "Comando desconhecido. Use /ajuda.")
        return

    if state["mode"] == "link":
        link = state.get("pending_link")
        kind = text.lower().replace("carrossel", "1").replace("carousel", "1")
        if not link:
            state["mode"] = None
            send(chat_id, "Sessão expirada. Envie o link de novo.")
            return
        if kind not in ("1", "2", "3"):
            send(chat_id, "Responda: 1) Carrossel  2) Reel  3) Ambos")
            return
        state["mode"] = None
        state["pending_link"] = None
        title = link.get("title", "")
        if kind in ("1", "3"):
            build_carousel(chat_id, title, list(link["images"]), plan=link["plan"])
        if kind in ("2", "3"):
            build_reel(chat_id, title, list(link["images"]), plan=link["plan"])
        return

    if state["mode"] in ("carousel", "reel"):
        theme = re.sub(r"https?://\S+", "", text).strip() or text
        images = list(state["pending_images"]) + resolve_images(chat_id, message)
        kind = state["mode"]
        state["mode"] = None
        state["pending_images"] = []
        run_generation(chat_id, kind, theme, images)
        return

    urls = extract_urls(text)
    image_urls = [u for u in urls if re.match(r"https?://.*\.(jpg|jpeg|png|webp)", u.lower())]
    article_urls = [u for u in urls if u not in image_urls]
    if article_urls and not state["busy"]:
        run_link_research(chat_id, article_urls[0])
        return

    theme = re.sub(r"https?://\S+", "", text).strip() or text
    run_generation(chat_id, None, theme, resolve_images(chat_id, message))


def run_generation(chat_id, kind, topic, images):
    if state["busy"]:
        send(chat_id, "Já estou gerando outra coisa. Envie /cancel ou espere.")
        return
    if kind not in ("carousel", "reel"):
        send(chat_id, "Envie /carrossel <tema> ou /reel <tema>.")
        return
    state["busy"] = True
    state["cancel"] = False
    try:
        if kind == "carousel":
            build_carousel(chat_id, topic, images)
        else:
            build_reel(chat_id, topic, images)
    except SystemExit:
        pass
    except Exception as e:
        send(chat_id, f"Erro: {e}")
    finally:
        state["busy"] = False


# ── Notificação diária ──────────────────────────────────────────────

def notif_loop():
    last_key = None
    while True:
        now = datetime.datetime.now()
        key = (now.year, now.month, now.day)
        if key != last_key and (now.hour, now.minute) >= (NOTIF_HOUR, NOTIF_MIN):
            last_key = key
            try:
                send(NOTIF_CHAT, "📊 Notícias de hoje:\n\n" + content_ai.daily_summary("crypto market macro"))
            except Exception as e:
                print(f"Notif error: {e}")
        time.sleep(30)


# ── Loop principal ──────────────────────────────────────────────────

def main():
    ensure_fonts()
    threading.Thread(target=notif_loop, daemon=True).start()
    offset = None
    print(f"Creator bot online. Usuário permitido: {ALLOWED}")
    while True:
        try:
            params = {"timeout": 30}
            if offset:
                params["offset"] = offset
            r = requests.get(API.format(token=TOKEN, method="getUpdates"),
                             params=params, timeout=60)
            data = r.json()
            if not data.get("ok"):
                print(f"API error: {data}")
                time.sleep(POLL_SECONDS)
                continue
            for upd in data["result"]:
                offset = upd["update_id"] + 1
                msg = upd.get("message") or {}
                chat_id = msg.get("chat", {}).get("id")
                if not chat_id:
                    continue
                if chat_id != ALLOWED:
                    print(f"Ignored chat {chat_id}")
                    continue
                text = (msg.get("text") or "").strip()
                print(f"[{chat_id}] {text[:120]}")
                try:
                    handle(chat_id, msg)
                except Exception as e:
                    send(chat_id, f"Erro interno: {e}")
        except requests.RequestException as e:
            print(f"Network error: {e}")
            time.sleep(POLL_SECONDS)


if __name__ == "__main__":
    main()
