CREATE TABLE anvil.content_reviews (
  id uuid PRIMARY KEY, scope_kind text NOT NULL CHECK(scope_kind IN ('PROJECT','DRAFT','USER_COMMON')), scope_id uuid NOT NULL,
  owner_user_id uuid REFERENCES anvil.users(id) ON DELETE RESTRICT,
  project_id uuid REFERENCES anvil.projects(id) ON DELETE RESTRICT, draft_id uuid REFERENCES anvil.project_drafts(id) ON DELETE RESTRICT,
  target_kind text NOT NULL CHECK(target_kind IN ('METHODOLOGY','FORM','DOCUMENT','WORK_PLAN','KNOWLEDGE','IMPACT','DRAFT_METHODOLOGY')), target_id uuid NOT NULL, target_version bigint NOT NULL CHECK(target_version>0),
  target_hash text NOT NULL CHECK(target_hash ~ '^[0-9a-f]{64}$'), criteria_version bigint NOT NULL CHECK(criteria_version>0),
  criteria_snapshot_json jsonb NOT NULL CHECK(jsonb_typeof(criteria_snapshot_json)='object'), items_json jsonb NOT NULL CHECK(jsonb_typeof(items_json)='array'),
  outcome text NOT NULL CHECK(outcome IN ('ACCEPTED','REWORK','BLOCKED','NOT_EXECUTED')),
  reviewer_user_id uuid NOT NULL, client_id uuid NOT NULL, reviewer_subject_ref jsonb NOT NULL CHECK(jsonb_typeof(reviewer_subject_ref)='object'),
  source_kind text NOT NULL CHECK(source_kind IN ('HUMAN_REVIEW','ASSIGNED_AGENT_REVIEW')),
  reason text NOT NULL CHECK(length(trim(reason))>0), command_id uuid NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY(reviewer_user_id,client_id) REFERENCES anvil.clients(user_id,id) ON DELETE RESTRICT,
  FOREIGN KEY(scope_kind,scope_id,command_id) REFERENCES anvil.commands(scope_kind,scope_id,id) ON DELETE RESTRICT,
  CHECK((scope_kind='USER_COMMON' AND owner_user_id IS NOT NULL AND owner_user_id=scope_id AND project_id IS NULL AND draft_id IS NULL)
    OR (scope_kind='PROJECT' AND project_id IS NOT NULL AND project_id=scope_id AND owner_user_id IS NULL AND draft_id IS NULL)
    OR (scope_kind='DRAFT' AND draft_id IS NOT NULL AND draft_id=scope_id AND owner_user_id IS NULL AND project_id IS NULL))
);
CREATE INDEX content_review_target ON anvil.content_reviews(scope_kind,scope_id,target_kind,target_id,target_version,created_at,id);
CREATE TABLE anvil.form_reviews (
  id uuid PRIMARY KEY, definition_id uuid NOT NULL, version bigint NOT NULL, target_hash text NOT NULL,
  validation_json jsonb NOT NULL, review_refs jsonb NOT NULL CHECK(jsonb_typeof(review_refs)='array'),
  decision text NOT NULL CHECK(decision='CONFIRMED'), decided_by uuid NOT NULL, client_id uuid NOT NULL,
  command_id uuid NOT NULL UNIQUE REFERENCES anvil.commands(id) ON DELETE RESTRICT,
  decided_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY(definition_id,version,target_hash) REFERENCES anvil.form_versions(definition_id,version,content_hash) ON DELETE RESTRICT,
  FOREIGN KEY(decided_by,client_id) REFERENCES anvil.clients(user_id,id) ON DELETE RESTRICT
);
CREATE FUNCTION anvil.guard_common_form_review() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE owner_id uuid; form_id uuid; form_version bigint; form_hash text; review_actor_id uuid; cmd_id uuid; expected_operation text;
BEGIN
  IF current_user<>'anvil_v3_app' THEN RETURN NEW; END IF;
  IF TG_TABLE_NAME='content_reviews' THEN
    IF NEW.scope_kind<>'USER_COMMON' OR NEW.target_kind<>'FORM' OR NEW.source_kind<>'HUMAN_REVIEW' THEN
      RAISE EXCEPTION 'REVIEW_SCOPE_NOT_READY' USING ERRCODE='42501';
    END IF;
    form_id=NEW.target_id; form_version=NEW.target_version; form_hash=NEW.target_hash; review_actor_id=NEW.reviewer_user_id; cmd_id=NEW.command_id; expected_operation='recordContentReview';
  ELSE
    form_id=NEW.definition_id; form_version=NEW.version; form_hash=NEW.target_hash; review_actor_id=NEW.decided_by; cmd_id=NEW.command_id; expected_operation='confirmForm';
  END IF;
  SELECT d.owner_user_id INTO owner_id FROM anvil.form_definitions d JOIN anvil.form_versions v ON v.definition_id=d.id
    WHERE d.id=form_id AND d.scope='USER_COMMON' AND v.version=form_version AND v.content_hash=form_hash;
  IF owner_id IS NULL OR owner_id IS DISTINCT FROM review_actor_id OR owner_id::text IS DISTINCT FROM current_setting('anvil.actor_id',true)
    OR NOT EXISTS(SELECT 1 FROM anvil.commands c WHERE c.id=cmd_id AND c.scope_kind='USER_COMMON' AND c.scope_id=owner_id AND c.actor_id=review_actor_id AND c.client_id=NEW.client_id AND c.operation=expected_operation) THEN
    RAISE EXCEPTION 'COMMON_REVIEW_OWNER_REQUIRED' USING ERRCODE='42501';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER common_content_review_guard BEFORE INSERT ON anvil.content_reviews FOR EACH ROW EXECUTE FUNCTION anvil.guard_common_form_review();
CREATE TRIGGER common_form_review_guard BEFORE INSERT ON anvil.form_reviews FOR EACH ROW EXECUTE FUNCTION anvil.guard_common_form_review();
REVOKE UPDATE,DELETE ON anvil.content_reviews,anvil.form_reviews FROM anvil_v3_app;
