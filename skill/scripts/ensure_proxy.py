#!/usr/bin/env python3
"""Make sure the browser actually goes through the local Clash proxy on 7897.

ego lite follows the Windows system proxy and has no CLI proxy flag. When Clash is
running but its "System Proxy" toggle was forgotten, this script turns the toggle
on (HKCU only, no admin needed) and refreshes WinINET so Chromium picks it up.

Usage:
    python ensure_proxy.py                 # check + fix, print JSON
    python ensure_proxy.py --check-only   # report only, never change settings
    python ensure_proxy.py --verify       # also request a 204 endpoint through the proxy
    python ensure_proxy.py --port 7890

For the chrome-devtools MCP backend, an alternative browser-level hard-code is
adding "--proxyServer=http://127.0.0.1:7897" to its args in mcp.json.
"""

from __future__ import annotations

import argparse
import json
import socket
import sys

DEFAULT_PORT = 7897
REG_PATH = r"Software\Microsoft\Windows\CurrentVersion\Internet Settings"
VERIFY_URL = "https://www.gstatic.com/generate_204"


def port_open(port: int) -> bool:
    try:
        with socket.create_connection(("127.0.0.1", port), timeout=0.6):
            return True
    except OSError:
        return False


def read_settings() -> dict:
    if sys.platform != "win32":
        return {"supported": False}
    import winreg
    try:
        k = winreg.OpenKey(winreg.HKEY_CURRENT_USER, REG_PATH)
        def val(name):
            try:
                return winreg.QueryValueEx(k, name)[0]
            except FileNotFoundError:
                return None
        out = {"supported": True, "ProxyEnable": val("ProxyEnable"), "ProxyServer": val("ProxyServer")}
        winreg.CloseKey(k)
        return out
    except OSError as e:
        return {"supported": True, "error": str(e)}


def write_settings(server: str) -> bool:
    import winreg
    import ctypes
    k = winreg.OpenKey(winreg.HKEY_CURRENT_USER, REG_PATH, 0, winreg.KEY_SET_VALUE)
    winreg.SetValueEx(k, "ProxyEnable", 0, winreg.REG_DWORD, 1)
    winreg.SetValueEx(k, "ProxyServer", 0, winreg.REG_SZ, server)
    winreg.CloseKey(k)
    # INTERNET_OPTION_SETTINGS_CHANGED / REFRESH: tell WinINET (and Chromium) to reload.
    try:
        wininet = ctypes.windll.wininet
        wininet.InternetSetOptionW(0, 39, 0, 0, 0)
        wininet.InternetSetOptionW(0, 37, 0, 0, 0)
    except Exception:
        pass
    return True


def verify() -> dict:
    import urllib.request
    try:
        req = urllib.request.Request(VERIFY_URL, method="GET")
        with urllib.request.urlopen(req, timeout=6) as resp:
            return {"ok": resp.status == 204, "status": resp.status, "url": VERIFY_URL}
    except Exception as e:
        return {"ok": False, "error": str(e)[:160], "url": VERIFY_URL}


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--port", type=int, default=DEFAULT_PORT)
    ap.add_argument("--check-only", action="store_true")
    ap.add_argument("--verify", action="store_true")
    args = ap.parse_args()

    server = f"127.0.0.1:{args.port}"
    before = read_settings()
    listening = port_open(args.port)
    result = {
        "port": args.port, "port_listening": listening,
        "proxy_before": before, "server_expected": server,
        "changed": False, "ok": False, "warnings": [],
    }

    if not listening:
        result["warnings"].append(
            f"No listener on {server}: start Clash / enable its mixed-port first. "
            "The browser cannot use a proxy that is not running."
        )
    elif not before.get("supported", True):
        result["warnings"].append("Non-Windows platform: set the proxy in the OS/browser settings manually.")
    else:
        enabled = before.get("ProxyEnable") == 1
        correct = str(before.get("ProxyServer") or "").strip() == server
        result["proxy_already_ok"] = enabled and correct
        if enabled and correct:
            result["ok"] = True
        elif args.check_only:
            result["warnings"].append("System proxy is off or points elsewhere; rerun without --check-only to fix.")
        else:
            try:
                write_settings(server)
                result["changed"] = True
                result["proxy_after"] = read_settings()
                result["ok"] = True
            except Exception as e:
                result["warnings"].append("Failed to write proxy settings: " + str(e)[:160])

    if args.verify:
        result["verify"] = verify()
        if not result["verify"].get("ok"):
            result["ok"] = False
            result["warnings"].append("Proxy verification request failed; check Clash rules / upstream.")
    result["mcp_backend_hint"] = 'Add "--proxyServer=http://127.0.0.1:' + str(args.port) + '" to chrome-devtools-mcp args for a browser-level hard-code.'
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 0 if result["ok"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
