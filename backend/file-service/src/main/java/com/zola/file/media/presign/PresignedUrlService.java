package com.zola.file.media.presign;

import com.zola.common.storage.ObjectStorageProperties;
import com.zola.file.entity.PendingUploadEntity;
import com.zola.file.repository.PendingUploadRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;
import software.amazon.awssdk.services.s3.model.DeleteObjectRequest;
import software.amazon.awssdk.services.s3.presigner.S3Presigner;
import software.amazon.awssdk.services.s3.presigner.model.PresignedPutObjectRequest;
import software.amazon.awssdk.services.s3.presigner.model.PutObjectPresignRequest;
import software.amazon.awssdk.services.s3.model.PutObjectRequest;
import software.amazon.awssdk.services.s3.S3Client;

import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.UUID;

@Service
public class PresignedUrlService {

    /* ── Allowed MIME types ─────────────────────────────────────────────────── */
    private static final Set<String> ALLOWED_IMAGE_TYPES = Set.of(
        "image/jpeg", "image/png", "image/webp", "image/gif"
    );
    private static final Set<String> ALLOWED_VIDEO_TYPES = Set.of(
        "video/mp4", "video/quicktime", "video/webm", "video/x-msvideo"
    );
    private static final Set<String> ALLOWED_FILE_TYPES = Set.of(
        // PDF
        "application/pdf",
        // Word
        "application/msword",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        // Excel
        "application/vnd.ms-excel",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        // PowerPoint
        "application/vnd.ms-powerpoint",
        "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        // Text
        "text/plain"
    );

    private final S3Presigner s3Presigner;
    private final S3Client s3Client;
    private final ObjectStorageProperties storageProperties;
    private final PendingUploadRepository pendingUploadRepository;
    private final long maxImageBytes;
    private final long maxVideoBytes;
    private final long maxFileBytes;
    private final long presignTtlMinutes;

    public PresignedUrlService(
        S3Presigner s3Presigner,
        S3Client s3Client,
        ObjectStorageProperties storageProperties,
        PendingUploadRepository pendingUploadRepository,
        @Value("${media.max-image-bytes}") long maxImageBytes,
        @Value("${media.max-video-bytes}") long maxVideoBytes,
        @Value("${media.max-file-bytes}") long maxFileBytes,
        @Value("${media.presign-ttl-minutes:15}") long presignTtlMinutes
    ) {
        this.s3Presigner = s3Presigner;
        this.s3Client = s3Client;
        this.storageProperties = storageProperties;
        this.pendingUploadRepository = pendingUploadRepository;
        this.maxImageBytes = maxImageBytes;
        this.maxVideoBytes = maxVideoBytes;
        this.maxFileBytes = maxFileBytes;
        this.presignTtlMinutes = presignTtlMinutes;
    }

    /**
     * Generate presigned PUT URLs for a batch of files.
     * Validates content type, size limits and file count.
     * Stores a pending-upload record for each key so the cleanup scheduler
     * can remove orphaned S3 objects if the client never sends the message.
     */
    public PresignedUrlResponse generatePresignedUrls(String userId, PresignedUrlRequest request) {
        List<PresignedUrlItem> items = new ArrayList<>(request.files().size());

        for (PresignedUrlRequest.FileUploadItem file : request.files()) {
            String ct = normalizeContentType(file.contentType());
            String mediaType = resolveMediaType(ct);
            validateSize(file.sizeBytes(), mediaType, ct);

            String fileKey = buildFileKey(userId, file.fileName());
            String uploadUrl = generatePutPresignedUrl(fileKey, ct);
            String publicUrl = buildPublicUrl(fileKey);

            // Track as pending so cleanup scheduler can purge orphaned uploads
            PendingUploadEntity pending = new PendingUploadEntity();
            pending.setUserId(userId);
            pending.setFileKey(fileKey);
            pending.setFileName(file.fileName());
            pending.setContentType(ct);
            pending.setSizeBytes(file.sizeBytes());
            pending.setIssuedAt(Instant.now());
            pending.setExpiresAt(Instant.now().plus(Duration.ofHours(2)));
            pendingUploadRepository.save(pending);

            items.add(new PresignedUrlItem(file.fileName(), fileKey, uploadUrl, publicUrl));
        }

        return new PresignedUrlResponse(items);
    }

    /**
     * Confirm that the S3 upload was actually used (message sent).
     * Marks the pending records as confirmed so they are excluded from cleanup.
     */
    public void confirmUploads(List<String> fileKeys) {
        pendingUploadRepository.confirmAll(fileKeys, Instant.now());
    }

    /**
     * Delete a file from S3 and remove its pending record (if any).
     * Only the owner may call this – userId check is enforced by controller.
     */
    public void deleteFile(String fileKey) {
        if (fileKey == null || fileKey.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "fileKey is required");
        }
        try {
            s3Client.deleteObject(DeleteObjectRequest.builder()
                .bucket(storageProperties.getBucket())
                .key(fileKey)
                .build());
        } catch (Exception ex) {
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "Failed to delete from S3", ex);
        }
        pendingUploadRepository.deleteByFileKey(fileKey);
    }

    // ── private helpers ───────────────────────────────────────────────────────

    private String generatePutPresignedUrl(String fileKey, String contentType) {
        PutObjectRequest putRequest = PutObjectRequest.builder()
            .bucket(storageProperties.getBucket())
            .key(fileKey)
            .contentType(contentType)
            .build();

        PutObjectPresignRequest presignRequest = PutObjectPresignRequest.builder()
            .signatureDuration(Duration.ofMinutes(presignTtlMinutes))
            .putObjectRequest(putRequest)
            .build();

        PresignedPutObjectRequest presigned = s3Presigner.presignPutObject(presignRequest);
        return presigned.url().toString();
    }

    private String buildFileKey(String userId, String originalFileName) {
        String sanitized = sanitizeFileName(originalFileName);
        String date = java.time.LocalDate.now().toString().replace("-", "/");
        return "chat/" + date + "/" + userId + "/" + UUID.randomUUID() + "-" + sanitized;
    }

    private String buildPublicUrl(String fileKey) {
        return "https://" + storageProperties.getBucket()
            + ".s3." + storageProperties.getRegion() + ".amazonaws.com/" + fileKey;
    }

    private String resolveMediaType(String contentType) {
        if (ALLOWED_IMAGE_TYPES.contains(contentType)) return "IMAGE";
        if (ALLOWED_VIDEO_TYPES.contains(contentType)) return "VIDEO";
        if (ALLOWED_FILE_TYPES.contains(contentType)) return "FILE";
        throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
            "Unsupported content type: " + contentType
            + ". Allowed: image/jpeg, image/png, image/webp, image/gif,"
            + " video/mp4, video/webm, video/quicktime,"
            + " application/pdf, application/msword, application/vnd.openxmlformats-officedocument.wordprocessingml.document,"
            + " application/vnd.ms-excel, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,"
            + " application/vnd.ms-powerpoint, application/vnd.openxmlformats-officedocument.presentationml.presentation,"
            + " text/plain");
    }

    private void validateSize(long sizeBytes, String mediaType, String contentType) {
        long limit = switch (mediaType) {
            case "IMAGE" -> maxImageBytes;
            case "VIDEO" -> maxVideoBytes;
            default -> maxFileBytes;
        };
        if (sizeBytes > limit) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                "File '" + contentType + "' exceeds size limit of " + (limit / 1_048_576) + " MB");
        }
        if (sizeBytes <= 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "sizeBytes must be positive");
        }
    }

    private String normalizeContentType(String raw) {
        if (raw == null || raw.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "contentType is required");
        }
        // Strip parameters like "; charset=utf-8"
        return raw.split(";")[0].trim().toLowerCase(Locale.ROOT);
    }

    private String sanitizeFileName(String name) {
        if (name == null || name.isBlank()) return "upload.bin";
        return name.replaceAll("[^a-zA-Z0-9._-]", "_");
    }
}
