# Chức năng Trợ lý AI (AI Chatbot)

## 1. Mục đích nghiệp vụ
- **Chức năng:** Tích hợp chatbot AI thông minh (sử dụng Gemini API) để trả lời các câu hỏi, tư vấn hoặc hỗ trợ người dùng trực tiếp trong ứng dụng.
- **Trường hợp sử dụng:** Người dùng chat trực tiếp với tài khoản AI (Chatbot) để giải đáp thắc mắc, viết code, dịch thuật, hoặc sáng tạo nội dung.

## 2. Luồng hoạt động
1. **User:** Truy cập màn hình Chatbot AI, gõ câu hỏi và nhấn gửi.
2. **Frontend:** Gửi request HTTP POST tới `ai-service` thông qua API Gateway.
3. **API Gateway:** Xác thực JWT token, lấy `userId` và chuyển tiếp request kèm header `X-User-Id` tới `ai-service`.
4. **AI Service (`ChatbotController`):**
   - Tiếp nhận câu hỏi qua endpoint `/api/v1/ai/chat`.
   - Lưu câu hỏi của người dùng vào MongoDB (`AiChatMessage`).
   - Gọi `GeminiService` để giao tiếp với Google Gemini API (sử dụng API key được cấu hình).
   - Nhận câu trả lời từ Gemini API, lưu câu trả lời này vào MongoDB (`AiChatMessage`).
   - Ghi nhận lịch sử sử dụng vào PostgreSQL (`AiUsageLogEntity`) để quản lý hạn mức/audit log.
5. **Frontend:** Nhận response và hiển thị câu trả lời dạng markdown hoặc văn bản thông thường lên khung chat.

## 3. API liên quan
- **Gửi tin nhắn cho AI:**
  - `POST /api/v1/ai/chat`
  - Headers: `X-User-Id: {userId}`
  - Request Body:
    ```json
    {
      "message": "Viết cho tôi một bài thơ ngắn về lập trình"
    }
    ```
  - Response:
    ```json
    {
      "status": "success",
      "data": {
        "reply": "Code chạy mượt mà, bug bay xa...",
        "conversationId": "ai_session_123"
      }
    }
    ```
- **Lấy lịch sử chat với AI:**
  - `GET /api/v1/ai/chat/history`
  - Headers: `X-User-Id: {userId}`

## 4. Database & Mô hình lưu trữ
- **MongoDB (`ai_chat_messages`):** Lưu trữ toàn bộ các tin nhắn trao đổi giữa user và AI để duy trì ngữ cảnh (context) cho chatbot.
- **PostgreSQL (`ai_usage_logs`):** Lưu trữ lịch sử sử dụng (thời gian, số tokens, userId) để phân tích hoặc giới hạn số lượng request theo ngày/tháng đối với mỗi tài khoản.
