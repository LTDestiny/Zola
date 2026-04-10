INSERT INTO users (
    id, email, phone, identity_type, password_hash, full_name,
    email_verified, phone_verified, is_active, is_deleted, created_at, updated_at
)
SELECT
    '11111111-1111-1111-1111-111111111111'::uuid,
    'seed.auth@zola.app',
    '0900000001',
    'EMAIL',
    '$2a$10$8m1vDg8Wf7xQY7z3c5n4QeL2w8h8D5U6j9Q0v3S8m1vDg8Wf7xQY6',
    'Seed Auth User',
    TRUE,
    FALSE,
    TRUE,
    FALSE,
    NOW(),
    NOW()
WHERE NOT EXISTS (
    SELECT 1 FROM users WHERE id = '11111111-1111-1111-1111-111111111111'::uuid
);

INSERT INTO user_sessions (
    id, user_id, refresh_token, device_name, device_type, ip_address, user_agent, is_active, expires_at, created_at
)
SELECT
    '11111111-1111-1111-1111-222222222222'::uuid,
    '11111111-1111-1111-1111-111111111111'::uuid,
    'seed-refresh-token-auth-service',
    'Seed Chrome',
    'WEB',
    '127.0.0.1',
    'seed-agent',
    TRUE,
    NOW() + INTERVAL '7 days',
    NOW()
WHERE NOT EXISTS (
    SELECT 1 FROM user_sessions WHERE id = '11111111-1111-1111-1111-222222222222'::uuid
);
