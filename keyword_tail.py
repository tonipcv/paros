#!/usr/bin/env python3
"""Busca palavras-chave de cauda longa com volume real via DataForSEO API.

Uso:
    python3 keyword_tail.py "treino em casa" "treino de força" [--max 200] [--out /tmp/keywords.csv]
"""

import argparse
import base64
import csv
import json
import os
import sys
import time

import urllib.request

API_URL = "https://api.dataforseo.com"
LOGIN = "toni@ktsgrupo.com"
PASSWORD = "60eb4e8cd0f31af2"
LOCATION_BR = 2076
LANG_PT = "pt"


def api_request(path: str, payload: list) -> dict:
    auth = base64.b64encode(f"{LOGIN}:{PASSWORD}".encode()).decode()
    req = urllib.request.Request(
        API_URL + path,
        data=json.dumps(payload).encode(),
        headers={
            "Authorization": f"Basic {auth}",
            "Content-Type": "application/json",
        },
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=60) as resp:
        return json.loads(resp.read().decode())


def keyword_ideas(seed: str, limit: int = 100) -> list[dict]:
    payload = [{
        "keywords": [seed],
        "location_code": LOCATION_BR,
        "language_code": LANG_PT,
        "limit": limit,
        "include_seed_keyword": True,
    }]
    data = api_request("/v3/dataforseo_labs/google/keyword_ideas/live", payload)
    if data.get("status_code") != 20000:
        raise RuntimeError(f"Erro na API: {data.get('status_message')}")
    items = data["tasks"][0]["result"][0].get("items", [])
    out = []
    for it in items:
        metrics = (it.get("keyword_properties") or {}).get("google_search_intent", {})
        kp = it.get("keyword_properties") or {}
        se = (it.get("search_volume") or 0)
        cpc = (it.get("cpc") or 0)
        comp = (it.get("competition") or 0)
        comp_lvl = (it.get("competition_level") or "")
        out.append({
            "keyword": it.get("keyword", ""),
            "volume": se,
            "cpc": round(cpc, 2) if cpc else 0,
            "competition": comp_lvl,
            "intent": kp.get("intent_info", {}).get("main_intent", ""),
        })
    return out


def main():
    ap = argparse.ArgumentParser(description="Cauda longa com volume via DataForSEO")
    ap.add_argument("seeds", nargs="+", help="Palavras-semente do nicho")
    ap.add_argument("--max", type=int, default=100, help="Máx de ideias por semente")
    ap.add_argument("--out", default="/tmp/keywords_tail.csv", help="Arquivo CSV de saída")
    args = ap.parse_args()

    all_rows = {}
    for seed in args.seeds:
        print(f"Buscando: {seed} ...", flush=True)
        try:
            rows = keyword_ideas(seed, args.max)
        except Exception as e:
            print(f"  ERRO: {e}", file=sys.stderr)
            continue
        print(f"  {len(rows)} ideias encontradas")
        for r in rows:
            words = len(r["keyword"].split())
            if words >= 3:
                all_rows[r["keyword"]] = r
        time.sleep(1.5)

    rows = sorted(all_rows.values(), key=lambda r: r["volume"], reverse=True)
    if not rows:
        print("Nenhuma palavra encontrada.")
        sys.exit(1)

    with open(args.out, "w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=["keyword", "volume", "cpc", "competition", "intent"])
        w.writeheader()
        w.writerows(rows)

    total_vol = sum(r["volume"] for r in rows)
    print(f"\n{len(rows)} palavras de cauda longa -> {args.out}")
    print(f"Volume total estimado: {total_vol:,}")
    print("\nTop 15 por volume:")
    for r in rows[:15]:
        print(f"  {r['volume']:>8,}  {r['keyword']}")


if __name__ == "__main__":
    main()
