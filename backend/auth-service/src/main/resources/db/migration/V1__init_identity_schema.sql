CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS users (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email           VARCHAR(255) UNIQUE,
    phone           VARCHAR(20) UNIQUE,
    identity_type   VARCHAR(10) NOT NULL DEFAULT 'EMAIL',
    password_hash   VARCHAR(255) NOT NULL,
    full_name       VARCHAR(100) NOT NULL,
    avatar_url      TEXT,
    gender          VARCHAR(10),
    birthdate       DATE,
    is_online       BOOLEAN DEFAULT FALSE,
    last_seen_at    TIMESTAMP,
    is_active       BOOLEAN DEFAULT TRUE,
    is_deleted      BOOLEAN DEFAULT FALSE,
    deleted_at      TIMESTAMP,
    email_verified  BOOLEAN DEFAULT FALSE,
    phone_verified  BOOLEAN DEFAULT FALSE,
    two_fa_enabled  BOOLEAN DEFAULT FALSE,
    two_fa_secret   VARCHAR(255),
    tos_accepted_at TIMESTAMP,
    tos_version     VARCHAR(20),
    created_at      TIMESTAMP DEFAULT NOW(),
    updated_at      TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_sessions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL,
    refresh_token   TEXT NOT NULL UNIQUE,
    device_name     VARCHAR(200),
    device_type     VARCHAR(50),
    ip_address      VARCHAR(45),
    user_agent      TEXT,
    is_active       BOOLEAN DEFAULT TRUE,
    expires_at      TIMESTAMP NOT NULL,
    last_used_at    TIMESTAMP DEFAULT NOW(),
    created_at      TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS security_logs (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID,
    event_type      VARCHAR(50) NOT NULL,
    ip_address      VARCHAR(45),
    device_info     TEXT,
    metadata        JSONB,
    created_at      TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS otp_logs (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID,
    identifier      VARCHAR(255) NOT NULL,
    otp_type        VARCHAR(30) NOT NULL,
    attempts        INT DEFAULT 0,
    sent_at         TIMESTAMP DEFAULT NOW(),
    expires_at      TIMESTAMP NOT NULL,
    used_at         TIMESTAMP
);