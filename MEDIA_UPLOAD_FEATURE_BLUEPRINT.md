# Media Upload Feature Blueprint (1-1 Chat)

## 1) Product Goal
Build production-grade media messaging for private chat (Zola/Messenger style):
- Send image, video, and document files.
- Multi-image select and preview before send.
- Upload progress, retry, cancel.
- Realtime delivery to both sides.
- Strict file type and size controls.
- Secure file access for conversation participants only.

## 2) Scope and UX Flow

### 2.1 Composer entry points
In chat composer, provide attachment entry points:
- Image upload.
- Video upload.
- File upload.
- Camera capture (mobile).
- Drag and drop to chat area.

### 2.2 Pre-send preview
When user selects files:
- Show preview modal.
- Remove each file before send.
- Enter optional caption.
- Confirm send or cancel.

### 2.3 Upload queue behavior
For each file:
- Status: `uploading` -> `sent` or `failed`.
- Show progress bar.
- Retry failed upload.
- Cancel in-flight upload.

### 2.4 Chat rendering behavior
- Image: image bubble, click to open full-screen viewer.
- Video: thumbnail/video element with duration and play.
- File: icon + filename + size + download action.
- Message receipts: sent/delivered/seen.

## 3) File Types and Limits

### 3.1 Accepted types
- Images: `jpg`, `jpeg`, `png`, `webp`.
- Videos: `mp4`, `mov`, `webm`.
- Files: `pdf`, `doc`, `docx`, `xls`, `xlsx`, `ppt`, `pptx`, `zip`, `rar`, `txt`.

### 3.2 Limits
- Image: 10 MB.
- Video: 100 MB.
- Generic file: 100 MB.

## 4) Frontend Architecture (React + Tailwind + Axios + STOMP)

### 4.1 Implemented in current codebase
Implemented changes:
- Upload API supports `onProgress` and `AbortSignal`.
- Chat composer supports:
  - Attachment menu.
  - Multi-file preview modal.
  - Drag and drop.
  - Mobile capture input.
- Upload queue UI supports:
  - Progress bars.
  - Retry on failure.
  - Cancel upload.
- Validation aligned with product limits and type allowlist.

### 4.2 Recommended frontend state model
```ts
interface PendingUpload {
  localId: string;
  fileName: string;
  mediaKind: "image" | "video" | "file";
  status: "uploading" | "failed";
  progress: number;
  errorMessage?: string;
}
```

### 4.3 UI edge cases
- If one file in batch fails, keep other files uploading.
- If user leaves conversation, preserve queue state in memory/store.
- If connection drops, show retry CTA and keep queue item.

## 5) Backend API Contract

### 5.1 Current upload endpoint
`POST /api/v1/media/upload` (multipart file)
- Request: multipart field `file`.
- Response includes: `fileUrl`, `fileName`, `size`, `mediaType`.

### 5.2 Message send endpoint
`POST /api/v1/chat/conversations/{conversationId}/messages`
- Payload includes `type`, `content`, `fileUrl`, `fileName`.
- Use:
  - `IMAGE` for images.
  - `VIDEO` for videos.
  - `FILE` for documents.

### 5.3 Recommended v2 enhancements
For large video and cloud-scale uploads:
1. `POST /api/v1/media/upload/init` -> return `uploadId`, `partSize`, signed-part URLs.
2. `PUT signedUrl` per chunk.
3. `POST /api/v1/media/upload/complete` -> assemble object and return media metadata.

## 6) Database Design

### 6.1 MongoDB message schema (recommended)
```json
{
  "_id": "msg_xxx",
  "conversationId": "conv_xxx",
  "senderId": "user_xxx",
  "type": "IMAGE|VIDEO|FILE|TEXT",
  "content": "optional caption",
  "file": {
    "storageKey": "chat/user/...",
    "url": "https://...",
    "name": "photo.jpg",
    "size": 1829371,
    "mimeType": "image/jpeg",
    "mediaType": "IMAGE",
    "thumbnailUrl": "https://...",
    "durationSec": 12
  },
  "delivery": {
    "deliveredTo": ["user_xxx"],
    "seenBy": ["user_xxx"]
  },
  "status": {
    "recalled": false,
    "deletedForUsers": []
  },
  "createdAt": "ISODate",
  "updatedAt": "ISODate"
}
```

### 6.2 PostgreSQL roles
- `users`, `conversations`, `conversation_participants` managed in PostgreSQL.
- Permission checks must verify sender belongs to conversation before issuing download URL.

## 7) Realtime Event Design

### 7.1 Event types
- `MEDIA_UPLOAD_PROGRESS` (optional client-local only).
- `MESSAGE_SENT`.
- `MESSAGE_DELIVERED`.
- `MESSAGE_SEEN`.
- `UPLOAD_FAILED` (optional local/system event).

### 7.2 Recipient behavior
- Online recipient: receive message instantly via WebSocket/STOMP.
- Offline recipient: push notification (notification-service) with summary text:
  - "A đã gửi 1 hình ảnh"
  - "A đã gửi 1 video"
  - "A đã gửi 1 tệp tin"

## 8) Security and Compliance

### 8.1 Input validation
- Validate both extension and MIME type.
- Enforce max-size per media category.
- Reject unsupported types early.

### 8.2 Storage safety
- Randomized object key using timestamp + UUID.
- Sanitize original filename.
- Keep original filename only for display metadata.

### 8.3 Access control
Recommended next step:
- Do not expose permanent public file URL for private chat.
- Add endpoint: `GET /api/v1/media/{mediaId}/access-url`.
- Validate current user is in conversation.
- Return short-lived signed URL (e.g., 2-5 minutes).

### 8.4 Malware scanning
Recommended production pipeline:
1. Upload file -> mark as `PENDING_SCAN`.
2. Trigger async AV scan (ClamAV/Lambda scanner).
3. If clean: `READY`.
4. If infected: quarantine + block download + notify sender.

## 9) Observability
Track and dashboard:
- Upload success rate by file type.
- Upload failure rate by error code.
- Average upload latency per size bucket.
- Realtime delivery latency.
- Signed URL generation failures.

## 10) Performance and Scalability
- Use direct-to-S3 multipart upload for large videos.
- Generate thumbnails asynchronously.
- CDN for media delivery.
- Add lifecycle policy for orphan uploads.
- Add dedup/checksum if needed for repeated files.

## 11) Test Plan

### 11.1 Functional
- Single image, multiple images, video, file upload.
- Preview remove/cancel/send.
- Retry failed upload.
- Cancel in-progress upload.
- Realtime receive while both users online.

### 11.2 Validation
- Reject unsupported extension.
- Reject file beyond limit.
- Verify caption persistence.

### 11.3 Security
- Unauthorized user cannot access private media.
- Signed URL expires correctly.
- Malware sample blocked in AV flow (staging only).

## 12) Rollout Plan
1. Release frontend queue/preview/drag-drop.
2. Release strict allowlist + new limits in file-service.
3. Add signed URL endpoint and secure media read path.
4. Add AV scan pipeline.
5. Add chunk upload for large video.
6. Add grouped media album support for multi-image bubble grid in v2.

## 13) Notes for Group Chat Extension
Design is extensible for group chat by replacing direct participant checks with conversation membership checks for N users. Delivery and seen receipts should be per-user arrays with pagination/compression strategy for large groups.
