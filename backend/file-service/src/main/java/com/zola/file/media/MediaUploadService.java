package com.zola.file.media;

import com.zola.common.storage.ObjectStorageProperties;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;
import software.amazon.awssdk.core.sync.RequestBody;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.PutObjectRequest;

import java.io.IOException;
import java.time.Instant;
import java.util.Locale;
import java.util.Set;
import java.util.UUID;

@Service
public class MediaUploadService {

    private static final Set<String> IMAGE_EXTENSIONS = Set.of("jpg", "jpeg", "png", "webp");
    private static final Set<String> VIDEO_EXTENSIONS = Set.of("mp4", "mov", "webm");
    private static final Set<String> FILE_EXTENSIONS = Set.of("pdf", "doc", "docx", "xls", "xlsx", "ppt", "pptx", "zip", "rar", "txt");

    private final S3Client s3Client;
    private final ObjectStorageProperties storageProperties;
    private final long maxImageBytes;
    private final long maxVideoBytes;
    private final long maxFileBytes;

    public MediaUploadService(
        S3Client s3Client,
        ObjectStorageProperties storageProperties,
        @Value("${media.max-image-bytes}") long maxImageBytes,
        @Value("${media.max-video-bytes}") long maxVideoBytes,
        @Value("${media.max-file-bytes}") long maxFileBytes
    ) {
        this.s3Client = s3Client;
        this.storageProperties = storageProperties;
        this.maxImageBytes = maxImageBytes;
        this.maxVideoBytes = maxVideoBytes;
        this.maxFileBytes = maxFileBytes;
    }

    public UploadedMedia upload(String userId, MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "File is required");
        }
        if (storageProperties.getBucket() == null || storageProperties.getBucket().isBlank()) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "S3 bucket is not configured");
        }

        String originalName = file.getOriginalFilename() == null ? "upload.bin" : file.getOriginalFilename();
        String extension = extensionOf(originalName);
        String mediaType = detectMediaType(file.getContentType(), extension);
        long maxAllowed = maxAllowedSize(mediaType);
        if (file.getSize() > maxAllowed) {
            throw new ResponseStatusException(
                HttpStatus.BAD_REQUEST,
                "File exceeds size limit for " + mediaType + ". Max bytes: " + maxAllowed
            );
        }

        String sanitizedName = sanitizeFileName(originalName);
        String objectKey = "chat/" + userId + "/" + Instant.now().toEpochMilli() + "-" + UUID.randomUUID() + "-" + sanitizedName;
        String contentType = file.getContentType() == null || file.getContentType().isBlank()
            ? "application/octet-stream"
            : file.getContentType();

        try {
            PutObjectRequest request = PutObjectRequest.builder()
                .bucket(storageProperties.getBucket())
                .key(objectKey)
                .contentType(contentType)
                .build();

            s3Client.putObject(request, RequestBody.fromBytes(file.getBytes()));
        } catch (IOException ex) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "Cannot read upload file", ex);
        } catch (Exception ex) {
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "Failed to upload to S3", ex);
        }

        String fileUrl = buildPublicUrl(objectKey);
        return new UploadedMedia(objectKey, fileUrl, originalName, file.getSize(), contentType, mediaType);
    }

    private long maxAllowedSize(String mediaType) {
        if ("IMAGE".equals(mediaType)) {
            return maxImageBytes;
        }
        if ("VIDEO".equals(mediaType)) {
            return maxVideoBytes;
        }
        return maxFileBytes;
    }

    private String detectMediaType(String contentType, String extension) {
        String ct = contentType == null ? "" : contentType.toLowerCase(Locale.ROOT);
        String ext = extension.toLowerCase(Locale.ROOT);

        if (IMAGE_EXTENSIONS.contains(ext)) {
            if (!ct.isBlank() && !ct.startsWith("image/")) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid image content type");
            }
            return "IMAGE";
        }
        if (VIDEO_EXTENSIONS.contains(ext)) {
            if (!ct.isBlank() && !ct.startsWith("video/")) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid video content type");
            }
            return "VIDEO";
        }
        if (FILE_EXTENSIONS.contains(ext)) {
            if (!ct.isBlank() && (ct.startsWith("image/") || ct.startsWith("video/"))) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid generic file content type");
            }
            return "FILE";
        }

        // Unknown extension: reject only if content type explicitly indicates image/video mismatch,
        // otherwise treat as generic FILE to support all document formats.
        if (!ct.isBlank() && (ct.startsWith("image/") || ct.startsWith("video/"))) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Unsupported file extension for media type");
        }
        return "FILE";
    }

    private String buildPublicUrl(String objectKey) {
        return "https://" + storageProperties.getBucket() + ".s3." + storageProperties.getRegion() + ".amazonaws.com/" + objectKey;
    }

    private String extensionOf(String name) {
        int index = name.lastIndexOf('.');
        if (index < 0 || index == name.length() - 1) {
            return "";
        }
        return name.substring(index + 1);
    }

    private String sanitizeFileName(String name) {
        return name.replaceAll("[^a-zA-Z0-9._-]", "_");
    }

    public record UploadedMedia(
        String key,
        String fileUrl,
        String fileName,
        long size,
        String contentType,
        String mediaType
    ) {
    }
}
