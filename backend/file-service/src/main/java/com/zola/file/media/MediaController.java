package com.zola.file.media;

import com.zola.common.response.ApiResponse;
import com.zola.file.media.presign.PresignedUrlRequest;
import com.zola.file.media.presign.PresignedUrlResponse;
import com.zola.file.media.presign.PresignedUrlService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping("/api/v1/media")
public class MediaController {

    private final MediaUploadService mediaUploadService;
    private final PresignedUrlService presignedUrlService;

    public MediaController(MediaUploadService mediaUploadService,
                           PresignedUrlService presignedUrlService) {
        this.mediaUploadService = mediaUploadService;
        this.presignedUrlService = presignedUrlService;
    }

    // ── Legacy direct-upload endpoint (kept for backward compatibility) ───────

    @PostMapping("/upload")
    public ApiResponse<MediaUploadService.UploadedMedia> upload(
        @RequestPart("file") MultipartFile file,
        @RequestHeader(value = "X-User-Id", required = false) String userId,
        HttpServletRequest request
    ) {
        String currentUserId = resolveUserId(userId, request);
        return ApiResponse.ok("Upload success", mediaUploadService.upload(currentUserId, file));
    }

    // ── Presigned URL endpoints ───────────────────────────────────────────────

    /**
     * Generate presigned S3 PUT URLs for multiple files.
     * The client uploads directly to S3, then sends the message via chat-service.
     *
     * POST /api/v1/media/presigned-urls
     */
    @PostMapping("/presigned-urls")
    public ApiResponse<PresignedUrlResponse> getPresignedUrls(
        @Valid @RequestBody PresignedUrlRequest request,
        @RequestHeader(value = "X-User-Id", required = false) String userId,
        HttpServletRequest httpRequest
    ) {
        String currentUserId = resolveUserId(userId, httpRequest);
        return ApiResponse.ok("Presigned URLs generated",
            presignedUrlService.generatePresignedUrls(currentUserId, request));
    }

    /**
     * Delete a file from S3 and remove its pending-upload record.
     * fileKey is passed as a query param to avoid path-encoding issues.
     *
     * DELETE /api/v1/media?fileKey=chat/2026/04/...
     */
    @DeleteMapping
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteFile(
        @RequestParam String fileKey,
        @RequestHeader(value = "X-User-Id", required = false) String userId,
        HttpServletRequest httpRequest
    ) {
        // userId is available for audit; ownership check can be added when needed
        presignedUrlService.deleteFile(fileKey);
    }

    /**
     * Internal callback from chat-service to mark uploaded files as confirmed
     * (i.e., the message was actually sent, file is not orphaned).
     *
     * POST /api/v1/media/confirm
     * Body: { "fileKeys": ["chat/...", ...] }
     */
    @PostMapping("/confirm")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void confirmUploads(@RequestBody ConfirmRequest body) {
        presignedUrlService.confirmUploads(body.fileKeys());
    }

    public record ConfirmRequest(java.util.List<String> fileKeys) {}

    // ── private helpers ───────────────────────────────────────────────────────

    private String resolveUserId(String headerValue, HttpServletRequest request) {
        if (headerValue != null && !headerValue.isBlank()) return headerValue;
        Object attr = request.getAttribute("X_USER_ID");
        if (attr instanceof String value && !value.isBlank()) return value;
        return "anonymous";
    }
}
