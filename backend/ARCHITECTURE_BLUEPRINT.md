# Zola Clone - Microservice Blueprint (Step 1)

## 1) Service Boundaries

- api-gateway: public entrypoint, auth pass-through, route aggregation.
- auth-service: register/login/refresh/logout/session management.
- user-service: profile, contact/friend relationship.
- chat-service:
  - PostgreSQL: conversation metadata, participant mapping, last message pointer.
  - MongoDB: message timeline (text/emoji/media/file/voice), recall/delete-for-me flags.
  - Redis: online/offline + typing TTL cache.
  - STOMP WebSocket signaling for realtime chat events.
- call-service: WebRTC signaling, call state, ICE candidate relay.
- notification-service: in-app + push/email notifications.
- file-service: upload/download signed URL for MinIO/S3.

## 2) Clean Architecture Layout (per service)

```text
src/main/java/com/zola/<service>/
  config/             # framework config (security, websocket, kafka, redis)
  controller/         # inbound adapters (REST / STOMP)
  dto/                # request/response DTO
  service/            # use-case orchestration
  repository/         # persistence adapters
  domain/             # domain model + business rules
```

## 3) Event-Driven Contracts

Kafka topics are centralized in `common` module:

- zola.chat.message.sent.v1
- zola.chat.message.recalled.v1
- zola.call.signal.v1
- zola.notification.created.v1

This keeps producer/consumer schemas stable across services.

## 4) Data Ownership

- auth-service -> PostgreSQL identity tables.
- user-service -> PostgreSQL user/social tables.
- chat-service -> PostgreSQL conversation + MongoDB message timeline.
- file-service -> object storage metadata in PostgreSQL, blob in MinIO/S3.

## 5) Next Steps

- Step 2: implement Auth + Chat core vertical slice end-to-end.
- Step 3: media/file pipeline + notification consumer.
- Step 4: call signaling and presence hardening.
