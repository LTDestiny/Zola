package com.zola.file.media;

import com.zola.common.storage.ObjectStorageProperties;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;
import software.amazon.awssdk.core.sync.RequestBody;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.CreateBucketRequest;
import software.amazon.awssdk.services.s3.model.GetObjectRequest;
import software.amazon.awssdk.services.s3.model.HeadBucketRequest;
import software.amazon.awssdk.services.s3.model.PutObjectRequest;
import software.amazon.awssdk.services.s3.model.S3Exception;

import java.io.IOException;
import java.net.URLEncoder;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.charset.StandardCharsets;
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
    private final Path localStorageRoot;
    private volatile boolean bucketVerified;

    public MediaUploadService(
        S3Client s3Client,
        ObjectStorageProperties storageProperties,
        @Value("${media.max-image-bytes}") long maxImageBytes,
        @Value("${media.max-video-bytes}") long maxVideoBytes,
        @Value("${media.max-file-bytes}") long maxFileBytes,
        @Value("${media.local-storage-dir:/data/media}") String localStorageDir
    ) {
        this.s3Client = s3Client;
        this.storageProperties = storageProperties;
        this.maxImageBytes = maxImageBytes;
        this.maxVideoBytes = maxVideoBytes;
        this.maxFileBytes = maxFileBytes;
        this.localStorageRoot = Path.of(localStorageDir).toAbsolutePath().normalize();
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

        if (!isS3Configured()) {
            try {
                writeLocalObject(objectKey, file.getBytes());
            } catch (IOException ex) {
                throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "Failed to store media locally", ex);
            }

            String fileUrl = buildGatewayObjectUrl(objectKey);
            return new UploadedMedia(objectKey, fileUrl, originalName, file.getSize(), contentType, mediaType);
        }

        try {
            ensureBucketExists(storageProperties.getBucket());

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

    public DownloadedMedia downloadByKey(String objectKey) {
        String normalizedKey = objectKey == null ? "" : objectKey.trim();
        if (normalizedKey.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Object key is required");
        }
        if (storageProperties.getBucket() == null || storageProperties.getBucket().isBlank()) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "S3 bucket is not configured");
        }

        if (!isS3Configured()) {
            try {
                byte[] bytes = readLocalObject(normalizedKey);
                String fileName = normalizedKey.contains("/")
                    ? normalizedKey.substring(normalizedKey.lastIndexOf('/') + 1)
                    : normalizedKey;
                String contentType = Files.probeContentType(resolveLocalObjectPath(normalizedKey));
                return new DownloadedMedia(
                    bytes,
                    contentType == null || contentType.isBlank() ? "application/octet-stream" : contentType,
                    fileName
                );
            } catch (IOException ex) {
                throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Media not found", ex);
            }
        }

        try {
            var response = s3Client.getObjectAsBytes(
                GetObjectRequest.builder()
                    .bucket(storageProperties.getBucket())
                    .key(normalizedKey)
                    .build()
            );

            String contentType = response.response().contentType();
            String safeContentType = contentType == null || contentType.isBlank()
                ? "application/octet-stream"
                : contentType;
            String fileName = normalizedKey.contains("/")
                ? normalizedKey.substring(normalizedKey.lastIndexOf('/') + 1)
                : normalizedKey;

            return new DownloadedMedia(response.asByteArray(), safeContentType, fileName);
        } catch (S3Exception ex) {
            int status = ex.statusCode();
            if (status == 404 || status == 403) {
                throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Media not found", ex);
            }
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "Failed to read media from object storage", ex);
        }
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
        if (!isS3Configured()) {
            return buildGatewayObjectUrl(objectKey);
        }

        String encodedKey = URLEncoder.encode(objectKey, StandardCharsets.UTF_8).replace("+", "%20");
        String endpoint = storageProperties.getPublicEndpoint();
        if (endpoint == null || endpoint.isBlank()) {
            endpoint = storageProperties.getEndpoint();
        }
        if (endpoint != null && !endpoint.isBlank()) {
            String normalized = endpoint.endsWith("/") ? endpoint.substring(0, endpoint.length() - 1) : endpoint;
            if (storageProperties.isPathStyle()) {
                return normalized + "/" + storageProperties.getBucket() + "/" + encodedKey;
            }
            return normalized + "/" + encodedKey;
        }
        return "https://" + storageProperties.getBucket() + ".s3." + storageProperties.getRegion() + ".amazonaws.com/" + encodedKey;
    }

    private String buildGatewayObjectUrl(String objectKey) {
        String encodedKey = URLEncoder.encode(objectKey, StandardCharsets.UTF_8).replace("+", "%20");
        return "/api/v1/media/object?key=" + encodedKey;
    }

    private boolean isS3Configured() {
        return hasText(storageProperties.getEndpoint())
            || (hasText(storageProperties.getAccessKey()) && hasText(storageProperties.getSecretKey()));
    }

    private boolean hasText(String value) {
        return value != null && !value.isBlank();
    }

    private void writeLocalObject(String objectKey, byte[] bytes) throws IOException {
        Path target = resolveLocalObjectPath(objectKey);
        Files.createDirectories(target.getParent());
        Files.write(target, bytes);
    }

    private byte[] readLocalObject(String objectKey) throws IOException {
        return Files.readAllBytes(resolveLocalObjectPath(objectKey));
    }

    private Path resolveLocalObjectPath(String objectKey) {
        String normalizedKey = objectKey == null ? "" : objectKey.replace('\\', '/').replaceAll("^/+", "");
        Path target = localStorageRoot.resolve(normalizedKey).normalize();
        if (!target.startsWith(localStorageRoot)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid media key");
        }
        return target;
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

    private void ensureBucketExists(String bucket) {
        if (bucketVerified) {
            return;
        }

        synchronized (this) {
            if (bucketVerified) {
                return;
            }
            try {
                s3Client.headBucket(HeadBucketRequest.builder().bucket(bucket).build());
            } catch (S3Exception ex) {
                int status = ex.statusCode();
                if (status == 404 || status == 400) {
                    s3Client.createBucket(CreateBucketRequest.builder().bucket(bucket).build());
                } else {
                    throw ex;
                }
            }
            bucketVerified = true;
        }
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

    public record DownloadedMedia(
        byte[] bytes,
        String contentType,
        String fileName
    ) {
    }
}
