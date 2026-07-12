# OMPC Workspace

OMPC is the workspace shell that hosts sub-projects, shared infrastructure,
and the Cloudflare tunnel entry point.

## Quick Start

### Start all services (backend + frontend + tunnel)

Double-click `START_OMPC.bat` or run:

```powershell
cd C:\TRAE\OMPC
py -3.14 start_ompc.py
```

This starts:
- OMPC-SSB backend API on http://127.0.0.1:6001
- OMPC-ZSCJ backend API on http://127.0.0.1:6002
- OMPC-SSB frontend app on http://127.0.0.1:6000
- OMPC-ZSCJ frontend app on http://127.0.0.1:6003 (需手动启动，启动器不自动启动)
- Cloudflare tunnel -> https://opc.mvpdark.top

### Check status

```powershell
py -3.14 start_ompc.py --status
```

### Stop all services

```powershell
py -3.14 start_ompc.py --stop
```

## Structure

```
C:\TRAE\OMPC\              <- this shell (workspace root)
  ├── START_OMPC.bat        unified launcher (backend + frontend + tunnel)
  ├── start_ompc.py         Python launcher with status/stop support
  ├── docker-compose.yml    shared infrastructure (PostgreSQL+pgvector, Redis)
  ├── infra\                shared infra configs (Cloudflare tunnel template)
  └── README.md             this file

C:\TRAE\OMPC-SSB\          <- sub-project: postgraduate-to-PhD content automation
  ├── backend\             FastAPI application (port 6001)
  ├── frontend\            Next.js workspace (port 6000)
  ├── .venv\               Python virtual environment (Python 3.14)
  ├── prompts\             prompt templates
  ├── docs\                project docs and sprint tasks
  ├── scripts\             local helpers (setup_local.py, start_local.py)
  ├── artifacts\           generated artifacts + SQLite dev database
  ├── .env                 environment config (SQLite mode)
  ├── AGENTS.md            agent rules
  ├── PROJECT_MAP.md       project map
  ├── LOOP_LOG.md          loop engineering log
  ├── README.md            project readme
  └── START_OPC.bat        project-level launcher (backend + frontend only)

C:\TRAE\OMPC-ZSCJ\          <- sub-project: knowledge base & trend collection service (independent)
  ├── backend\             FastAPI application (port 6002) - knowledge base + trend collection
  ├── static\              Static HTML admin page (served by backend on port 6002)
  ├── .venv\               Python virtual environment
  ├── prompts\             prompt templates (knowledge compile, review, style reference)
  ├── .env                 environment config (SQLite mode, AUTH_REQUIRED=false)
  ├── LOOP_LOG.md          loop engineering log
  └── LOOP_LOG_1-100.md    archived loop log
```

## Services

| Service          | Port | Local URL                        | Public URL                          | Responsibility                                      |
|------------------|------|----------------------------------|-------------------------------------|-----------------------------------------------------|
| OMPC-SSB Frontend| 6000 | http://127.0.0.1:6000/?theme=mint| https://opc.mvpdark.top             | Postgraduate-to-PhD content automation workspace    |
| OMPC-SSB Backend | 6001 | http://127.0.0.1:6001            | https://opc.mvpdark.top/api         | Content generation, review, image, auth             |
| OMPC-ZSCJ Admin UI |  -   | http://127.0.0.1:6002            | https://opc.mvpdark.top/zscj         | Knowledge base & trend collection admin UI (static) |
| OMPC-ZSCJ Backend| 6002 | http://127.0.0.1:6002            | https://opc.mvpdark.top/zscj/api    | Knowledge base CRUD, trend collection, compilation  |
| Health (SSB)     | 6001 | http://127.0.0.1:6001/health     | https://opc.mvpdark.top/health      | SSB backend health check                            |
| Health (ZSCJ)    | 6002 | http://127.0.0.1:6002/health     | https://opc.mvpdark.top/zscj/health | ZSCJ backend health check                           |
| API Docs (SSB)   | 6001 | http://127.0.0.1:6001/docs       | https://opc.mvpdark.top/docs        | SSB Swagger UI                                      |
| API Docs (ZSCJ)  | 6002 | http://127.0.0.1:6002/docs       | https://opc.mvpdark.top/zscj/docs   | ZSCJ Swagger UI                                     |
| Static (SSB)     | 6001 | http://127.0.0.1:6001/static     | https://opc.mvpdark.top/static      | SSB static assets                                   |

### Startup summary

| Component         | Port | Start command                                      |
|-------------------|------|----------------------------------------------------|
| OMPC-SSB Backend  | 6001 | `cd C:\TRAE\OMPC-SSB && START_OPC.bat` or `py scripts\start_local.py` |
| OMPC-SSB Frontend | 6000 | `cd C:\TRAE\OMPC-SSB\frontend && npm run dev`           |
| OMPC-ZSCJ Backend | 6002 | `cd C:\TRAE\OMPC-ZSCJ\backend && uvicorn app.main:app --host 0.0.0.0 --port 6002` |
| OMPC-ZSCJ Admin UI |  -   | served by ZSCJ backend at http://127.0.0.1:6002        |
| All services      | -    | `cd C:\TRAE\OMPC && py -3.14 start_ompc.py`            |

## Cloudflare Tunnel

- Tunnel ID: `a753843f-b31c-45b2-a041-d662105ad090`
- Tunnel name: configured via UUID in `~/.cloudflared/config.yml`
- Start command: `cloudflared tunnel run` (reads tunnel ID from config.yml automatically)
- Domain: `opc.mvpdark.top`
- Config: `~/.cloudflared/config.yml`
- LAN IP: `192.168.10.88`

Ingress rules (in order):
1. `/api/*`        -> SSB backend 6001
2. `/zscj/api/*`   -> ZSCJ backend 6002
3. `/static/*`     -> SSB backend 6001
4. `/health/*`     -> SSB backend 6001
5. `/docs/*`       -> SSB backend 6001
6. all other       -> SSB frontend 6000
7. catch-all       -> 404

## Database

### OMPC-SSB

Current mode: **SQLite** (local development)
- Database: `C:\TRAE\OMPC-SSB\artifacts\dev\opc-dev.db`
- Config: `C:\TRAE\OMPC-SSB\.env` -> `DATABASE_URL=sqlite:///./artifacts/dev/opc-dev.db`

### OMPC-ZSCJ

Current mode: **SQLite** (local development)
- Database: `C:\TRAE\OMPC-ZSCJ\backend\zscj.db` (created on first run)
- Config: `C:\TRAE\OMPC-ZSCJ\backend\.env` -> `DATABASE_URL=sqlite:///./zscj.db`
- Auth: `AUTH_REQUIRED=false` (default user for local development)

### Docker mode

Docker mode (PostgreSQL + Redis, requires Docker Desktop):
```powershell
cd C:\TRAE\OMPC
docker compose up -d
```
Then update `C:\TRAE\OMPC-SSB\.env`:
```
DATABASE_URL=postgresql+psycopg://postgres:postgres@localhost:5432/opc
```

## Sub-projects

- **OMPC-SSB** (`C:\TRAE\OMPC-SSB`): Postgraduate-to-PhD Xiaohongshu lead-generation
  content automation platform. Backend on port 6001, frontend on port 6000.
  Handles content generation, review (with `review_model`), image generation,
  and auth. See its `README.md` and `AGENTS.md` for details.
- **OMPC-ZSCJ** (`C:\TRAE\OMPC-ZSCJ`): Knowledge base and trend collection service,
  separated from OMPC-SSB as an independent service. Backend on port 6002,
  static HTML admin page served by its backend. Handles knowledge base CRUD, AI knowledge compilation,
  trend material collection (xiaohongshu/douyin), keyword analysis, and
  video transcript review. Admin-only (`AUTH_REQUIRED=false` by default for
  local development).

## Notes

- `E:\SSB` is kept as a backup of the original project before migration.
- The shell stays thin: only shared infra, launchers, and workspace-level docs
  live here. All business code belongs to sub-projects.
- First-time setup: `cd C:\TRAE\OMPC-SSB && py -3.14 scripts\setup_local.py`
