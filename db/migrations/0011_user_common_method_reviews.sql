-- 기존 적용 SQL을 바꾸지 않고 본인 공통 방법론의 검토/확정만 추가한다.
ALTER TABLE anvil.methodology_reviews ADD COLUMN client_id uuid;
ALTER TABLE anvil.methodology_reviews ADD COLUMN command_id uuid UNIQUE REFERENCES anvil.commands(id) ON DELETE RESTRICT;
ALTER TABLE anvil.methodology_reviews ADD CONSTRAINT method_review_client_fk
  FOREIGN KEY(decided_by,client_id) REFERENCES anvil.clients(user_id,id) ON DELETE RESTRICT;
CREATE OR REPLACE FUNCTION anvil.guard_common_form_review() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE owner_id uuid; target_id uuid; target_version bigint; target_hash text; review_actor_id uuid; cmd_id uuid; expected_operation text; target_kind text;
BEGIN
  IF current_user<>'anvil_v3_app' THEN RETURN NEW; END IF;
  IF TG_TABLE_NAME='content_reviews' THEN
    IF NEW.scope_kind<>'USER_COMMON' OR NEW.target_kind NOT IN ('FORM','METHODOLOGY') OR NEW.source_kind<>'HUMAN_REVIEW' THEN
      RAISE EXCEPTION 'REVIEW_SCOPE_NOT_READY' USING ERRCODE='42501';
    END IF;
    target_id=NEW.target_id; target_version=NEW.target_version; target_hash=NEW.target_hash; target_kind=NEW.target_kind;
    review_actor_id=NEW.reviewer_user_id; cmd_id=NEW.command_id; expected_operation='recordContentReview';
    IF NEW.owner_user_id IS DISTINCT FROM review_actor_id OR NEW.scope_id IS DISTINCT FROM review_actor_id THEN
      RAISE EXCEPTION 'COMMON_REVIEW_OWNER_REQUIRED' USING ERRCODE='42501';
    END IF;
  ELSE
    target_id=NEW.definition_id; target_version=NEW.version; target_hash=NEW.target_hash;
    review_actor_id=NEW.decided_by; cmd_id=NEW.command_id;
    IF TG_TABLE_NAME='form_reviews' THEN target_kind='FORM'; expected_operation='confirmForm';
    ELSE target_kind='METHODOLOGY'; expected_operation='confirmMethodology'; END IF;
    IF NEW.decision<>'CONFIRMED' THEN RAISE EXCEPTION 'COMMON_CONFIRMATION_REQUIRED' USING ERRCODE='42501'; END IF;
  END IF;
  IF target_kind='FORM' THEN
    SELECT d.owner_user_id INTO owner_id FROM anvil.form_definitions d JOIN anvil.form_versions v ON v.definition_id=d.id
      WHERE d.id=target_id AND d.scope='USER_COMMON' AND v.version=target_version AND v.content_hash=target_hash;
  ELSE
    SELECT d.owner_user_id INTO owner_id FROM anvil.methodology_definitions d JOIN anvil.methodology_versions v ON v.definition_id=d.id
      WHERE d.id=target_id AND d.scope='USER_COMMON' AND v.version=target_version AND v.content_hash=target_hash;
  END IF;
  IF owner_id IS NULL OR owner_id IS DISTINCT FROM review_actor_id OR owner_id::text IS DISTINCT FROM current_setting('anvil.actor_id',true)
    OR NOT EXISTS(SELECT 1 FROM anvil.commands c WHERE c.id=cmd_id AND c.scope_kind='USER_COMMON' AND c.scope_id=owner_id AND c.actor_id=review_actor_id AND c.client_id=NEW.client_id AND c.operation=expected_operation AND c.state='APPLIED' AND c.expected_version=target_version
      AND c.result_ref->'data'->'ref'=jsonb_build_object('id',target_id,'version',target_version,'contentHash',target_hash)) THEN
    RAISE EXCEPTION 'COMMON_REVIEW_OWNER_REQUIRED' USING ERRCODE='42501';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER common_method_review_guard BEFORE INSERT ON anvil.methodology_reviews FOR EACH ROW EXECUTE FUNCTION anvil.guard_common_form_review();
GRANT INSERT ON anvil.methodology_reviews TO anvil_v3_app;
REVOKE UPDATE,DELETE ON anvil.methodology_reviews FROM anvil_v3_app;
