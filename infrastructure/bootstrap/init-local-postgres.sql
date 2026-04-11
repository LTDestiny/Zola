-- Initialize all service databases on local PostgreSQL (pgAdmin instance)
SELECT 'CREATE DATABASE zola_gateway_db'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'zola_gateway_db')\gexec
SELECT 'CREATE DATABASE zola_identity_db'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'zola_identity_db')\gexec
SELECT 'CREATE DATABASE zola_user_db'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'zola_user_db')\gexec
SELECT 'CREATE DATABASE zola_call_db'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'zola_call_db')\gexec
SELECT 'CREATE DATABASE zola_file_db'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'zola_file_db')\gexec
SELECT 'CREATE DATABASE zola_ai_meta_db'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'zola_ai_meta_db')\gexec
SELECT 'CREATE DATABASE zola_notification_db'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'zola_notification_db')\gexec
SELECT 'CREATE DATABASE zola_admin_db'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'zola_admin_db')\gexec
