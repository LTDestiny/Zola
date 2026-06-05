# Chức năng Đồng bộ sự kiện đa thiết bị (Device Sync)

## 1. Mục đích nghiệp vụ
- **Chức năng:** Tự động cập nhật tức thời các hành động của người dùng (đọc tin nhắn, ghim cuộc trò chuyện, thu hồi tin nhắn) lên toàn bộ các thiết bị khác đang hoạt động cùng một lúc của tài khoản đó.
- **Trường hợp sử dụng:** Người dùng đang sử dụng đồng thời Zola Web và Zola Mobile. Khi đọc tin nhắn trên Web, huy hiệu chấm đỏ chưa đọc trên Mobile phải tự động biến mất.

## 2. Luồng hoạt động
1. **User (Thiết bị 1):** Thực hiện hành động (ví dụ: bấm đọc tin nhắn trong hội thoại A).
2. **Backend (Chat Service):**
   - Nhận yêu cầu và cập nhật trạng thái trong database (ví dụ: cập nhật `unread_count = 0`).
   - Gọi phương thức `messagingTemplate.convertAndSendToUser(userId, "/queue/sync", syncEvent)` để gửi sự kiện đồng bộ tới hàng đợi cá nhân của chính người dùng đó.
3. **Phân phối WebSocket:**
   - WebSocket Broker tự động định tuyến thông điệp tới tất cả các kết nối (session) WebSocket đang mở của `userId` đó.
4. **Frontend (Thiết bị 2):**
   - Lắng nghe kênh `/user/queue/sync` hoặc `/user/queue/chat`.
   - Nhận được sự kiện đồng bộ (chứa thông tin hành động và payload).
   - Tiến hành cập nhật trạng thái local (Redux / zustand / state), xóa chấm đỏ hoặc ẩn tin nhắn thu hồi tương ứng.

## 3. API liên quan
- **WebSocket STOMP Channel:**
  - Kênh subscribe: `/user/queue/sync` hoặc `/user/queue/chat`
  - Kênh publish (nếu client chủ động đồng bộ): `/app/sync.publish`
  - Payload cấu trúc `SyncEventMessage`:
    ```json
    {
      "sourceClient": "WEB_APP",
      "eventType": "CONVERSATION_READ_SYNC",
      "payload": "{\"conversationId\":\"3fa85f64-5717-4562-b3fc-2c963f66afa6\"}",
      "timestamp": "2026-06-05T08:08:43Z"
    }
    ```
- **HTTP REST Endpoint (Internal):**
  - `POST /api/v1/sync/users/{userId}/emit` (Cho phép các microservice khác phát sự kiện đồng bộ thiết bị qua Gateway).

## 4. Database & Cache
- Không trực tiếp lưu trạng thái đồng bộ lâu dài, hoạt động dựa trên các session WebSocket đang hoạt động của người dùng (`online_sessions` trong Redis).
