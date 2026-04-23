ALTER TABLE users
    ADD COLUMN IF NOT EXISTS hide_birthdate BOOLEAN DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS hide_email BOOLEAN DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS hide_phone BOOLEAN DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS allow_stranger_messages BOOLEAN DEFAULT TRUE;

UPDATE users
SET hide_birthdate = COALESCE(hide_birthdate, FALSE),
    hide_email = COALESCE(hide_email, FALSE),
    hide_phone = COALESCE(hide_phone, FALSE),
    allow_stranger_messages = COALESCE(allow_stranger_messages, TRUE)
WHERE hide_birthdate IS NULL
   OR hide_email IS NULL
   OR hide_phone IS NULL
   OR allow_stranger_messages IS NULL;
