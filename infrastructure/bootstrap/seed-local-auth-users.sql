-- Run after Flyway created auth tables in zola_identity_db
CREATE EXTENSION IF NOT EXISTS pgcrypto;

INSERT INTO users (
    id, email, phone, identity_type, password_hash, full_name,
    email_verified, phone_verified, is_active, is_deleted, created_at, updated_at
)
SELECT
    '11111111-1111-1111-1111-111111111111'::uuid,
    'seed1@zola.app',
    '0900000001',
    'EMAIL',
    crypt('password123', gen_salt('bf', 10)),
    'Seed User 1',
    TRUE,
    FALSE,
    TRUE,
    FALSE,
    NOW(),
    NOW()
WHERE NOT EXISTS (
    SELECT 1 FROM users WHERE id = '11111111-1111-1111-1111-111111111111'::uuid
);

INSERT INTO users (
    id, email, phone, identity_type, password_hash, full_name,
    email_verified, phone_verified, is_active, is_deleted, created_at, updated_at
)
SELECT
    '11111111-1111-1111-1111-222222222222'::uuid,
    'seed2@zola.app',
    '0900000002',
    'EMAIL',
    crypt('password123', gen_salt('bf', 10)),
    'Seed User 2',
    TRUE,
    FALSE,
    TRUE,
    FALSE,
    NOW(),
    NOW()
WHERE NOT EXISTS (
    SELECT 1 FROM users WHERE id = '11111111-1111-1111-1111-222222222222'::uuid
);

INSERT INTO users (
    id, email, phone, identity_type, password_hash, full_name,
    email_verified, phone_verified, is_active, is_deleted, created_at, updated_at
)
SELECT
    '11111111-1111-1111-1111-333333333333'::uuid,
    'seed3@zola.app',
    '0900000003',
    'EMAIL',
    crypt('password123', gen_salt('bf', 10)),
    'Seed User 3',
    TRUE,
    FALSE,
    TRUE,
    FALSE,
    NOW(),
    NOW()
WHERE NOT EXISTS (
    SELECT 1 FROM users WHERE id = '11111111-1111-1111-1111-333333333333'::uuid
);
