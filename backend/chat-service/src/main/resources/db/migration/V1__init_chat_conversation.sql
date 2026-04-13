CREATE TABLE IF NOT EXISTS conversation (
    id UUID PRIMARY KEY,
    user1_id VARCHAR(64) NOT NULL,
    user2_id VARCHAR(64) NOT NULL,
    last_message TEXT,
    updated_at TIMESTAMP NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_conversation_users
    ON conversation (LEAST(user1_id, user2_id), GREATEST(user1_id, user2_id));

CREATE INDEX IF NOT EXISTS idx_conversation_user1_updated_at
    ON conversation (user1_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_conversation_user2_updated_at
    ON conversation (user2_id, updated_at DESC);
