#!/usr/bin/env bash
set -euo pipefail
: "${SHARED_DB_CONTAINER:=shared-db}"; : "${POSTGRES_ADMIN_USER:=postgres}"
docker exec -i "$SHARED_DB_CONTAINER" psql -X -At -U "$POSTGRES_ADMIN_USER" --dbname=anvil <<'SQL'
SELECT json_build_object('database',current_database(),'schema_owner',(SELECT nspowner::regrole::text FROM pg_namespace WHERE nspname='public'),'roles',(SELECT json_agg(json_build_object('name',rolname,'superuser',rolsuper,'createdb',rolcreatedb,'createrole',rolcreaterole,'replication',rolreplication,'bypassrls',rolbypassrls)) FROM pg_roles WHERE rolname IN ('anvil_owner','anvil_migrator','anvil_app')),'migration_revision',(SELECT version_num FROM alembic_version LIMIT 1));
SQL
