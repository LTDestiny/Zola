# API Gửi Ảnh / Video trong Chat

> **Base URL (local dev):**
> - file-service: `http://localhost:8084`
> - chat-service: `http://localhost:8083`
>
> **Auth header** (API Gateway inject sau khi xác thực JWT):
> ```
> X-User-Id: <userId>
> ```
> Frontend chỉ cần gửi `Authorization: Bearer <accessToken>` lên API Gateway, gateway tự inject `X-User-Id`.

---

## Tổng quan flow

```
Frontend                    file-service              AWS S3          chat-service
   │                             │                      │                  │
   │ 1. POST /presigned-urls     │                      │                  │
   │─────────────────────────────>                      │                  │
   │                             │                      │                  │
   │ ← uploadUrl[], publicUrl[]  │                      │                  │
   │                             │                      │                  │
   │ 2. PUT <uploadUrl>          │                      │                  │
   │─────────────────────────────────────────────────────>                 │
   │                             │                      │                  │
   │ ← 200 OK (S3 response)      │                      │                  │
   │                             │                      │                  │
   │ 3. STOMP /app/chat.send     │                      │                 │
   │────────────────────────────────────────────────────────────────────── >
   │                             │                      │                  │
   │ ← MESSAGE_SENT event        │                      │                  │
   │   (broadcast to all members)│                      │                  │
```

---

## BƯỚC 1 — Xin presigned URLs

### `POST /api/v1/media/presigned-urls`

**Mô tả:** Frontend gửi danh sách file cần upload, backend trả về các URL để upload thẳng lên S3.

**Headers:**
```
X-User-Id: <userId>
Content-Type: application/json
```

**Request Body:**
```json
{
  "files": [
    {
      "fileName": "photo.jpg",
      "contentType": "image/jpeg",
      "sizeBytes": 1048576
    },
    {
      "fileName": "clip.mp4",
      "contentType": "video/mp4",
      "sizeBytes": 10485760
    }
  ]
}
```

| Field | Type | Bắt buộc | Mô tả |
|---|---|---|---|
| `files` | array | ✅ | Tối đa **10 file** mỗi request |
| `files[].fileName` | string | ✅ | Tên file gốc (ví dụ `photo.jpg`) |
| `files[].contentType` | string | ✅ | MIME type (xem bảng cho phép bên dưới) |
| `files[].sizeBytes` | number | ✅ | Kích thước file (bytes), phải > 0 |

**MIME types được phép:**

| Loại | MIME types |
|---|---|
| Ảnh (IMAGE) | `image/jpeg`, `image/png`, `image/webp`, `image/gif` |
| Video (VIDEO) | `video/mp4`, `video/quicktime`, `video/webm`, `video/x-msvideo` |
| File (FILE) | `application/pdf`, `application/msword`, `application/vnd.openxmlformats-officedocument.wordprocessingml.document`, `application/vnd.ms-excel`, `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`, `application/vnd.ms-powerpoint`, `application/vnd.openxmlformats-officedocument.presentationml.presentation`, `text/plain` |

**Giới hạn kích thước:**
- Ảnh: tối đa **50 MB**
- Video: tối đa **500 MB**
- PDF: tối đa **100 MB**

**Response 200:**
```json
{
  "success": true,
  "message": "Presigned URLs generated",
  "data": {
    "items": [
      {
        "fileName": "photo.jpg",
        "fileKey": "chat/2026/04/user-123/550e8400-photo.jpg",
        "uploadUrl": "https://zola-shared-files-dev.s3.ap-southeast-1.amazonaws.com/chat/...?X-Amz-Signature=...",
        "publicUrl": "https://zola-shared-files-dev.s3.ap-southeast-1.amazonaws.com/chat/2026/04/user-123/550e8400-photo.jpg"
      },
      {
        "fileName": "clip.mp4",
        "fileKey": "chat/2026/04/user-123/660e9500-clip.mp4",
        "uploadUrl": "https://zola-shared-files-dev.s3.ap-southeast-1.amazonaws.com/chat/...?X-Amz-Signature=...",
        "publicUrl": "https://zola-shared-files-dev.s3.ap-southeast-1.amazonaws.com/chat/2026/04/user-123/660e9500-clip.mp4"
      }
    ]
  }
}
```

| Field | Mô tả |
|---|---|
| `fileKey` | Lưu lại — cần dùng ở **Bước 3** |
| `uploadUrl` | URL để PUT file lên S3 — **có hiệu lực 15 phút** |
| `publicUrl` | URL hiển thị file sau khi upload xong |

**Response lỗi:**

| HTTP | Trường hợp |
|---|---|
| 400 | Quá 10 file, sai MIME type, vượt giới hạn kích thước, `sizeBytes <= 0` |
| 500 | Lỗi kết nối AWS |

---

## BƯỚC 2 — Upload trực tiếp lên S3

### `PUT <uploadUrl>`

**Mô tả:** Frontend dùng `uploadUrl` nhận được ở Bước 1 để upload file **thẳng lên S3**, không qua backend.

**Quan trọng:**
- Method phải là **PUT** (không phải POST)
- Header `Content-Type` phải **khớp chính xác** với `contentType` đã khai báo ở Bước 1
- Body là **binary** (raw bytes của file)
- URL có hiệu lực **15 phút** — cần upload trong thời gian này

**Ví dụ (JavaScript / fetch):**
```javascript
const response = await fetch(item.uploadUrl, {
  method: 'PUT',
  headers: {
    'Content-Type': file.type,   // phải khớp với contentType đã gửi
  },
  body: file,                    // File object từ <input type="file">
});

if (!response.ok) {
  throw new Error('Upload lên S3 thất bại');
}
```

**Ví dụ (axios):**
```javascript
await axios.put(item.uploadUrl, file, {
  headers: { 'Content-Type': file.type },
  onUploadProgress: (e) => {
    const percent = Math.round((e.loaded * 100) / e.total);
    setProgress(percent);
  },
});
```

**Response S3:**
- `200 OK` — upload thành công
- `403 Forbidden` — URL hết hạn hoặc sai `Content-Type`
- `400 Bad Request` — file rỗng

> **Tip hiển thị preview:** Dùng `URL.createObjectURL(file)` để show ảnh/video preview ngay trên UI trong lúc upload, không cần chờ S3.

---

## BƯỚC 3 — Gửi message qua WebSocket STOMP

### Destination: `/app/chat.send`

**Mô tả:** Sau khi tất cả file upload thành công, gửi message lên chat-service qua STOMP.

**Payload:**
```json
{
  "conversationId": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "type": "MEDIA",
  "content": "Xem ảnh này đi!",
  "clientMessageId": "client-generated-uuid-for-dedup",
  "attachments": [
    {
      "fileName": "photo.jpg",
      "fileKey": "chat/2026/04/user-123/550e8400-photo.jpg",
      "fileUrl": "https://zola-shared-files-dev.s3.ap-southeast-1.amazonaws.com/chat/2026/04/user-123/550e8400-photo.jpg",
      "contentType": "image/jpeg",
      "mediaType": "IMAGE",
      "sizeBytes": 1048576,
      "sortOrder": 0
    },
    {
      "fileName": "clip.mp4",
      "fileKey": "chat/2026/04/user-123/660e9500-clip.mp4",
      "fileUrl": "https://zola-shared-files-dev.s3.ap-southeast-1.amazonaws.com/chat/2026/04/user-123/660e9500-clip.mp4",
      "contentType": "video/mp4",
      "mediaType": "VIDEO",
      "sizeBytes": 10485760,
      "sortOrder": 1
    }
  ]
}
```

| Field | Type | Bắt buộc | Mô tả |
|---|---|---|---|
| `conversationId` | UUID | ✅ | ID cuộc hội thoại |
| `type` | string | ✅ | Luôn là `"MEDIA"` khi có file |
| `content` | string | ❌ | Caption / nội dung text kèm theo (có thể để `""`) |
| `clientMessageId` | string | ❌ | UUID do client sinh ra, chống duplicate khi reconnect |
| `attachments` | array | ✅ (cho MEDIA) | Danh sách file đã upload |
| `attachments[].fileName` | string | ✅ | Tên file gốc |
| `attachments[].fileKey` | string | ✅ | `fileKey` nhận được từ Bước 1 |
| `attachments[].fileUrl` | string | ✅ | `publicUrl` nhận được từ Bước 1 |
| `attachments[].contentType` | string | ✅ | MIME type |
| `attachments[].mediaType` | string | ✅ | `IMAGE` / `VIDEO` / `FILE` |
| `attachments[].sizeBytes` | number | ✅ | Kích thước bytes |
| `attachments[].sortOrder` | number | ✅ | Thứ tự hiển thị (0-based) |

**Event nhận về (broadcast tới tất cả member của conversation):**

Subscribe tại: `/topic/chat/{conversationId}`

```json
{
  "type": "MESSAGE_SENT",
  "senderId": "user-123",
  "conversationId": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "message": {
    "messageId": "msg-uuid",
    "conversationId": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    "senderId": "user-123",
    "receiverId": "user-456",
    "type": "MEDIA",
    "content": "Xem ảnh này đi!",
    "fileUrl": "https://...photo.jpg",
    "fileName": "photo.jpg",
    "attachments": [
      {
        "fileName": "photo.jpg",
        "fileKey": "chat/2026/04/user-123/550e8400-photo.jpg",
        "fileUrl": "https://...photo.jpg",
        "contentType": "image/jpeg",
        "mediaType": "IMAGE",
        "sizeBytes": 1048576,
        "sortOrder": 0
      },
      {
        "fileName": "clip.mp4",
        "fileKey": "chat/2026/04/user-123/660e9500-clip.mp4",
        "fileUrl": "https://...clip.mp4",
        "contentType": "video/mp4",
        "mediaType": "VIDEO",
        "sizeBytes": 10485760,
        "sortOrder": 1
      }
    ],
    "reactions": [],
    "deletedForUsers": [],
    "deliveredTo": ["user-123"],
    "seenBy": ["user-123"],
    "createdAt": "2026-04-23T10:00:00Z",
    "updatedAt": "2026-04-23T10:00:00Z",
    "recalled": false,
    "edited": false
  }
}
```

---

## API phụ trợ

### Xóa file đã upload (khi user bỏ không gửi)

### `DELETE /api/v1/media?fileKey=<fileKey>`

**Headers:**
```
X-User-Id: <userId>
```

**Query param:**
```
fileKey=chat/2026/04/user-123/550e8400-photo.jpg
```

**Response:** `204 No Content`

> Gọi API này khi user đã xin presigned URL, upload file lên S3, nhưng sau đó huỷ không gửi message. Nếu không gọi, file sẽ tự bị cleanup sau **2 giờ** bởi scheduler.

---

### Lấy lịch sử tin nhắn (HTTP fallback, có attachments)

### `GET /api/v1/chat/conversations/{conversationId}/messages?cursor=<cursor>&limit=20`

**Headers:**
```
X-User-Id: <userId>
```

**Response:**
```json
{
  "items": [
    {
      "id": "msg-uuid",
      "type": "MEDIA",
      "content": "Xem ảnh này đi!",
      "attachments": [
        {
          "fileName": "photo.jpg",
          "fileUrl": "https://...",
          "mediaType": "IMAGE",
          "sortOrder": 0
        }
      ],
      "createdAt": "2026-04-23T10:00:00Z"
    }
  ],
  "nextCursor": "msg-uuid-of-last-item"
}
```

---

## Hướng dẫn cho từng loại media

### Ảnh

- `contentType`: `image/jpeg` / `image/png` / `image/webp` / `image/gif`
- `mediaType`: `"IMAGE"`
- Giới hạn: 50 MB/file
- Gợi ý UX: compress trước khi upload (ví dụ `browser-image-compression`)

### Video

- `contentType`: `video/mp4` / `video/webm` / `video/quicktime`
- `mediaType`: `"VIDEO"`
- Giới hạn: 500 MB/file
- Gợi ý UX: hiển thị progress bar, cho phép cancel (abort `fetch`)

### PDF & Office

- `contentType`: xem bảng bên dưới
- `mediaType`: `"FILE"`
- Giới hạn: 100 MB/file

| Đuôi file | contentType |
|---|---|
| `.pdf` | `application/pdf` |
| `.doc` | `application/msword` |
| `.docx` | `application/vnd.openxmlformats-officedocument.wordprocessingml.document` |
| `.xls` | `application/vnd.ms-excel` |
| `.xlsx` | `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet` |
| `.ppt` | `application/vnd.ms-powerpoint` |
| `.pptx` | `application/vnd.openxmlformats-officedocument.presentationml.presentation` |
| `.txt` | `text/plain` |

---

## Gợi ý code Frontend (React)

```javascript
// 1. Xin presigned URLs
async function requestPresignedUrls(files) {
  const payload = {
    files: files.map(f => ({
      fileName: f.name,
      contentType: f.type,
      sizeBytes: f.size,
    })),
  };

  const res = await apiClient.post('/api/v1/media/presigned-urls', payload);
  return res.data.data.items; // array of { fileName, fileKey, uploadUrl, publicUrl }
}

// 2. Upload từng file lên S3
async function uploadToS3(file, item, onProgress) {
  await axios.put(item.uploadUrl, file, {
    headers: { 'Content-Type': file.type },
    onUploadProgress: e => onProgress(Math.round(e.loaded * 100 / e.total)),
  });
}

// 3. Gửi message STOMP
function sendMediaMessage(stompClient, conversationId, caption, files, presignItems) {
  const attachments = presignItems.map((item, index) => ({
    fileName: item.fileName,
    fileKey: item.fileKey,
    fileUrl: item.publicUrl,
    contentType: files[index].type,
    mediaType: resolveMediaType(files[index].type),
    sizeBytes: files[index].size,
    sortOrder: index,
  }));

  stompClient.publish({
    destination: '/app/chat.send',
    body: JSON.stringify({
      conversationId,
      type: 'MEDIA',
      content: caption ?? '',
      clientMessageId: crypto.randomUUID(),
      attachments,
    }),
  });
}

function resolveMediaType(mimeType) {
  if (mimeType.startsWith('image/')) return 'IMAGE';
  if (mimeType.startsWith('video/')) return 'VIDEO';
  return 'FILE';
}

// Orchestrate toàn bộ flow
async function handleSendFiles(stompClient, conversationId, caption, selectedFiles) {
  // Validate phía client (optional, backend đã validate lại)
  if (selectedFiles.length > 10) throw new Error('Tối đa 10 file');

  // Bước 1
  const presignItems = await requestPresignedUrls(selectedFiles);

  // Bước 2 — upload song song tất cả file
  await Promise.all(
    selectedFiles.map((file, i) =>
      uploadToS3(file, presignItems[i], percent => updateProgress(i, percent))
    )
  );

  // Bước 3
  sendMediaMessage(stompClient, conversationId, caption, selectedFiles, presignItems);
}
```

---

## Lỗi thường gặp

| Lỗi | Nguyên nhân | Cách xử lý |
|---|---|---|
| `400 Unsupported content type` | MIME type không được phép | Kiểm tra bảng MIME types |
| `400 File exceeds size limit` | File quá lớn | Thông báo user, compress nếu là ảnh |
| `400 Maximum 10 files per request` | Gửi quá 10 file | Chia batch |
| `403` từ S3 | `uploadUrl` hết hạn (> 15 phút) | Xin lại presigned URL |
| `403` từ S3 | `Content-Type` không khớp | Đảm bảo header PUT = contentType đã khai báo |
| Message không nhận được qua WS | `fileKey`/`fileUrl` sai | Copy đúng từ response Bước 1 |
| Duplicate message | Không dùng `clientMessageId` | Luôn sinh UUID random cho mỗi lần gửi |
