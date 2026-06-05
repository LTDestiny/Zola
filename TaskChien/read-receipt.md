# Chức năng Báo cáo đã đọc (Read Receipt)

## 1. Mục đích nghiệp vụ
- **Chức năng:** Cho phép người dùng biết đối phương đã đọc tin nhắn của mình hay chưa (thường hiển thị chữ "Đã xem" hoặc avatar nhỏ của người nhận dưới tin nhắn).
- **Trường hợp sử dụng:** Giúp tăng tính tương tác thực tế, người gửi biết tin nhắn đã được tiếp nhận.

## 2. Luồng hoạt động
1. **User A (Người nhận):** Mở phòng chat chứa tin nhắn chưa đọc của User B.
2. **Frontend User A:** Bắn API HTTP `PATCH /api/v1/conversations/{conversationId}/read` hoặc gửi socket qua destination `/app/chat.read` kèm `conversationId` và `messageId` mới nhất.
3. **Chat Service:**
   - Cập nhật danh sách người đã đọc (`seenBy` chứa `userId` của A) trong bảng `messages` (MongoDB).
   - Đặt lại số đếm tin nhắn chưa đọc cho User A về 0 trong PostgreSQL (`user_unread_count = 0`).
4. **WebSocket Event:** 
   - Server gửi sự kiện `READ_RECEIPT` hoặc `CONVERSATION_UPDATED` tới topic của cuộc trò chuyện `/topic/chat/{conversationId}` để các client khác (như User B) cập nhật trạng thái "Đã xem".
   - Server gửi sự kiện đồng bộ tới `/user/{userId}/queue/chat` hoặc `/queue/sync` cho các thiết bị khác của A.

## 3. API liên quan
- **WebSocket STOMP:**
  - Destination: `/app/chat.read`
  - Payload:
    ```json
    {
      "conversationId": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
      "messageId": "60d5ec49f8d54c1a2c8b4567"
    }
    ```
- **HTTP REST (Fallback):**
  - `PATCH /api/v1/conversations/{conversationId}/read`

## 4. Database
- **MongoDB (`messages`):**
  - Trường `seenBy` (Array of Strings): Chứa danh sách User ID đã xem tin nhắn này.
- **PostgreSQL (`conversation` hoặc `conversation_members`):**
  - Cập nhật cột `unread_count` (hoặc `userX_unread_count`) về `0` cho user vừa xem.

## 5. Redis & WebSocket
- Dùng WebSocket để broadcast tức thời trạng thái "seen" để đối phương đổi trạng thái hiển thị từ "Đã gửi" sang "Đã xem".
