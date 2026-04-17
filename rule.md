TAI LIEU FULL CHAT APP 1-1 (BACKEND + FRONTEND) - BAN CHI TIET

Muc tieu: Dac ta day du kien truc, contract API, contract realtime, schema du lieu, bao mat, kha nang mo rong, va lo trinh trien khai cho ung dung chat 1-1 theo mo hinh Zola/Messenger.

==================================================
1) TAM NHIN SAN PHAM
==================================================

- He thong chat 1-1 da thiet ke theo microservice, de mo rong len group chat, call video, thong bao va AI chatbot.
- Uu tien trai nghiem realtime on dinh, do tre thap, khong mat tin nhan khi mat ket noi tam thoi.
- API theo chuan versioning /api/v1/*, su dung JWT va refresh token.


==================================================
2) KIEN TRUC TONG THE
==================================================

Frontend:
- Web: React + TypeScript + Tailwind.
- Mobile: React Native (tai su dung contract API va realtime event).

Backend:
- API Gateway: xac thuc token, route request den cac service.
- Auth Service: dang ky, dang nhap, refresh token, logout.
- User Service: profile, friendship, tim kiem user.
- Chat Service: conversation metadata + realtime websocket.
- Media Service: upload file, tra signed URL.
- Notification Service: push/in-app notification.
- Call Service: signaling cho WebRTC.

Ha tang:
- PostgreSQL: du lieu quan he (users, conversations, participants).
- MongoDB: message timeline.
- Redis: online status, typing ttl, cache.
- Object Storage (S3/MinIO): media file.
- Kafka: event bus giua service.


==================================================
3) KIEN TRUC FRONTEND CHI TIET
==================================================

Mau thu muc de xuat:
- src/components: ChatBox, MessageBubble, ConversationList, Header, CallModal.
- src/pages: LoginPage, RegisterPage, ChatPage, ProfilePage.
- src/api: authApi, chatApi, mediaApi, callApi, httpClient.
- src/realtime: chatRealtimeClient, callRealtimeClient.
- src/store: authStore, chatStore, uiStore.
- src/hooks: useAuth, useConversation, useRealtime, useUpload.
- src/utils: formatDate, messageMapper, retryPolicy.

Nguyen tac:
- UI state va server state tach rieng.
- Optimistic update cho send message.
- Co co che rollback neu server reject.
- Realtime event luon merge theo messageId de tranh duplicate.


==================================================
4) FLOW FRONTEND LOGIN
==================================================

1. User nhap email/password.
2. POST /api/v1/auth/login.
3. Nhan accessToken + refreshToken + expiresAt.
4. Luu token an toan (web: memory + localStorage co han).
5. Redirect ChatPage.
6. Khoi tao websocket connection (kem Authorization).
7. Neu access token het han, tu dong refresh; refresh that bai thi logout.


==================================================
5) FLOW CHAT REALTIME
==================================================

1. Vao ChatPage -> GET /api/v1/chat/conversations.
2. Chon conversation -> GET /api/v1/chat/conversations/{id}/messages?page,size.
3. Subscribe topic /topic/chat/{conversationId}.
4. Khi gui tin nhan:
	 - Uu tien websocket /app/chat.send neu connected.
	 - Fallback REST POST /api/v1/chat/conversations/{id}/messages neu websocket loi.
5. Backend persist vao MongoDB + cap nhat last_message o PostgreSQL.
6. Backend broadcast event MESSAGE_SENT.
7. Frontend merge event vao danh sach message va conversation list.


==================================================
6) HOP DONG REALTIME (STOMP)
==================================================

Endpoint:
- CONNECT: /ws
- Client send prefix: /app
- Topic receive: /topic/chat/{conversationId}
- User queue: /user/queue/chat

Client send:
- /app/chat.send
- /app/chat.recall
- /app/chat.typing
- /app/chat.delete-for-me
- /app/chat.forward
- /app/chat.read

EventType server broadcast:
- MESSAGE_SENT
- MESSAGE_RECALLED
- MESSAGE_DELETED_FOR_ME
- MESSAGE_FORWARDED
- READ_RECEIPT
- TYPING

Khuyen nghi:
- Moi event phai co eventType, actorId, conversationId, message payload (neu co).
- Co idempotency key cho send de tranh gui trung khi reconnect.


==================================================
7) API CONTRACT CHINH (REST)
==================================================

Auth:
- POST /api/v1/auth/register
- POST /api/v1/auth/login
- POST /api/v1/auth/refresh
- POST /api/v1/auth/logout

User:
- GET /api/v1/users/me/profile
- GET /api/v1/users/search-by-email?email=
- GET /api/v1/users/friendships/status?targetUserId=
- POST /api/v1/users/friendships

Chat:
- POST /api/v1/chat/conversations/direct
- GET /api/v1/chat/conversations
- GET /api/v1/chat/conversations/{conversationId}/messages
- POST /api/v1/chat/conversations/{conversationId}/messages
- GET /api/v1/chat/users/{userId}/online

Media:
- POST /api/v1/media/upload-init
- PUT signedUrl (upload truc tiep)
- POST /api/v1/media/confirm


==================================================
8) MESSAGE SCHEMA CHI TIET (MONGODB)
==================================================

Collection: messages

Truong de xuat:
- _id: string (messageId)
- conversationId: string
- senderId: string
- receiverId: string
- type: TEXT | EMOJI | IMAGE | VIDEO | FILE | AUDIO | FORWARD
- content: string
- fileUrl: string | null
- fileName: string | null
- thumbnailUrl: string | null
- reactions: [{ userId, emoji, createdAt }]
- recalled: boolean
- deletedForUsers: string[]
- seenBy: string[]
- createdAt: ISODate/string
- updatedAt: ISODate/string

Index:
- (conversationId, createdAt)
- (conversationId, _id)
- (senderId, createdAt)


==================================================
9) SCHEMA QUAN HE (POSTGRESQL)
==================================================

Bang users:
- id, email, password_hash, full_name, avatar_url, created_at, updated_at

Bang conversation:
- id (uuid), user1_id, user2_id, last_message, updated_at
- unique index theo cap user (least(user1,user2), greatest(user1,user2))

Bang friendship:
- id, requester_id, addressee_id, status(PENDING/ACCEPTED/BLOCKED), created_at


==================================================
10) REDIS CACHE/PRESENCE
==================================================

- online key: chat:online:session-count:{userId}
- typing key: chat:typing:{conversationId}:{userId} (TTL 3-5s)
- unread count cache: chat:unread:{userId}:{conversationId}

Quy tac:
- CONNECT tang session count, DISCONNECT giam.
- Session count > 0 thi online = true.


==================================================
11) BAO MAT HE THONG
==================================================

- JWT access token ngan han + refresh token dai hon.
- BCrypt/Argon2 cho password.
- CORS whitelist theo moi truong.
- Validate file type/size khi upload.
- Rate limit endpoint auth va send message.
- Chong spam: max message per minute theo user/conversation.
- HTTPS bat buoc moi truong production.
- Kiem tra membership conversation o moi thao tac message.


==================================================
12) FLOW GUI FILE/ANH/VIDEO
==================================================

1. User chon file -> preview.
2. Goi upload-init de lay signed URL.
3. Upload truc tiep object storage.
4. Goi confirm de dong bo metadata media.
5. Gui chat message type=FILE/IMAGE/VIDEO kem fileUrl.
6. Backend broadcast realtime ngay sau khi persist.


==================================================
13) FLOW SEEN / TYPING / REACTION
==================================================

Typing:
- Client gui /app/chat.typing moi 1-2s khi dang go.
- Server broadcast event TYPING, co debounce.

Seen:
- Khi mo conversation va message vao viewport -> gui /app/chat.read.
- Server update seenBy va broadcast READ_RECEIPT.

Reaction:
- API/ws them hoac go reaction theo messageId.
- Server broadcast MESSAGE_REACTION_UPDATED.


==================================================
14) VIDEO CALL (WEBRTC) - DAC TA TOI THIEU
==================================================

- Signaling event qua websocket:
	CALL_INVITE, CALL_ACCEPT, CALL_REJECT, CALL_ICE, CALL_HANGUP.
- Frontend tao RTCPeerConnection, local stream, remote stream.
- STUN/TURN can cau hinh de ho tro mang khac NAT.
- Kiem soat timeout cuoc goi va trang thai missed call.


==================================================
15) OBSERVABILITY VA RESILIENCY
==================================================

- Structured logging (requestId, userId, conversationId).
- Metrics:
	message_send_success_total,
	websocket_connected_users,
	message_delivery_latency_ms,
	failed_publish_total.
- Retry policy client:
	reconnect websocket exponential backoff,
	fallback REST khi publish fail.
- Dead letter queue (Kafka) cho event loi.


==================================================
16) TEST PLAN BAT BUOC
==================================================

Unit test:
- message validation, permission check, recall/delete rules.

Integration test:
- send message -> persist Mongo + update conversation + broadcast.
- typing/read receipt event flow.

E2E test:
- 2 user, 2 trinh duyet:
	login -> tao direct conversation -> gui/nhan realtime -> recall -> seen.

Load test:
- 1k concurrent socket, latency p95 < 300ms.


==================================================
17) LO TRINH DO AN CHI TIET
==================================================

Phase 1 (Core):
- login/register, direct conversation, text chat realtime.

Phase 2 (Rich chat):
- file upload, reaction, recall/delete-for-me, seen/typing.

Phase 3 (Calling + Notification):
- webRTC call 1-1, missed-call notification, push notify.

Phase 4 (Platform):
- admin dashboard, moderation, analytics, AI assistant.


==================================================
18) DINH NGHIA DONE (DOD)
==================================================

- Khong mat tin nhan khi reconnect.
- Du lieu dong bo giua 2 thiet bi trong < 1s (mang tot).
- 100% endpoint co auth/validation/permission.
- CI pass: lint + test + build + basic e2e.
- Co tai lieu API va event contract cho team frontend/mobile.