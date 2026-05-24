UPDATE users SET password_hash = '$2a$10$4.lX4AIz6xJ4ZC1nYxSB1ulPksr5jgLClmFFxQbr1/IPlRlmD.f0C' WHERE email IN ('seed1@zola.app', 'seed2@zola.app', 'seed3@zola.app');
SELECT email, LEFT(password_hash, 10) as hash_prefix FROM users;
