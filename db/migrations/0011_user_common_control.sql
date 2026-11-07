-- 직접 승인한 본인 공통 범위만 확장한다. 기존 적용 SQL/PROJECT/DRAFT 의미는 보존한다.
ALTER TABLE anvil.commands DROP CONSTRAINT commands_scope_kind_check;
ALTER TABLE anvil.commands ADD CONSTRAINT commands_scope_kind_check CHECK(scope_kind IN ('PROJECT','DRAFT','USER_COMMON'));
ALTER TABLE anvil.commands DROP CONSTRAINT commands_check;
ALTER TABLE anvil.commands ADD CONSTRAINT commands_check CHECK(
  (scope_kind='PROJECT' AND project_id IS NOT NULL AND project_id=scope_id AND draft_id IS NULL AND control_generation IS NOT NULL)
  OR (scope_kind='DRAFT' AND draft_id IS NOT NULL AND draft_id=scope_id AND project_id IS NULL AND control_generation IS NULL)
  OR (scope_kind='USER_COMMON' AND scope_id=actor_id AND project_id IS NULL AND draft_id IS NULL AND control_generation IS NULL
      AND approval_consumption_id IS NULL AND policy_ref IS NULL));
CREATE UNIQUE INDEX user_common_command_once ON anvil.commands(actor_id,command_id) WHERE scope_kind='USER_COMMON';
ALTER TABLE anvil.authorization_receipts DROP CONSTRAINT authorization_receipts_scope_kind_check;
ALTER TABLE anvil.authorization_receipts ADD CONSTRAINT authorization_receipts_scope_kind_check CHECK(scope_kind IN ('PROJECT','DRAFT','USER_COMMON'));
ALTER TABLE anvil.authorization_receipts ADD CONSTRAINT user_common_receipt_boundary CHECK(scope_kind<>'USER_COMMON' OR (policy_ref IS NULL AND approval_decision_ref IS NULL));
CREATE TABLE anvil.user_common_audit_events (
  owner_user_id uuid NOT NULL REFERENCES anvil.users(id) ON DELETE RESTRICT,
  scope_kind text NOT NULL DEFAULT 'USER_COMMON' CHECK(scope_kind='USER_COMMON'),
  server_sequence bigint NOT NULL CHECK(server_sequence>0), event_id uuid NOT NULL UNIQUE,
  client_id uuid NOT NULL, command_id uuid NOT NULL UNIQUE, operation_id uuid NOT NULL,
  operation text NOT NULL, target_ref jsonb NOT NULL, outcome text NOT NULL, reason_code text NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(owner_user_id,server_sequence),
  FOREIGN KEY(owner_user_id,client_id) REFERENCES anvil.clients(user_id,id) ON DELETE RESTRICT,
  FOREIGN KEY(scope_kind,owner_user_id,command_id) REFERENCES anvil.commands(scope_kind,scope_id,id) ON DELETE RESTRICT
);
REVOKE UPDATE,DELETE ON anvil.user_common_audit_events FROM anvil_v3_app;

-- SQL 쓰기 권한도 사용자 공통본에 한정한다. SYSTEM·PROJECT 및 이전 버전은 개정하지 않는다.
CREATE FUNCTION anvil.guard_common_methodology_write() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE owner_id uuid;
BEGIN
  IF current_user <> 'anvil_v3_app' THEN RETURN NEW; END IF;
  IF TG_TABLE_NAME='methodology_definitions' THEN
    IF NEW.scope<>'USER_COMMON' OR NEW.owner_user_id::text IS DISTINCT FROM current_setting('anvil.actor_id',true)
      OR (TG_OP='UPDATE' AND (OLD.scope<>'USER_COMMON' OR OLD.owner_user_id IS DISTINCT FROM NEW.owner_user_id)) THEN
      RAISE EXCEPTION 'COMMON_OWNER_REQUIRED' USING ERRCODE='42501';
    END IF;
  ELSE
    SELECT owner_user_id INTO owner_id FROM anvil.methodology_definitions WHERE id=NEW.definition_id AND scope='USER_COMMON';
    IF owner_id IS NULL OR owner_id::text IS DISTINCT FROM current_setting('anvil.actor_id',true) OR NEW.created_by IS DISTINCT FROM owner_id THEN
      RAISE EXCEPTION 'COMMON_OWNER_REQUIRED' USING ERRCODE='42501';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER common_methodology_definition_guard BEFORE INSERT OR UPDATE ON anvil.methodology_definitions
  FOR EACH ROW EXECUTE FUNCTION anvil.guard_common_methodology_write();
CREATE TRIGGER common_methodology_version_guard BEFORE INSERT ON anvil.methodology_versions
  FOR EACH ROW EXECUTE FUNCTION anvil.guard_common_methodology_write();
GRANT INSERT ON anvil.methodology_definitions,anvil.methodology_versions TO anvil_v3_app;
GRANT UPDATE(head_version) ON anvil.methodology_definitions TO anvil_v3_app;
