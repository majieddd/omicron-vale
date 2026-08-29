#!/usr/bin/env python3
"""Resumable download of Blender portable zip. Retries, range-resumes."""
import urllib.request, os, sys, time

URL = "https://download.blender.org/release/Blender4.2/blender-4.2.3-windows-x64.zip"
DEST = os.path.expandvars(r"%LOCALAPPDATA%\BlenderPortable\blender-4.2.3-windows-x64.zip")
retry = 5

os.makedirs(os.path.dirname(DEST), exist_ok=True)

def size():
    try:
        return os.path.getsize(DEST)
    except OSError:
        return 0

for attempt in range(retry):
    have = size()
    try:
        headers = {"Range": f"bytes={have}-"} if have else {}
        req = urllib.request.Request(URL, headers=headers)
        with urllib.request.urlopen(req, timeout=120) as r, open(DEST, "ab") as f:
            total = int(r.headers.get("Content-Length", 0)) + have
            while True:
                chunk = r.read(1 << 20)
                if not chunk:
                    break
                f.write(chunk)
                print(f"\r{size()/1e6:8.1f} / {total/1e6:8.1f} MB", end="", flush=True)
        if size() >= total - 1:
            print("\nDONE", size(), total)
            sys.exit(0)
        print("\nshort read, retrying")
    except Exception as e:
        print("\nattempt", attempt, "failed:", e)
        time.sleep(4)
print("GAVE UP at", size())
sys.exit(1)
