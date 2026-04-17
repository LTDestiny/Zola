#!/bin/sh
set -eu

: "${POSTGRES_HOST:=postgres}"
: "${POSTGRES_DB:=postgres}"
: "${POSTGRES_USER:=postgres}"
: "${POSTGRES_PASSWORD:=root}"

connect_user=""
connect_password=""

try_connect() {
	candidate_user="$1"
	candidate_password="$2"
	if [ -z "$candidate_user" ]; then
		return 1
	fi

	PGPASSWORD="$candidate_password" psql \
		-h "${POSTGRES_HOST}" \
		-U "$candidate_user" \
		-d "${POSTGRES_DB}" \
		-v ON_ERROR_STOP=1 \
		-c "SELECT 1" >/dev/null 2>&1
}

# 1) Try credentials passed by compose/.env
if try_connect "${POSTGRES_USER}" "${POSTGRES_PASSWORD}"; then
	connect_user="${POSTGRES_USER}"
	connect_password="${POSTGRES_PASSWORD}"
fi

# 2) Fallback for older volumes initialized with a different superuser
if [ -z "${connect_user}" ] && try_connect "postgres" "root"; then
	connect_user="postgres"
	connect_password="root"
fi

if [ -z "${connect_user}" ] && try_connect "zola" "zola_pass"; then
	connect_user="zola"
	connect_password="zola_pass"
fi

if [ -z "${connect_user}" ]; then
	echo "Unable to connect to PostgreSQL with known bootstrap credentials."
	exit 1
fi

export PGPASSWORD="${connect_password}"

psql -h "${POSTGRES_HOST}" -U "${connect_user}" -d "${POSTGRES_DB}" -v ON_ERROR_STOP=1 <<'SQL'
DO $$
BEGIN
		IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'postgres') THEN
				CREATE ROLE postgres LOGIN SUPERUSER PASSWORD 'root';
		END IF;

		IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'zola') THEN
				CREATE ROLE zola LOGIN SUPERUSER PASSWORD 'zola_pass';
		END IF;
END
$$;
SQL

psql -h "${POSTGRES_HOST}" -U "${connect_user}" -d "${POSTGRES_DB}" -v ON_ERROR_STOP=1 <<'SQL'
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
SQL

echo "PostgreSQL bootstrap completed."
