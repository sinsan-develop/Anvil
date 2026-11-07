-- 현재 프로젝트의 명시 정책 개정만 열고 과거 SQL·정책 버전/감사는 보존한다.
ALTER TABLE anvil.permission_policy_versions ADD COLUMN client_id uuid;
ALTER TABLE anvil.permission_policy_versions ADD COLUMN command_id uuid UNIQUE REFERENCES anvil.commands(id) ON DELETE RESTRICT;
ALTER TABLE anvil.permission_policy_versions ADD CONSTRAINT policy_version_client_fk
  FOREIGN KEY(created_by,client_id) REFERENCES anvil.clients(user_id,id) ON DELETE RESTRICT;
CREATE UNIQUE INDEX project_command_once ON anvil.commands(project_id,actor_id,command_id) WHERE scope_kind='PROJECT';
CREATE FUNCTION anvil.guard_project_policy_write() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE policy_id uuid; target_version bigint; cmd_id text;
BEGIN
  IF current_user<>'anvil_v3_app' THEN RETURN NEW; END IF;
  cmd_id=current_setting('anvil.command_id',true);
  IF TG_TABLE_NAME='permission_policies' THEN policy_id=NEW.id; target_version=NEW.head_version;
  ELSE policy_id=NEW.policy_id; target_version=NEW.version;
    IF NEW.command_id::text IS DISTINCT FROM cmd_id OR NEW.client_id::text IS DISTINCT FROM current_setting('anvil.client_id',true) THEN
      RAISE EXCEPTION 'POLICY_COMMAND_REQUIRED' USING ERRCODE='42501';
    END IF;
    IF NOT EXISTS(SELECT 1 FROM anvil.commands c WHERE c.id=NEW.command_id AND c.result_ref->'data'->'ref'->>'contentHash'=NEW.content_hash) THEN
      RAISE EXCEPTION 'POLICY_CONTENT_HASH_MISMATCH' USING ERRCODE='42501';
    END IF;
  END IF;
  IF NEW.created_by::text IS DISTINCT FROM current_setting('anvil.actor_id',true)
    OR NOT EXISTS(SELECT 1 FROM anvil.project_control pc
      JOIN anvil.project_members m ON m.project_id=pc.project_id AND m.user_id=pc.actor_id
      JOIN anvil.commands c ON c.project_id=pc.project_id AND c.actor_id=pc.actor_id AND c.client_id=pc.client_id
      JOIN anvil.authorization_receipts r ON r.id=c.authorization_receipt_id AND r.command_id=c.id AND r.scope_kind='PROJECT' AND r.scope_id=pc.project_id
      WHERE pc.project_id=NEW.project_id AND pc.actor_id=NEW.created_by AND pc.revoked_at IS NULL AND m.revoked_at IS NULL AND m.participation='OWNER'
        AND pc.client_id::text=current_setting('anvil.client_id',true) AND c.control_generation=pc.generation
        AND c.id::text=cmd_id AND c.operation='savePermissionPolicy' AND c.state='APPLIED' AND c.expected_version=target_version-1
        AND c.result_ref->'data'->'ref'->>'id'=policy_id::text AND (c.result_ref->'data'->'ref'->>'version')::bigint=target_version) THEN
    RAISE EXCEPTION 'POLICY_CURRENT_OWNER_REQUIRED' USING ERRCODE='42501';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER project_policy_guard BEFORE INSERT OR UPDATE ON anvil.permission_policies
  FOR EACH ROW EXECUTE FUNCTION anvil.guard_project_policy_write();
CREATE TRIGGER project_policy_version_guard BEFORE INSERT ON anvil.permission_policy_versions
  FOR EACH ROW EXECUTE FUNCTION anvil.guard_project_policy_write();
REVOKE UPDATE,DELETE ON anvil.permission_policies FROM anvil_v3_app;
GRANT UPDATE(head_version) ON anvil.permission_policies TO anvil_v3_app;
REVOKE UPDATE,DELETE ON anvil.permission_policy_versions FROM anvil_v3_app;
