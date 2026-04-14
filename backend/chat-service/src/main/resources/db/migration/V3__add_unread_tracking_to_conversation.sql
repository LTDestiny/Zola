ALTER TABLE conversation
    ADD COLUMN IF NOT EXISTS last_message_at TIMESTAMP;

UPDATE conversation
SET last_message_at = COALESCE(last_message_at, updated_at, NOW())
WHERE last_message_at IS NULL;

ALTER TABLE conversation
    ALTER COLUMN last_message_at SET NOT NULL;

ALTER TABLE conversation
    ADD COLUMN IF NOT EXISTS user1_unread_count INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS user2_unread_count INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS user1_last_read_at TIMESTAMP,
    ADD COLUMN IF NOT EXISTS user2_last_read_at TIMESTAMP,
    ADD COLUMN IF NOT EXISTS user1_last_read_message_id VARCHAR(128),
    ADD COLUMN IF NOT EXISTS user2_last_read_message_id VARCHAR(128);

CREATE INDEX IF NOT EXISTS idx_conversation_user1_unread
    ON conversation (user1_id, user1_unread_count DESC, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_conversation_user2_unread
    ON conversation (user2_id, user2_unread_count DESC, updated_at DESC);