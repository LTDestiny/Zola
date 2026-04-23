-- V2: Pending upload tracking for orphan cleanup
-- When a presigned URL is issued but the user never sends a message,
-- this table lets the cleanup scheduler identify and delete the orphaned S3 object.

CREATE TABLE IF NOT EXISTS pending_uploads (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id      VARCHAR(128)            NOT NULL,
    file_key     TEXT                    NOT NULL UNIQUE,
    file_name    TEXT                    NOT NULL,
    content_type VARCHAR(128)            NOT NULL,
    size_bytes   BIGINT                  NOT NULL,
    issued_at    TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    confirmed_at TIMESTAMP WITH TIME ZONE,
    expires_at   TIMESTAMP WITH TIME ZONE NOT NULL
);

-- Fast index to find expired-and-unconfirmed rows in O(log n)
CREATE INDEX idx_pending_uploads_cleanup
    ON pending_uploads (expires_at)
    WHERE confirmed_at IS NULL;
