#!/usr/bin/env python3
"""Instagram Carousel — Libre Baskerville + Inter, premium Forbes style."""

import os, subprocess, glob
from PIL import Image, ImageDraw, ImageFont, ImageFilter

W, H = 1080, 1350

# Fonts
libre_files = glob.glob("/tmp/LibreBaskerville*.ttf") + glob.glob("/tmp/kmKW*.ttf") + glob.glob("/tmp/kmKU*.ttf")
FONT_TITLE = libre_files[0] if libre_files else "/tmp/LibreBaskerville-Regular.ttf"
FONT_BODY = "/tmp/Inter-SemiBold.ttf"

BG = "#000000"
WHITE = "#ffffff"
MUTED = "#c4c4c4"
DARK_GRAY = "#2a2a2a"

LOGO_PATH = "/Users/albertalves/Downloads/logo-x.png"


def create_premium_slide(photo_path, title_lines, body_lines, output_path, slide_num=None, title_size=62, body_size=30):
    """Premium slide with image on top, text below."""

    img = Image.new("RGB", (W, H), BG)
    draw = ImageDraw.Draw(img)

    img_area_h = int(H * 0.50)
    try:
        photo = Image.open(photo_path).convert("RGB")
        ratio = max(W / photo.width, img_area_h / photo.height)
        pw, ph = int(photo.width * ratio), int(photo.height * ratio)
        photo = photo.resize((pw, ph), Image.LANCZOS)
        photo = photo.filter(ImageFilter.SHARPEN)
        left = (pw - W) // 2
        photo = photo.crop((left, 0, left + W, img_area_h))

        overlay = Image.new("RGBA", (W, 160), (0, 0, 0, 0))
        odraw = ImageDraw.Draw(overlay)
        for y in range(160):
            alpha = int(240 * y / 160)
            odraw.line([(0, y), (W, y)], fill=(0, 0, 0, alpha))
        img.paste(photo, (0, 0))
        img.paste(overlay, (0, img_area_h - 160), overlay)
    except Exception as e:
        print(f"  Image error: {e}")

    top = img_area_h + 90
    px = 80

    font_title = ImageFont.truetype(FONT_TITLE, title_size)
    ty = top + 10
    for line in title_lines:
        draw.text((px, ty), line, fill=WHITE, font=font_title)
        ty += int(title_size * 1.25)

    ty += 24
    font_body = ImageFont.truetype(FONT_BODY, body_size)
    body_line_h = int(body_size * 1.4)
    for line in body_lines:
        if line == "":
            ty += 14
            continue
        draw.text((px, ty), line, fill=WHITE, font=font_body)
        ty += body_line_h

    try:
        logo = Image.open(LOGO_PATH).convert("RGBA")
        logo_h = 48
        ratio = logo_h / logo.height
        logo_w = int(logo.width * ratio)
        logo = logo.resize((logo_w, logo_h), Image.LANCZOS)
        logo = logo.convert("L").convert("RGBA")
        lx = W - px - logo_w
        ly = H - 60
        img.paste(logo, (lx, ly), logo)
    except:
        font_footer = ImageFont.truetype(FONT_BODY, 16)
        draw.text((W - px - 80, H - 58), "logo-x", fill=MUTED, font=font_footer)

    if slide_num:
        font_num = ImageFont.truetype(FONT_BODY, 16)
        draw.text((px, H - 58), slide_num, fill=DARK_GRAY, font=font_num)

    img.save(output_path, "JPEG", quality=95, exif=b"")
    print(f"  {os.path.basename(output_path)} ({os.path.getsize(output_path)//1024} KB)")


def create_side_by_side_slide(photo_left, photo_right, title_lines, body_lines, output_path, slide_num=None):
    """Slide with two images side by side, text below."""

    img = Image.new("RGB", (W, H), BG)
    draw = ImageDraw.Draw(img)

    img_area_h = int(H * 0.50)
    half_w = W // 2

    try:
        pl = Image.open(photo_left).convert("RGB")
        ratio = max(half_w / pl.width, img_area_h / pl.height)
        pw, ph = int(pl.width * ratio), int(pl.height * ratio)
        pl = pl.resize((pw, ph), Image.LANCZOS)
        pl = pl.filter(ImageFilter.SHARPEN)
        top_l = (ph - img_area_h) // 2
        pl = pl.crop((0, max(0, top_l), half_w, min(ph, max(0, top_l) + img_area_h)))
        pl = pl.resize((half_w, img_area_h), Image.LANCZOS)
    except Exception as e:
        print(f"  Left image error: {e}")
        pl = Image.new("RGB", (half_w, img_area_h), "#111111")

    try:
        pr = Image.open(photo_right).convert("RGB")
        ratio = max(half_w / pr.width, img_area_h / pr.height)
        pw, ph = int(pr.width * ratio), int(pr.height * ratio)
        pr = pr.resize((pw, ph), Image.LANCZOS)
        pr = pr.filter(ImageFilter.SHARPEN)
        top_r = (ph - img_area_h) // 2
        pr = pr.crop((0, max(0, top_r), half_w, min(ph, max(0, top_r) + img_area_h)))
        pr = pr.resize((half_w, img_area_h), Image.LANCZOS)
    except Exception as e:
        print(f"  Right image error: {e}")
        pr = Image.new("RGB", (half_w, img_area_h), "#111111")

    img.paste(pl, (0, 0))
    img.paste(pr, (half_w, 0))

    # Divider line (subtle)
    draw.line([(half_w, 0), (half_w, img_area_h)], fill="#333333", width=2)

    # Gradient fade on each side
    for side_x in [0, half_w]:
        overlay = Image.new("RGBA", (half_w, 160), (0, 0, 0, 0))
        odraw = ImageDraw.Draw(overlay)
        for y in range(160):
            alpha = int(240 * y / 160)
            odraw.line([(0, y), (half_w, y)], fill=(0, 0, 0, alpha))
        img.paste(overlay, (side_x, img_area_h - 160), overlay)

    # Labels on images
    font_label = ImageFont.truetype(FONT_BODY, 22)
    draw.text((30, 20), "KIMI K3", fill=WHITE, font=font_label)
    draw.text((half_w + 30, 20), "GPT 5.6 SOL", fill=WHITE, font=font_label)

    # Text area
    top = img_area_h + 70
    px = 80

    font_title = ImageFont.truetype(FONT_TITLE, 56)
    ty = top + 10
    for line in title_lines:
        draw.text((px, ty), line, fill=WHITE, font=font_title)
        ty += 72

    ty += 20
    font_body = ImageFont.truetype(FONT_BODY, 32)
    for line in body_lines:
        if line == "":
            ty += 16
            continue
        draw.text((px, ty), line, fill=WHITE, font=font_body)
        ty += 42

    try:
        logo = Image.open(LOGO_PATH).convert("RGBA")
        logo_h = 44
        ratio = logo_h / logo.height
        logo_w = int(logo.width * ratio)
        logo = logo.resize((logo_w, logo_h), Image.LANCZOS)
        logo = logo.convert("L").convert("RGBA")
        lx = W - px - logo_w
        ly = H - 56
        img.paste(logo, (lx, ly), logo)
    except:
        font_footer = ImageFont.truetype(FONT_BODY, 16)
        draw.text((W - px - 80, H - 54), "logo-x", fill=MUTED, font=font_footer)

    if slide_num:
        font_num = ImageFont.truetype(FONT_BODY, 16)
        draw.text((px, H - 56), slide_num, fill=DARK_GRAY, font=font_num)

    img.save(output_path, "JPEG", quality=95, exif=b"")
    print(f"  {os.path.basename(output_path)} ({os.path.getsize(output_path)//1024} KB)")


if __name__ == "__main__":
    from PIL import ImageDraw, ImageFont

    OUT = "/tmp/venice-slide"
    os.makedirs(OUT, exist_ok=True)

    IMG_NEWS_1 = "/tmp/carousel_npm_1.jpg"
    IMG_NEWS_2 = "/tmp/carousel_npm_2.jpg"

    # ─── Slide 1/5: Cover ───
    create_premium_slide(
        photo_path=IMG_NEWS_1,
        title_lines=["THE NPM WORM", "THAT STOLE", "EVERY SECRET"],
        body_lines=[
            "868 packages compromised. Over 2 billion",
            "monthly installs at risk.",
            "Shai-Hulud is back.",
        ],
        output_path=f"{OUT}/slide_01.jpg",
        slide_num="1/5",
        title_size=62,
        body_size=30,
    )

    # ─── Slide 2/5: How it started ───
    create_premium_slide(
        photo_path=IMG_NEWS_2,
        title_lines=["ONE ACCOUNT,", "WAS ALL IT TOOK"],
        body_lines=[
            "Attackers compromised the GitHub account",
            "of the maintainer behind keyv, a library",
            "with 127 million weekly npm downloads.",
        ],
        output_path=f"{OUT}/slide_02.jpg",
        slide_num="2/5",
        title_size=58,
        body_size=30,
    )

    # ─── Slide 3/5: The preinstall hook ───
    create_premium_slide(
        photo_path=IMG_NEWS_1,
        title_lines=["THE PREINSTALL", "HOOK"],
        body_lines=[
            "A preinstall hook fires on npm install",
            "and drops a credential-stealing worm",
            "before you even notice.",
        ],
        output_path=f"{OUT}/slide_03.jpg",
        slide_num="3/5",
        title_size=58,
        body_size=30,
    )

    # ─── Slide 4/5: What it steals ───
    create_premium_slide(
        photo_path=IMG_NEWS_2,
        title_lines=["EVERY SECRET", "YOU OWN"],
        body_lines=[
            "It sweeps npm, GitHub, AWS, Kubernetes",
            "and Vault secrets. Then it spreads",
            "to more maintainers and packages.",
        ],
        output_path=f"{OUT}/slide_04.jpg",
        slide_num="4/5",
        title_size=62,
        body_size=30,
    )

    # ─── Slide 5/5: What to do ───
    create_premium_slide(
        photo_path=IMG_NEWS_1,
        title_lines=["CHECK YOUR", "DEPENDENCIES"],
        body_lines=[
            "Audit your lockfiles. Rotate npm, GitHub,",
            "AWS and Vault secrets now. Your supply",
            "chain may already be watching you.",
        ],
        output_path=f"{OUT}/slide_05.jpg",
        slide_num="5/5",
        title_size=62,
        body_size=30,
    )

    print(f"\n  Slide criado em {OUT}/")
    subprocess.run(["open", OUT])
