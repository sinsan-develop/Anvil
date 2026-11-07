CREATE TABLE anvil.permission_policies (
  id uuid PRIMARY KEY, project_id uuid NOT NULL UNIQUE REFERENCES anvil.projects(id) ON DELETE RESTRICT,
  head_version bigint NOT NULL CHECK(head_version>0), created_by uuid NOT NULL REFERENCES anvil.users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(project_id,id)
);
CREATE TABLE anvil.permission_policy_versions (
  project_id uuid NOT NULL, policy_id uuid NOT NULL, version bigint NOT NULL CHECK(version>0),
  rules_json jsonb NOT NULL CHECK(jsonb_typeof(rules_json)='array'),
  content_hash text NOT NULL CHECK(content_hash ~ '^[0-9a-f]{64}$'), reason text NOT NULL CHECK(length(trim(reason))>0),
  review_refs jsonb NOT NULL CHECK(jsonb_typeof(review_refs)='array'),
  created_by uuid NOT NULL REFERENCES anvil.users(id) ON DELETE RESTRICT, created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(project_id,policy_id,version), FOREIGN KEY(project_id,policy_id) REFERENCES anvil.permission_policies(project_id,id) ON DELETE RESTRICT
);
ALTER TABLE anvil.permission_policies ADD CONSTRAINT policy_current_version FOREIGN KEY(project_id,id,head_version)
  REFERENCES anvil.permission_policy_versions(project_id,policy_id,version) ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED;

CREATE TABLE anvil.commands (
  id uuid PRIMARY KEY, scope_kind text NOT NULL CHECK(scope_kind IN ('PROJECT','DRAFT')), scope_id uuid NOT NULL,
  project_id uuid REFERENCES anvil.projects(id) ON DELETE RESTRICT, draft_id uuid REFERENCES anvil.project_drafts(id) ON DELETE RESTRICT,
  actor_id uuid NOT NULL REFERENCES anvil.users(id) ON DELETE RESTRICT, client_id uuid NOT NULL,
  operation text NOT NULL CHECK(length(trim(operation))>0), command_id uuid NOT NULL,
  request_hash text NOT NULL CHECK(request_hash ~ '^[0-9a-f]{64}$'), operation_id uuid NOT NULL UNIQUE,
  state text NOT NULL CHECK(state IN ('PERSISTED','APPLIED','DELIVERY_PENDING','FAILED')),
  authorization_receipt_id uuid, approval_consumption_id uuid,
  expected_version bigint NOT NULL CHECK(expected_version>=0), control_generation bigint CHECK(control_generation>0),
  policy_ref jsonb, payload_ref jsonb, result_ref jsonb, received_at timestamptz NOT NULL DEFAULT now(), completed_at timestamptz,
  FOREIGN KEY(actor_id,client_id) REFERENCES anvil.clients(user_id,id) ON DELETE RESTRICT,
  UNIQUE(scope_kind,scope_id,actor_id,operation,command_id), UNIQUE(project_id,id), UNIQUE(draft_id,id), UNIQUE(scope_kind,scope_id,id),
  CHECK((scope_kind='PROJECT' AND project_id IS NOT NULL AND project_id=scope_id AND draft_id IS NULL AND control_generation IS NOT NULL)
     OR (scope_kind='DRAFT' AND draft_id IS NOT NULL AND draft_id=scope_id AND project_id IS NULL AND control_generation IS NULL))
);
CREATE TABLE anvil.approval_requests (
  id uuid PRIMARY KEY, project_id uuid NOT NULL REFERENCES anvil.projects(id) ON DELETE RESTRICT,
  version bigint NOT NULL CHECK(version>0), candidate_command_id uuid NOT NULL,
  action_scope_json jsonb NOT NULL CHECK(jsonb_typeof(action_scope_json)='object'),
  scope_digest text NOT NULL CHECK(scope_digest ~ '^[0-9a-f]{64}$'), details_json jsonb NOT NULL CHECK(jsonb_typeof(details_json)='object'),
  required_decider_ref jsonb NOT NULL, status text NOT NULL CHECK(status IN ('PENDING','APPROVED','REJECTED','CHANGE_REQUESTED','EXPIRED','REVOKED','CONSUMED')),
  expires_at timestamptz NOT NULL, created_by uuid NOT NULL REFERENCES anvil.users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(project_id,id)
);
CREATE INDEX approval_requests_current ON anvil.approval_requests(project_id,status,created_at,id);
CREATE TABLE anvil.approval_decisions (
  id uuid PRIMARY KEY, project_id uuid NOT NULL, request_id uuid NOT NULL UNIQUE, request_version bigint NOT NULL CHECK(request_version>0),
  scope_digest text NOT NULL CHECK(scope_digest ~ '^[0-9a-f]{64}$'), decision text NOT NULL CHECK(decision IN ('APPROVE','REJECT','REQUEST_CHANGE')),
  reason text NOT NULL CHECK(length(trim(reason))>0), decided_by uuid NOT NULL REFERENCES anvil.users(id) ON DELETE RESTRICT,
  client_id uuid NOT NULL, control_generation bigint NOT NULL CHECK(control_generation>0), decided_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY(project_id,request_id) REFERENCES anvil.approval_requests(project_id,id) ON DELETE RESTRICT,
  FOREIGN KEY(decided_by,client_id) REFERENCES anvil.clients(user_id,id) ON DELETE RESTRICT, UNIQUE(project_id,id)
);
CREATE TABLE anvil.approval_consumptions (
  id uuid PRIMARY KEY, project_id uuid NOT NULL, decision_id uuid NOT NULL UNIQUE, command_id uuid NOT NULL UNIQUE,
  scope_digest text NOT NULL CHECK(scope_digest ~ '^[0-9a-f]{64}$'), policy_id uuid NOT NULL, policy_version bigint NOT NULL,
  consumed_at timestamptz NOT NULL DEFAULT now(), UNIQUE(project_id,id),
  FOREIGN KEY(project_id,decision_id) REFERENCES anvil.approval_decisions(project_id,id) ON DELETE RESTRICT,
  FOREIGN KEY(project_id,command_id) REFERENCES anvil.commands(project_id,id) ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED,
  FOREIGN KEY(project_id,policy_id,policy_version) REFERENCES anvil.permission_policy_versions(project_id,policy_id,version) ON DELETE RESTRICT
);
CREATE TABLE anvil.authorization_receipts (
  id uuid PRIMARY KEY, scope_kind text NOT NULL CHECK(scope_kind IN ('PROJECT','DRAFT')), scope_id uuid NOT NULL,
  command_id uuid NOT NULL UNIQUE,
  subject_ref jsonb NOT NULL, policy_ref jsonb, scope_digest text NOT NULL CHECK(scope_digest ~ '^[0-9a-f]{64}$'),
  approval_decision_ref uuid REFERENCES anvil.approval_decisions(id) ON DELETE RESTRICT,
  authorized_at timestamptz NOT NULL DEFAULT now(), UNIQUE(scope_kind,scope_id,command_id,id),
  FOREIGN KEY(scope_kind,scope_id,command_id) REFERENCES anvil.commands(scope_kind,scope_id,id) ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED
);
ALTER TABLE anvil.commands ADD CONSTRAINT command_authorization_receipt FOREIGN KEY(scope_kind,scope_id,id,authorization_receipt_id)
  REFERENCES anvil.authorization_receipts(scope_kind,scope_id,command_id,id) ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE anvil.commands ADD CONSTRAINT command_approval_consumption FOREIGN KEY(project_id,approval_consumption_id)
  REFERENCES anvil.approval_consumptions(project_id,id) ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED;

CREATE TABLE anvil.audit_events (
  project_id uuid NOT NULL REFERENCES anvil.projects(id) ON DELETE RESTRICT,
  server_sequence bigint NOT NULL CHECK(server_sequence>0), event_id uuid NOT NULL UNIQUE,
  actor_ref jsonb NOT NULL, client_ref uuid REFERENCES anvil.clients(id) ON DELETE RESTRICT,
  command_id uuid, operation_id uuid, target_ref jsonb NOT NULL, policy_ref jsonb, approval_ref jsonb,
  outcome text NOT NULL, reason_code text NOT NULL, scope_digest text CHECK(scope_digest ~ '^[0-9a-f]{64}$'),
  recorded_at timestamptz NOT NULL DEFAULT now(), source_kind text NOT NULL, correction_of uuid,
  PRIMARY KEY(project_id,server_sequence), UNIQUE(project_id,event_id),
  FOREIGN KEY(project_id,command_id) REFERENCES anvil.commands(project_id,id) ON DELETE RESTRICT,
  FOREIGN KEY(project_id,correction_of) REFERENCES anvil.audit_events(project_id,event_id) ON DELETE RESTRICT
);
CREATE TABLE anvil.draft_audit_events (
  draft_id uuid NOT NULL REFERENCES anvil.project_drafts(id) ON DELETE RESTRICT,
  server_sequence bigint NOT NULL CHECK(server_sequence>0), event_id uuid NOT NULL UNIQUE,
  actor_ref jsonb NOT NULL, client_ref uuid NOT NULL REFERENCES anvil.clients(id) ON DELETE RESTRICT,
  command_id uuid, operation_id uuid, operation text NOT NULL, outcome text NOT NULL, reason_code text NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(draft_id,server_sequence),
  FOREIGN KEY(draft_id,command_id) REFERENCES anvil.commands(draft_id,id) ON DELETE RESTRICT
);
CREATE TABLE anvil.project_events (
  project_id uuid NOT NULL REFERENCES anvil.projects(id) ON DELETE RESTRICT,
  server_sequence bigint NOT NULL CHECK(server_sequence>0), event_id uuid NOT NULL UNIQUE,
  kind text NOT NULL, target_ref jsonb NOT NULL, command_id uuid, safe_payload_json jsonb NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(project_id,server_sequence),
  FOREIGN KEY(project_id,command_id) REFERENCES anvil.commands(project_id,id) ON DELETE RESTRICT
);
CREATE TABLE anvil.delivery_outbox (
  id uuid PRIMARY KEY, project_id uuid NOT NULL, command_id uuid NOT NULL, kind text NOT NULL,
  destination_ref jsonb NOT NULL, payload_ref jsonb NOT NULL, scope_digest text NOT NULL CHECK(scope_digest ~ '^[0-9a-f]{64}$'),
  state text NOT NULL, attempt_count integer NOT NULL DEFAULT 0 CHECK(attempt_count>=0), next_attempt_at timestamptz, last_error_code text,
  FOREIGN KEY(project_id,command_id) REFERENCES anvil.commands(project_id,id) ON DELETE RESTRICT,
  UNIQUE(command_id,kind,destination_ref)
);
REVOKE UPDATE,DELETE ON anvil.audit_events,anvil.draft_audit_events,anvil.permission_policy_versions,
  anvil.approval_decisions,anvil.approval_consumptions,anvil.authorization_receipts,anvil.project_events FROM anvil_v3_app;
REVOKE UPDATE ON anvil.approval_requests FROM anvil_v3_app;
REVOKE DELETE ON anvil.approval_requests FROM anvil_v3_app;
GRANT UPDATE(status,version) ON anvil.approval_requests TO anvil_v3_app;
