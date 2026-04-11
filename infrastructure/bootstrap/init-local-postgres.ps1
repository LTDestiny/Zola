$ErrorActionPreference = "Stop"

$env:PGPASSWORD = "admin"

Write-Host "[1/4] Creating service databases on local PostgreSQL..."
psql -h localhost -U postgres -d postgres -f "./init-local-postgres.sql"

Write-Host "[2/4] Applying auth schema migration..."
psql -h localhost -U postgres -d zola_identity_db -f "../../backend/auth-service/src/main/resources/db/migration/V1__init_identity_schema.sql"

Write-Host "[3/4] Seeding auth users (password = password123)..."
psql -h localhost -U postgres -d zola_identity_db -f "./seed-local-auth-users.sql"

Write-Host "[4/4] Applying user schema + seed..."
psql -h localhost -U postgres -d zola_user_db -f "../../backend/user-service/src/main/resources/db/migration/V1__init_user_schema.sql"
psql -h localhost -U postgres -d zola_user_db -f "../../backend/user-service/src/main/resources/db/migration/V2__seed_user_data.sql"

Write-Host "Done. Databases and seed data are ready in local PostgreSQL."