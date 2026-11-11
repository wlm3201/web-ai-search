#!/usr/bin/env python3
"""Read the "AI" bookmarks folder from a Chromium-family browser profile.

The profile holds BOTH the bookmarks and the logged-in cookies. Never copy, clean or
re-create this directory: doing so logs every AI site out.

Usage:
    python read_ai_bookmarks.py                      # list sites in folder "AI"
    python read_ai_bookmarks.py --folder AI --only gemini
    python read_ai_bookmarks.py --list-folders
    python read_ai_bookmarks.py --user-data-dir <dir>
"""

from __future__ import annotations

import argparse
import json
import os
import re
import subprocess
import sys
from pathlib import Path

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

HOME = Path.home()
FALLBACK_PROFILE = HOME / ".config" / "web-ai-search" / "profile"


def default_candidates() -> list[Path]:
    local = HOME / "AppData" / "Local"
    mac = HOME / "Library" / "Application Support"
    return [
        Path(os.environ["WAS_BOOKMARK_PROFILE"]) if os.environ.get("WAS_BOOKMARK_PROFILE") else FALLBACK_PROFILE,
        local / "Google" / "Chrome" / "User Data",
        local / "Microsoft" / "Edge" / "User Data",
        local / "Chromium" / "User Data",
        mac / "Google" / "Chrome",
        HOME / ".config" / "google-chrome",
    ]


def detect_running_profile() -> Path | None:
    """Find --user-data-dir of a running Chromium-family browser."""
    try:
        if sys.platform == "win32":
            ps = (
                "Get-CimInstance Win32_Process -Filter \"name = 'chrome.exe'\" | "
                "Where-Object { $_.CommandLine -like '*--user-data-dir*' } | "
                "Select-Object -First 5 -ExpandProperty CommandLine"
            )
            out = subprocess.run(
                ["powershell", "-NoProfile", "-Command", ps],
                capture_output=True, text=True, timeout=12,
            ).stdout
        else:
            out = subprocess.run(
                ["ps", "-eo", "args"], capture_output=True, text=True, timeout=12
            ).stdout
            out = "\n".join(l for l in out.splitlines() if "--user-data-dir" in l)
        m = re.search(r'--user-data-dir=(?:"([^"]+)"|([^\s]+))', out)
        if m:
            return Path(m.group(1) or m.group(2))
    except Exception:
        pass
    return None


def resolve_profile(explicit: str | None) -> tuple[Path, str]:
    if explicit:
        return Path(explicit).expanduser(), "--user-data-dir"
    running = detect_running_profile()
    if running and (running / "Default" / "Bookmarks").exists():
        return running, "running Chrome process"
    for c in default_candidates():
        if (c / "Default" / "Bookmarks").exists():
            return c, "default candidate"
    for c in default_candidates():
        if c.exists():
            return c, "existing profile (no Default/Bookmarks yet)"
    return FALLBACK_PROFILE, "fallback (not found)"


def bookmarks_file(profile: Path) -> Path | None:
    primary = profile / "Default" / "Bookmarks"
    if primary.exists():
        return primary
    found = sorted(profile.glob("*/Bookmarks"))
    return found[0] if found else None


def iter_url_nodes(node: dict):
    if node.get("type") == "url" and node.get("url", "").startswith(("http://", "https://")):
        yield node
    for child in node.get("children", []) or []:
        yield from iter_url_nodes(child)


def iter_folders(node: dict, path: str = ""):
    if node.get("type") == "folder":
        here = f"{path}/{node.get('name','')}" if path else node.get("name", "")
        yield here, node
        for child in node.get("children", []) or []:
            yield from iter_folders(child, here)
    else:
        for child in node.get("children", []) or []:
            yield from iter_folders(child, path)


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--folder", default="AI", help="bookmark folder name (case-insensitive), default: AI")
    ap.add_argument("--only", default="", help="keep only sites whose name/url contains this text")
    ap.add_argument("--user-data-dir", default=None, help="explicit browser user data dir")
    ap.add_argument("--list-folders", action="store_true", help="list all bookmark folders instead of sites")
    args = ap.parse_args()

    profile, how = resolve_profile(args.user_data_dir)
    bm = bookmarks_file(profile)
    result = {
        "profile": str(profile),
        "profile_source": how,
        "bookmarks_file": str(bm) if bm else None,
        "cookies_file": str(profile / "Default" / "Network" / "Cookies"),
        "folder": args.folder,
        "count": 0,
        "sites": [],
        "folders": [],
        "warnings": [],
    }
    if not bm:
        result["warnings"].append(
            "No Bookmarks file in this profile. Open your browser, log in to the AI sites, "
            "and create a bookmark folder named AI in its bookmark bar."
        )
        print(json.dumps(result, ensure_ascii=False, indent=2))
        return 0

    data = json.loads(bm.read_text(encoding="utf-8"))
    roots = data.get("roots", {})
    folders: list[tuple[str, dict]] = []
    for root in roots.values():
        if isinstance(root, dict):
            folders.extend(iter_folders(root))
    result["folders"] = [p for p, _ in folders]

    if args.list_folders:
        print(json.dumps(result, ensure_ascii=False, indent=2))
        return 0

    matches = [(p, n) for p, n in folders if p.split("/")[-1].casefold() == args.folder.casefold()]
    if not matches:
        result["warnings"].append(
            f"Folder '{args.folder}' not found. Available folders: {', '.join(result['folders'][:40])}"
        )
    for path, node in matches:
        for url_node in iter_url_nodes(node):
            name, url = url_node.get("name", ""), url_node.get("url", "")
            host = re.sub(r"^https?://", "", url).split("/")[0]
            result["sites"].append({"folder": path, "name": name, "url": url, "host": host})
    if args.only:
        key = args.only.casefold()
        result["sites"] = [s for s in result["sites"] if key in s["name"].casefold() or key in s["url"].casefold()]
    result["count"] = len(result["sites"])
    if not result["sites"] and not result["warnings"]:
        result["warnings"].append("Folder exists but contains no http(s) bookmarks.")
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
