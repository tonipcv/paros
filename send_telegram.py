#!/usr/bin/env python3
"""Send a video (and optional photo) to a Telegram chat via bot API.

Usage:
  python3 send_telegram.py <video_path> [photo_path] [caption]
  python3 send_telegram.py <video_path> [photo_path] [caption] --chat <chat_id>

Bot token comes from TELEGRAM_BOT_TOKEN env var (or --token).
If no chat_id given, resolves from getUpdates (latest chat that messaged the bot).
"""

import argparse, os, sys, time
import requests

API = "https://api.telegram.org/bot{token}/{method}"

def get_chat_id(token):
    r = requests.get(API.format(token=token, method="getUpdates"), timeout=30)
    data = r.json()
    if not data.get("ok") or not data["result"]:
        sys.exit(
            "No chat found. Message the bot (@paulheuvbot) once, then rerun, "
            "or pass --chat <chat_id>."
        )
    updates = data["result"]
    chat = updates[-1]["message"]["chat"]
    return chat["id"]

def send(token, chat_id, path, kind, caption=None):
    with open(path, "rb") as f:
        files = {kind: f}
        data = {"chat_id": chat_id}
        if caption:
            data["caption"] = caption
        r = requests.post(
            API.format(token=token, method="send" + kind.capitalize()),
            data=data, files=files, timeout=600,
        )
    resp = r.json()
    if not resp.get("ok"):
        sys.exit(f"Telegram error: {resp}")
    print(f"Sent {kind}: {path} -> chat {chat_id}")

def main():
    p = argparse.ArgumentParser()
    p.add_argument("video", help="path to .mp4")
    p.add_argument("photo", nargs="?", default=None, help="optional thumbnail jpg")
    p.add_argument("caption", nargs="?", default=None)
    p.add_argument("--chat", default=None)
    p.add_argument("--token", default=os.environ.get("TELEGRAM_BOT_TOKEN"))
    args = p.parse_args()

    token = args.token
    if not token:
        sys.exit("No token: set TELEGRAM_BOT_TOKEN or pass --token")
    chat_id = args.chat or get_chat_id(token)

    if args.photo:
        send(token, chat_id, args.photo, "photo")
    send(token, chat_id, args.video, "video", args.caption)

if __name__ == "__main__":
    main()
