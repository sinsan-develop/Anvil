CREATE TABLE anvil.draft_methodology_reviews (
  id uuid PRIMARY KEY, draft_id uuid NOT NULL REFERENCES anvil.project_drafts(id) ON DELETE RESTRICT,
  version bigint NOT NULL CHECK(version>0), graph_hash text NOT NULL CHECK(graph_hash ~ '^[0-9a-f]{64}$'),
  graph_json jsonb NOT NULL CHECK(jsonb_typeof(graph_json)='object'), review_refs jsonb NOT NULL CHECK(jsonb_typeof(review_refs)='array'),
  validation_json jsonb NOT NULL, decided_by uuid NOT NULL, client_id uuid NOT NULL,
  command_id uuid NOT NULL UNIQUE REFERENCES anvil.commands(id) ON DELETE RESTRICT, decided_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY(decided_by,client_id) REFERENCES anvil.clients(user_id,id) ON DELETE RESTRICT,
  UNIQUE(draft_id,version,graph_hash,id)
);
-- 공통본 guard의 USER_COMMON 동작은 변경하지 않고 별도 DRAFT 분기를 명시한다.
DROP TRIGGER common_content_review_guard ON anvil.content_reviews;
CREATE TRIGGER common_content_review_guard BEFORE INSERT ON anvil.content_reviews
  FOR EACH ROW WHEN (NEW.scope_kind='USER_COMMON') EXECUTE FUNCTION anvil.guard_common_form_review();
CREATE FUNCTION anvil.guard_draft_method_review() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE bound_draft uuid; target_version bigint; target_hash text; reviewer uuid; cmd_id uuid; expected_operation text;
BEGIN
  IF current_user<>'anvil_v3_app' THEN RETURN NEW; END IF;
  IF TG_TABLE_NAME='content_reviews' THEN
    IF NEW.scope_kind<>'DRAFT' OR NEW.target_kind<>'DRAFT_METHODOLOGY' OR NEW.source_kind<>'HUMAN_REVIEW'
      OR NEW.target_id IS DISTINCT FROM NEW.draft_id THEN RAISE EXCEPTION 'DRAFT_REVIEW_REQUIRED' USING ERRCODE='42501'; END IF;
    bound_draft=NEW.draft_id; target_version=NEW.target_version; target_hash=NEW.target_hash;
    reviewer=NEW.reviewer_user_id; cmd_id=NEW.command_id; expected_operation='recordContentReview';
  ELSE
    bound_draft=NEW.draft_id; target_version=NEW.version; target_hash=NEW.graph_hash;
    reviewer=NEW.decided_by; cmd_id=NEW.command_id; expected_operation='confirmDraftMethodology';
    IF NOT EXISTS(SELECT 1 FROM anvil.project_drafts d WHERE d.id=bound_draft AND d.input_json->'methodologySelection'->'graph'=NEW.graph_json) THEN
      RAISE EXCEPTION 'DRAFT_GRAPH_MISMATCH' USING ERRCODE='42501';
    END IF;
  END IF;
  IF reviewer::text IS DISTINCT FROM current_setting('anvil.actor_id',true)
    OR NOT EXISTS(SELECT 1 FROM anvil.project_drafts d JOIN anvil.commands c ON c.draft_id=d.id
      JOIN anvil.authorization_receipts r ON r.command_id=c.id AND r.id=c.authorization_receipt_id AND r.scope_kind='DRAFT' AND r.scope_id=d.id
      WHERE d.id=bound_draft AND d.owner_user_id=reviewer AND d.client_id=NEW.client_id AND d.version=target_version AND d.consumed_project_id IS NULL
        AND d.input_json->'methodologySelection'->>'kind'='NEW_PROJECT_DRAFT'
        AND c.id=cmd_id AND c.actor_id=reviewer AND c.client_id=NEW.client_id AND c.state='APPLIED' AND c.operation=expected_operation AND c.expected_version=target_version
        AND c.result_ref->'data'->'ref'=jsonb_build_object('id',bound_draft,'version',target_version,'contentHash',target_hash)) THEN
    RAISE EXCEPTION 'DRAFT_REVIEW_OWNER_REQUIRED' USING ERRCODE='42501';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER draft_content_review_guard BEFORE INSERT ON anvil.content_reviews
  FOR EACH ROW WHEN (NEW.scope_kind<>'USER_COMMON') EXECUTE FUNCTION anvil.guard_draft_method_review();
CREATE TRIGGER draft_method_confirmation_guard BEFORE INSERT ON anvil.draft_methodology_reviews
  FOR EACH ROW EXECUTE FUNCTION anvil.guard_draft_method_review();
REVOKE UPDATE,DELETE ON anvil.draft_methodology_reviews FROM anvil_v3_app;

-- 본인 공통본과 첫 프로젝트 생성의 별도 쓰기 경계. 프로젝트 개정/자동 실행은 열지 않는다.
CREATE OR REPLACE FUNCTION anvil.guard_common_methodology_write() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE owner_id uuid; project_scope uuid;
BEGIN
  IF current_user<>'anvil_v3_app' THEN RETURN NEW; END IF;
  IF TG_TABLE_NAME='methodology_definitions' THEN
    IF NEW.scope='PROJECT' AND TG_OP='INSERT' THEN project_scope=NEW.project_id;
    ELSIF NEW.scope<>'USER_COMMON' OR NEW.owner_user_id::text IS DISTINCT FROM current_setting('anvil.actor_id',true)
      OR (TG_OP='UPDATE' AND (OLD.scope<>'USER_COMMON' OR OLD.owner_user_id IS DISTINCT FROM NEW.owner_user_id)) THEN
      RAISE EXCEPTION 'COMMON_OWNER_REQUIRED' USING ERRCODE='42501';
    END IF;
  ELSE
    SELECT owner_user_id,project_id INTO owner_id,project_scope FROM anvil.methodology_definitions WHERE id=NEW.definition_id AND scope IN ('USER_COMMON','PROJECT');
    IF project_scope IS NULL AND (owner_id IS NULL OR owner_id::text IS DISTINCT FROM current_setting('anvil.actor_id',true) OR NEW.created_by IS DISTINCT FROM owner_id) THEN
      RAISE EXCEPTION 'COMMON_OWNER_REQUIRED' USING ERRCODE='42501';
    END IF;
    IF project_scope IS NOT NULL AND (NEW.version<>1 OR NEW.created_by::text IS DISTINCT FROM current_setting('anvil.actor_id',true)) THEN
      RAISE EXCEPTION 'INITIAL_PROJECT_CREATION_REQUIRED' USING ERRCODE='42501';
    END IF;
  END IF;
  IF project_scope IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM anvil.project_drafts d
    JOIN anvil.project_members m ON m.project_id=project_scope AND m.user_id=d.owner_user_id
    JOIN anvil.project_control pc ON pc.project_id=m.project_id AND pc.actor_id=m.user_id AND pc.client_id=d.client_id
    JOIN anvil.commands c ON c.project_id=project_scope AND c.actor_id=m.user_id AND c.client_id=d.client_id
    JOIN anvil.authorization_receipts r ON r.command_id=c.id AND r.id=c.authorization_receipt_id AND r.scope_kind='PROJECT' AND r.scope_id=project_scope
    WHERE d.id::text=current_setting('anvil.creation_draft_id',true) AND d.consumed_project_id IS NULL
      AND d.owner_user_id::text=current_setting('anvil.actor_id',true) AND m.participation='OWNER' AND m.revoked_at IS NULL
      AND pc.generation=1 AND pc.revoked_at IS NULL AND c.operation='createProject' AND c.state='APPLIED' AND c.control_generation=1
  ) THEN RAISE EXCEPTION 'INITIAL_PROJECT_CREATION_REQUIRED' USING ERRCODE='42501'; END IF;
  RETURN NEW;
END;
$$;
