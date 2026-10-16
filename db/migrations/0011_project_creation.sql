-- 최초 프로젝트 생성에서만 적용 snapshot INSERT를 연다. 기존 SQL/공통본 권한은 불변이다.
CREATE FUNCTION anvil.guard_initial_project_methodology() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF current_user<>'anvil_v3_app' THEN RETURN NEW; END IF;
  IF NEW.application_version<>1 OR NEW.created_by::text IS DISTINCT FROM current_setting('anvil.actor_id',true)
    OR NOT EXISTS (
      SELECT 1 FROM anvil.project_drafts d
      JOIN anvil.project_members m ON m.project_id=NEW.project_id AND m.user_id=d.owner_user_id
      JOIN anvil.project_control pc ON pc.project_id=m.project_id AND pc.actor_id=m.user_id AND pc.client_id=d.client_id
      JOIN anvil.commands c ON c.project_id=NEW.project_id AND c.actor_id=m.user_id AND c.client_id=d.client_id
      JOIN anvil.authorization_receipts r ON r.command_id=c.id AND r.id=c.authorization_receipt_id AND r.scope_kind='PROJECT' AND r.scope_id=NEW.project_id
      WHERE d.id::text=current_setting('anvil.creation_draft_id',true) AND d.consumed_project_id IS NULL
        AND d.owner_user_id=NEW.created_by AND m.participation='OWNER' AND m.revoked_at IS NULL
        AND pc.generation=1 AND pc.revoked_at IS NULL AND c.operation='createProject' AND c.state='APPLIED' AND c.control_generation=1
    ) THEN RAISE EXCEPTION 'INITIAL_PROJECT_CREATION_REQUIRED' USING ERRCODE='42501';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER initial_project_methodology_guard BEFORE INSERT ON anvil.project_methodologies
  FOR EACH ROW EXECUTE FUNCTION anvil.guard_initial_project_methodology();
GRANT INSERT ON anvil.project_methodologies TO anvil_v3_app;
REVOKE UPDATE,DELETE ON anvil.project_methodologies FROM anvil_v3_app;
