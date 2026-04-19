ALTER TABLE conversation
    ADD COLUMN IF NOT EXISTS type VARCHAR(16) NOT NULL DEFAULT 'private';

UPDATE conversation
SET type = COALESCE(NULLIF(TRIM(type), ''), 'private')
WHERE type IS NULL OR TRIM(type) = '';

CREATE INDEX IF NOT EXISTS idx_conversation_type_updated_at
    ON conversation (type, updated_at DESC);
