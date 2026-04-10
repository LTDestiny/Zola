CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS reports (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reporter_id     UUID NOT NULL,
    target_type     VARCHAR(20) NOT NULL,
    target_id       UUID NOT NULL,
    reason          VARCHAR(100) NOT NULL,
    description     TEXT,
    status          VARCHAR(20) DEFAULT 'PENDING',
    reviewed_by     UUID,
    reviewed_at     TIMESTAMP,
    created_at      TIMESTAMP DEFAULT NOW()
);