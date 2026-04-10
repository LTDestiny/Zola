CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS file_audit_logs (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    uploader_id     UUID,
    file_key        TEXT NOT NULL,
    action          VARCHAR(30) NOT NULL,
    metadata        JSONB,
    created_at      TIMESTAMP DEFAULT NOW()
);