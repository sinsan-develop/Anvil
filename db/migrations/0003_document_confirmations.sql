-- 기존 SQL을 바꾸지 않고 별도 확정 기록과 head/pointer 권한을 추가한다.
CREATE TABLE anvil.document_confirmations (
  id uuid PRIMARY KEY, project_id uuid NOT NULL, document_id uuid NOT NULL, version bigint NOT NULL,
  target_hash text NOT NULL, form_ref jsonb NOT NULL, review_refs jsonb NOT NULL, validation_json jsonb NOT NULL,
  confirmed_by uuid NOT NULL REFERENCES anvil.users(id), client_id uuid NOT NULL REFERENCES anvil.clients(id),
  command_id uuid NOT NULL UNIQUE REFERENCES anvil.commands(id), created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY(project_id,document_id,version,target_hash) REFERENCES anvil.document_versions(project_id,document_id,version,content_hash)
);
GRANT SELECT,INSERT ON anvil.document_confirmations TO anvil_v3_app;
REVOKE UPDATE,DELETE ON anvil.document_confirmations FROM anvil_v3_app;
GRANT UPDATE(confirmed_version) ON anvil.documents TO anvil_v3_app;

CREATE FUNCTION anvil.document_command_authorized(pid uuid,did uuid,v bigint,op text) RETURNS boolean LANGUAGE sql STABLE AS $$
  SELECT EXISTS(SELECT 1 FROM anvil.commands c
    JOIN anvil.authorization_receipts r ON r.id=c.authorization_receipt_id AND r.command_id=c.id AND r.policy_ref=c.policy_ref
    JOIN anvil.project_control pc ON pc.project_id=c.project_id AND pc.actor_id=c.actor_id AND pc.client_id=c.client_id AND pc.generation=c.control_generation AND pc.revoked_at IS NULL
    JOIN anvil.project_members m ON m.project_id=c.project_id AND m.user_id=c.actor_id AND m.participation='OWNER' AND m.revoked_at IS NULL
    JOIN anvil.permission_policies p ON p.project_id=c.project_id AND p.id::text=c.policy_ref->>'id' AND p.head_version=(c.policy_ref->>'version')::bigint
    WHERE c.id::text=current_setting('anvil.command_id',true) AND c.project_id=pid
      AND c.actor_id::text=current_setting('anvil.actor_id',true) AND c.client_id::text=current_setting('anvil.client_id',true)
      AND c.state='APPLIED' AND c.operation=op AND c.expected_version=CASE WHEN op='saveDocumentDraft' THEN v-1 ELSE v END
      AND c.result_ref->'data'->'ref'->>'id'=did::text AND (c.result_ref->'data'->'ref'->>'version')::bigint=v);
$$;
CREATE FUNCTION anvil.guard_document_confirmation() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE latest_review uuid;
BEGIN
  IF current_user<>'anvil_v3_app' THEN RETURN NEW; END IF;
  SELECT r.id INTO latest_review FROM anvil.content_reviews r
    JOIN anvil.audit_events a ON a.command_id=r.command_id AND a.project_id=r.project_id
    WHERE r.scope_kind='PROJECT' AND r.project_id=NEW.project_id AND r.target_kind='DOCUMENT' AND r.target_id=NEW.document_id
      AND r.target_version=NEW.version AND r.target_hash=NEW.target_hash AND r.criteria_version=1 AND r.source_kind='HUMAN_REVIEW'
    ORDER BY a.server_sequence DESC LIMIT 1;
  IF NOT anvil.document_command_authorized(NEW.project_id,NEW.document_id,NEW.version,'confirmDocument')
    OR NEW.command_id::text IS DISTINCT FROM current_setting('anvil.command_id',true)
    OR NEW.confirmed_by::text IS DISTINCT FROM current_setting('anvil.actor_id',true)
    OR NEW.client_id::text IS DISTINCT FROM current_setting('anvil.client_id',true)
    OR NEW.validation_json->>'validForConfirmation' IS DISTINCT FROM 'true'
    OR jsonb_typeof(NEW.review_refs) IS DISTINCT FROM 'array' OR jsonb_array_length(NEW.review_refs)=0
    OR latest_review IS NULL OR NOT EXISTS(SELECT 1 FROM anvil.content_reviews r WHERE r.id=latest_review AND r.outcome='ACCEPTED'
      AND NEW.review_refs @> jsonb_build_array(jsonb_build_object('id',r.id,'criteriaVersion',1,'outcome','ACCEPTED','targetRef',jsonb_build_object('id',NEW.document_id,'version',NEW.version,'contentHash',NEW.target_hash))))
    OR NOT EXISTS(SELECT 1 FROM anvil.commands c JOIN anvil.documents d ON d.project_id=c.project_id AND d.id=NEW.document_id AND d.head_version=NEW.version
      JOIN anvil.document_versions v ON v.project_id=d.project_id AND v.document_id=d.id AND v.version=NEW.version AND v.content_hash=NEW.target_hash
      WHERE c.id=NEW.command_id AND c.result_ref->'data'->>'status'='CONFIRMED' AND c.result_ref->'data'->>'confirmationId'=NEW.id::text
        AND c.result_ref->'data'->'ref'->>'contentHash'=NEW.target_hash
        AND NEW.form_ref=jsonb_build_object('id',v.form_definition_id,'version',v.form_version,'contentHash',v.form_hash)) THEN
    RAISE EXCEPTION 'DOCUMENT_CONFIRMATION_AUTHORIZATION_REQUIRED' USING ERRCODE='42501';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER document_confirmation_guard BEFORE INSERT ON anvil.document_confirmations FOR EACH ROW EXECUTE FUNCTION anvil.guard_document_confirmation();

-- 기존 version/link/draft-event guard는 유지하고 head/pointer만 구분해 검사한다.
CREATE FUNCTION anvil.guard_document_head() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE op text;
BEGIN
  IF current_user<>'anvil_v3_app' THEN RETURN NEW; END IF;
  SELECT operation INTO op FROM anvil.commands WHERE id::text=current_setting('anvil.command_id',true);
  IF op='saveDocumentDraft' AND anvil.document_command_authorized(NEW.project_id,NEW.id,NEW.head_version,op) THEN
    IF TG_OP='INSERT' THEN
      IF NEW.confirmed_version IS NOT NULL OR NEW.created_by::text IS DISTINCT FROM current_setting('anvil.actor_id',true) OR NEW.head_version<>1 THEN RAISE EXCEPTION 'DOCUMENT_DRAFT_ONLY' USING ERRCODE='42501'; END IF;
    ELSIF NEW.confirmed_version IS DISTINCT FROM OLD.confirmed_version OR NEW.head_version<>OLD.head_version+1 THEN
      RAISE EXCEPTION 'DOCUMENT_CONFIRMED_VERSION_PRESERVE' USING ERRCODE='42501';
    END IF;
  ELSIF TG_OP='UPDATE' AND op='confirmDocument' AND anvil.document_command_authorized(NEW.project_id,NEW.id,NEW.head_version,op)
    AND NEW.confirmed_version=NEW.head_version AND (to_jsonb(NEW)-ARRAY['confirmed_version','updated_at'])=(to_jsonb(OLD)-ARRAY['confirmed_version','updated_at'])
    AND EXISTS(SELECT 1 FROM anvil.document_confirmations r WHERE r.project_id=NEW.project_id AND r.document_id=NEW.id AND r.version=NEW.head_version AND r.command_id::text=current_setting('anvil.command_id',true)) THEN
    RETURN NEW;
  ELSE RAISE EXCEPTION 'DOCUMENT_CURRENT_AUTHORIZATION_REQUIRED' USING ERRCODE='42501'; END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER document_draft_guard ON anvil.documents;
CREATE TRIGGER document_head_guard BEFORE INSERT OR UPDATE ON anvil.documents FOR EACH ROW EXECUTE FUNCTION anvil.guard_document_head();
