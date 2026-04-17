-- =========================
-- SEED USERS (10 rows)
-- =========================
SET search_path TO public;
INSERT INTO public.users (id, email, phone, identity_type, password_hash, full_name, is_active, created_at, updated_at)
SELECT 
    gen_random_uuid(),
    'user' || i || '@mail.com',
    '09000000' || LPAD(i::text, 2, '0'),
    'EMAIL',
    'hash',
    'User ' || i,
    true,
    now(),
    now()
FROM generate_series(1,10) i;


-- =========================
-- FILE AUDIT LOGS
-- =========================
INSERT INTO public.file_audit_logs (id, uploader_id, file_key, action, metadata)
SELECT 
    gen_random_uuid(),
    NULL,
    'file_' || i,
    'UPLOAD',
    '{}'::jsonb
FROM generate_series(1,10) i;


-- =========================
-- USER SESSIONS
-- =========================
INSERT INTO public.user_sessions (id, user_id, refresh_token, is_active, expires_at)
SELECT 
    gen_random_uuid(),
    id,
    gen_random_uuid()::text,
    true,
    now() + interval '7 days'
FROM users
LIMIT 10;


-- =========================
-- SECURITY LOGS
-- =========================
INSERT INTO public.security_logs (id, user_id, event_type)
SELECT 
    gen_random_uuid(),
    id,
    'LOGIN'
FROM users
LIMIT 10;


-- =========================
-- OTP LOGS
-- =========================
INSERT INTO public.otp_logs (id, user_id, identifier, otp_type, expires_at)
SELECT 
    gen_random_uuid(),
    id,
    'user' || row_number() over(),
    'EMAIL',
    now() + interval '5 minutes'
FROM users
LIMIT 10;


-- =========================
-- GROUPS
-- =========================
INSERT INTO public.groups (id, name, owner_id)
SELECT 
    gen_random_uuid(),
    'Group ' || row_number() over(),
    id
FROM users
LIMIT 10;


-- =========================
-- GROUP MEMBERS
-- =========================
INSERT INTO public.group_members (id, group_id, user_id)
SELECT 
    gen_random_uuid(),
    g.id,
    u.id
FROM groups g
JOIN users u ON true
LIMIT 10;


-- =========================
-- FRIENDSHIPS
-- =========================
INSERT INTO public.friendships (id, requester_id, addressee_id, status)
SELECT 
    gen_random_uuid(),
    u1.id,
    u2.id,
    'ACCEPTED'
FROM users u1
JOIN users u2 ON u1.id <> u2.id
LIMIT 10;