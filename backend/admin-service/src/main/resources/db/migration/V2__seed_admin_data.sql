INSERT INTO reports (
    id, reporter_id, target_type, target_id, reason, description, status, reviewed_by, reviewed_at, created_at
)
SELECT
    '71111111-1111-1111-1111-111111111111'::uuid,
    '11111111-1111-1111-1111-111111111111'::uuid,
    'USER',
    '11111111-1111-1111-1111-333333333333'::uuid,
    'SPAM',
    'Seed report for moderation flow',
    'PENDING',
    NULL,
    NULL,
    NOW()
WHERE NOT EXISTS (
    SELECT 1 FROM reports WHERE id = '71111111-1111-1111-1111-111111111111'::uuid
);
