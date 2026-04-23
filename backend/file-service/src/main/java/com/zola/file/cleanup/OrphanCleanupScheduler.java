package com.zola.file.cleanup;

import com.zola.common.storage.ObjectStorageProperties;
import com.zola.file.entity.PendingUploadEntity;
import com.zola.file.repository.PendingUploadRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.DeleteObjectRequest;

import java.time.Instant;
import java.util.List;

/**
 * Periodically deletes S3 objects for presigned uploads that were never
 * confirmed (i.e., the user requested upload URLs but never sent a message).
 *
 * <p>Schedule: every hour. For sub-minute precision in tests use a cron expression.</p>
 */
@Component
public class OrphanCleanupScheduler {

    private static final Logger log = LoggerFactory.getLogger(OrphanCleanupScheduler.class);

    private final PendingUploadRepository pendingUploadRepository;
    private final S3Client s3Client;
    private final ObjectStorageProperties storageProperties;

    public OrphanCleanupScheduler(
        PendingUploadRepository pendingUploadRepository,
        S3Client s3Client,
        ObjectStorageProperties storageProperties
    ) {
        this.pendingUploadRepository = pendingUploadRepository;
        this.s3Client = s3Client;
        this.storageProperties = storageProperties;
    }

    /**
     * Runs every hour (fixedDelay = 3600 s, initial delay = 5 min to let service start).
     */
    @Scheduled(fixedDelayString = "${media.cleanup.interval-ms:3600000}",
               initialDelayString = "${media.cleanup.initial-delay-ms:300000}")
    public void cleanupOrphanedUploads() {
        List<PendingUploadEntity> expired = pendingUploadRepository.findExpiredUnconfirmed(Instant.now());
        if (expired.isEmpty()) {
            log.debug("Orphan cleanup: nothing to delete");
            return;
        }

        log.info("Orphan cleanup: found {} expired unconfirmed upload(s)", expired.size());

        int deleted = 0;
        int failed  = 0;
        for (PendingUploadEntity record : expired) {
            try {
                s3Client.deleteObject(DeleteObjectRequest.builder()
                    .bucket(storageProperties.getBucket())
                    .key(record.getFileKey())
                    .build());
                pendingUploadRepository.delete(record);
                deleted++;
                log.debug("Orphan cleanup: deleted s3://{}/{}", storageProperties.getBucket(), record.getFileKey());
            } catch (Exception ex) {
                failed++;
                log.warn("Orphan cleanup: failed to delete s3://{}/{} - {}",
                    storageProperties.getBucket(), record.getFileKey(), ex.getMessage());
            }
        }

        log.info("Orphan cleanup finished: {} deleted, {} failed", deleted, failed);
    }
}
