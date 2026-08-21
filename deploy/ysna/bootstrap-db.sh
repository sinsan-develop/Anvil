#!/usr/bin/env bash
set -euo pipefail
: "${ANVIL_MIGRATOR_PASSWORD:?ANVIL_MIGRATOR_PASSWORD is required}"
: "${ANVIL_APP_PASSWORD:?ANVIL_APP_PASSWORD is required}"
[[ "$ANVIL_MIGRATOR_PASSWORD" =~ ^[0-9a-f]{64}$ ]] || { echo 'invalid migrator secret' >&2; exit 2; }
[[ "$ANVIL_APP_PASSWORD" =~ ^[0-9a-f]{64}$ ]] || { echo 'invalid app secret' >&2; exit 2; }
: "${SHARED_DB_CONTAINER:=shared-db}"; : "${POSTGRES_ADMIN_USER:=postgres}"
psql_shared() { docker exec -i "$SHARED_DB_CONTAINER" psql -X -v ON_ERROR_STOP=1 -U "$POSTGRES_ADMIN_USER" "$@"; }
psql_shared --dbname=postgres <<'SQL'
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='anvil_owner') THEN CREATE ROLE anvil_owner NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS; END IF;
 IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='anvil_migrator') THEN CREATE ROLE anvil_migrator LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS; END IF;
 IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='anvil_app') THEN CREATE ROLE anvil_app LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS; END IF;
END $$;
SQL
psql_shared --dbname=postgres -v "migrator_password=$ANVIL_MIGRATOR_PASSWORD" -v "app_password=$ANVIL_APP_PASSWORD" <<'SQL'
ALTER ROLE anvil_migrator PASSWORD :'migrator_password'; ALTER ROLE anvil_app PASSWORD :'app_password';
SELECT format('CREATE DATABASE anvil OWNER anvil_owner') WHERE NOT EXISTS (SELECT 1 FROM pg_database WHERE datname='anvil')\gexec
SQL
psql_shared --dbname=anvil <<'SQL'
REVOKE ALL ON SCHEMA public FROM PUBLIC; ALTER SCHEMA public OWNER TO anvil_owner;
GRANT CONNECT ON DATABASE anvil TO anvil_migrator, anvil_app; GRANT USAGE,CREATE ON SCHEMA public TO anvil_migrator; GRANT USAGE ON SCHEMA public TO anvil_app;
SQL
echo '{"status":"ready","database":"anvil","roles":["anvil_owner","anvil_migrator","anvil_app"]}'
