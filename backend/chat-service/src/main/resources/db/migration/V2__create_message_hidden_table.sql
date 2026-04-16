CREATE TABLE IF NOT EXISTS message_hidden (
    id UUID PRIMARY KEY,
    user_id VARCHAR(64) NOT NULL,
    message_id VARCHAR(128) NOT NULL,
    created_at TIMESTAMP NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_message_hidden_user_message
    ON message_hidden (user_id, message_id);

CREATE INDEX IF NOT EXISTS idx_message_hidden_user_created_at
    ON message_hidden (user_id, created_at DESC);