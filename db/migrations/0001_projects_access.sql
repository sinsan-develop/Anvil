CREATE TABLE anvil.users (
  id uuid PRIMARY KEY, login_name text NOT NULL, normalized_login_name text NOT NULL UNIQUE,
  display_name text NOT NULL, status text NOT NULL CHECK(status IN ('ACTIVE','REVOKED')),
  credential_generation bigint NOT NULL DEFAULT 1 CHECK(credential_generation > 0),
  server_owner boolean NOT NULL DEFAULT false, version bigint NOT NULL DEFAULT 1 CHECK(version > 0),
  created_at timestamptz NOT NULL DEFAULT now(), revoked_at timestamptz
);
CREATE UNIQUE INDEX one_active_server_owner ON anvil.users(server_owner) WHERE server_owner AND status='ACTIVE';
CREATE TABLE anvil.clients (
  id uuid PRIMARY KEY, user_id uuid NOT NULL REFERENCES anvil.users(id) ON DELETE RESTRICT,
  label text NOT NULL, version bigint NOT NULL DEFAULT 1 CHECK(version > 0),
  created_at timestamptz NOT NULL DEFAULT now(), revoked_at timestamptz, UNIQUE(user_id,id)
);
CREATE TABLE anvil.password_credentials (
  user_id uuid PRIMARY KEY REFERENCES anvil.users(id) ON DELETE RESTRICT, argon2_phc text NOT NULL,
  credential_generation bigint NOT NULL CHECK(credential_generation>0), changed_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE anvil.auth_sessions (
  id uuid PRIMARY KEY, token_digest text NOT NULL UNIQUE CHECK(token_digest ~ '^[0-9a-f]{64}$'),
  user_id uuid NOT NULL REFERENCES anvil.users(id) ON DELETE RESTRICT, client_id uuid NOT NULL,
  credential_generation bigint NOT NULL CHECK(credential_generation>0), csrf_digest text NOT NULL CHECK(csrf_digest ~ '^[0-9a-f]{64}$'),
  created_at timestamptz NOT NULL DEFAULT now(), last_seen_at timestamptz NOT NULL DEFAULT now(),
  idle_expires_at timestamptz NOT NULL, absolute_expires_at timestamptz NOT NULL, reauth_until timestamptz, revoked_at timestamptz,
  FOREIGN KEY(user_id,client_id) REFERENCES anvil.clients(user_id,id) ON DELETE RESTRICT
);
CREATE INDEX auth_sessions_user ON anvil.auth_sessions(user_id);
CREATE TABLE anvil.installation_claims (
  installation_id uuid PRIMARY KEY, bootstrap_digest text NOT NULL CHECK(bootstrap_digest ~ '^[0-9a-f]{64}$'),
  expires_at timestamptz NOT NULL, consumed_at timestamptz, owner_user_id uuid REFERENCES anvil.users(id) ON DELETE RESTRICT,
  version bigint NOT NULL DEFAULT 1 CHECK(version>0)
);
CREATE TABLE anvil.recovery_credentials (
  id uuid PRIMARY KEY, user_id uuid NOT NULL REFERENCES anvil.users(id) ON DELETE RESTRICT, secret_digest text NOT NULL UNIQUE,
  issued_at timestamptz NOT NULL DEFAULT now(), consumed_at timestamptz, revoked_at timestamptz
);
CREATE UNIQUE INDEX one_active_recovery ON anvil.recovery_credentials(user_id) WHERE consumed_at IS NULL AND revoked_at IS NULL;
CREATE TABLE anvil.user_invitations (
  id uuid PRIMARY KEY, normalized_login_name text NOT NULL, display_name text NOT NULL, secret_digest text NOT NULL UNIQUE,
  project_grants_json jsonb NOT NULL, expires_at timestamptz NOT NULL,
  consumed_by uuid REFERENCES anvil.users(id) ON DELETE RESTRICT, consumed_at timestamptz, revoked_at timestamptz,
  created_by uuid NOT NULL REFERENCES anvil.users(id) ON DELETE RESTRICT
);
CREATE TABLE anvil.auth_attempt_windows (
  bucket_kind text NOT NULL CHECK(bucket_kind IN ('ACCOUNT','SOURCE')), bucket_key text NOT NULL,
  window_start timestamptz NOT NULL, attempt_count integer NOT NULL CHECK(attempt_count>=0), blocked_until timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(bucket_kind,bucket_key,window_start)
);
CREATE TABLE anvil.auth_actions (
  id uuid PRIMARY KEY, actor_scope text NOT NULL, operation text NOT NULL, command_id uuid NOT NULL,
  protected_fingerprint text NOT NULL, result_status text NOT NULL, safe_result_ref jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(actor_scope,operation,command_id)
);
CREATE TABLE anvil.auth_audit_events (
  id uuid PRIMARY KEY, server_sequence bigint GENERATED ALWAYS AS IDENTITY UNIQUE,
  subject_ref uuid, action_id uuid, client_ref uuid, operation text NOT NULL, outcome text NOT NULL,
  reason_code text NOT NULL, recorded_at timestamptz NOT NULL DEFAULT now()
);
REVOKE UPDATE,DELETE ON anvil.auth_audit_events FROM anvil_v3_app;
CREATE TABLE anvil.projects (
  id uuid PRIMARY KEY, name text NOT NULL CHECK(length(trim(name))>0), purpose text NOT NULL CHECK(length(trim(purpose))>0),
  desired_outcome text NOT NULL CHECK(length(trim(desired_outcome))>0), version bigint NOT NULL DEFAULT 1 CHECK(version>0),
  archived_at timestamptz, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE anvil.project_drafts (
  id uuid PRIMARY KEY, owner_user_id uuid NOT NULL REFERENCES anvil.users(id) ON DELETE RESTRICT,
  client_id uuid NOT NULL, version bigint NOT NULL DEFAULT 1 CHECK(version>0), step integer NOT NULL CHECK(step BETWEEN 1 AND 4),
  input_json jsonb NOT NULL, consumed_project_id uuid REFERENCES anvil.projects(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY(owner_user_id,client_id) REFERENCES anvil.clients(user_id,id) ON DELETE RESTRICT,
  UNIQUE(owner_user_id,id)
);
CREATE INDEX project_drafts_owner ON anvil.project_drafts(owner_user_id,updated_at DESC,id DESC);
CREATE TABLE anvil.project_members (
  project_id uuid NOT NULL REFERENCES anvil.projects(id) ON DELETE RESTRICT,
  user_id uuid NOT NULL REFERENCES anvil.users(id) ON DELETE RESTRICT,
  participation text NOT NULL CHECK(participation IN ('OWNER','VIEWER','HANDOFF_ELIGIBLE')),
  version bigint NOT NULL DEFAULT 1 CHECK(version>0), joined_at timestamptz NOT NULL DEFAULT now(), revoked_at timestamptz,
  PRIMARY KEY(project_id,user_id)
);
CREATE INDEX project_members_user ON anvil.project_members(user_id,project_id) WHERE revoked_at IS NULL;
CREATE TABLE anvil.project_control (
  project_id uuid PRIMARY KEY, actor_id uuid NOT NULL, client_id uuid NOT NULL, generation bigint NOT NULL CHECK(generation>0),
  version bigint NOT NULL DEFAULT 1 CHECK(version>0), issued_at timestamptz NOT NULL DEFAULT now(), revoked_at timestamptz,
  FOREIGN KEY(project_id,actor_id) REFERENCES anvil.project_members(project_id,user_id) ON DELETE RESTRICT,
  FOREIGN KEY(actor_id,client_id) REFERENCES anvil.clients(user_id,id) ON DELETE RESTRICT
);
CREATE TABLE anvil.source_declarations (
  id uuid PRIMARY KEY, draft_id uuid REFERENCES anvil.project_drafts(id) ON DELETE RESTRICT,
  project_id uuid REFERENCES anvil.projects(id) ON DELETE RESTRICT,
  version bigint NOT NULL CHECK(version>0), declared_by uuid NOT NULL REFERENCES anvil.users(id) ON DELETE RESTRICT,
  host_label text NOT NULL, display_name text NOT NULL, path_hint_protected_ref text, origin_root_ref uuid, reason text NOT NULL,
  authority text NOT NULL CHECK(authority='USER_DECLARED'), created_at timestamptz NOT NULL DEFAULT now(),
  CHECK((draft_id IS NULL)<>(project_id IS NULL)), UNIQUE(draft_id,id), UNIQUE(project_id,id)
);
CREATE TABLE anvil.project_baselines (
  id uuid PRIMARY KEY, project_id uuid NOT NULL REFERENCES anvil.projects(id) ON DELETE RESTRICT,
  version bigint NOT NULL CHECK(version>0), source_snapshot_ref uuid NOT NULL,
  content_json jsonb NOT NULL, content_hash text NOT NULL CHECK(content_hash ~ '^[0-9a-f]{64}$'),
  created_by uuid NOT NULL REFERENCES anvil.users(id) ON DELETE RESTRICT, created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(project_id,id), UNIQUE(project_id,version)
);
