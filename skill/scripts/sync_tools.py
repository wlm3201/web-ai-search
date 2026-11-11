#!/usr/bin/env python3
"""Sync page-side JS tools into the current workspace.

chrome-devtools-mcp rejects `evaluate_script.sourcePath` / `filePath` values outside
its configured workspace roots. A user-level skill lives in ~/.codebuddy/skills, so
its scripts cannot be loaded directly. Run this once per workspace to copy the JS
tools to `<workspace>/.codebuddy/web-ai-search/`, then use RELATIVE sourcePath values
such as `.codebuddy/web-ai-search/ai_lib.js`.

Usage:
    python sync_tools.py                         # sync into current working directory
    python sync_tools.py --workspace <workspace>
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import shutil
from pathlib import Path

SRC = Path(__file__).resolve().parent
DEST_REL = Path(".codebuddy") / "web-ai-search"


def digest(p: Path) -> str:
    return hashlib.sha256(p.read_bytes()).hexdigest()[:12]


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--workspace", default=os.getcwd(), help="workspace root (default: cwd)")
    args = ap.parse_args()
    ws = Path(args.workspace).resolve()
    dest = ws / DEST_REL
    dest.mkdir(parents=True, exist_ok=True)
    synced = []
    for f in sorted(SRC.glob("*.js")):
        target = dest / f.name
        changed = (not target.exists()) or digest(f) != digest(target)
        if changed:
            shutil.copy2(f, target)
        synced.append({"file": f.name, "changed": changed, "sha": digest(f)})
    result = {
        "workspace": str(ws),
        "destination": str(dest),
        "relative_prefix": str(DEST_REL).replace("\\", "/") + "/",
        "absolute_prefix": str(dest).replace("\\", "/") + "/",
        "tool_path_example": str(DEST_REL / "ai_lib.js").replace("\\", "/"),
        "synced": synced,
        "hint": "Use sourcePath values relative to the workspace root, e.g. .codebuddy/web-ai-search/ai_wait.js",
    }
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
