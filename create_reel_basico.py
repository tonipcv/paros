#!/usr/bin/env python3
"""Reels template basico — full image, audio ao fundo, JUST IN + headline."""

import os, subprocess, requests
from PIL import Image

OUT = "/tmp/reel_mythos"
os.makedirs(OUT, exist_ok=True)

IMG = "/tmp/mythos_crypto.jpg"
W, H = 1080, 1920

FISH_API_KEY = "2decb955bc8b492ea5b94d75cee5d2e0"

NARRATION = (
    "Anthropic's Claude Mythos AI has discovered new ways to attack "
    "cryptographic algorithms, including a post-quantum encryption candidate. "
    "The breakthrough raises urgent questions about the future of security "
    "in an age of advanced AI."
)

def prepare_image():
    img = Image.open(IMG).convert("RGB")
    ratio = W / img.width
    nw, nh = W, int(img.height * ratio)
    img = img.resize((nw, nh), Image.LANCZOS)
    canvas = Image.new("RGB", (W, H), "#000000")
    top = (H - nh) // 2
    canvas.paste(img, (0, top + 160))
    path = os.path.join(OUT, "frame.jpg")
    canvas.save(path, "JPEG", quality=92, exif=b"")
    return path

def generate_audio():
    resp = requests.post(
        "https://api.fish.audio/v1/tts",
        headers={
            "Authorization": f"Bearer {FISH_API_KEY}",
            "Content-Type": "application/json",
            "model": "s2.1-pro-free",
        },
        json={"text": NARRATION, "reference_id": "c25dbc8fddae4ce08b72d94cb3ef9ed5", "format": "mp3"},
        timeout=60,
    )
    if resp.status_code != 200:
        print(f"Fish API error: {resp.status_code} {resp.text[:200]}")
        return None
    path = os.path.join(OUT, "audio.mp3")
    with open(path, "wb") as f:
        f.write(resp.content)
    print(f"  Audio: {len(resp.content)//1024} KB")
    return path

def get_audio_duration(path):
    r = subprocess.run(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration",
         "-of", "default=noprint_wrappers=1:nokey=1", path],
        capture_output=True, text=True
    )
    return float(r.stdout.strip())

def write_texts():
    with open(os.path.join(OUT, "hl_justin.txt"), "w") as f:
        f.write("JUST IN")
    with open(os.path.join(OUT, "hl_0.txt"), "w") as f:
        f.write("Claude Mythos discovers")
    with open(os.path.join(OUT, "hl_1.txt"), "w") as f:
        f.write("new ways to attack")
    with open(os.path.join(OUT, "hl_2.txt"), "w") as f:
        f.write("cryptographic algorithms.")

def create_video(frame_path, duration):
    write_texts()
    font = "/tmp/Inter-SemiBold.ttf"
    out = os.path.join(OUT, "video.mp4")
    cmd = [
        "ffmpeg", "-y",
        "-loop", "1", "-i", frame_path,
        "-vf",
        "vignette=eval=frame,"
        f"drawbox=x=140:y=280:w=300:h=3:color=#b42828,"
        f"drawtext=textfile={OUT}/hl_justin.txt:fontfile={font}:fontsize=28:fontcolor=#b42828:x=140:y=300,"
        f"drawtext=textfile={OUT}/hl_0.txt:fontfile={font}:fontsize=36:fontcolor=#f0ece0:x=140:y=360,"
        f"drawtext=textfile={OUT}/hl_1.txt:fontfile={font}:fontsize=36:fontcolor=#f0ece0:x=140:y=410,"
        f"drawtext=textfile={OUT}/hl_2.txt:fontfile={font}:fontsize=36:fontcolor=#f0ece0:x=140:y=460",
        "-an", "-c:v", "libx264", "-preset", "medium", "-crf", "20",
        "-t", str(duration), "-pix_fmt", "yuv420p",
        out
    ]
    subprocess.run(cmd, check=True, capture_output=True)
    print(f"  video.mp4 ({duration:.0f}s)")
    return out

def main():
    print("Preparing image...")
    frame = prepare_image()

    print("Generating audio...")
    audio = generate_audio()
    if not audio:
        return

    dur = get_audio_duration(audio)
    print(f"  Duration: {dur:.1f}s")

    print("Creating video...")
    video = create_video(frame, dur)

    print("Adding audio...")
    final = os.path.join(OUT, "final.mp4")
    subprocess.run([
        "ffmpeg", "-y",
        "-i", video, "-i", audio,
        "-c:v", "copy", "-c:a", "aac", "-b:a", "192k",
        "-map", "0:v:0", "-map", "1:a:0",
        final
    ], check=True, capture_output=True)

    size = os.path.getsize(final) // 1024
    print(f"\nDone: {final} ({size} KB, {dur:.0f}s)")
    subprocess.run(["open", final])

if __name__ == "__main__":
    main()
