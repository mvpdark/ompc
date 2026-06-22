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
- Backend API on http://127.0.0.1:8010
- ZSCJ API on http://127.0.0.1:8011
- Frontend app on http://127.0.0.1:3000
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

E:\OMPC-ZSCJ\          <- sub-project: knowledge base & trend collection service
  ├── backend\             FastAPI application (port 8011)
  ├── .venv\               Python virtual environment
  ├── .env                 environment config
  └── LOOP_LOG.md          loop engineering log
```

## Services

| Service  | Local URL                        | Public URL                          |
|----------|----------------------------------|-------------------------------------|
| Frontend | http://127.0.0.1:3000/?theme=mint | https://opc.mvpdark.top             |
| Backend  | http://127.0.0.1:8010            | https://opc.mvpdark.top/api         |
| ZSCJ     | http://127.0.0.1:8011            | https://opc.mvpdark.top/zscj/api    |
| Health   | http://127.0.0.1:8010/health     | https://opc.mvpdark.top/health      |
| API Docs | http://127.0.0.1:8010/docs       | https://opc.mvpdark.top/docs        |
| Static   | http://127.0.0.1:8010/static     | https://opc.mvpdark.top/static      |

## Cloudflare Tunnel

- Tunnel name: `opc-social-content-automation-live`
- Tunnel ID: `74d3c6d8-28e9-477e-bf32-128911ce015b`
- Domain: `opc.mvpdark.top`
- Config: `~/.cloudflared/config.yml`
- LAN IP: `192.168.10.88`

Ingress rules (in order):
1. `/api/*`    -> backend 8010
2. `/static/*` -> backend 8010
3. `/health/*` -> backend 8010
4. `/docs/*`   -> backend 8010
5. all other   -> frontend 3000
6. catch-all   -> 404

## Database

Current mode: **SQLite** (local development)
- Database: `E:\OMPC-SSB\artifacts\dev\opc-dev.db`
- Config: `E:\OMPC-SSB\.env` -> `DATABASE_URL=sqlite:///E:/OMPC-SSB/artifacts/dev/opc-dev.db`

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
  content automation platform. See its `README.md` and `AGENTS.md` for details.
- **OMPC-ZSCJ** (`E:\OMPC-ZSCJ`): Knowledge base and trend collection service
  (separated from OMPC-SSB). Runs on port 8011. Admin-only.

## Notes

- `E:\SSB` is kept as a backup of the original project before migration.
- The shell stays thin: only shared infra, launchers, and workspace-level docs
  live here. All business code belongs to sub-projects.
- First-time setup: `cd E:\OMPC-SSB && py -3.14 scripts\setup_local.py`
