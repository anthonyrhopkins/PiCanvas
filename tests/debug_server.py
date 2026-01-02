import os
import shlex
import ssl
import subprocess
import time
import urllib.request
from pathlib import Path
from typing import Optional, Sequence

DEBUG_MANIFEST_URL = "https://localhost:4321/temp/build/manifests.js"
DEFAULT_SERVE_COMMAND = ("npm", "run", "serve")


def get_serve_command() -> Sequence[str]:
    override = os.getenv("PICANVAS_SERVE_COMMAND")
    if override:
        return shlex.split(override)
    return DEFAULT_SERVE_COMMAND


def debug_manifest_available(url: str = DEBUG_MANIFEST_URL, timeout: float = 2.0) -> bool:
    try:
        context = ssl._create_unverified_context()
        with urllib.request.urlopen(url, timeout=timeout, context=context) as response:
            return getattr(response, "status", 200) == 200
    except Exception:
        return False


def wait_for_debug_manifest(
    url: str = DEBUG_MANIFEST_URL,
    timeout: float = 60.0,
    interval: float = 1.0
) -> bool:
    start = time.time()
    while time.time() - start < timeout:
        if debug_manifest_available(url):
            return True
        time.sleep(interval)
    return False


def start_debug_server(
    cwd: Path,
    command: Optional[Sequence[str]] = None
) -> subprocess.Popen:
    cmd = command or get_serve_command()
    return subprocess.Popen(list(cmd), cwd=str(cwd))


def stop_debug_server(process: Optional[subprocess.Popen]) -> None:
    if not process:
        return
    if process.poll() is None:
        process.terminate()
        try:
            process.wait(timeout=10)
        except subprocess.TimeoutExpired:
            process.kill()
            process.wait(timeout=10)
