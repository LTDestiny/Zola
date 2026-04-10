INSERT INTO ai_usage_logs (
    id, user_id, prompt_tokens, completion_tokens, model, created_at
)
SELECT
    '51111111-1111-1111-1111-111111111111'::uuid,
    '11111111-1111-1111-1111-111111111111'::uuid,
    32,
    58,
    'gpt-4o-mini',
    NOW()
WHERE NOT EXISTS (
    SELECT 1 FROM ai_usage_logs WHERE id = '51111111-1111-1111-1111-111111111111'::uuid
);
