UPDATE friendships
SET status = CASE
    WHEN upper(trim(status)) = 'CANCELED' THEN 'CANCELLED'
    ELSE upper(trim(status))
END
WHERE status IS NOT NULL;

DELETE FROM friendships target
USING (
    SELECT id
    FROM (
        SELECT
            id,
            row_number() OVER (
                PARTITION BY least(requester_id::text, addressee_id::text),
                             greatest(requester_id::text, addressee_id::text)
                ORDER BY
                    CASE upper(trim(status))
                        WHEN 'ACCEPTED' THEN 0
                        WHEN 'PENDING' THEN 1
                        WHEN 'BLOCKED' THEN 2
                        WHEN 'DECLINED' THEN 3
                        WHEN 'REJECTED' THEN 4
                        WHEN 'CANCELLED' THEN 5
                        WHEN 'NONE' THEN 6
                        ELSE 7
                    END,
                    updated_at DESC NULLS LAST,
                    created_at DESC NULLS LAST,
                    id DESC
            ) AS row_number_rank
        FROM friendships
    ) ranked
    WHERE ranked.row_number_rank > 1
) duplicate_rows
WHERE target.id = duplicate_rows.id;

ALTER TABLE friendships
    DROP CONSTRAINT IF EXISTS chk_friendships_status;

ALTER TABLE friendships
    ADD CONSTRAINT chk_friendships_status
    CHECK (upper(trim(status)) IN ('NONE', 'PENDING', 'ACCEPTED', 'BLOCKED', 'REJECTED', 'DECLINED', 'CANCELLED'));

ALTER TABLE friendships
    DROP CONSTRAINT IF EXISTS chk_friendships_not_self;

ALTER TABLE friendships
    ADD CONSTRAINT chk_friendships_not_self
    CHECK (requester_id <> addressee_id);

CREATE UNIQUE INDEX IF NOT EXISTS uk_friendships_user_pair_canonical
    ON friendships (
        least(requester_id::text, addressee_id::text),
        greatest(requester_id::text, addressee_id::text)
    );
