-- 직접 승인된 본인 공통 양식에 한정한다. 공식 원문/기준과 과거 버전의 DML은 열지 않는다.
CREATE FUNCTION anvil.guard_common_form_write() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE owner_id uuid;
BEGIN
  IF current_user <> 'anvil_v3_app' THEN RETURN NEW; END IF;
  IF TG_TABLE_NAME='form_definitions' THEN
    IF NEW.scope<>'USER_COMMON' OR NEW.owner_user_id::text IS DISTINCT FROM current_setting('anvil.actor_id',true)
      OR (TG_OP='UPDATE' AND (OLD.scope<>'USER_COMMON' OR OLD.owner_user_id IS DISTINCT FROM NEW.owner_user_id)) THEN
      RAISE EXCEPTION 'COMMON_OWNER_REQUIRED' USING ERRCODE='42501';
    END IF;
  ELSE
    SELECT owner_user_id INTO owner_id FROM anvil.form_definitions WHERE id=NEW.definition_id AND scope='USER_COMMON';
    IF owner_id IS NULL OR owner_id::text IS DISTINCT FROM current_setting('anvil.actor_id',true) OR NEW.created_by IS DISTINCT FROM owner_id
      OR NEW.definition_json->>'scope' IS DISTINCT FROM 'USER_COMMON' THEN
      RAISE EXCEPTION 'COMMON_OWNER_REQUIRED' USING ERRCODE='42501';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER common_form_definition_guard BEFORE INSERT OR UPDATE ON anvil.form_definitions FOR EACH ROW EXECUTE FUNCTION anvil.guard_common_form_write();
CREATE TRIGGER common_form_version_guard BEFORE INSERT ON anvil.form_versions FOR EACH ROW EXECUTE FUNCTION anvil.guard_common_form_write();
GRANT INSERT ON anvil.form_definitions,anvil.form_versions TO anvil_v3_app;
GRANT UPDATE(head_version,name,form_code) ON anvil.form_definitions TO anvil_v3_app;
