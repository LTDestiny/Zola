ALTER TABLE friendships
    ADD COLUMN IF NOT EXISTS addressee_viewed_at TIMESTAMP NULL;

CREATE INDEX IF NOT EXISTS idx_friendships_addressee_pending_unread
    ON friendships (addressee_id, status, addressee_viewed_at);
