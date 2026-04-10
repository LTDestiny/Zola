INSERT INTO friendships (
    id, requester_id, addressee_id, status, nickname, created_at, updated_at
)
SELECT
    '21111111-1111-1111-1111-111111111111'::uuid,
    '11111111-1111-1111-1111-111111111111'::uuid,
    '11111111-1111-1111-1111-333333333333'::uuid,
    'ACCEPTED',
    'Seed Friend',
    NOW(),
    NOW()
WHERE NOT EXISTS (
    SELECT 1 FROM friendships WHERE id = '21111111-1111-1111-1111-111111111111'::uuid
);

INSERT INTO groups (
    id, name, avatar_url, owner_id, is_active, created_at, updated_at
)
SELECT
    '21111111-1111-1111-1111-222222222222'::uuid,
    'Seed Group',
    NULL,
    '11111111-1111-1111-1111-111111111111'::uuid,
    TRUE,
    NOW(),
    NOW()
WHERE NOT EXISTS (
    SELECT 1 FROM groups WHERE id = '21111111-1111-1111-1111-222222222222'::uuid
);
