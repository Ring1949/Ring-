#!/usr/bin/env python3
"""Import local photography archives into the public Supabase-backed portfolio.

The importer never edits source files. It creates web previews, extracts EXIF
metadata, uploads with deterministic paths, and records progress so interrupted
runs can resume without duplicating media rows.
"""

from __future__ import annotations

import argparse
import concurrent.futures
import datetime as dt
import hashlib
import json
import mimetypes
import os
import re
import shutil
import sys
import threading
import time
import urllib.error
import urllib.parse
import urllib.request
from collections import Counter, defaultdict
from dataclasses import dataclass, asdict
from fractions import Fraction
from pathlib import Path
from typing import Any

from PIL import ExifTags, Image, ImageOps


PHOTO_ROOT = Path(r"D:\Ring的个人文档\摄影作品储存库")
PRODUCT_ROOT = Path(r"D:\Ring的个人文档\产品摄影储藏室")
IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp", ".arw", ".cr2"}
VIDEO_EXTENSIONS = {".mp4"}
GENERIC_STEM = re.compile(
    r"^(?:img|dsc|dji|pxl|6t3a|image|photo|作品|图片|图|未命名|screenshot|截图)?[\s_-]*[0-9a-f_-]*$",
    re.IGNORECASE,
)
EXIF = {name: tag for tag, name in ExifTags.TAGS.items()}
PRINT_LOCK = threading.Lock()
DIGEST_LOCKS: defaultdict[str, threading.Lock] = defaultdict(threading.Lock)


PRODUCT_GROUPS = [
    ("佛像与香炉", "product-buddha-incense", ["佛像", "香炉"], "佛像,香炉,产品摄影,静物"),
    ("水晶能量柱", "product-energy-columns", ["能量柱"], "能量柱,水晶,产品摄影,静物"),
    ("珠宝耳饰", "product-earrings", ["耳饰", "耳环", "耳钉"], "耳饰,耳环,珠宝,产品摄影"),
    ("珠宝项链与吊坠", "product-necklaces", ["项链", "吊坠"], "项链,吊坠,珠宝,产品摄影"),
    ("珠宝手串与手镯", "product-bracelets", ["手串", "手镯"], "手串,手镯,珠宝,产品摄影"),
    ("珠宝戒指", "product-rings", ["戒指"], "戒指,珠宝,产品摄影,商业视觉"),
    ("水晶矿标", "product-minerals", ["矿标", "晶矿"], "矿标,水晶,产品摄影,静物"),
    ("水晶摆件", "product-ornaments", ["摆件"], "摆件,水晶,产品摄影,静物"),
    ("日本中古珠宝", "product-vintage-jewelry", ["日本中古", "中古"], "中古珠宝,产品摄影,商业视觉"),
    ("胸针与袖扣", "product-brooch-cufflinks", ["胸针", "袖扣"], "胸针,袖扣,珠宝,产品摄影"),
]


@dataclass
class Task:
    source: str
    root_kind: str
    relative: str
    category_slug: str
    collection_slug: str
    project_title: str
    project_slug: str
    year: str
    title: str
    description: str
    tags: str
    sequence: int = 0


def log(message: str) -> None:
    with PRINT_LOCK:
        print(message, flush=True)


def parse_env(path: Path) -> dict[str, str]:
    values: dict[str, str] = {}
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        value = value.strip()
        if len(value) >= 2 and value[0] == value[-1] and value[0] in {'"', "'"}:
            value = value[1:-1]
        values[key.strip()] = value.replace(r"\n", "\n")
    return values


def clean_shoot_name(name: str) -> str:
    name = re.sub(r"^20\d{6}", "", name)
    name = re.sub(r"\s*刘铮摄\s*$", "", name)
    return name.strip(" _-") or "摄影作品"


def clean_label(value: str) -> str:
    value = re.sub(r"\s*刘铮摄\s*", "", value)
    value = re.sub(r"(?:-已增强|-降噪|~\d+)$", "", value, flags=re.IGNORECASE)
    value = re.sub(r"\s+", " ", value).strip(" _-·()（）[]【】")
    return value


def meaningful_stem(path: Path) -> str:
    stem = clean_label(path.stem)
    if not stem or GENERIC_STEM.fullmatch(stem) or len(stem) > 55:
        return ""
    if re.fullmatch(r"[0-9._ -]+", stem):
        return ""
    return stem


def product_group(relative: Path) -> tuple[str, str, str]:
    haystack = str(relative).lower()
    for title, slug, words, tags in PRODUCT_GROUPS:
        if any(word.lower() in haystack for word in words):
            return title, slug, tags
    return "商业珠宝图集", "product-jewelry-archive", "珠宝,静物,产品摄影,商业视觉"


def event_tags(title: str) -> str:
    rules = [
        (["展", "壁画", "陶瓷", "艺术", "石窟"], "展览,文化,纪实摄影"),
        (["毕业", "情侣", "人物", "采访", "她力量"], "人物,纪实摄影,现场"),
        (["军训", "歌手", "典礼", "论坛", "比赛", "龙舟", "鱼宴", "支教", "思政"], "校园活动,新闻摄影,现场"),
        (["武汉大学", "樱花", "停机坪"], "城市,建筑,风光摄影"),
        (["创作"], "创作摄影,光影,视觉实验"),
    ]
    for words, tags in rules:
        if any(word in title for word in words):
            return tags
    return "纪实摄影,现场,摄影作品"


def build_tasks(source: str) -> list[Task]:
    tasks: list[Task] = []
    if source in {"all", "photo"}:
        for path in sorted(PHOTO_ROOT.rglob("*"), key=lambda p: str(p).lower()):
            if not path.is_file() or path.suffix.lower() not in IMAGE_EXTENSIONS | VIDEO_EXTENSIONS:
                continue
            relative = path.relative_to(PHOTO_ROOT)
            top = relative.parts[0]
            project_title = clean_shoot_name(top)
            date_match = re.match(r"^(20\d{2})", top)
            year = date_match.group(1) if date_match else "2024–2026"
            slug_seed = hashlib.sha1(top.encode("utf-8")).hexdigest()[:8]
            project_slug = "photo-" + (re.match(r"^(20\d{6})", top).group(1) if re.match(r"^(20\d{6})", top) else slug_seed)
            stem = meaningful_stem(path)
            tags = event_tags(project_title)
            tasks.append(Task(
                source=str(path), root_kind="photo", relative=str(relative), category_slug="photo", collection_slug="photo",
                project_title=project_title, project_slug=project_slug, year=year,
                title=stem, description=f"《{project_title}》系列摄影作品。", tags=tags,
            ))
    if source in {"all", "product"}:
        for path in sorted(PRODUCT_ROOT.rglob("*"), key=lambda p: str(p).lower()):
            if not path.is_file() or path.suffix.lower() not in IMAGE_EXTENSIONS:
                continue
            relative = path.relative_to(PRODUCT_ROOT)
            project_title, project_slug, tags = product_group(relative)
            stem = meaningful_stem(path)
            leaf = clean_label(path.parent.name)
            description = f"{project_title}产品摄影。"
            if leaf and leaf not in {"分类", "原图未修", "Ring", "2025珠宝摄影"}:
                description += f"归档分组：{leaf}。"
            tasks.append(Task(
                source=str(path), root_kind="product", relative=str(relative), category_slug="photo", collection_slug="product",
                project_title=project_title, project_slug=project_slug, year="2025",
                title=stem, description=description, tags=tags,
            ))

    counters: Counter[str] = Counter()
    for task in tasks:
        counters[task.project_slug] += 1
        task.sequence = counters[task.project_slug]
        if not task.title:
            suffix = "影像" if Path(task.source).suffix.lower() in VIDEO_EXTENSIONS else "作品"
            task.title = f"{task.project_title} · {suffix} {task.sequence:03d}"
    return tasks


def rational(value: Any) -> float | None:
    if value is None:
        return None
    try:
        return float(value)
    except (TypeError, ValueError, ZeroDivisionError):
        try:
            return float(Fraction(value))
        except Exception:
            return None


def exif_metadata(image: Image.Image) -> dict[str, str]:
    try:
        exif = image.getexif()
    except Exception:
        exif = {}
    make = str(exif.get(EXIF.get("Make"), "")).strip()
    model = str(exif.get(EXIF.get("Model"), "")).strip()
    camera = model
    if make and make.lower() not in model.lower():
        camera = f"{make} {model}".strip()
    lens_model = str(exif.get(EXIF.get("LensModel"), "")).strip()
    focal = rational(exif.get(EXIF.get("FocalLength")))
    lens = lens_model
    if focal:
        focal_text = f"{focal:.1f}".rstrip("0").rstrip(".") + "mm"
        lens = f"{lens_model} · {focal_text}" if lens_model else focal_text
    aperture_value = rational(exif.get(EXIF.get("FNumber")))
    aperture = f"f/{aperture_value:.1f}".replace(".0", "") if aperture_value else ""
    exposure = rational(exif.get(EXIF.get("ExposureTime")))
    shutter = ""
    if exposure:
        if exposure < 1:
            shutter = f"1/{max(1, round(1 / exposure))}s"
        else:
            shutter = f"{exposure:.2f}".rstrip("0").rstrip(".") + "s"
    iso_value = exif.get(EXIF.get("PhotographicSensitivity")) or exif.get(EXIF.get("ISOSpeedRatings"))
    if isinstance(iso_value, (tuple, list)):
        iso_value = iso_value[0] if iso_value else ""
    captured_raw = str(exif.get(EXIF.get("DateTimeOriginal")) or exif.get(EXIF.get("DateTime")) or "").strip()
    captured_at = ""
    if captured_raw:
        try:
            captured_at = dt.datetime.strptime(captured_raw[:19], "%Y:%m:%d %H:%M:%S").isoformat()
        except ValueError:
            captured_at = captured_raw
    return {
        "camera": camera,
        "lens": lens,
        "aperture": aperture,
        "shutter_speed": shutter,
        "iso": str(iso_value or ""),
        "captured_at": captured_at,
    }


def open_source(path: Path) -> tuple[Image.Image, dict[str, str]]:
    if path.suffix.lower() in {".arw", ".cr2"}:
        tools_path = Path(__file__).resolve().parents[1] / ".photo-import-tools"
        if tools_path.exists() and str(tools_path) not in sys.path:
            sys.path.insert(0, str(tools_path))
        try:
            import rawpy  # type: ignore
        except ImportError as exc:
            raise RuntimeError("RAW support requires the optional rawpy package") from exc
        with rawpy.imread(str(path)) as raw:
            array = raw.postprocess(use_camera_wb=True, half_size=True, no_auto_bright=False, output_bps=8)
        return Image.fromarray(array), {"camera": "", "lens": "", "aperture": "", "shutter_speed": "", "iso": "", "captured_at": ""}
    image = Image.open(path)
    return image, exif_metadata(image)


def make_preview(task: Task, cache_dir: Path, max_dimension: int, quality: int) -> tuple[Path, dict[str, str], str, int]:
    source = Path(task.source)
    if source.suffix.lower() in VIDEO_EXTENSIONS:
        digest = hashlib.sha256(source.read_bytes()).hexdigest()
        source_key = hashlib.sha1(task.relative.encode("utf-8")).hexdigest()[:10]
        cache_path = cache_dir / f"{digest}-{source_key}{source.suffix.lower()}"
        if not cache_path.exists():
            shutil.copy2(source, cache_path)
        return cache_path, {"camera": "", "lens": "", "aperture": "", "shutter_speed": "", "iso": "", "captured_at": ""}, "video/mp4", cache_path.stat().st_size

    image, metadata = open_source(source)
    try:
        image = ImageOps.exif_transpose(image)
        image.thumbnail((max_dimension, max_dimension), Image.Resampling.LANCZOS, reducing_gap=3.0)
        if image.mode not in {"RGB", "RGBA"}:
            image = image.convert("RGBA" if "transparency" in image.info else "RGB")
        scratch = cache_dir / (hashlib.sha1(task.relative.encode("utf-8")).hexdigest() + ".webp")
        # Method 2 keeps the requested visual quality and avoids pathological
        # multi-minute encodes seen on a few high-noise 30 MP source files.
        save_args: dict[str, Any] = {"format": "WEBP", "quality": quality, "method": 2}
        if image.info.get("icc_profile"):
            save_args["icc_profile"] = image.info["icc_profile"]
        image.save(scratch, **save_args)
    finally:
        image.close()
    digest = hashlib.sha256(scratch.read_bytes()).hexdigest()
    source_key = hashlib.sha1(task.relative.encode("utf-8")).hexdigest()[:10]
    final_path = cache_dir / f"{digest}-{source_key}.webp"
    if final_path != scratch:
        if final_path.exists():
            scratch.unlink()
        else:
            scratch.replace(final_path)
    return final_path, metadata, "image/webp", final_path.stat().st_size


class SupabaseClient:
    def __init__(self, env: dict[str, str]):
        self.url = (env.get("SUPABASE_URL") or env.get("NEXT_PUBLIC_SUPABASE_URL") or "").rstrip("/")
        self.key = env.get("SUPABASE_SERVICE_ROLE_KEY") or env.get("SUPABASE_SECRET_KEY") or ""
        self.bucket = env.get("SUPABASE_MEDIA_BUCKET") or "media"
        if not self.url or not self.key:
            raise RuntimeError("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in the environment file")

    def request(self, method: str, url: str, body: bytes | None = None, headers: dict[str, str] | None = None, retries: int = 5) -> bytes:
        request_headers = {"apikey": self.key, "Authorization": f"Bearer {self.key}", **(headers or {})}
        last_error: Exception | None = None
        for attempt in range(retries):
            try:
                request = urllib.request.Request(url, data=body, headers=request_headers, method=method)
                with urllib.request.urlopen(request, timeout=120) as response:
                    return response.read()
            except (urllib.error.URLError, urllib.error.HTTPError, TimeoutError) as exc:
                last_error = exc
                if isinstance(exc, urllib.error.HTTPError):
                    detail = exc.read().decode("utf-8", errors="replace")[:500]
                    if exc.code < 500 and exc.code not in {408, 409, 429}:
                        raise RuntimeError(f"Supabase returned HTTP {exc.code}: {detail}") from exc
                if attempt + 1 < retries:
                    time.sleep(min(20, 2 ** attempt))
        raise RuntimeError(f"Supabase request failed after {retries} attempts: {last_error}")

    def rest(self, method: str, table: str, query: str = "", payload: Any = None, prefer: str = "return=representation") -> Any:
        url = f"{self.url}/rest/v1/{table}{('?' + query) if query else ''}"
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8") if payload is not None else None
        raw = self.request(method, url, body, {"Content-Type": "application/json", "Prefer": prefer})
        return json.loads(raw.decode("utf-8")) if raw else None

    def upsert(self, table: str, payload: dict[str, Any], conflict: str) -> dict[str, Any]:
        rows = self.rest("POST", table, f"on_conflict={urllib.parse.quote(conflict)}&select=*", payload, "resolution=merge-duplicates,return=representation")
        return rows[0]

    def find_media(self, storage_path: str) -> dict[str, Any] | None:
        encoded = urllib.parse.quote(storage_path, safe="")
        rows = self.rest("GET", "media", f"storage_path=eq.{encoded}&select=*&limit=1")
        return rows[0] if rows else None

    def upload(self, storage_path: str, path: Path, mime_type: str) -> str:
        encoded_bucket = urllib.parse.quote(self.bucket, safe="")
        encoded_path = urllib.parse.quote(storage_path, safe="/")
        url = f"{self.url}/storage/v1/object/{encoded_bucket}/{encoded_path}"
        self.request("POST", url, path.read_bytes(), {"Content-Type": mime_type, "x-upsert": "true"})
        return f"{self.url}/storage/v1/object/public/{encoded_bucket}/{encoded_path}"


def load_state(path: Path) -> dict[str, Any]:
    if not path.exists():
        return {"completed": {}, "failed": {}}
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return {"completed": {}, "failed": {}}


def save_state(path: Path, state: dict[str, Any]) -> None:
    temporary = path.with_suffix(".tmp")
    temporary.write_text(json.dumps(state, ensure_ascii=False, indent=2), encoding="utf-8")
    temporary.replace(path)


def project_payload(task: Task, category_id: int) -> dict[str, Any]:
    subtitle = "珠宝、静物与商业产品视觉" if task.collection_slug == "product" else "现场、人物与时代切片"
    return {
        "title": task.project_title,
        "subtitle": subtitle,
        "slug": task.project_slug,
        "category_id": category_id,
        "description": f"{task.project_title}公开作品集，收录经网页优化的高清预览。",
        "year": task.year,
        "location": "武汉" if task.collection_slug == "photo" else "",
        "is_featured": False,
        "is_recommended": True,
        "is_series": True,
        "series_style": "product-neutral" if task.collection_slug == "product" else "documentary-light",
        "status": "published",
        "tags": task.tags,
        "sort_order": 100 + int(hashlib.sha1(task.project_slug.encode()).hexdigest()[:4], 16),
        "updated_at": dt.datetime.now(dt.timezone.utc).isoformat(),
    }


def process_task(task: Task, client: SupabaseClient, projects: dict[str, dict[str, Any]], cache_dir: Path, max_dimension: int, quality: int) -> dict[str, Any]:
    preview, metadata, mime_type, size = make_preview(task, cache_dir, max_dimension, quality)
    suffix = preview.suffix.lower()
    digest = preview.stem.split("-", 1)[0]
    storage_path = f"portfolio-import/v1/{digest[:2]}/{digest}{suffix}"
    with DIGEST_LOCKS[digest]:
        existing = client.find_media(storage_path)
        if existing:
            preview.unlink(missing_ok=True)
            return {"status": "existing", "media": existing, "task": asdict(task), "public_url": existing.get("file_path", "")}
        public_url = client.upload(storage_path, preview, mime_type)
        project = projects[task.project_slug]
        payload = {
            "project_id": project["id"],
            "category_id": project["category_id"],
            "title": task.title,
            "description": task.description,
            "file_path": public_url,
            "storage_path": storage_path,
            "original_name": Path(task.source).name,
            "file_type": suffix.lstrip("."),
            "mime_type": mime_type,
            "size": size,
            "media_type": "video" if suffix == ".mp4" else "image",
            "tags": task.tags,
            **metadata,
            "is_hero": False,
            "is_selected": task.sequence <= 3,
            "is_cover": task.sequence == 1,
            "show_in_database": True,
            "sort_order": task.sequence,
            "created_at": dt.datetime.now(dt.timezone.utc).isoformat(),
            "updated_at": dt.datetime.now(dt.timezone.utc).isoformat(),
        }
        rows = client.rest("POST", "media", "select=*", payload)
        preview.unlink(missing_ok=True)
        return {"status": "uploaded", "media": rows[0], "task": asdict(task), "public_url": public_url}


def prepare_task(task: Task, cache_dir: Path, max_dimension: int, quality: int) -> dict[str, Any]:
    preview, metadata, mime_type, size = make_preview(task, cache_dir, max_dimension, quality)
    suffix = preview.suffix.lower()
    digest = preview.stem.split("-", 1)[0]
    project_id = 200_000_000 + int(hashlib.sha1(task.project_slug.encode("utf-8")).hexdigest()[:7], 16)
    media_id = 600_000_000 + int(hashlib.sha1((task.relative + digest).encode("utf-8")).hexdigest()[:7], 16)
    category_id = 1
    pathname = f"portfolio/v1/{task.collection_slug}/{task.project_slug}/{digest}{suffix}"
    media = {
        "id": media_id,
        "project_id": project_id,
        "category_id": category_id,
        "title": task.title,
        "description": task.description,
        "file_path": "",
        "storage_path": pathname,
        "original_name": Path(task.source).name,
        "file_type": suffix.lstrip("."),
        "mime_type": mime_type,
        "size": size,
        "media_type": "video" if suffix == ".mp4" else "image",
        "tags": task.tags,
        **metadata,
        "is_hero": 0,
        "is_selected": 1 if task.sequence <= 3 else 0,
        "is_cover": 1 if task.sequence == 1 else 0,
        "show_in_database": 1,
        "sort_order": task.sequence,
        "project_title": task.project_title,
        "project_slug": task.project_slug,
        "project_year": task.year,
        "project_location": "武汉" if task.collection_slug == "photo" else "",
        "category_name": "摄影",
        "category_slug": "photo",
        "collection_slug": task.collection_slug,
    }
    return {
        "source": task.source,
        "root_kind": task.root_kind,
        "relative": task.relative,
        "preview_path": str(preview),
        "pathname": pathname,
        "content_type": mime_type,
        "size": size,
        "media": media,
    }


def main() -> int:
    parser = argparse.ArgumentParser(description="Import local photography archives into the public portfolio")
    parser.add_argument("--env", default=".env.photo-import")
    parser.add_argument("--source", choices=["all", "photo", "product"], default="all")
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--prepare-only", action="store_true")
    parser.add_argument("--prepared-file", default=".photo-import-prepared.json")
    parser.add_argument("--limit", type=int, default=0)
    parser.add_argument("--workers", type=int, default=3)
    parser.add_argument("--max-dimension", type=int, default=2000)
    parser.add_argument("--quality", type=int, default=80)
    args = parser.parse_args()

    Image.MAX_IMAGE_PIXELS = 300_000_000
    tasks = build_tasks(args.source)
    if args.limit > 0:
        tasks = tasks[:args.limit]
    counts = Counter(task.project_title for task in tasks)
    log(f"Discovered {len(tasks)} publishable media files across {len(counts)} projects")
    for title, count in sorted(counts.items()):
        log(f"  {title}: {count}")
    if args.dry_run:
        return 0

    repo = Path(__file__).resolve().parents[1]
    cache_dir = repo / ".photo-import-cache"
    cache_dir.mkdir(parents=True, exist_ok=True)

    if args.prepare_only:
        prepared_path = (repo / args.prepared_file).resolve()
        prepared = load_state(prepared_path) if prepared_path.exists() else {"records": {}, "failed": {}}
        prepared.setdefault("records", {})
        prepared.setdefault("failed", {})
        pending = [
            task for task in tasks
            if task.source not in prepared["records"] or not Path(prepared["records"][task.source].get("preview_path", "")).exists()
        ]
        log(f"Preparing {len(pending)} remaining web previews with {max(1, args.workers)} workers")
        with concurrent.futures.ThreadPoolExecutor(max_workers=max(1, args.workers)) as executor:
            futures = {
                executor.submit(prepare_task, task, cache_dir, args.max_dimension, args.quality): task
                for task in pending
            }
            for index, future in enumerate(concurrent.futures.as_completed(futures), start=1):
                task = futures[future]
                try:
                    record = future.result()
                    prepared["records"][task.source] = record
                    prepared["failed"].pop(task.source, None)
                    log(f"[{index}/{len(pending)}] prepared: {task.title}")
                except Exception as exc:
                    prepared["failed"][task.source] = {"error": str(exc), "task": asdict(task)}
                    log(f"[{index}/{len(pending)}] FAILED: {task.relative} — {exc}")
                save_state(prepared_path, prepared)
        log(f"Prepared total={len(prepared['records'])}, failed={len(prepared['failed'])}")
        return 1 if prepared["failed"] else 0

    env_path = Path(args.env).resolve()
    client = SupabaseClient(parse_env(env_path))
    state_path = repo / ".photo-import-state.json"
    state = load_state(state_path)

    photo_category = client.upsert("categories", {
        "name": "摄影", "slug": "photo", "description": "人物、现场、城市与观看方式。", "sort_order": 1,
        "is_primary": True, "updated_at": dt.datetime.now(dt.timezone.utc).isoformat(),
    }, "slug")
    categories = {"photo": photo_category}

    first_by_project: dict[str, Task] = {}
    for task in tasks:
        first_by_project.setdefault(task.project_slug, task)
    projects: dict[str, dict[str, Any]] = {}
    for slug, task in first_by_project.items():
        projects[slug] = client.upsert("projects", project_payload(task, categories[task.category_slug]["id"]), "slug")

    pending = [task for task in tasks if task.source not in state.get("completed", {})]
    log(f"Starting {len(pending)} remaining uploads with {max(1, args.workers)} workers")
    uploaded = existing = failed = 0
    cover_updates: dict[str, str] = {}
    category_covers: dict[str, str] = {}
    with concurrent.futures.ThreadPoolExecutor(max_workers=max(1, args.workers)) as executor:
        futures = {
            executor.submit(process_task, task, client, projects, cache_dir, args.max_dimension, args.quality): task
            for task in pending
        }
        for index, future in enumerate(concurrent.futures.as_completed(futures), start=1):
            task = futures[future]
            try:
                result = future.result()
                state.setdefault("completed", {})[task.source] = result
                state.setdefault("failed", {}).pop(task.source, None)
                if result["status"] == "uploaded":
                    uploaded += 1
                else:
                    existing += 1
                if task.sequence == 1 and result.get("public_url"):
                    cover_updates[task.project_slug] = result["public_url"]
                    category_covers.setdefault(task.category_slug, result["public_url"])
                log(f"[{index}/{len(pending)}] {result['status']}: {task.title}")
            except Exception as exc:
                failed += 1
                state.setdefault("failed", {})[task.source] = {"error": str(exc), "task": asdict(task)}
                log(f"[{index}/{len(pending)}] FAILED: {task.relative} — {exc}")
            save_state(state_path, state)

    for slug, cover in cover_updates.items():
        project_id = projects[slug]["id"]
        client.rest("PATCH", "projects", f"id=eq.{project_id}", {"cover_image": cover, "updated_at": dt.datetime.now(dt.timezone.utc).isoformat()})
    for slug, cover in category_covers.items():
        category_id = categories[slug]["id"]
        client.rest("PATCH", "categories", f"id=eq.{category_id}", {"cover_image": cover, "updated_at": dt.datetime.now(dt.timezone.utc).isoformat()})

    log(f"Finished: uploaded={uploaded}, existing={existing}, failed={failed}, completed_total={len(state.get('completed', {}))}")
    sample = next((item.get("public_url") for item in state.get("completed", {}).values() if item.get("public_url")), "")
    if sample:
        log(f"Public sample: {sample}")
    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
