# ZOLA — Master Build Prompt v2

> Phiên bản mở rộng: Security · Sessions · Media · Call · Admin
> Copy toàn bộ vào Cursor AI / Claude Code / GitHub Copilot Chat

---

## 🎯 PROJECT OVERVIEW

Build **Zola** — ứng dụng OTT chat real-time kiểu Zalo.
Architecture: **Microservices + Event-Driven** trên AWS cloud.

### Tech Stack

| Layer            | Technology                                              |
| ---------------- | ------------------------------------------------------- |
| Web Frontend     | React 18 + TypeScript + Tailwind CSS + Shadcn/ui + Vite |
| Mobile           | React Native + TypeScript (Android)                     |
| Backend Services | Java 17 + Spring Boot 3.x                               |
| Auth             | JWT (access + refresh tokens) + bcrypt                  |
| Real-time Chat   | WebSocket + STOMP protocol                              |
| Real-time Call   | WebRTC + STUN/TURN (Coturn)                             |
| SQL Database     | PostgreSQL 15 (Amazon RDS)                              |
| NoSQL Database   | MongoDB 7 (messages, conversations)                     |
| Cache / Pub-Sub  | Redis 7 (Amazon ElastiCache)                            |
| File Storage     | Amazon S3 + CloudFront CDN                              |
| AI Chatbot       | OpenAI API (GPT-4o-mini)                                |
| Containerization | Docker + Docker Compose                                 |
| Orchestration    | Kubernetes (AWS EKS)                                    |
| IaC              | Terraform                                               |
| CI/CD            | GitHub Actions                                          |

---

## 🏗️ SYSTEM ARCHITECTURE

```
┌─────────────────────────────────────────────────────┐
│                   CLIENT LAYER                       │
│      [React Web]              [React Native Android] │
└──────────┬──────────────────────────────┬────────────┘
           │ REST / WebSocket / WebRTC     │
┌──────────▼──────────────────────────────▼────────────┐
│                   API GATEWAY                         │
│  JWT filter · Rate limit · CORS · Circuit breaker     │
└───┬──────┬──────┬──────┬──────┬──────┬──────┬────────┘
   │      │      │      │      │      │      │
┌──▼─┐ ┌──▼─┐ ┌──▼──┐ ┌─▼──┐ ┌▼───┐ ┌▼────┐ ┌▼──────┐
│Auth│ │User│ │Chat │ │Notif│ │File│ │ AI  │ │ Call  │
│Svc │ │Svc │ │ Svc │ │ Svc │ │Svc │ │ Svc │ │  Svc  │
└──┬─┘ └──┬─┘ └──┬──┘ └─┬──┘ └┬───┘ └┬────┘ └┬──────┘
   └──────┴──────┴───────┴─────┴──────┴───────┘
                         │
           ┌─────────────▼─────────────┐
           │  EVENT BUS (Redis Pub/Sub) │
           └──────┬──────────┬─────────┘
                  │          │
           ┌──────▼──┐  ┌────▼────┐  ┌──────────┐
           │PostgreSQL│  │ MongoDB │  │  Redis   │
           │  (RDS)  │  │         │  │  Cache   │
           └─────────┘  └─────────┘  └──────────┘
                                           │
                                    ┌──────▼──────┐
                                    │ Coturn TURN │
                                    │   Server    │
                                    └─────────────┘
```

---

## 📁 PROJECT STRUCTURE

```
zola/
├── backend/
│   ├── api-gateway/
│   ├── auth-service/
│   ├── user-service/
│   ├── chat-service/
│   ├── call-service/          # WebRTC signaling
│   ├── notification-service/
│   ├── file-service/
│   ├── ai-service/
│   ├── admin-service/         # Dashboard, moderation
│   └── common/                # Shared DTOs, exceptions, events
├── frontend/
│   ├── web/
│   └── mobile/
├── infrastructure/
│   ├── terraform/
│   ├── k8s/
│   ├── coturn/                # TURN server config
│   └── docker-compose.yml
└── .github/workflows/
```

---

## 🗄️ DATABASE SCHEMAS

### PostgreSQL (Relational Data)

```sql
-- =============================================
-- USERS
-- =============================================
CREATE TABLE users (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email           VARCHAR(255) UNIQUE,
    phone           VARCHAR(20)  UNIQUE,
    -- Chỉ một trong hai (email hoặc phone) làm định danh chính
    identity_type   VARCHAR(10) NOT NULL DEFAULT 'EMAIL', -- EMAIL | PHONE
    password_hash   VARCHAR(255) NOT NULL,
    full_name       VARCHAR(100) NOT NULL,
    avatar_url      TEXT,
    gender          VARCHAR(10),
    birthdate       DATE,
    is_online       BOOLEAN DEFAULT FALSE,
    last_seen_at    TIMESTAMP,
    is_active       BOOLEAN DEFAULT TRUE,        -- soft disable (khóa tài khoản)
    is_deleted      BOOLEAN DEFAULT FALSE,       -- hard delete flag
    deleted_at      TIMESTAMP,
    email_verified  BOOLEAN DEFAULT FALSE,
    phone_verified  BOOLEAN DEFAULT FALSE,
    -- 2FA
    two_fa_enabled  BOOLEAN DEFAULT FALSE,
    two_fa_secret   VARCHAR(255),                -- TOTP secret (encrypted)
    -- ToS
    tos_accepted_at TIMESTAMP,
    tos_version     VARCHAR(20),
    created_at      TIMESTAMP DEFAULT NOW(),
    updated_at      TIMESTAMP DEFAULT NOW()
);

-- =============================================
-- SESSIONS & DEVICES
-- =============================================
CREATE TABLE user_sessions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    refresh_token   TEXT NOT NULL UNIQUE,
    device_name     VARCHAR(200),
    device_type     VARCHAR(50),                 -- WEB | ANDROID | IOS
    ip_address      VARCHAR(45),
    user_agent      TEXT,
    is_active       BOOLEAN DEFAULT TRUE,
    expires_at      TIMESTAMP NOT NULL,
    last_used_at    TIMESTAMP DEFAULT NOW(),
    created_at      TIMESTAMP DEFAULT NOW()
);

-- =============================================
-- SECURITY LOGS
-- =============================================
CREATE TABLE security_logs (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID REFERENCES users(id),
    event_type      VARCHAR(50) NOT NULL,
    -- LOGIN | LOGOUT | PASSWORD_CHANGE | FAILED_LOGIN
    -- RESET_REQUEST | 2FA_ENABLED | ACCOUNT_LOCKED
    ip_address      VARCHAR(45),
    device_info     TEXT,
    metadata        JSONB,
    created_at      TIMESTAMP DEFAULT NOW()
);

-- =============================================
-- OTP / RESET TOKENS (lưu Redis chính, PG backup)
-- =============================================
CREATE TABLE otp_logs (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID REFERENCES users(id),
    identifier      VARCHAR(255) NOT NULL,       -- email or phone
    otp_type        VARCHAR(30)  NOT NULL,
    -- RESET_PASSWORD | EMAIL_VERIFY | PHONE_VERIFY | 2FA_SETUP
    attempts        INT DEFAULT 0,
    sent_at         TIMESTAMP DEFAULT NOW(),
    expires_at      TIMESTAMP NOT NULL,
    used_at         TIMESTAMP
);

-- =============================================
-- FRIENDSHIPS (soft relationship)
-- =============================================
CREATE TABLE friendships (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    requester_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    addressee_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status          VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    -- PENDING | ACCEPTED | BLOCKED | REJECTED
    -- Không xóa cứng: unfriend → đổi status thành 'UNFRIENDED'
    nickname        VARCHAR(100),               -- tên gọi riêng tư
    updated_at      TIMESTAMP DEFAULT NOW(),
    created_at      TIMESTAMP DEFAULT NOW(),
    UNIQUE(requester_id, addressee_id)
);

-- =============================================
-- GROUPS
-- =============================================
CREATE TABLE groups (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name            VARCHAR(100) NOT NULL,
    avatar_url      TEXT,
    owner_id        UUID NOT NULL REFERENCES users(id),
    is_active       BOOLEAN DEFAULT TRUE,
    created_at      TIMESTAMP DEFAULT NOW(),
    updated_at      TIMESTAMP DEFAULT NOW()
);

CREATE TABLE group_members (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id        UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role            VARCHAR(20) NOT NULL DEFAULT 'MEMBER', -- OWNER | MEMBER
    nickname        VARCHAR(100),
    joined_at       TIMESTAMP DEFAULT NOW(),
    UNIQUE(group_id, user_id)
);

-- =============================================
-- NOTIFICATIONS
-- =============================================
CREATE TABLE notifications (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type            VARCHAR(50) NOT NULL,
    content         TEXT NOT NULL,
    reference_id    UUID,
    is_read         BOOLEAN DEFAULT FALSE,
    created_at      TIMESTAMP DEFAULT NOW()
);

-- =============================================
-- CALL HISTORY
-- =============================================
CREATE TABLE call_logs (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    caller_id       UUID NOT NULL REFERENCES users(id),
    callee_id       UUID REFERENCES users(id),          -- NULL nếu call nhóm
    group_id        UUID REFERENCES groups(id),
    call_type       VARCHAR(10) NOT NULL,               -- AUDIO | VIDEO
    call_mode       VARCHAR(10) NOT NULL,               -- ONE_TO_ONE | GROUP
    status          VARCHAR(20) NOT NULL,
    -- COMPLETED | MISSED | REJECTED | CANCELLED | NO_ANSWER
    started_at      TIMESTAMP,
    ended_at        TIMESTAMP,
    duration_sec    INT DEFAULT 0,
    created_at      TIMESTAMP DEFAULT NOW()
);

-- =============================================
-- REPORT / MODERATION
-- =============================================
CREATE TABLE reports (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reporter_id     UUID NOT NULL REFERENCES users(id),
    target_type     VARCHAR(20) NOT NULL,              -- USER | MESSAGE | GROUP
    target_id       UUID NOT NULL,
    reason          VARCHAR(100) NOT NULL,
    description     TEXT,
    status          VARCHAR(20) DEFAULT 'PENDING',     -- PENDING | REVIEWED | DISMISSED
    reviewed_by     UUID REFERENCES users(id),
    reviewed_at     TIMESTAMP,
    created_at      TIMESTAMP DEFAULT NOW()
);
```

### MongoDB (Message Data)

```javascript
// conversations
{
  _id: ObjectId,
  type: "DIRECT" | "GROUP",
  participants: ["userId1", "userId2"],
  group_id: "uuid",
  last_message: {
    content: String,
    sender_id: String,
    type: String,
    sent_at: Date
  },
  updated_at: Date,
  created_at: Date
}

// messages
{
  _id: ObjectId,
  conversation_id: ObjectId,
  sender_id: String,
  type: "TEXT" | "IMAGE" | "VIDEO" | "FILE" | "VOICE" | "GIF" | "STICKER" | "EMOJI",
  content: String,
  file_url: String,         // S3 / CDN URL
  file_name: String,
  file_size: Number,
  file_type: String,        // mime type
  thumbnail_url: String,    // video/image preview
  duration_sec: Number,     // voice/video
  reply_to: ObjectId,       // tin nhắn được reply
  forwarded_from: ObjectId, // nếu forward
  is_deleted: Boolean,      // xóa phía mình (chỉ ẩn UI)
  is_recalled: Boolean,     // thu hồi 2 phía
  recalled_at: Date,
  edited_at: Date,          // lịch sử chỉnh sửa
  auto_delete_at: Date,     // tự xóa sau thời gian
  read_by: [{ user_id: String, read_at: Date }],
  pin_order: Number,        // != null nếu được ghim
  created_at: Date,
  updated_at: Date
}

// message_edits — lưu lịch sử chỉnh sửa
{
  _id: ObjectId,
  message_id: ObjectId,
  previous_content: String,
  edited_at: Date
}

// media_refs — quản lý ownership file (1 file vật lý, nhiều reference)
{
  _id: ObjectId,
  s3_key: String,           // file vật lý gốc
  s3_url: String,
  cdn_url: String,
  uploader_id: String,
  file_size: Number,
  mime_type: String,
  checksum: String,         // dedup
  ref_count: Number,        // số lượng message tham chiếu
  is_deleted: Boolean,      // chỉ xóa khi ref_count = 0
  created_at: Date
}

// ai_conversations
{
  _id: ObjectId,
  user_id: String,
  messages: [{ role: "user"|"assistant", content: String, timestamp: Date }],
  token_count: Number,
  updated_at: Date,
  created_at: Date
}
```

### Redis Keys Structure

```
# Sessions
session:{userId}:{sessionId}         → session metadata (TTL = refresh token expiry)
online:{userId}                      → "1" (TTL = 30s, heartbeat)
typing:{conversationId}:{userId}     → "1" (TTL = 3s)

# Rate limiting
rate:otp:{identifier}                → count (TTL = 1 hour)
rate:login:{ip}                      → count (TTL = 15 min)
rate:api:{userId}                    → count (TTL = 1 min)

# OTP
otp:{type}:{identifier}             → { code, attempts } (TTL = 10 min)

# Cache
user:{userId}                        → user profile JSON (TTL = 5 min)
conversation:{conversationId}        → conversation metadata (TTL = 10 min)

# Pub/Sub channels
zola:message:new
zola:message:recalled
zola:friend:request
zola:friend:accepted
zola:call:invite
zola:call:end
zola:user:online
zola:user:offline
```

---

## 🔐 AUTH SERVICE (Port 8081)

### Endpoints

```
POST /api/v1/auth/register               Đăng ký (email hoặc phone)
POST /api/v1/auth/login                  Đăng nhập
POST /api/v1/auth/refresh                Làm mới access token
POST /api/v1/auth/logout                 Đăng xuất thiết bị hiện tại
POST /api/v1/auth/logout-all             Đăng xuất tất cả thiết bị
GET  /api/v1/auth/sessions               Danh sách thiết bị đang đăng nhập
DELETE /api/v1/auth/sessions/{id}        Đăng xuất từ xa theo session
POST /api/v1/auth/forgot-password        Gửi OTP reset password
POST /api/v1/auth/verify-otp             Xác minh OTP
POST /api/v1/auth/reset-password         Đặt lại mật khẩu
POST /api/v1/auth/change-password        Đổi mật khẩu (cần auth + OTP)
POST /api/v1/auth/verify-email           Gửi email xác thực
POST /api/v1/auth/confirm-email          Xác nhận email
POST /api/v1/auth/2fa/enable             Bật 2FA (TOTP)
POST /api/v1/auth/2fa/verify             Xác minh TOTP code
POST /api/v1/auth/2fa/disable            Tắt 2FA
POST /api/v1/auth/tos/accept             Ghi nhận đồng ý điều khoản
```

### Token Logic

```java
// Access Token: JWT, expire 15 phút
// Refresh Token: UUID lưu PostgreSQL, expire 7 ngày
// Sau khi đổi mật khẩu: revoke ALL refresh tokens của user đó
// Logout từ xa: xóa session record + xóa Redis cache

// JWT payload
{
  "sub": "user-uuid",
  "email": "user@example.com",
  "sessionId": "session-uuid",   // để revoke chính xác
  "iat": 1700000000,
  "exp": 1700000900,
  "type": "ACCESS"
}
```

### OTP Logic

```java
// Rate limit (lưu Redis):
//   - Tối đa 5 lần gửi OTP / identifier / giờ
//   - Delay: 60s giữa 2 lần gửi liên tiếp
//   - Tối đa 3 lần nhập sai → khóa OTP 15 phút
//   - IP rate limit: 20 request / 15 phút

// Nếu có ai spam reset password cho user:
//   → push notification tới thiết bị đang login:
//     "Có yêu cầu đặt lại mật khẩu. Nếu không phải bạn, hãy kiểm tra bảo mật."

// Mỗi OTP:
//   - 6 chữ số
//   - TTL: 10 phút
//   - Dùng 1 lần rồi invalidate
//   - Không cho phép reuse OTP cũ
```

### 2FA (TOTP — Google Authenticator)

```java
// Khi enable 2FA:
//   1. Sinh TOTP secret
//   2. Mã hóa AES-256 trước khi lưu DB
//   3. Trả QR code / manual key cho user scan
//   4. Bắt xác minh 1 lần trước khi save để đảm bảo user đã setup đúng

// 2FA bắt buộc áp dụng khi:
//   - Đăng nhập từ IP / device lạ
//   - Đổi email / phone
//   - Đổi mật khẩu
//   - Xóa tài khoản
//   - Disable 2FA
```

### Account Lifecycle

```java
// SOFT LOCK (khóa tài khoản):
//   users.is_active = false
//   → revoke tất cả sessions
//   → ẩn khỏi tìm kiếm
//   → không thể login nhưng giữ toàn bộ data

// HARD DELETE (xóa tài khoản):
//   1. Xóa PII: email, phone, full_name, avatar → replace bằng anonymized value
//   2. Xóa tất cả sessions
//   3. Xóa cache Redis
//   4. Đánh dấu users.is_deleted = true, deleted_at = NOW()
//   5. File media: giảm ref_count, xóa vật lý khi ref_count = 0
//   6. Giữ lại: security_logs, call_logs, report records (theo yêu cầu pháp lý)
//   7. Gửi confirmation email
```

---

## 👤 USER SERVICE (Port 8082)

### Endpoints

```
GET    /api/v1/users/me
PUT    /api/v1/users/me
GET    /api/v1/users/search?email={email}

# Friendships
GET    /api/v1/friends
POST   /api/v1/friends/request
GET    /api/v1/friends/requests/received
GET    /api/v1/friends/requests/sent
PUT    /api/v1/friends/request/{id}/accept
PUT    /api/v1/friends/request/{id}/reject
DELETE /api/v1/friends/request/{id}
DELETE /api/v1/friends/{friendId}          # Unfriend: đổi status, KHÔNG xóa record
POST   /api/v1/friends/{userId}/block      # Block
DELETE /api/v1/friends/{userId}/block      # Unblock

# Groups
GET    /api/v1/groups
POST   /api/v1/groups
GET    /api/v1/groups/{id}
PUT    /api/v1/groups/{id}
DELETE /api/v1/groups/{id}
POST   /api/v1/groups/{id}/members
DELETE /api/v1/groups/{id}/members/{userId}
PUT    /api/v1/groups/{id}/leave
PUT    /api/v1/groups/{id}/members/{userId}/role
```

### Friendship Status Machine

```
(none) ──request──▶ PENDING
PENDING ──accept──▶ ACCEPTED
PENDING ──reject──▶ REJECTED
ACCEPTED ──unfriend──▶ UNFRIENDED   (không xóa record, không xóa chat history)
ACCEPTED/UNFRIENDED ──block──▶ BLOCKED
BLOCKED ──unblock──▶ UNFRIENDED
```

---

## 💬 CHAT SERVICE (Port 8083)

### REST Endpoints

```
GET    /api/v1/conversations
GET    /api/v1/conversations/{id}/messages    (pagination, cursor-based)
POST   /api/v1/conversations/{id}/messages/search
GET    /api/v1/conversations/{id}/pinned      Tin nhắn đã ghim
POST   /api/v1/messages/{id}/pin
DELETE /api/v1/messages/{id}/pin
DELETE /api/v1/messages/{id}                 Xóa phía mình (ẩn UI)
PUT    /api/v1/messages/{id}/recall          Thu hồi 2 phía
PUT    /api/v1/messages/{id}/edit            Chỉnh sửa tin nhắn
PUT    /api/v1/conversations/{id}/read
PUT    /api/v1/messages/{id}/auto-delete     Đặt tự xóa
```

### WebSocket (STOMP)

```
Connect: ws://host/ws  (Authorization: Bearer {token})

Subscribe:
  /user/queue/messages           Nhận tin nhắn 1-1 mới
  /user/queue/notifications      Notification cá nhân
  /user/queue/typing             Typing indicator của bạn chat
  /user/queue/read-receipts      Đã xem
  /topic/group/{groupId}         Tin nhắn nhóm

Send (client → server):
  /app/chat.send                 Gửi tin nhắn
  /app/chat.typing               Đang gõ
  /app/chat.stopTyping           Ngừng gõ
  /app/chat.read                 Đánh dấu đã đọc
  /app/chat.recall               Thu hồi
```

### Message payload

```json
{
  "conversationId": "...",
  "type": "TEXT",
  "content": "Hello!",
  "replyTo": null,
  "fileUrl": null,
  "autoDeleteSeconds": null
}
```

### Event-driven flow

```
Client gửi message → Chat Service
  ├─ Lưu MongoDB (messages)
  ├─ Cập nhật conversation.last_message
  ├─ Publish event zola:message:new → Redis Pub/Sub
  │     ├─ Notification Service → push notification tới offline users
  │     └─ Online users nhận trực tiếp qua WebSocket
  └─ Trả ACK cho sender
```

---

## 📞 CALL SERVICE (Port 8087)

### Endpoints

```
POST   /api/v1/calls/initiate            Khởi tạo cuộc gọi (lấy room ID)
POST   /api/v1/calls/{id}/answer         Trả lời cuộc gọi
POST   /api/v1/calls/{id}/reject         Từ chối
POST   /api/v1/calls/{id}/end            Kết thúc cuộc gọi
POST   /api/v1/calls/{id}/join           Tham gia cuộc gọi nhóm
POST   /api/v1/calls/{id}/leave          Rời cuộc gọi nhóm
GET    /api/v1/calls/history             Lịch sử cuộc gọi
GET    /api/v1/calls/ice-servers         Trả về STUN/TURN credentials
```

### WebRTC Signaling (WebSocket)

```
/app/call.offer        Gửi SDP offer
/app/call.answer       Gửi SDP answer
/app/call.ice          Gửi ICE candidate
/app/call.end          Kết thúc
/app/call.mute         Mute/unmute mic
/app/call.video        Toggle camera
```

### Call States

```
INITIATING → RINGING → ACTIVE → ENDED
                ├─→ MISSED (không trả lời sau 30s)
                ├─→ REJECTED (callee từ chối)
                └─→ CANCELLED (caller huỷ)
```

### TURN Server Config (Coturn)

```bash
# coturn/turnserver.conf
listening-port=3478
tls-listening-port=5349
realm=zola.app
server-name=turn.zola.app
use-auth-secret
static-auth-secret=${TURN_SECRET}
cert=/etc/ssl/turn.pem
pkey=/etc/ssl/turn-key.pem
```

```java
// Trả về credentials tạm thời (expire 1 giờ)
// GET /api/v1/calls/ice-servers
{
  "iceServers": [
    { "urls": "stun:stun.zola.app:3478" },
    {
      "urls": "turn:turn.zola.app:3478",
      "username": "timestamp:userId",
      "credential": "hmac_sha1(secret, username)"
    }
  ]
}
```

---

## 📁 FILE SERVICE (Port 8084)

### Endpoints

```
POST   /api/v1/files/upload              Upload file (multipart)
POST   /api/v1/files/presigned-url       Lấy presigned URL upload trực tiếp lên S3
DELETE /api/v1/files/{key}               Giảm ref_count; xóa S3 khi ref_count = 0
GET    /api/v1/files/{key}/url           Lấy CDN URL mới (nếu presigned hết hạn)
```

### File Rules

```yaml
limits:
  max_file_size: 100MB
  max_image_size: 20MB
  max_video_size: 10MB # per tin nhắn
  max_voice_size: 5MB
  allowed_image_types: [jpg, jpeg, png, gif, webp]
  allowed_video_types: [mp4, mov, avi]
  allowed_doc_types: [pdf, docx, xlsx, pptx, txt, zip]

storage_model:
  # Lưu 1 file vật lý, nhiều metadata record (media_refs)
  # Khi forward: tạo record mới trong media_refs, tăng ref_count
  # Khi xóa message: giảm ref_count
  # Khi ref_count = 0: xóa S3 object thật sự

security:
  virus_scan: true # ClamAV hoặc AWS Macie
  content_moderation: true # AWS Rekognition cho ảnh/video
  presigned_url_ttl: 3600 # 1 giờ
```

---

## 🤖 AI SERVICE (Port 8085)

### Endpoints

```
POST   /api/v1/ai/chat
DELETE /api/v1/ai/history
```

### Context Management

```java
// Sliding window: giữ tối đa 20 messages gần nhất
// Token limit: 3000 tokens cho history
// Auto-summarize khi vượt limit
// System prompt:
"""
Bạn là Zola AI, trợ lý thông minh trong ứng dụng chat Zola.
Trả lời ngắn gọn, hữu ích và thân thiện.
Ngôn ngữ: tiếng Việt hoặc tiếng Anh theo ngôn ngữ người dùng.
"""

// Model: gpt-4o-mini, temperature: 0.7, max_tokens: 1000
```

---

## 🔔 NOTIFICATION SERVICE (Port 8086)

### Redis Pub/Sub Events

```
zola:message:new         → Push + WebSocket realtime
zola:message:recalled    → WebSocket realtime
zola:friend:request      → Push + in-app notification
zola:friend:accepted     → Push + in-app notification
zola:call:invite         → Push + WebSocket (priority)
zola:call:end            → WebSocket
zola:user:online         → WebSocket tới friend list
zola:user:offline        → WebSocket tới friend list
zola:security:alert      → Push + email (login lạ, spam reset)
```

### Security Notification

```java
// Khi phát hiện spam reset password cho một user:
//   → Lấy tất cả active sessions của user đó
//   → Push notification: "Có yêu cầu đặt lại mật khẩu.
//      Nếu không phải bạn, hãy kiểm tra bảo mật tài khoản."
//   → Log security_logs với event_type = 'SUSPICIOUS_RESET_ATTEMPT'
```

---

## 🛡️ ADMIN SERVICE (Port 8088)

### Endpoints

```
GET    /api/v1/admin/users               Danh sách user
PUT    /api/v1/admin/users/{id}/lock     Khóa tài khoản
PUT    /api/v1/admin/users/{id}/unlock   Mở khóa
GET    /api/v1/admin/reports             Danh sách báo cáo
PUT    /api/v1/admin/reports/{id}/review Xử lý báo cáo
GET    /api/v1/admin/security-logs       Log bảo mật
GET    /api/v1/admin/stats               Dashboard metrics
```

### Admin roles

```
SUPER_ADMIN    Toàn quyền
MODERATOR      Xem và xử lý reports, khóa user
SUPPORT        Xem thông tin user (không sửa)
```

---

## 🌐 FRONTEND — React Web

### Directory structure

```
src/
├── api/
│   ├── authApi.ts
│   ├── userApi.ts
│   ├── chatApi.ts
│   ├── callApi.ts
│   └── fileApi.ts
├── components/
│   ├── ui/               shadcn components
│   ├── auth/             LoginForm, RegisterForm, OtpInput, TwoFASetup
│   ├── chat/
│   │   ├── ChatWindow.tsx
│   │   ├── MessageBubble.tsx
│   │   ├── MessageInput.tsx      emoji, file, voice record
│   │   ├── TypingIndicator.tsx
│   │   ├── ReadReceipt.tsx
│   │   ├── MessageContextMenu.tsx  xóa / thu hồi / chỉnh sửa / ghim / forward
│   │   └── FilePreview.tsx
│   ├── call/
│   │   ├── CallModal.tsx         UI cuộc gọi đến
│   │   ├── CallScreen.tsx        màn hình đang gọi
│   │   └── useWebRTC.ts          WebRTC hook
│   ├── sidebar/
│   │   ├── ConversationList.tsx
│   │   └── ContactList.tsx
│   └── common/
│       ├── Avatar.tsx
│       ├── OnlineIndicator.tsx
│       └── SessionManager.tsx    hiện danh sách thiết bị
├── hooks/
│   ├── useWebSocket.ts
│   ├── useWebRTC.ts
│   ├── useAuth.ts
│   ├── useChat.ts
│   └── useNotification.ts
├── pages/
│   ├── LoginPage.tsx
│   ├── RegisterPage.tsx
│   ├── ChatPage.tsx
│   ├── ProfilePage.tsx
│   └── SecurityPage.tsx     sessions, 2FA, password change
├── stores/
│   ├── authStore.ts
│   ├── chatStore.ts
│   ├── callStore.ts
│   └── notificationStore.ts
└── types/
```

### WebRTC hook (call)

```typescript
// hooks/useWebRTC.ts
export function useWebRTC(callId: string) {
  const localStream = useRef<MediaStream>();
  const remoteStream = useRef<MediaStream>();
  const peerConn = useRef<RTCPeerConnection>();

  const initPeer = async (iceServers: RTCIceServer[]) => {
    peerConn.current = new RTCPeerConnection({ iceServers });
    peerConn.current.onicecandidate = (e) => {
      if (e.candidate) sendSignal("ice", e.candidate);
    };
    peerConn.current.ontrack = (e) => {
      remoteStream.current = e.streams[0];
    };
  };

  const startCall = async () => {
    localStream.current = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: true,
    });
    localStream.current
      .getTracks()
      .forEach((t) => peerConn.current?.addTrack(t, localStream.current!));
    const offer = await peerConn.current!.createOffer();
    await peerConn.current!.setLocalDescription(offer);
    sendSignal("offer", offer);
  };

  return { localStream, remoteStream, startCall, initPeer };
}
```

### Security page features

```
- Danh sách thiết bị đang đăng nhập (IP, device, last used)
- Nút "Đăng xuất thiết bị này" trên mỗi session
- Nút "Đăng xuất tất cả thiết bị khác"
- Bật/tắt 2FA với QR code
- Lịch sử bảo mật (đăng nhập, đổi mật khẩu, v.v.)
- Cảnh báo session sắp hết hạn (trước 5 phút → hiện banner)
```

---

## 📱 FRONTEND — React Native Android

```bash
npx react-native@latest init ZolaMobile --template react-native-template-typescript
npm install @react-navigation/native @react-navigation/stack @react-navigation/bottom-tabs
npm install @stomp/stompjs
npm install react-native-webrtc
npm install react-native-image-picker react-native-document-picker
npm install react-native-audio-recorder-player   # ghi voice
npm install react-native-fast-image
npm install zustand axios
```

### Permissions (AndroidManifest.xml)

```xml
<uses-permission android:name="android.permission.CAMERA"/>
<uses-permission android:name="android.permission.RECORD_AUDIO"/>
<uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE"/>
<uses-permission android:name="android.permission.INTERNET"/>
<uses-permission android:name="android.permission.ACCESS_NETWORK_STATE"/>
```

---

## ⚙️ SPRING BOOT — SERVICE TEMPLATE

### application.yml

```yaml
spring:
  datasource:
    url: jdbc:postgresql://${DB_HOST}:5432/${DB_NAME}
    username: ${DB_USER}
    password: ${DB_PASSWORD}
  jpa:
    hibernate.ddl-auto: validate
    show-sql: false
  data:
    mongodb.uri: ${MONGO_URI}
    redis:
      host: ${REDIS_HOST}
      port: 6379
      password: ${REDIS_PASSWORD}

jwt:
  secret: ${JWT_SECRET}
  access-token-expiry: 900000 # 15 min
  refresh-token-expiry: 604800000 # 7 days

security:
  otp:
    max-attempts-per-hour: 5
    resend-delay-seconds: 60
    max-fail-attempts: 3
    lock-duration-minutes: 15
  rate-limit:
    login-per-ip-per-15min: 20

aws:
  s3.bucket: ${S3_BUCKET}
  s3.region: ap-southeast-1
  access-key: ${AWS_ACCESS_KEY}
  secret-key: ${AWS_SECRET_KEY}

openai:
  api-key: ${OPENAI_API_KEY}
  model: gpt-4o-mini
  max-tokens: 1000
  temperature: 0.7

turn:
  secret: ${TURN_SECRET}
  host: turn.zola.app
  ttl: 3600
```

### Security config (Spring Security)

```java
@Configuration
@EnableWebSecurity
public class SecurityConfig {
    // JWT filter → validate access token, extract userId + sessionId
    // Check Redis: session masih active? (revoke check)
    // Rate limiting filter (Bucket4j)
    // CORS config
    // XSS protection headers
    // CSRF disabled (stateless JWT)
}
```

### Global Exception Handler

```java
@RestControllerAdvice
public class GlobalExceptionHandler {
    // ResourceNotFoundException → 404
    // UnauthorizedException → 401
    // ForbiddenException → 403
    // RateLimitException → 429
    // ValidationException → 400
    // InternalServerError → 500
    // Response format: ApiResponse<Void> { success, message, error, timestamp }
}
```

---

## 🐳 DOCKER COMPOSE (local dev)

```yaml
version: "3.8"
services:
  postgres:
    image: postgres:15-alpine
    environment:
      POSTGRES_DB: zola_db
      POSTGRES_USER: zola
      POSTGRES_PASSWORD: zola_pass
    ports: ["5432:5432"]
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./backend/sql/init.sql:/docker-entrypoint-initdb.d/init.sql

  mongodb:
    image: mongo:7
    ports: ["27017:27017"]
    volumes: [mongo_data:/data/db]

  redis:
    image: redis:7-alpine
    command: redis-server --requirepass redis_pass
    ports: ["6379:6379"]

  coturn:
    image: coturn/coturn
    network_mode: host
    volumes:
      [./infrastructure/coturn/turnserver.conf:/etc/coturn/turnserver.conf]

  api-gateway:
    build: ./backend/api-gateway
    ports: ["8080:8080"]
    depends_on: [auth-service, user-service, chat-service, call-service]

  auth-service:
    build: ./backend/auth-service
    ports: ["8081:8081"]
    environment:
      DB_HOST: postgres
      REDIS_HOST: redis
      JWT_SECRET: ${JWT_SECRET}
    depends_on: [postgres, redis]

  user-service:
    build: ./backend/user-service
    ports: ["8082:8082"]
    environment: { DB_HOST: postgres, REDIS_HOST: redis }
    depends_on: [postgres, redis]

  chat-service:
    build: ./backend/chat-service
    ports: ["8083:8083"]
    environment:
      DB_HOST: postgres
      MONGO_URI: mongodb://mongodb:27017/zola_chat
      REDIS_HOST: redis
    depends_on: [postgres, mongodb, redis]

  call-service:
    build: ./backend/call-service
    ports: ["8087:8087"]
    environment:
      DB_HOST: postgres
      REDIS_HOST: redis
      TURN_SECRET: ${TURN_SECRET}
    depends_on: [postgres, redis]

  file-service:
    build: ./backend/file-service
    ports: ["8084:8084"]
    environment:
      S3_BUCKET: ${S3_BUCKET}
      AWS_ACCESS_KEY: ${AWS_ACCESS_KEY}
      AWS_SECRET_KEY: ${AWS_SECRET_KEY}

  ai-service:
    build: ./backend/ai-service
    ports: ["8085:8085"]
    environment:
      MONGO_URI: mongodb://mongodb:27017/zola_ai
      OPENAI_API_KEY: ${OPENAI_API_KEY}
    depends_on: [mongodb]

  notification-service:
    build: ./backend/notification-service
    ports: ["8086:8086"]
    environment: { REDIS_HOST: redis, DB_HOST: postgres }
    depends_on: [redis, postgres]

  admin-service:
    build: ./backend/admin-service
    ports: ["8088:8088"]
    environment: { DB_HOST: postgres, REDIS_HOST: redis }
    depends_on: [postgres, redis]

  zola-web:
    build: ./frontend/web
    ports: ["3000:80"]
    environment:
      VITE_API_URL: http://localhost:8080
      VITE_WS_URL: ws://localhost:8083/ws

volumes:
  postgres_data:
  mongo_data:
```

---

## 🔑 ENVIRONMENT VARIABLES

```env
# Database
DB_HOST=localhost
DB_NAME=zola_db
DB_USER=zola
DB_PASSWORD=your_secure_password

# MongoDB
MONGO_URI=mongodb://localhost:27017/zola

# Redis
REDIS_HOST=localhost
REDIS_PASSWORD=your_redis_password

# JWT (256-bit secret)
JWT_SECRET=your_very_long_256_bit_secret_key_here

# AWS
AWS_ACCESS_KEY=AKIA...
AWS_SECRET_KEY=...
S3_BUCKET=zola-media-bucket
AWS_REGION=ap-southeast-1

# OpenAI
OPENAI_API_KEY=sk-...

# TURN server
TURN_SECRET=your_turn_hmac_secret

# Email (SMTP for OTP)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=noreply@zola.app
SMTP_PASSWORD=your_app_password

# Frontend
VITE_API_URL=http://localhost:8080
VITE_WS_URL=ws://localhost:8083/ws
VITE_TURN_HOST=turn.zola.app
```

---

## 📋 IMPLEMENTATION CHECKLIST

### Phase 1 — Foundation & Auth

- [ ] PostgreSQL schema (tất cả tables)
- [ ] Auth Service: register, login, JWT, bcrypt, refresh token, sessions
- [ ] Session management: danh sách thiết bị, logout từ xa
- [ ] OTP: gửi, xác minh, rate limit, anti-spam
- [ ] Email xác thực tài khoản
- [ ] ToS acceptance flow
- [ ] API Gateway với JWT filter + rate limiting
- [ ] React Web: Login, Register, OTP input, routing

### Phase 2 — Core Chat

- [ ] User Service: profile, friendship state machine
- [ ] MongoDB integration, Chat Service REST
- [ ] WebSocket/STOMP, typing indicator, read receipts
- [ ] Message: reply, forward, pin, recall, edit, auto-delete
- [ ] File Service: S3 upload, media_refs ownership model
- [ ] Frontend: ChatWindow, MessageInput (file, emoji, voice)

### Phase 3 — Groups & Advanced Messaging

- [ ] Group CRUD, member management, roles
- [ ] Group chat + STOMP topic
- [ ] Push notifications (Firebase FCM)
- [ ] Notification Service + Redis Pub/Sub wiring
- [ ] Security notifications (spam reset password alert)

### Phase 4 — Calls

- [ ] Call Service: signaling WebSocket
- [ ] Coturn TURN server setup
- [ ] WebRTC 1-1 audio/video call
- [ ] Call states, history, missed call notification
- [ ] React Native call UI

### Phase 5 — Security & Admin

- [ ] 2FA (TOTP) setup flow
- [ ] Security logs, login history
- [ ] Account soft-lock / hard-delete flow
- [ ] Admin Service: dashboard, user management, reports
- [ ] Content moderation (AWS Rekognition)

### Phase 6 — DevOps

- [ ] Dockerfile per service
- [ ] GitHub Actions: test → build → push ECR → deploy EKS
- [ ] Terraform: VPC, RDS, ElastiCache, EKS, S3, CloudFront
- [ ] Kubernetes deployments, HPA auto-scaling
- [ ] CloudWatch monitoring + alerts

---

## 💡 CODING CONVENTIONS

### Backend (Java)

- Package: `com.zola.{service-name}`
- Response wrapper: `ApiResponse<T> { success, message, data, timestamp }`
- Lombok: `@Data`, `@Builder`, `@RequiredArgsConstructor`
- Validate với Jakarta Bean Validation (`@Valid`, `@NotBlank`, v.v.)
- `@Transactional` cho PostgreSQL write operations
- `@Async` cho event publishing
- Sensitive data (2FA secret, token) phải mã hóa AES-256 trước khi lưu DB

### Frontend (TypeScript/React)

- Functional components + hooks only
- Zustand cho global state
- React Query (`@tanstack/react-query`) cho server state
- Axios interceptors: tự động attach JWT, handle 401 → refresh, handle 403 → logout
- Tailwind utility classes, không viết custom CSS ngoài file global
- Tên component: PascalCase; hooks: `use` prefix; stores: camelCase

---

## 📌 CURRENT IMPLEMENTATION STATUS (Updated: 2026-04-10)

### ✅ Đã làm xong

- Monorepo scaffold đầy đủ: backend multi-module, frontend web, infrastructure, CI skeleton.
- Docker Compose local có đủ service chính và thứ tự khởi động hợp lý.
- Chia database theo service ownership:
  - PostgreSQL: `zola_identity_db`, `zola_user_db`, `zola_call_db`, `zola_file_db`, `zola_ai_meta_db`, `zola_notification_db`, `zola_admin_db`, `zola_gateway_db`.
  - MongoDB: `zola_chat_db`, `zola_ai_db`.
- Bootstrap tự động:
  - PostgreSQL: thiếu DB thì tự tạo, có rồi thì bỏ qua.
  - MongoDB: chỉ seed khi collection mục tiêu đang rỗng.
- Flyway migration đã tách theo service dùng PostgreSQL:
  - V1: init schema.
  - V2: seed data ảo idempotent (`WHERE NOT EXISTS`).
- Skeleton entity + repository đầu tiên đã có cho các service dữ liệu:
  - JPA: auth, user, call, file, ai, notification, admin.
  - Mongo: chat (`ConversationDocument`, `ConversationRepository`).
- Build check:
  - Backend Maven compile pass.
  - Frontend web build pass.
  - Docker Compose config parse pass.

### 🚧 Chưa làm (so với đặc tả tổng)

- Auth nghiệp vụ đầy đủ: register/login/refresh/logout-all/sessions/OTP/2FA/TOS.
- API Gateway production: JWT filter chuẩn, rate limiting, circuit breaker, CORS policy hoàn chỉnh.
- User service nghiệp vụ đầy đủ: friendship state machine, block/unblock, group role flow.
- Chat core nghiệp vụ:
  - Conversation/message REST đầy đủ.
  - STOMP real-time (send/typing/read/recall/edit/pin).
  - Read receipt + typing indicator end-to-end.
- Call service signaling WebRTC đầy đủ (offer/answer/ice/end) + call state machine.
- File service tích hợp S3/presigned URL/virus scan/moderation.
- AI service tích hợp OpenAI thật + sliding window/summarize theo token limit.
- Notification service xử lý event Redis Pub/Sub và push thực.
- Admin dashboard + moderation workflow đầy đủ.
- Test coverage (unit/integration/e2e), observability, security hardening, deploy AWS thực tế.

### ▶️ Việc nên làm ngay (next sprint)

1. Hoàn thiện **Phase 1** end-to-end:
   - Auth API core + JWT access/refresh + session management.
   - Security logs + OTP rate limit bằng Redis.
   - Gateway JWT validation và reject token revoked theo `sessionId`.
2. Hoàn thiện **Phase 2 foundation**:
   - Chat REST cơ bản (`conversations`, `messages`, pagination cursor).
   - STOMP connect/subscribe/send tối thiểu cho direct chat.
3. Hoàn thiện **data consistency contracts**:
   - Define event schema versioning (`zola.*`) trong module `common`.
   - Add outbox pattern cho service phát event quan trọng.
4. Hoàn thiện **quality gates**:
   - Unit test tối thiểu cho service/repository.
   - Integration test cho Flyway + DB boot + seed idempotent.

### 🌱 Hướng mở rộng kiến trúc

- Multi-tenant mode (tenant_id) cho bản B2B.
- CQRS cho read-heavy timeline/conversation list.
- Full-text search cho messages (OpenSearch hoặc PostgreSQL trigram).
- Media pipeline async (thumbnail/transcode) qua queue.
- Presence service chuyên biệt (online/typing/read) để scale real-time.
- Zero-downtime migration strategy cho schema lớn (expand/contract).
- SSO/OAuth2 login (Google/Microsoft) và device trust policy.

### 🧭 Definition of Done đề xuất cho từng phase

- API contract rõ (OpenAPI), có test pass, có migration, có seed local, có monitoring baseline.
- Mỗi service phải chạy độc lập được bằng profile local + docker deps.
- Không có dependency chéo DB; đồng bộ giữa service qua event/contract.
