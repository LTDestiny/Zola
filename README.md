# Zola System Scaffold

Monorepo scaffold for the Zola chat platform based on the project specification.

## Included

- Backend microservice skeletons (Spring Boot 3 + Java 17)
- Frontend web skeleton (React + Vite + TypeScript)
- Infrastructure bootstrap (Docker Compose, coturn config, k8s placeholders, terraform placeholders)

## Quick Start

1. Copy `.env.example` to `.env` and update secrets.
2. Start local dependencies:
   - `docker compose -f infrastructure/docker-compose.yml up -d`
3. Import backend services as Maven projects.
4. Start the web app:
   - `cd frontend/web`
   - `npm install`
   - `npm run dev`

## Auto Bootstrap Behavior

When starting with Docker Compose:

- `db-bootstrap` checks PostgreSQL databases and creates missing ones only.
- `mongo-bootstrap` inserts seed documents only when target collections are empty.
- PostgreSQL table schemas and seed rows are managed by Flyway migrations per service.
- If data already exists, bootstrap and seed steps do not duplicate records.

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
