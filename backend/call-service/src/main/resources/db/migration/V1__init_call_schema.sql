CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS call_logs (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    caller_id       UUID NOT NULL,
    callee_id       UUID,
    group_id        UUID,
    call_type       VARCHAR(10) NOT NULL,
    call_mode       VARCHAR(10) NOT NULL,
    status          VARCHAR(20) NOT NULL,
    started_at      TIMESTAMP,
    ended_at        TIMESTAMP,
    duration_sec    INT DEFAULT 0,
    created_at      TIMESTAMP DEFAULT NOW()
);