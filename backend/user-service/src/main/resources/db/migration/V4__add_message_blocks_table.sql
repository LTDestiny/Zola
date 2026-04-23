CREATE TABLE IF NOT EXISTS message_blocks (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    blocker_id       UUID NOT NULL,
    blocked_user_id  UUID NOT NULL,
    created_at       TIMESTAMP DEFAULT NOW(),
    updated_at       TIMESTAMP DEFAULT NOW(),
    CONSTRAINT chk_message_blocks_self_block CHECK (blocker_id <> blocked_user_id),
    CONSTRAINT uk_message_blocks_pair UNIQUE (blocker_id, blocked_user_id)
);

CREATE INDEX IF NOT EXISTS idx_message_blocks_blocker_id
    ON message_blocks (blocker_id);

CREATE INDEX IF NOT EXISTS idx_message_blocks_blocked_user_id
    ON message_blocks (blocked_user_id);
