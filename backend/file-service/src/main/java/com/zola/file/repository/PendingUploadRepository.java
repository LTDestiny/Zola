package com.zola.file.repository;

import com.zola.file.entity.PendingUploadEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

@Repository
public interface PendingUploadRepository extends JpaRepository<PendingUploadEntity, UUID> {

    /**
     * Find all uploads that have expired and were never confirmed by the sender.
     * Used by the cleanup scheduler.
     */
    @Query("SELECT p FROM PendingUploadEntity p WHERE p.expiresAt < :now AND p.confirmedAt IS NULL")
    List<PendingUploadEntity> findExpiredUnconfirmed(@Param("now") Instant now);

    /**
     * Mark a batch of file keys as confirmed (message was sent successfully).
     */
    @Modifying
    @Transactional
    @Query("UPDATE PendingUploadEntity p SET p.confirmedAt = :now WHERE p.fileKey IN :fileKeys")
    void confirmAll(@Param("fileKeys") List<String> fileKeys, @Param("now") Instant now);

    /**
     * Delete a single pending record by its S3 file key.
     */
    @Modifying
    @Transactional
    @Query("DELETE FROM PendingUploadEntity p WHERE p.fileKey = :fileKey")
    void deleteByFileKey(@Param("fileKey") String fileKey);
}
