INSERT INTO call_logs (
    id, caller_id, callee_id, group_id, call_type, call_mode, status,
    started_at, ended_at, duration_sec, created_at
)
SELECT
    '31111111-1111-1111-1111-111111111111'::uuid,
    '11111111-1111-1111-1111-111111111111'::uuid,
    '11111111-1111-1111-1111-333333333333'::uuid,
    NULL,
    'AUDIO',
    'ONE_TO_ONE',
    'COMPLETED',
    NOW() - INTERVAL '5 minutes',
    NOW() - INTERVAL '2 minutes',
    180,
    NOW()
WHERE NOT EXISTS (
    SELECT 1 FROM call_logs WHERE id = '31111111-1111-1111-1111-111111111111'::uuid
);
