#!/usr/bin/env python3
"""Kimi K3 Potato Reel — single image, Forbes-style headline, Fish Audio voice."""

import os, subprocess, requests, json
from PIL import Image

OUT = "/tmp/kimi_reel"
os.makedirs(OUT, exist_ok=True)

IMG = "/tmp/kimi_k3_potato.jpg"
FONT = "/tmp/Inter-SemiBold.ttf"
W, H = 1080, 1920

FISH_API_KEY = "2decb955bc8b492ea5b94d75cee5d2e0"
FISH_VOICE_ID = "c25dbc8fddae4ce08b72d94cb3ef9ed5"

SEGMENTS = [
    {
        "headline": ["THE TINY KIMI K3", "Runs Locally on", "Potato Hardware"],
        "narration": "The tiny Kimi K3 that you can run locally on a potato hardware.",
    },
    {
        "headline": ["2.8 TRILLION", "Compressed to", "0.18 Billion"],
        "narration": "Compressed from 2.8 trillion to 0.18 billion parameters.",
    },
    {
        "headline": ["Only 0.10B", "Parameters", "Activated"],
        "narration": "Only 0.10 billion parameters activated, keeping the same architecture.",
    },
    {
        "headline": ["Same Architecture", "Same DNA", "Smaller Version"],
        "narration": "Same new attention design, same DNA, just a smaller version for testing.",
    },
    {
        "headline": ["Fits in 700MB", "Load on Normal", "Hardware Now"],
        "narration": "Now fits in 700 megabytes. You can load the new Kimi K3 architecture on normal hardware.",
    },
]

def prepare_image():
    img = Image.open(IMG).convert("RGB")
    ratio = max(W / img.width, H / img.height)
    nw, nh = int(img.width * ratio), int(img.height * ratio)
    img = img.resize((nw, nh), Image.LANCZOS)
    left, top = (nw - W) // 2, (nh - H) // 2
    img = img.crop((left, top, left + W, top + H))
    path = os.path.join(OUT, "frame.jpg")
    img.save(path, "JPEG", quality=92, exif=b"")
    return path

def write_headlines(i, headline):
    for j, line in enumerate(headline):
        with open(os.path.join(OUT, f"hl_{j}.txt"), "w") as f:
            f.write(line)
    with open(os.path.join(OUT, "source.txt"), "w") as f:
        f.write("KIMI K3 · Moonshot AI")

def generate_audio():
    full_narration = " ".join(s["narration"] for s in SEGMENTS)
    print(f"  Narration: {full_narration}")
    resp = requests.post(
        "https://api.fish.audio/v1/tts",
        headers={
            "Authorization": f"Bearer {FISH_API_KEY}",
            "Content-Type": "application/json",
            "model": "s2.1-pro-free",
        },
        json={
            "text": full_narration,
            "reference_id": FISH_VOICE_ID,
            "format": "mp3",
        },
        timeout=60,
    )
    if resp.status_code != 200:
        print(f"  Fish API error: {resp.status_code} {resp.text[:200]}")
        return None
    path = os.path.join(OUT, "audio.mp3")
    with open(path, "wb") as f:
        f.write(resp.content)
    print(f"  Audio: {len(resp.content)//1024} KB")
    return path

def get_audio_duration(path):
    result = subprocess.run(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration",
         "-of", "default=noprint_wrappers=1:nokey=1", path],
        capture_output=True, text=True
    )
    return float(result.stdout.strip())

def create_segments(frame_path, seg_duration):
    for i, seg in enumerate(SEGMENTS):
        write_headlines(i, seg["headline"])
        base = os.path.join(OUT, f"seg_{i:02d}")
        cmd = [
            "ffmpeg", "-y",
            "-loop", "1", "-i", frame_path,
            "-vf",
            f"colorchannelmixer=rr=0.7:gg=0.18:bb=0.15,"
            f"noise=alls=10:allf=t,"
            f"vignette=eval=frame,"
            f"drawbox=x=140:y=280:w=300:h=3:color=#b42828,"
            f"drawtext=textfile={OUT}/hl_0.txt:fontfile={FONT}:fontsize=32:fontcolor=#f0ece0:x=140:y=340,"
            f"drawtext=textfile={OUT}/hl_1.txt:fontfile={FONT}:fontsize=32:fontcolor=#f0ece0:x=140:y=384,"
            f"drawtext=textfile={OUT}/hl_2.txt:fontfile={FONT}:fontsize=32:fontcolor=#f0ece0:x=140:y=428,"
            f"drawtext=textfile={OUT}/source.txt:fontfile={FONT}:fontsize=15:fontcolor=#888888:x=(w-text_w)/2:y=1780",
            "-an", "-c:v", "libx264", "-preset", "medium", "-crf", "20",
            "-t", str(seg_duration), "-pix_fmt", "yuv420p",
            f"{base}.mp4"
        ]
        subprocess.run(cmd, check=True, capture_output=True)
        print(f"  seg_{i:02d}.mp4")

def main():
    print("Preparing image...")
    frame = prepare_image()

    print("\nGenerating audio...")
    audio = generate_audio()
    if not audio:
        return
    audio_dur = get_audio_duration(audio)
    print(f"  Audio duration: {audio_dur:.1f}s")

    seg_dur = audio_dur / len(SEGMENTS)
    print(f"  Segment duration: {seg_dur:.1f}s")

    print("\nCreating segments...")
    create_segments(frame, seg_dur)

    print("\nConcatenating...")
    concat_path = os.path.join(OUT, "concat.txt")
    with open(concat_path, "w") as f:
        for i in range(len(SEGMENTS)):
            f.write(f"file '{OUT}/seg_{i:02d}.mp4'\n")
    subprocess.run([
        "ffmpeg", "-y", "-f", "concat", "-safe", "0",
        "-i", concat_path, "-c", "copy",
        os.path.join(OUT, "video_only.mp4")
    ], check=True, capture_output=True)

    print("Adding audio...")
    total = audio_dur
    subprocess.run([
        "ffmpeg", "-y",
        "-i", os.path.join(OUT, "video_only.mp4"),
        "-i", audio,
        "-c:v", "copy", "-c:a", "aac", "-b:a", "192k",
        "-map", "0:v:0", "-map", "1:a:0",
        "-t", str(total),
        os.path.join(OUT, "final.mp4")
    ], check=True, capture_output=True)

    final = os.path.join(OUT, "final.mp4")
    size = os.path.getsize(final) // 1024
    print(f"\nDone: {final} ({size} KB, {total:.0f}s)")
    subprocess.run(["open", OUT])

if __name__ == "__main__":
    main()
