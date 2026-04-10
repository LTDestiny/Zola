INSERT INTO file_audit_logs (
    id, uploader_id, file_key, action, metadata, created_at
)
SELECT
    '41111111-1111-1111-1111-111111111111'::uuid,
    '11111111-1111-1111-1111-111111111111'::uuid,
    'seed/hello.txt',
    'UPLOAD',
    '{"source":"seed"}'::jsonb,
    NOW()
WHERE NOT EXISTS (
    SELECT 1 FROM file_audit_logs WHERE id = '41111111-1111-1111-1111-111111111111'::uuid
);
