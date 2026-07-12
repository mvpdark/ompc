"""
OMPC workspace launcher.

Starts the OMPC-SSB project (backend + frontend), the OMPC-ZSCJ service,
and the Cloudflare tunnel from the OMPC shell directory.

Usage:
    python start_ompc.py              # start all services
    python start_ompc.py --status     # check service status
    python start_ompc.py --stop       # stop all services
"""
from __future__ import annotations

import argparse
import os
import re
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
# Cloudflare tunnel ID is read automatically from ~/.cloudflared/config.yml
# when `cloudflared tunnel run` is invoked without arguments.

# cloudflared PID 文件：start_tunnel 写入，stop_all 读取后精准杀进程
CLOUDFLARED_PID_FILE = SHELL_DIR / ".cloudflared.pid"

# OMPC-ZSCJ (知识库/趋势采集独立服务)
ZSCJ_DIR = SHELL_DIR.parent / "OMPC-ZSCJ" / "backend"
# ZSCJ uses its own independent venv for isolation
ZSCJ_VENV_PYTHON = ZSCJ_DIR / ".venv" / ("Scripts/python.exe" if os.name == "nt" else "bin/python")

# Cache-bust proxy（端口 60003）：为前端 Next.js 提供缓存破坏代理
CACHE_PROXY_PORT = 60003
# cache-bust-proxy.js 可能在 shell 目录或 OMPC 根目录下
_CACHE_PROXY_CANDIDATES = [
    SHELL_DIR / "cache-bust-proxy.js",
    PROJECT_DIR / "shell" / "cache-bust-proxy.js",
]
CACHE_PROXY_SCRIPT = next(
    (p for p in _CACHE_PROXY_CANDIDATES if p.exists()),
    _CACHE_PROXY_CANDIDATES[0],
)

# Log directory for service stdout/stderr capture
LOG_DIR = SHELL_DIR / "logs"

# 跟踪父进程打开的日志文件句柄，所有 Popen 完成后统一关闭
_log_files: list = []
# 记录启动失败的服务，供 main() 汇总报告
_failed_services: list[str] = []


def _open_log(name: str):
    """打开日志文件并记录到 _log_files，供 Popen 使用后统一关闭父进程句柄。"""
    LOG_DIR.mkdir(parents=True, exist_ok=True)
    f = open(LOG_DIR / name, "a", encoding="utf-8", errors="replace")
    _log_files.append(f)
    return f


def close_log_files() -> None:
    """关闭父进程持有的日志文件句柄（子进程有自己的 FD 副本，不受影响）。"""
    for f in _log_files:
        try:
            f.close()
        except Exception:
            pass
    _log_files.clear()


def port_is_open(port: int, host: str = "127.0.0.1") -> bool:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        sock.settimeout(0.5)
        return sock.connect_ex((host, port)) == 0


def wait_for_port(port: int, name: str, timeout: int = 10) -> bool:
    """Wait up to `timeout` seconds for `port` to open, checking once per second."""
    for _ in range(timeout):
        if port_is_open(port):
            print(f"  {name} health check passed (port {port} open)")
            return True
        time.sleep(1)
    print(f"  WARNING: {name} did not open port {port} within {timeout}s")
    return False


def lan_ip() -> str | None:
    try:
        with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as s:
            s.connect(("8.8.8.8", 80))
            ip = s.getsockname()[0]
            return ip
    except OSError:
        return None


def start_backend() -> None:
    if port_is_open(60001):
        print("  Backend already running on http://127.0.0.1:60001")
        return
    if not VENV_PYTHON.exists():
        print("  ERROR: .venv not found. Run: python scripts/setup_local.py")
        _failed_services.append("Backend (port 60001)")
        return
    flags = subprocess.CREATE_NEW_PROCESS_GROUP if os.name == "nt" else 0
    try:
        subprocess.Popen(
            [
                str(VENV_PYTHON), "-m", "uvicorn", "app.main:app",
                "--host", "0.0.0.0", "--port", "60001",
            ],
            cwd=BACKEND_DIR,
            creationflags=flags,
            stdout=_open_log("backend-60001.log"),
            stderr=subprocess.STDOUT,
        )
    except OSError as exc:
        print(f"  ERROR: 无法启动 Backend 进程: {exc}")
        _failed_services.append("Backend (port 60001)")
        return
    if not wait_for_port(60001, "Backend"):
        print("  ERROR: Backend failed to start within timeout")
        _failed_services.append("Backend (port 60001)")
        return
    print("  Backend started on http://127.0.0.1:60001")


def start_frontend() -> None:
    if port_is_open(60000):
        print("  Frontend already running on http://127.0.0.1:60000")
        return
    npm = shutil.which("npm")
    if not npm:
        print("  ERROR: npm not found")
        _failed_services.append("Frontend (port 60000)")
        return
    flags = subprocess.CREATE_NEW_PROCESS_GROUP if os.name == "nt" else 0
    try:
        subprocess.Popen(
            [npm, "run", "dev:lan"],
            cwd=FRONTEND_DIR,
            creationflags=flags,
            stdout=_open_log("frontend-60000.log"),
            stderr=subprocess.STDOUT,
        )
    except OSError as exc:
        print(f"  ERROR: 无法启动 Frontend 进程: {exc}")
        _failed_services.append("Frontend (port 60000)")
        return
    if not wait_for_port(60000, "Frontend", timeout=30):
        print("  ERROR: Frontend failed to start within timeout")
        _failed_services.append("Frontend (port 60000)")
        return
    print("  Frontend started on http://127.0.0.1:60000")


def start_zscj() -> None:
    """Start OMPC-ZSCJ (knowledge base / trend collection service) on port 60002."""
    if port_is_open(60002):
        print("  ZSCJ already running on http://127.0.0.1:60002")
        return
    if not ZSCJ_VENV_PYTHON.exists():
        print("  ERROR: ZSCJ .venv not found. Run: cd OMPC-ZSCJ/backend && python -m venv .venv")
        _failed_services.append("ZSCJ (port 60002)")
        return
    venv = ZSCJ_VENV_PYTHON
    if not ZSCJ_DIR.exists():
        print("  ERROR: OMPC-ZSCJ/backend not found")
        _failed_services.append("ZSCJ (port 60002)")
        return
    flags = subprocess.CREATE_NEW_PROCESS_GROUP if os.name == "nt" else 0
    try:
        subprocess.Popen(
            [
                str(venv), "-m", "uvicorn", "app.main:app",
                "--host", "0.0.0.0", "--port", "60002",
            ],
            cwd=str(ZSCJ_DIR),
            creationflags=flags,
            stdout=_open_log("zscj-60002.log"),
            stderr=subprocess.STDOUT,
        )
    except OSError as exc:
        print(f"  ERROR: 无法启动 ZSCJ 进程: {exc}")
        _failed_services.append("ZSCJ (port 60002)")
        return
    if not wait_for_port(60002, "ZSCJ"):
        print("  ERROR: ZSCJ failed to start within timeout")
        _failed_services.append("ZSCJ (port 60002)")
        return
    print("  ZSCJ started on http://127.0.0.1:60002")


def start_cache_proxy() -> None:
    """Start cache-bust-proxy.js on port 60003 for frontend cache busting."""
    if port_is_open(CACHE_PROXY_PORT):
        print(f"  Cache proxy already running on http://127.0.0.1:{CACHE_PROXY_PORT}")
        return
    if not CACHE_PROXY_SCRIPT.exists():
        print(f"  WARNING: cache-bust-proxy.js not found at {CACHE_PROXY_SCRIPT}, skipping cache proxy")
        _failed_services.append(f"Cache proxy (port {CACHE_PROXY_PORT})")
        return
    node = shutil.which("node")
    if not node:
        print("  ERROR: node not found, cannot start cache proxy")
        _failed_services.append(f"Cache proxy (port {CACHE_PROXY_PORT})")
        return
    flags = subprocess.CREATE_NEW_PROCESS_GROUP if os.name == "nt" else 0
    try:
        subprocess.Popen(
            [node, str(CACHE_PROXY_SCRIPT)],
            cwd=str(SHELL_DIR),
            creationflags=flags,
            stdout=_open_log("cache-proxy-60003.log"),
            stderr=subprocess.STDOUT,
        )
    except OSError as exc:
        print(f"  ERROR: 无法启动 Cache proxy 进程: {exc}")
        _failed_services.append(f"Cache proxy (port {CACHE_PROXY_PORT})")
        return
    if not wait_for_port(CACHE_PROXY_PORT, "Cache proxy"):
        print("  ERROR: Cache proxy failed to start within timeout")
        _failed_services.append(f"Cache proxy (port {CACHE_PROXY_PORT})")
        return
    print(f"  Cache proxy started on http://127.0.0.1:{CACHE_PROXY_PORT}")


def start_tunnel() -> None:
    cloudflared = shutil.which("cloudflared")
    if not cloudflared:
        print("  ERROR: cloudflared not found")
        _failed_services.append("Cloudflare tunnel")
        return
    cf_config = SHELL_DIR / "cf-config.yml"
    if not cf_config.exists():
        print("  WARNING: cf-config.yml not found, skipping Cloudflare tunnel.")
        _failed_services.append("Cloudflare tunnel")
        return
    flags = subprocess.CREATE_NEW_PROCESS_GROUP if os.name == "nt" else 0
    try:
        proc = subprocess.Popen(
            [cloudflared, "tunnel", "run", "--config", str(cf_config)],
            creationflags=flags,
            stdout=_open_log("cloudflared.log"),
            stderr=subprocess.STDOUT,
        )
        # 保存 cloudflared PID，供 stop_all 精准停止而非杀死所有同名进程
        try:
            CLOUDFLARED_PID_FILE.write_text(str(proc.pid), encoding="utf-8")
        except Exception:
            pass
    except OSError as exc:
        print(f"  ERROR: 无法启动 Cloudflare tunnel 进程: {exc}")
        _failed_services.append("Cloudflare tunnel")
        return
    print("  Cloudflare tunnel started -> https://opc.mvpdark.top")


def stop_port(port: int) -> None:
    if not port_is_open(port):
        return
    if os.name == "nt":
        try:
            result = subprocess.run(["netstat", "-ano", "-p", "tcp"], capture_output=True, text=True)
        except Exception as exc:
            print(f"  WARNING: netstat command failed: {exc}")
            return
        for line in result.stdout.splitlines():
            parts = line.split()
            # 不同 Windows 版本 netstat 输出列数可能不同，先确保有足够列再访问索引
            if len(parts) < 4:
                continue
            # parts[1] = Local Address, parts[3] = State
            if parts[3].upper() != "LISTENING" or not re.search(rf":{port}$", parts[1]):
                continue
            # parts[4] = PID (需要 -ano 参数)，访问前再次检查长度
            if len(parts) < 5:
                continue
            try:
                pid = int(parts[4])
                subprocess.run(["taskkill", "/PID", str(pid), "/F", "/T"], check=False)
                print(f"  Stopped process {pid} on port {port}")
            except ValueError:
                pass


def stop_all() -> None:
    print("Stopping services...")
    stop_port(CACHE_PROXY_PORT)
    stop_port(60002)
    stop_port(60001)
    stop_port(60000)
    if os.name == "nt":
        # 优先通过 PID 文件精准杀进程，避免杀死其他 cloudflared 实例
        pid_str = None
        try:
            pid_str = CLOUDFLARED_PID_FILE.read_text(encoding="utf-8").strip()
        except Exception:
            pass
        if pid_str:
            try:
                subprocess.run(["taskkill", "/PID", pid_str, "/F", "/T"], capture_output=True)
            except Exception:
                pass
            try:
                CLOUDFLARED_PID_FILE.unlink(missing_ok=True)
            except Exception:
                pass
        else:
            # PID 文件不存在时回退到按进程名杀
            subprocess.run(["taskkill", "/IM", "cloudflared.exe", "/F"], capture_output=True)
    print("  Cloudflare tunnel stopped")
    print("Done.")


def print_status() -> None:
    ip = lan_ip()
    print("OMPC Workspace Status:")
    print(f"  Shell:    {SHELL_DIR}")
    print(f"  Project:  {PROJECT_DIR}")
    print(f"  ZSCJ:     {ZSCJ_DIR}")
    print(f"  LAN IP:   {ip or 'unknown'}")
    print()
    print(f"  Backend  60001: {'running' if port_is_open(60001) else 'stopped'}")
    print(f"  ZSCJ     60002: {'running' if port_is_open(60002) else 'stopped'}")
    print(f"  Cache    60003: {'running' if port_is_open(CACHE_PROXY_PORT) else 'stopped'}")
    print(f"  Frontend 60000: {'running' if port_is_open(60000) else 'stopped'}")
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
    LOG_DIR.mkdir(parents=True, exist_ok=True)
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

    if not PROJECT_DIR.exists():
        print(f"ERROR: 项目目录不存在: {PROJECT_DIR}")
        print("  请确认 OMPC-SSB 项目已正确克隆到 OMPC 的同级目录。")
        sys.exit(1)

    print("Starting OMPC workspace...")
    print(f"  Shell:   {SHELL_DIR}")
    print(f"  Project: {PROJECT_DIR}")
    print(f"  ZSCJ:    {ZSCJ_DIR}")
    print()
    try:
        start_backend()
        time.sleep(2)
        start_zscj()
        time.sleep(1)
        start_cache_proxy()
        time.sleep(1)
        start_frontend()
        time.sleep(1)
        start_tunnel()
    finally:
        # 所有 Popen 调用完成（或异常退出），关闭父进程持有的日志文件句柄
        close_log_files()
    if _failed_services:
        print()
        print("WARNING: The following services failed to start:")
        for svc in _failed_services:
            print(f"  - {svc}")
        print()
        sys.exit(1)
    print()
    print("Services starting:")
    print("  Frontend: http://127.0.0.1:60000/?theme=mint")
    print("  Backend:  http://127.0.0.1:60001")
    print("  ZSCJ:     http://127.0.0.1:60002")
    print(f"  Cache:    http://127.0.0.1:{CACHE_PROXY_PORT}")
    print("  Public:   https://opc.mvpdark.top")
    print()
    print("Use --status to check, --stop to stop all.")


if __name__ == "__main__":
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    main()
