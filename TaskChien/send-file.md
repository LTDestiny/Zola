# Chức năng Gửi tin nhắn đính kèm File/Media/Video

## 1. Mục đích nghiệp vụ
- **Chức năng:** Cho phép người dùng tải lên và gửi các tệp tin đính kèm như hình ảnh, video, hoặc tài liệu (pdf, docx, zip, xlsx,...) đến một người dùng khác hoặc một nhóm.
- **Trường hợp sử dụng:** Chia sẻ thông tin đa phương tiện trực quan và lưu trữ tài liệu trực tiếp trong phòng chat.

## 2. Luồng hoạt động
1. **User (Thiết bị gửi):** Chọn file từ thiết bị và nhấn gửi.
2. **Tải file lên File Service:** 
   - Frontend gửi yêu cầu `POST /api/v1/media/upload` (Multipart Request) kèm file nhị phân qua API Gateway tới `file-service`.
   - `file-service` phân loại tệp tin (`IMAGE`, `VIDEO`, `FILE`) và kiểm tra giới hạn dung lượng (`media.max-image-bytes`, `media.max-video-bytes`, `media.max-file-bytes`).
   - `file-service` lưu trữ file vào S3 Bucket (nếu cấu hình) hoặc Local Storage và trả về thông tin `UploadedMedia` chứa `fileUrl`, `key`, `mediaType`, `size`.
3. **Gửi tin nhắn chứa file:**
   - Frontend lấy `fileUrl` từ response của `file-service`, gửi payload tin nhắn qua WebSocket STOMP tới `/app/chat.send` (hoặc HTTP REST `POST /api/v1/conversations/{id}/messages`).
   - Trong payload chứa `type` (`IMAGE`/`VIDEO`/`FILE`), `fileUrl`, và `fileName`.
4. **Lưu trữ & Định tuyến:**
   - `chat-service` lưu tin nhắn vào MongoDB (`messages`), cập nhật PostgreSQL (`conversation`).
   - Server phát sự kiện realtime qua WebSocket topic `/topic/chat/{conversationId}`.
5. **Thiết bị nhận:** Nhận sự kiện, hiển thị hình ảnh thu nhỏ (thumbnail), trình phát video (video player), hoặc link tải tài liệu.

## 3. API liên quan
- **Tải file lên File Service:**
  - `POST /api/v1/media/upload`
  - Request Part: `file` (Multipart file)
  - Headers: `X-User-Id: {userId}`
  - Response:
    ```json
    {
      "status": "success",
      "data": {
        "key": "chat/user123/1715000000000-demo.mp4",
        "fileUrl": "/api/v1/media/object?key=...",
        "fileName": "demo.mp4",
        "size": 10485760,
        "contentType": "video/mp4",
        "mediaType": "VIDEO"
      }
    }
    ```
- **Gửi tin nhắn chứa file qua WebSocket:**
  - Destination: `/app/chat.send`
  - Payload:
    ```json
    {
      "conversationId": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
      "type": "VIDEO",
      "content": "[Video] demo.mp4",
      "fileUrl": "/api/v1/media/object?key=...",
      "fileName": "demo.mp4"
    }
    ```

## 4. Database & Mô hình lưu trữ
- **Local Storage / S3 Object Storage:** Lưu trữ file vật lý.
- **MongoDB (`messages`):** Lưu trữ metadata của tin nhắn đính kèm (`fileUrl`, `fileName`, `type`).
- **PostgreSQL (`conversation`):** Cập nhật `last_message` chứa nội dung mô tả file (Ví dụ: `[Video] demo.mp4`).
