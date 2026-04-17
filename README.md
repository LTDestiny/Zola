# Zola System Scaffold

Monorepo scaffold for the Zola chat platform based on the project specification.

## Included

- Backend microservice skeletons (Spring Boot 3 + Java 17)
- Frontend web skeleton (React + Vite + TypeScript)
- Infrastructure bootstrap (Docker Compose, coturn config, k8s placeholders, terraform placeholders)

## Quick Start

1. Copy `.env.example` to `.env` and update secrets.
2. Start core containers (lean mode):
   - `docker compose -f infrastructure/docker-compose.yml up -d`
3. Import backend services as Maven projects.
4. Start the web app:
   - `cd frontend/web`
   - `npm install`
   - `npm run dev`

## Full Stack Dev Run (All Services)

To run all backend services + coturn + frontend in dev mode (Vite at 5173):

- `docker compose -f infrastructure/docker-compose.yml -f infrastructure/docker-compose.dev.yml --profile web --profile extended --profile realtime up -d --build`

To check running containers:

- `docker compose -f infrastructure/docker-compose.yml -f infrastructure/docker-compose.dev.yml --profile web --profile extended --profile realtime ps`

To stop full dev stack:

- `docker compose -f infrastructure/docker-compose.yml -f infrastructure/docker-compose.dev.yml --profile web --profile extended --profile realtime down`

## Docker Compose Profiles (Container Optimization)

Default `up -d` now starts only the core chat/auth stack:

- `mongodb`, `mongo-bootstrap`, `redis`
- `auth-service`, `user-service`, `chat-service`, `api-gateway`

Optional profiles:

- `--profile web`: run `zola-web` (Nginx production web container)
- `--profile extended`: run `call-service`, `file-service`, `ai-service`, `notification-service`, `admin-service`
- `--profile realtime`: run `coturn` for WebRTC/TURN
- `--profile local-pg-bootstrap`: run Docker PostgreSQL + `db-bootstrap` only when needed

Examples:

- Core + web:
  - `docker compose -f infrastructure/docker-compose.yml --profile web up -d --build`
- Core + extended services:
  - `docker compose -f infrastructure/docker-compose.yml --profile extended up -d --build`
- Full stack:
  - `docker compose -f infrastructure/docker-compose.yml --profile web --profile extended --profile realtime up -d --build`

Note:

- Default Docker DB host is `host.docker.internal` with defaults `postgres/root`.
- If you use Docker PostgreSQL (`local-pg-bootstrap`), set `DB_HOST_DOCKER=postgres` before `docker compose up`.
- If you only use local PostgreSQL (pgAdmin), do not enable `local-pg-bootstrap`.

## Docker Web Modes (Dev and Prod)

- Production mode (Nginx static build):
  - Uses `frontend/web/Dockerfile.prod`
  - Start with: `docker compose -f infrastructure/docker-compose.yml up -d --build zola-web`
  - Open: `http://localhost:3000`

- Development mode (auto update on code changes):
  - Uses `frontend/web/Dockerfile.dev` and bind-mount source code
  - Start with:
    - `docker compose -f infrastructure/docker-compose.yml -f infrastructure/docker-compose.dev.yml up -d --build zola-web`
  - Open: `http://localhost:5173`
  - Any file change in `frontend/web/src` hot-reloads in container.

## Authentication Notes

- Login flow now uses Email OTP:
  - `POST /api/v1/auth/login/request-otp`
  - `POST /api/v1/auth/login/verify-otp`
- Register requires policy consent (`acceptedPolicy=true`).
- SMTP is used as a third-party email provider for OTP delivery. Configure:
  - `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `MAIL_FROM`
- Session rule:
  - Each account can only keep one active `WEB` session and one active `MOBILE` session at the same time.
  - Logging in again on the same device type revokes older sessions of that type.

## Auto Bootstrap Behavior

When starting with Docker Compose:

- `db-bootstrap` (when `local-pg-bootstrap` profile is enabled) checks PostgreSQL databases and creates missing ones only.
- `mongo-bootstrap` inserts seed documents only when target collections are empty.
- PostgreSQL table schemas and seed rows are managed by Flyway migrations per service.
- If data already exists, bootstrap and seed steps do not duplicate records.

### Local PostgreSQL Bootstrap (without Docker PostgreSQL)

If you run PostgreSQL on host machine and want service DBs + seed users:

- `cd infrastructure/bootstrap`
- `powershell -ExecutionPolicy Bypass -File .\init-local-postgres.ps1`

Seed auth users created:

- `seed1@zola.app`
- `seed2@zola.app`
- `seed3@zola.app`

Seed password:

- `password123`

## Suggested Build Order

1. Phase 1: auth-service + api-gateway + basic web auth screens.
2. Phase 2: user-service + chat-service + websocket chat flow.
3. Phase 3: notification-service + file-service.
4. Phase 4: call-service + coturn + webRTC UI.
5. Phase 5: admin-service + security hardening.
6. Phase 6: CI/CD + Terraform + Kubernetes.

## Recommended Database Split

For this architecture, a practical split is:

- PostgreSQL: 8 logical databases on 1 PostgreSQL server
  - zola_identity_db: users, sessions, security logs, otp logs (auth-service)
  - zola_user_db: friendships, groups, group members (user-service)
  - zola_call_db: call logs (call-service)
  - zola_file_db: file audit or metadata if needed (file-service)
  - zola_ai_meta_db: AI usage and billing metadata (ai-service)
  - zola_notification_db: notification records (notification-service)
  - zola_admin_db: reports and moderation records (admin-service)
  - zola_gateway_db: reserved for gateway metadata (optional)

- MongoDB: 2 logical databases on 1 MongoDB server
  - zola_chat_db: conversations, messages, media refs, edit history (chat-service)
  - zola_ai_db: ai conversations and context memory (ai-service)

Notes:

- This split keeps Flyway ownership clean: one PostgreSQL schema owner per service.
- Cross-database foreign keys are not used; consistency is handled in service logic and events.
- In early-stage environments, all logical databases can run on one PostgreSQL instance and one MongoDB instance.
