# OMPC Workspace

OMPC is the workspace shell that hosts sub-projects, shared infrastructure,
and the Cloudflare tunnel entry point.

## Quick Start

### Start all services (backend + frontend + tunnel)

Double-click `START_OMPC.bat` or run:

```powershell
cd E:\OMPC
py -3.14 start_ompc.py
```

This starts:
- OMPC-SSB backend API on http://127.0.0.1:8010
- OMPC-ZSCJ backend API on http://127.0.0.1:8011
- OMPC-SSB frontend app on http://127.0.0.1:3000
- OMPC-ZSCJ frontend app on http://127.0.0.1:3001
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
E:\OMPC\              <- this shell (workspace root)
  ├── START_OMPC.bat        unified launcher (backend + frontend + tunnel)
  ├── start_ompc.py         Python launcher with status/stop support
  ├── docker-compose.yml    shared infrastructure (PostgreSQL+pgvector, Redis)
  ├── infra\                shared infra configs (Cloudflare tunnel template)
  └── README.md             this file

E:\OMPC-SSB\          <- sub-project: postgraduate-to-PhD content automation
  ├── backend\             FastAPI application (port 8010)
  ├── frontend\            Next.js workspace (port 3000)
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

E:\OMPC-ZSCJ\          <- sub-project: knowledge base & trend collection service (independent)
  ├── backend\             FastAPI application (port 8011) - knowledge base + trend collection
  ├── frontend\            Next.js workspace (port 3001) - knowledge & trends admin UI
  ├── .venv\               Python virtual environment
  ├── prompts\             prompt templates (knowledge compile, review, style reference)
  ├── .env                 environment config (SQLite mode, AUTH_REQUIRED=false)
  ├── LOOP_LOG.md          loop engineering log
  └── LOOP_LOG_1-100.md    archived loop log
```

## Services

| Service          | Port | Local URL                        | Public URL                          | Responsibility                                      |
|------------------|------|----------------------------------|-------------------------------------|-----------------------------------------------------|
| OMPC-SSB Frontend| 3000 | http://127.0.0.1:3000/?theme=mint| https://opc.mvpdark.top             | Postgraduate-to-PhD content automation workspace    |
| OMPC-SSB Backend | 8010 | http://127.0.0.1:8010            | https://opc.mvpdark.top/api         | Content generation, review, image, auth             |
| OMPC-ZSCJ Frontend| 3001| http://127.0.0.1:3001            | https://opc.mvpdark.top:3001        | Knowledge base & trend collection admin UI          |
| OMPC-ZSCJ Backend| 8011 | http://127.0.0.1:8011            | https://opc.mvpdark.top/zscj/api    | Knowledge base CRUD, trend collection, compilation  |
| Health (SSB)     | 8010 | http://127.0.0.1:8010/health     | https://opc.mvpdark.top/health      | SSB backend health check                            |
| Health (ZSCJ)    | 8011 | http://127.0.0.1:8011/health     | https://opc.mvpdark.top/zscj/health | ZSCJ backend health check                           |
| API Docs (SSB)   | 8010 | http://127.0.0.1:8010/docs       | https://opc.mvpdark.top/docs        | SSB Swagger UI                                      |
| API Docs (ZSCJ)  | 8011 | http://127.0.0.1:8011/docs       | https://opc.mvpdark.top/zscj/docs   | ZSCJ Swagger UI                                     |
| Static (SSB)     | 8010 | http://127.0.0.1:8010/static     | https://opc.mvpdark.top/static      | SSB static assets                                   |

### Startup summary

| Component         | Port | Start command                                      |
|-------------------|------|----------------------------------------------------|
| OMPC-SSB Backend  | 8010 | `cd E:\OMPC-SSB && START_OPC.bat` or `py scripts\start_local.py` |
| OMPC-SSB Frontend | 3000 | `cd E:\OMPC-SSB\frontend && npm run dev`           |
| OMPC-ZSCJ Backend | 8011 | `cd E:\OMPC-ZSCJ\backend && uvicorn app.main:app --host 0.0.0.0 --port 8011` |
| OMPC-ZSCJ Frontend| 3001 | `cd E:\OMPC-ZSCJ\frontend && npm run dev`          |
| All services      | -    | `cd E:\OMPC && py -3.14 start_ompc.py`            |

## Cloudflare Tunnel

- Tunnel name: `opc-social-content-automation-live`
- Tunnel ID: `74d3c6d8-28e9-477e-bf32-128911ce015b`
- Domain: `opc.mvpdark.top`
- Config: `~/.cloudflared/config.yml`
- LAN IP: `192.168.10.88`

Ingress rules (in order):
1. `/api/*`        -> SSB backend 8010
2. `/zscj/api/*`   -> ZSCJ backend 8011
3. `/static/*`     -> SSB backend 8010
4. `/health/*`     -> SSB backend 8010
5. `/docs/*`       -> SSB backend 8010
6. all other       -> SSB frontend 3000
7. catch-all       -> 404

## Database

### OMPC-SSB

Current mode: **SQLite** (local development)
- Database: `E:\OMPC-SSB\artifacts\dev\opc-dev.db`
- Config: `E:\OMPC-SSB\.env` -> `DATABASE_URL=sqlite:///E:/OMPC-SSB/artifacts/dev/opc-dev.db`

### OMPC-ZSCJ

Current mode: **SQLite** (local development)
- Database: `E:\OMPC-ZSCJ\backend\zscj.db`
- Config: `E:\OMPC-ZSCJ\backend\.env` -> `DATABASE_URL=sqlite:///./zscj.db`
- Auth: `AUTH_REQUIRED=false` (default user for local development)

### Docker mode

Docker mode (PostgreSQL + Redis, requires Docker Desktop):
```powershell
cd E:\OMPC
docker compose up -d
```
Then update `E:\OMPC-SSB\.env`:
```
DATABASE_URL=postgresql+psycopg://postgres:postgres@localhost:5432/opc
```

## Sub-projects

- **OMPC-SSB** (`E:\OMPC-SSB`): Postgraduate-to-PhD Xiaohongshu lead-generation
  content automation platform. Backend on port 8010, frontend on port 3000.
  Handles content generation, review (with `review_model`), image generation,
  and auth. See its `README.md` and `AGENTS.md` for details.
- **OMPC-ZSCJ** (`E:\OMPC-ZSCJ`): Knowledge base and trend collection service,
  separated from OMPC-SSB as an independent service. Backend on port 8011,
  frontend on port 3001. Handles knowledge base CRUD, AI knowledge compilation,
  trend material collection (xiaohongshu/douyin), keyword analysis, and
  video transcript review. Admin-only (`AUTH_REQUIRED=false` by default for
  local development).

## Notes

- `E:\SSB` is kept as a backup of the original project before migration.
- The shell stays thin: only shared infra, launchers, and workspace-level docs
  live here. All business code belongs to sub-projects.
- First-time setup: `cd E:\OMPC-SSB && py -3.14 scripts\setup_local.py`
