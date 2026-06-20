"""
OMPC workspace launcher.

Starts the OMPC-SSB project (backend + frontend) and the Cloudflare tunnel
from the OMPC shell directory.

Usage:
    python start_ompc.py              # start all services
    python start_ompc.py --status     # check service status
    python start_ompc.py --stop       # stop all services
"""
from __future__ import annotations

import argparse
import os
import shutil
import socket
import subprocess
import sys
import time
from pathlib import Path

SHELL_DIR = Path(__file__).resolve().parent
PROJECT_DIR = SHELL_DIR.parent / "OMPC-SSB"
BACKEND_DIR = PROJECT_DIR / "backend"
FRONTEND_DIR = PROJECT_DIR / "frontend"
VENV_PYTHON = PROJECT_DIR / ".venv" / ("Scripts/python.exe" if os.name == "nt" else "bin/python")
TUNNEL_NAME = "opc-social-content-automation-live"


def port_is_open(port: int, host: str = "127.0.0.1") -> bool:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        sock.settimeout(0.5)
        return sock.connect_ex((host, port)) == 0


def lan_ip() -> str | None:
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except OSError:
        return None


def start_backend() -> None:
    if port_is_open(8010):
        print("  Backend already running on http://127.0.0.1:8010")
        return
    if not VENV_PYTHON.exists():
        print("  ERROR: .venv not found. Run: python scripts/setup_local.py")
        return
    flags = subprocess.CREATE_NEW_PROCESS_GROUP if os.name == "nt" else 0
    subprocess.Popen(
        [
            str(VENV_PYTHON), "-m", "uvicorn", "app.main:app",
            "--host", "0.0.0.0", "--port", "8010",
        ],
        cwd=BACKEND_DIR,
        creationflags=flags,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    print("  Backend started on http://127.0.0.1:8010")


def start_frontend() -> None:
    if port_is_open(3000):
        print("  Frontend already running on http://127.0.0.1:3000")
        return
    npm = shutil.which("npm")
    if not npm:
        print("  ERROR: npm not found")
        return
    flags = subprocess.CREATE_NEW_PROCESS_GROUP if os.name == "nt" else 0
    subprocess.Popen(
        [npm, "run", "dev:lan"],
        cwd=FRONTEND_DIR,
        creationflags=flags,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    print("  Frontend started on http://127.0.0.1:3000")


def start_tunnel() -> None:
    cloudflared = shutil.which("cloudflared")
    if not cloudflared:
        print("  ERROR: cloudflared not found")
        return
    flags = subprocess.CREATE_NEW_PROCESS_GROUP if os.name == "nt" else 0
    subprocess.Popen(
        [cloudflared, "tunnel", "run", TUNNEL_NAME],
        creationflags=flags,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    print("  Cloudflare tunnel started -> https://opc.mvpdark.top")


def stop_port(port: int) -> None:
    if not port_is_open(port):
        return
    if os.name == "nt":
        result = subprocess.run(["netstat", "-ano", "-p", "tcp"], capture_output=True, text=True)
        for line in result.stdout.splitlines():
            parts = line.split()
            if len(parts) < 5:
                continue
            if parts[3].upper() == "LISTENING" and parts[1].endswith(f":{port}"):
                try:
                    pid = int(parts[4])
                    subprocess.run(["taskkill", "/PID", str(pid), "/F", "/T"], check=False)
                    print(f"  Stopped process {pid} on port {port}")
                except ValueError:
                    pass


def stop_all() -> None:
    print("Stopping services...")
    stop_port(8010)
    stop_port(3000)
    if os.name == "nt":
        subprocess.run(["taskkill", "/IM", "cloudflared.exe", "/F"], capture_output=True)
    print("  Cloudflare tunnel stopped")
    print("Done.")


def print_status() -> None:
    ip = lan_ip()
    print("OMPC Workspace Status:")
    print(f"  Shell:    {SHELL_DIR}")
    print(f"  Project:  {PROJECT_DIR}")
    print(f"  LAN IP:   {ip or 'unknown'}")
    print()
    print(f"  Backend  8010: {'running' if port_is_open(8010) else 'stopped'}")
    print(f"  Frontend 3000: {'running' if port_is_open(3000) else 'stopped'}")
    print(f"  Public URL:   https://opc.mvpdark.top")
    print(f"  Tunnel:       {'running' if _tunnel_running() else 'stopped'}")


def _tunnel_running() -> bool:
    if os.name == "nt":
        result = subprocess.run(
            ["tasklist", "/FI", "IMAGENAME eq cloudflared.exe"],
            capture_output=True, text=True,
        )
        return "cloudflared.exe" in result.stdout
    return shutil.which("pgrep") is not None and subprocess.run(
        ["pgrep", "cloudflared"], capture_output=True
    ).returncode == 0


def main() -> None:
    parser = argparse.ArgumentParser(description="OMPC workspace launcher.")
    parser.add_argument("--status", action="store_true", help="Print service status.")
    parser.add_argument("--stop", action="store_true", help="Stop all services.")
    args = parser.parse_args()

    if args.status:
        print_status()
        return

    if args.stop:
        stop_all()
        return

    print("Starting OMPC workspace...")
    print(f"  Shell:   {SHELL_DIR}")
    print(f"  Project: {PROJECT_DIR}")
    print()
    start_backend()
    time.sleep(2)
    start_frontend()
    time.sleep(1)
    start_tunnel()
    print()
    print("Services starting:")
    print("  Frontend: http://127.0.0.1:3000/?theme=mint")
    print("  Backend:  http://127.0.0.1:8010")
    print("  Public:   https://opc.mvpdark.top")
    print()
    print("Use --status to check, --stop to stop all.")


if __name__ == "__main__":
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    main()
