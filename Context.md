# Zola Context (Current Code Snapshot)

Last updated: 2026-04-11

## 1) System Overview

Zola is a microservice-based chat platform with a React web frontend and Spring Boot backend services.

Core runtime flow:

- Web client calls API Gateway (`:8080`) for REST APIs
- API Gateway routes to Auth/User/Chat services
- Chat service uses MongoDB for conversation/message data
- Relational data is split by service in PostgreSQL logical databases
- Redis is used for cache/session/pub-sub style support

## 2) Repository Structure

- `backend/`
  - `api-gateway` (port 8080)
  - `auth-service` (port 8081)
  - `user-service` (port 8082)
  - `chat-service` (port 8083)
  - `file-service` (port 8084)
  - `ai-service` (port 8085)
  - `notification-service` (port 8086)
  - `call-service` (port 8087)
  - `admin-service` (port 8088)
  - `common` shared module
- `frontend/web/` React + Vite app
- `infrastructure/` docker compose, bootstrap scripts, coturn config, k8s/terraform placeholders

## 3) Frontend Status

Frontend stack:

- React 18 + TypeScript + Vite
- `react-router-dom` routing
- `axios` for HTTP
- STOMP client dependency present for real-time messaging

Current routes:

- `/` home
- `/login`
- `/register`
- `/forgot-password`
- `/policy`
- `/chat` (protected by auth guard)

Auth behavior on web:

- Access/refresh token stored in localStorage
- Access token expiry timestamp tracked in localStorage
- Expired token is auto-cleared and user is redirected to `/login`
- `/chat` requires authenticated state via route guard

## 4) Backend Runtime Configuration

### API Gateway (`8080`)

- Depends on auth-service/user-service/chat-service
- Uses JWT secret and service URLs from environment

### Auth Service (`8081`)

- PostgreSQL database: `zola_identity_db`
- Redis dependency
- SMTP settings for OTP email
- JWT config:
  - Access token expiry: 900 seconds (15 minutes)
  - Refresh token expiry: 604800 seconds

### User Service (`8082`)

- PostgreSQL database: `zola_user_db`
- Redis dependency

### Chat Service (`8083`)

- MongoDB database: `zola_chat_db`
- Redis dependency
- JWT settings for token verification

### Extended Services

- `file-service` (`zola_file_db`)
- `ai-service` (`zola_ai_meta_db` + `zola_ai_db` in Mongo)
- `notification-service` (`zola_notification_db`)
- `call-service` (`zola_call_db`)
- `admin-service` (`zola_admin_db`)

## 5) Databases and Seeding

Default current setup prefers local PostgreSQL (outside Docker):

- `DB_HOST=host.docker.internal`
- `DB_USER=postgres`
- `DB_PASSWORD=admin`

Bootstrap utilities:

- `infrastructure/bootstrap/init-local-postgres.sql`
- `infrastructure/bootstrap/seed-local-auth-users.sql`
- `infrastructure/bootstrap/init-local-postgres.ps1`

Seed accounts in identity DB:

- `seed1@zola.app`
- `seed2@zola.app`
- `seed3@zola.app`

Seed password: `password123`

## 6) Docker Compose Profiles

Main compose file: `infrastructure/docker-compose.yml`

Profiles:

- `web`: frontend container (`zola-web`)
- `extended`: call/file/ai/notification/admin services
- `realtime`: coturn
- `local-pg-bootstrap`: Docker PostgreSQL + db-bootstrap helper

Base (no profile) includes:

- mongodb
- mongo-bootstrap
- redis
- api-gateway
- auth-service
- user-service
- chat-service

Dev override file:

- `infrastructure/docker-compose.dev.yml`
- Runs `zola-web` with `Dockerfile.dev` on port `5173`

## 7) Full Stack Dev Command

From repo root:

```powershell
docker compose -f infrastructure/docker-compose.yml -f infrastructure/docker-compose.dev.yml --profile web --profile extended --profile realtime up -d --build
```

Check status:

```powershell
docker compose -f infrastructure/docker-compose.yml -f infrastructure/docker-compose.dev.yml --profile web --profile extended --profile realtime ps
```

## 8) Known Environment Requirements

For full feature behavior, set these env vars in `.env`:

- `JWT_SECRET`
- SMTP: `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `MAIL_FROM`
- File service: `S3_BUCKET`, `AWS_ACCESS_KEY`, `AWS_SECRET_KEY`
- Call service: `TURN_SECRET`
- AI service: `OPENAI_API_KEY`

Without them, containers still start but related features may be limited or use blank defaults.
