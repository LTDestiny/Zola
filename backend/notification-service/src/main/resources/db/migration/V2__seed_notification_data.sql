INSERT INTO notifications (
    id, user_id, type, content, reference_id, is_read, created_at
)
SELECT
    '61111111-1111-1111-1111-111111111111'::uuid,
    '11111111-1111-1111-1111-111111111111'::uuid,
    'SYSTEM',
    'Welcome to Zola seed notification',
    NULL,
    FALSE,
    NOW()
WHERE NOT EXISTS (
    SELECT 1 FROM notifications WHERE id = '61111111-1111-1111-1111-111111111111'::uuid
);
