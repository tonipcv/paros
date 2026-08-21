#!/usr/bin/env python3
"""AI content layer — Firecrawl (news) + DeepSeek (copywriting) for the Telegram bot."""

import json, os, re
from urllib.parse import urlparse
import requests

DEEPSEEK_URL = "https://api.deepseek.com/chat/completions"
FIRECRAWL_URL = "https://api.firecrawl.dev/v1/search"
FIRECRAWL_SCRAPE_URL = "https://api.firecrawl.dev/v1/scrape"

FALLBACK_KEY = "sk-76da5f4ba4714854be8880541255d427"
FALLBACK_FIRECRAWL = "fc-5ca1a7df788b46f489f6aefd4c1c1916"


def deepseek_key():
    return os.environ.get("DEEPSEEK_API_KEY", FALLBACK_KEY)


def firecrawl_key():
    return os.environ.get("FIRECRAWL_API_KEY", FALLBACK_FIRECRAWL)


def search_news(topic, limit=3):
    """Search news for a topic via Firecrawl. Returns list of dicts."""
    try:
        r = requests.post(
            FIRECRAWL_URL,
            headers={"Authorization": f"Bearer {firecrawl_key()}"},
            json={"query": topic, "limit": limit, "lang": "en"},
            timeout=60,
        )
        data = r.json()
        if not data.get("success"):
            return []
        out = []
        for item in data.get("data", []):
            if not item.get("title"):
                continue
            meta = item.get("metadata", {}) or {}
            out.append({
                "title": item.get("title", ""),
                "url": item.get("url", "") or meta.get("url", ""),
                "description": item.get("description", "") or meta.get("description", ""),
                "image": item.get("image") or meta.get("ogImage"),
            })
        return out
    except Exception:
        return []


def _chat(system, user):
    payload = {
        "model": os.environ.get("DEEPSEEK_MODEL", "deepseek-chat"),
        "messages": [
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ],
        "temperature": 0.7,
        "response_format": {"type": "json_object"},
    }
    try:
        r = requests.post(
            DEEPSEEK_URL,
            headers={
                "Authorization": f"Bearer {deepseek_key()}",
                "Content-Type": "application/json",
            },
            json=payload,
            timeout=120,
        )
        r.raise_for_status()
        content = r.json()["choices"][0]["message"]["content"]
        return json.loads(content)
    except Exception:
        payload.pop("response_format", None)
        r = requests.post(
            DEEPSEEK_URL,
            headers={
                "Authorization": f"Bearer {deepseek_key()}",
                "Content-Type": "application/json",
            },
            json=payload,
            timeout=120,
        )
        content = r.json()["choices"][0]["message"]["content"]
        match = re.search(r"\{.*\}", content, re.DOTALL)
        if not match:
            raise
        return json.loads(match.group(0))


def _news_context(news):
    if not news:
        return "(no news found — use general knowledge)"
    return "\n".join(
        f"- {n['title']}: {n['description'][:400]}" for n in news[:3]
    )


def carousel_plan(topic, news):
    """Return 5 slides: [{"title_lines": [...], "body_lines": [...]}]."""
    system = (
        "You are a premium Forbes-style crypto/tech news copywriter with a "
        "background in security engineering. ALWAYS write in ENGLISH. "
        "Generate valid JSON. Rules: titles in ALL CAPS, 2-3 lines of up to "
        "28 characters each; body in 1-2 short lines of up to 60 characters; "
        "NEVER use dashes (—), multiple hyphens or emojis; serious and direct "
        "tone. Content requirements: every slide must carry CONCRETE "
        "TECHNICAL DETAILS from the context (CVE IDs, exact numbers, versions, "
        "percentages, dollar amounts, dates, names of vendors/tools/exploit "
        "chains) — never generic phrases. Cover must be provocative with a "
        "curiosity gap, like a tabloid for engineers. Return JSON only: "
        '{"cover_title": "...", "slides": [{"title_lines": [...], "body_lines": [...]}]}'
    )
    user = (
        f"Topic: {topic}\n\nContext news (use ONLY facts from here):\n{_news_context(news)}\n\n"
        "Create a 5-slide carousel: 1 provocative cover with a curiosity gap, "
        "2 how it started (with dates/actors), 3 the technical mechanism "
        "(vulnerability, attack chain, exploit detail), 4 impact with hard "
        "numbers, 5 what to do now (concrete technical actions)."
    )
    plan = _chat(system, user)
    slides = plan.get("slides", [])
    if len(slides) < 5:
        raise ValueError("DeepSeek retornou menos de 5 slides")
    return {"cover_title": plan.get("cover_title", topic.upper()), "slides": slides[:5]}


def reel_plan(topic, news):
    """Return 5-7 segments: [{"headline": [3 lines], "narration": "..."}]."""
    system = (
        "You are a breaking-news reel scriptwriter with a security/tech "
        "engineering background. ALWAYS write in ENGLISH. Generate valid JSON. "
        "Rules: each headline has 3 lines of up to 30 characters in ALL CAPS; "
        "each narration is ONE short spoken sentence (spell out numbers), no "
        "emojis, no dashes. Content requirements: every segment must carry "
        "CONCRETE TECHNICAL DETAILS from the context (CVE IDs, versions, "
        "numbers, percentages, dates, tool/vendor names) — never generic "
        "phrases. Opening segment must hook hard with urgency or a shocking "
        "fact. Return JSON only: {\"source_label\": \"...\", \"segments\": "
        '[{"headline": [...], "narration": "..."}]}'
    )
    user = (
        f"Topic: {topic}\n\nContext news (use ONLY facts from here):\n{_news_context(news)}\n\n"
        "Create 6 segments: hard-hitting hook, context (dates/actors), "
        "technical detail (vulnerability/attack chain), hard numbers, "
        "alert/risk, conclusion with a concrete action tip."
    )
    plan = _chat(system, user)
    segments = plan.get("segments", [])
    if len(segments) < 3:
        raise ValueError("DeepSeek retornou poucos segmentos")
    return {
        "source_label": plan.get("source_label", topic.upper()),
        "segments": segments[:7],
    }


def scrape_article(url):
    """Scrape an article via Firecrawl. Returns title, content, images, source."""
    try:
        r = requests.post(
            FIRECRAWL_SCRAPE_URL,
            headers={"Authorization": f"Bearer {firecrawl_key()}"},
            json={"url": url, "formats": ["markdown"]},
            timeout=120,
        )
        data = r.json()
        if not data.get("success"):
            return None
        d = data.get("data", {})
        meta = d.get("metadata", {}) or {}
        md = d.get("markdown", "") or ""
        images = []
        logo_re = re.compile(r"(logo|icon|favicon|badge|sprite|watermark|avatar|gravatar)", re.I)
        for key in ("ogImage", "twitterImage"):
            v = meta.get(key)
            if v and v.startswith("http") and not v.lower().endswith(".svg") \
               and not logo_re.search(v):
                images.append(v)
        for m in re.findall(r"!\[[^\]]*\]\((https?://[^)\s]+)\)", md):
            if m.startswith("http") and not m.lower().endswith(".svg") \
               and not logo_re.search(m) and m not in images and len(images) < 3:
                images.append(m)
        return {
            "title": meta.get("title", "") or d.get("title", ""),
            "content": md[:12000],
            "images": images,
            "source_label": urlparse(url).netloc.replace("www.", "").upper(),
        }
    except Exception:
        return None


def article_plan(title, content):
    """Deep research plan from an article: caption + carousel slides + reel segments."""
    system = (
        "You are a premium Forbes-style crypto/tech news copywriter with a "
        "security/tech engineering background. ALWAYS write in ENGLISH. "
        "Generate valid JSON with EXACTLY these keys: "
        '{"caption": "...", "cover_title": "...", "slides": [...], '
        '"segments": [...], "source_label": "..."}. '
        "Rules: caption = editorial English caption up to 1200 characters "
        "with 3-5 hashtags at the end, no emojis, no dashes (—); "
        "cover_title = short ALL CAPS title with a curiosity gap; slides = 5 "
        'objects with "title_lines" (2-3 ALL CAPS lines of up to 28 chars) '
        'and "body_lines" (1-2 lines of up to 60 chars); segments = 6 '
        'objects with "headline" (3 ALL CAPS lines of up to 30 chars) and '
        '"narration" (one short sentence, numbers spelled out). '
        "Content requirements: everything must use CONCRETE TECHNICAL DETAILS "
        "from the article (CVE IDs, versions, numbers, percentages, dollar "
        "amounts, dates, vendor/tool names, exploit mechanics) — never "
        "generic phrases; cover/caption must hook with urgency or a shocking "
        "fact."
    )
    user = (
        f"Title: {title}\n\nArticle (use ONLY facts from here):\n{content[:12000]}"
    )
    plan = _chat(system, user)
    if len(plan.get("slides", [])) < 5:
        raise ValueError("DeepSeek retornou menos de 5 slides")
    return plan


def daily_summary(topic):
    """Short news digest for the daily 8:00 notification."""
    news = search_news(topic, limit=4)
    system = (
        "You summarize macro/crypto news in ENGLISH with hard data. "
        "Generate valid JSON: "
        '{"text": "up to 800 characters, 3-5 bullet points with specific '
        'numbers, prices, percentages and technical facts, no emojis, no dashes"}'
    )
    user = f"Notícias:\n{_news_context(news)}"
    plan = _chat(system, user)
    return plan.get("text", "(sem resumo disponível)")


if __name__ == "__main__":
    import sys
    topic = sys.argv[1] if len(sys.argv) > 1 else "bitcoin macro"
    news = search_news(topic)
    print(f"{len(news)} notícias encontradas")
    for n in news[:3]:
        print(f"  - {n['title'][:80]}")
    plan = carousel_plan(topic, news)
    print(json.dumps(plan, ensure_ascii=False, indent=2)[:2000])
