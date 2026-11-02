#!/usr/bin/env python3
"""Authorized, resumable AtoBeach country API snapshot using Scrapling.

Run with an isolated Python environment, for example:
  uv run --with 'scrapling[fetchers]' python scripts/crawl-atobeach-countries.py \
    --authorized --output /tmp/atobeach-countries.json
"""

import argparse
import asyncio
import hashlib
import json
import os
import random
from datetime import datetime, timezone
from pathlib import Path

from scrapling.fetchers import AsyncFetcher, StealthyFetcher


BASE_URL = "https://atobeach.com"
LIST_URL = f"{BASE_URL}/api/countries/"


def parse_args():
    parser = argparse.ArgumentParser()
    parser.add_argument("--authorized", action="store_true", help="Confirm permission from the site owner.")
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--interval", type=float, default=1.0)
    return parser.parse_args()


def decode_json(page):
    return json.loads(page.body.decode(page.encoding, errors="replace"))


def write_document(output_path, records):
    rows = sorted(records.values(), key=lambda record: record["payload"]["slug"])
    document = {
        "schemaVersion": 1,
        "provider": "atobeach",
        "listOriginUrl": LIST_URL,
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "recordCount": len(rows),
        "records": rows,
    }
    temporary_path = output_path.with_suffix(f"{output_path.suffix}.tmp")
    temporary_path.write_text(json.dumps(document, ensure_ascii=False, indent=2), encoding="utf-8")
    os.replace(temporary_path, output_path)


async def fetch_detail(slug):
    origin_url = f"{BASE_URL}/api/countries/{slug}/"
    for attempt in range(6):
        page = await AsyncFetcher.get(
            origin_url,
            impersonate="chrome",
            stealthy_headers=True,
            timeout=30,
        )
        if page.status == 429:
            await asyncio.sleep(min(90, 15 * (attempt + 1)))
            continue
        if page.status != 200:
            if attempt == 5:
                raise RuntimeError(f"{origin_url}: HTTP {page.status}")
            await asyncio.sleep(min(30, 2**attempt))
            continue
        payload = decode_json(page)
        canonical = json.dumps(payload, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
        return {
            "provider": "atobeach",
            "sourceRecordId": str(payload.get("id") or slug),
            "originUrl": origin_url,
            "fetchedAt": datetime.now(timezone.utc).isoformat(),
            "payloadHash": hashlib.sha256(canonical.encode("utf-8")).hexdigest(),
            "payload": payload,
        }
    raise RuntimeError(f"Unable to fetch {origin_url}")


async def main():
    args = parse_args()
    if not args.authorized:
        raise SystemExit("Refusing to crawl API routes without --authorized.")
    args.output.parent.mkdir(parents=True, exist_ok=True)

    list_page = await StealthyFetcher.async_fetch(
        LIST_URL,
        headless=True,
        disable_resources=True,
        network_idle=True,
    )
    if list_page.status != 200:
        raise RuntimeError(f"Country list: HTTP {list_page.status}")
    slugs = [row["slug"] for row in decode_json(list_page)]
    records = {}
    if args.output.exists():
        checkpoint = json.loads(args.output.read_text(encoding="utf-8"))
        records = {record["payload"]["slug"]: record for record in checkpoint.get("records", [])}

    for index, slug in enumerate(slugs, start=1):
        if slug not in records:
            records[slug] = await fetch_detail(slug)
            write_document(args.output, records)
            await asyncio.sleep(args.interval + random.uniform(0, 0.2))
        if index % 20 == 0:
            print(json.dumps({"progress": index, "saved": len(records)}), flush=True)

    write_document(args.output, records)
    print(json.dumps({
        "output": str(args.output),
        "recordCount": len(records),
        "uniqueCountryCodes": len({record["payload"]["code"] for record in records.values()}),
    }))


if __name__ == "__main__":
    asyncio.run(main())
