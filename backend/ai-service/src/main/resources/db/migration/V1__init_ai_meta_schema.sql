CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS ai_usage_logs (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id           UUID,
    prompt_tokens     INT DEFAULT 0,
    completion_tokens INT DEFAULT 0,
    model             VARCHAR(50),
    created_at        TIMESTAMP DEFAULT NOW()
);