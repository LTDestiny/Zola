CREATE TABLE IF NOT EXISTS user_pinned_conversations (
    id BIGSERIAL PRIMARY KEY,
    user_id VARCHAR(64) NOT NULL,
    conversation_id VARCHAR(64) NOT NULL,
    pinned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uk_user_pinned_conversation UNIQUE (user_id, conversation_id)
);

CREATE INDEX IF NOT EXISTS idx_user_pinned_conversations_user_pinned_at
    ON user_pinned_conversations (user_id, pinned_at DESC);

INSERT INTO user_pinned_conversations (user_id, conversation_id, pinned_at)
SELECT user1_id, id::text, COALESCE(updated_at, NOW())
FROM conversation
WHERE user1_is_pinned = TRUE
ON CONFLICT (user_id, conversation_id) DO NOTHING;

INSERT INTO user_pinned_conversations (user_id, conversation_id, pinned_at)
SELECT user2_id, id::text, COALESCE(updated_at, NOW())
FROM conversation
WHERE user2_is_pinned = TRUE
ON CONFLICT (user_id, conversation_id) DO NOTHING;
