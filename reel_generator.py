#!/usr/bin/env python3
"""Generic reel generator — single image 1080x1920, segmented headlines, Fish Audio TTS.

Builds on the pattern from create_kimi_reel.py / create_trezor_reel.py.
"""

import os, subprocess
from PIL import Image

FISH_API_URL = "https://api.fish.audio/v1/tts"
FISH_API_KEY = os.environ.get("FISH_API_KEY", "2decb955bc8b492ea5b94d75cee5d2e0")
DEFAULT_VOICE_ID = os.environ.get("FISH_VOICE_ID",
                                  "e5f3047b09ab468da84ca21e3f511680")
FONT = "/tmp/Inter-SemiBold.ttf"
W, H = 1080, 1920


def prepare_frame(img_path, out_path):
    img = Image.open(img_path).convert("RGB")
    ratio = max(W / img.width, H / img.height)
    nw, nh = int(img.width * ratio), int(img.height * ratio)
    img = img.resize((nw, nh), Image.LANCZOS)
    left, top = (nw - W) // 2, (nh - H) // 2
    img = img.crop((left, top, left + W, top + H))
    img.save(out_path, "JPEG", quality=92, exif=b"")
    return out_path


def generate_audio(narration, out_path, voice_id=DEFAULT_VOICE_ID):
    import requests
    resp = requests.post(
        FISH_API_URL,
        headers={
            "Authorization": f"Bearer {FISH_API_KEY}",
            "Content-Type": "application/json",
            "model": "s2.1-pro-free",
        },
        json={"text": narration, "reference_id": voice_id, "format": "mp3"},
        timeout=90,
    )
    if resp.status_code != 200:
        raise RuntimeError(f"Fish API error: {resp.status_code} {resp.text[:200]}")
    with open(out_path, "wb") as f:
        f.write(resp.content)
    return out_path


def _audio_duration(path):
    r = subprocess.run(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration",
         "-of", "default=noprint_wrappers=1:nokey=1", path],
        capture_output=True, text=True,
    )
    return float(r.stdout.strip())


def _write_text(path, text):
    with open(path, "w") as f:
        f.write(text)


def create_segments(frame_path, out_dir, segments, source_label, seg_duration):
    paths = []
    for i, seg in enumerate(segments):
        headline = seg["headline"]
        if isinstance(headline, str):
            headline = [headline, "", ""]
        for j in range(3):
            _write_text(os.path.join(out_dir, f"hl_{j}.txt"), headline[j] if j < len(headline) else "")
        _write_text(os.path.join(out_dir, "source.txt"), source_label)
        base = os.path.join(out_dir, f"seg_{i:02d}")
        cmd = [
            "ffmpeg", "-y",
            "-loop", "1", "-i", frame_path,
            "-vf",
            f"hue=s=0,"
            f"eq=contrast=1.2:brightness=0.01:gamma=0.95,"
            f"noise=alls=10:allf=t,"
            f"vignette=eval=frame,"
            f"drawbox=x=100:y=245:w=880:h=230:color=black@0.62:t=fill,"
            f"drawbox=x=0:y=1755:w=1080:h=130:color=black@0.7:t=fill,"
            f"drawbox=x=140:y=280:w=300:h=3:color=#d0d0d0,"
            f"drawtext=textfile={out_dir}/hl_0.txt:fontfile={FONT}:fontsize=32:fontcolor=#f0ece0:shadowcolor=black@0.95:shadowx=2:shadowy=2:x=140:y=340,"
            f"drawtext=textfile={out_dir}/hl_1.txt:fontfile={FONT}:fontsize=32:fontcolor=#f0ece0:shadowcolor=black@0.95:shadowx=2:shadowy=2:x=140:y=384,"
            f"drawtext=textfile={out_dir}/hl_2.txt:fontfile={FONT}:fontsize=32:fontcolor=#f0ece0:shadowcolor=black@0.95:shadowx=2:shadowy=2:x=140:y=428,"
            f"drawtext=textfile={out_dir}/source.txt:fontfile={FONT}:fontsize=15:fontcolor=#aaaaaa:shadowcolor=black@0.95:shadowx=1:shadowy=1:x=(w-text_w)/2:y=1780",
            "-an", "-c:v", "libx264", "-preset", "medium", "-crf", "24",
            "-t", str(seg_duration), "-pix_fmt", "yuv420p",
            f"{base}.mp4",
        ]
        subprocess.run(cmd, check=True, capture_output=True)
        paths.append(f"{base}.mp4")
    return paths


def generate_reel(img_path, segments, source_label, out_dir,
                  voice_id=DEFAULT_VOICE_ID):
    """Build a full reel. Returns path to final.mp4."""
    os.makedirs(out_dir, exist_ok=True)
    frame = prepare_frame(img_path, os.path.join(out_dir, "frame.jpg"))

    narration = " ".join(s["narration"] for s in segments)
    audio = generate_audio(narration, os.path.join(out_dir, "audio.mp3"), voice_id)
    audio_dur = _audio_duration(audio)
    seg_dur = audio_dur / len(segments)

    seg_paths = create_segments(frame, out_dir, segments, source_label, seg_dur)

    concat_path = os.path.join(out_dir, "concat.txt")
    with open(concat_path, "w") as f:
        for p in seg_paths:
            f.write(f"file '{p}'\n")
    video_only = os.path.join(out_dir, "video_only.mp4")
    subprocess.run([
        "ffmpeg", "-y", "-f", "concat", "-safe", "0",
        "-i", concat_path, "-c", "copy", video_only,
    ], check=True, capture_output=True)

    final = os.path.join(out_dir, "final.mp4")
    subprocess.run([
        "ffmpeg", "-y",
        "-i", video_only, "-i", audio,
        "-c:v", "copy", "-c:a", "aac", "-b:a", "192k",
        "-map", "0:v:0", "-map", "1:a:0",
        "-t", str(audio_dur),
        final,
    ], check=True, capture_output=True)
    return final


if __name__ == "__main__":
    import json, sys
    segments = [
        {"headline": ["TESTE DO", "GERADOR DE", "REEL"], "narration": "Teste do gerador de reel genérico."},
        {"headline": ["FUNCIONOU", "EM 2", "SEGUNDOS"], "narration": "Funcionou em dois segundos."},
    ]
    out = generate_reel(sys.argv[1], segments, "TESTE · VENICE")
    print(out)
