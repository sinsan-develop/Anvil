ALTER TABLE anvil.artifacts ADD COLUMN inspection_json jsonb;
ALTER TABLE anvil.artifacts ADD CONSTRAINT artifact_quarantine_inspection_required CHECK(state<>'QUARANTINED' OR (inspection_json IS NOT NULL AND inspection_json->>'state'='SUSPECTED'));
-- 이전 제안 diff의 정확 허가 guard는 보존한다. 신규 업로드 검사는 아래 별도 guard가 소유한다.
DROP TRIGGER project_artifact_guard ON anvil.artifacts;
CREATE TRIGGER project_artifact_guard BEFORE INSERT ON anvil.artifacts FOR EACH ROW WHEN(NEW.inspection_json IS NULL) EXECUTE FUNCTION anvil.guard_project_artifact_insert();
CREATE FUNCTION anvil.guard_uploaded_artifact_inspection() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE op text;
BEGIN
 IF current_user<>'anvil_v3_app' THEN RETURN NEW;END IF;
 SELECT operation INTO op FROM anvil.commands WHERE id=NEW.command_id;
 IF op IS DISTINCT FROM 'uploadArtifact' THEN
  IF NEW.inspection_json IS NOT NULL THEN RAISE EXCEPTION 'ARTIFACT_INSPECTION_AUTHORIZATION_REQUIRED' USING ERRCODE='42501';END IF;
  RETURN NEW;
 END IF;
 IF NEW.project_id IS NULL OR NEW.draft_id IS NOT NULL OR NEW.state NOT IN('READY','QUARANTINED') OR NEW.inspection_json IS NULL
  OR jsonb_typeof(NEW.inspection_json) IS DISTINCT FROM 'object'
  OR (SELECT count(*) FROM jsonb_object_keys(NEW.inspection_json))<>5
  OR NEW.inspection_json->'policyVersion' IS DISTINCT FROM '1'::jsonb
  OR NEW.inspection_json->>'method' IS DISTINCT FROM 'KNOWN_PATTERNS_RAW_BYTES' OR NEW.inspection_json->'complete' IS DISTINCT FROM 'false'::jsonb
  OR NEW.inspection_json->>'state' IS DISTINCT FROM (CASE WHEN NEW.state='QUARANTINED' THEN 'SUSPECTED' ELSE 'NO_KNOWN_MARKER' END)
  OR jsonb_typeof(NEW.inspection_json->'reasonCodes') IS DISTINCT FROM 'array'
  OR jsonb_array_length(NEW.inspection_json->'reasonCodes')>3
  OR (NEW.state='QUARANTINED') IS DISTINCT FROM (jsonb_array_length(NEW.inspection_json->'reasonCodes')>0)
  OR (SELECT count(*) FROM jsonb_array_elements(NEW.inspection_json->'reasonCodes'))<>(SELECT count(DISTINCT value) FROM jsonb_array_elements(NEW.inspection_json->'reasonCodes'))
  OR EXISTS(SELECT 1 FROM jsonb_array_elements_text(NEW.inspection_json->'reasonCodes') AS reason(value) WHERE reason.value IS NULL OR reason.value NOT IN('PRIVATE_KEY_MARKER','BEARER_TOKEN_MARKER','SECRET_ASSIGNMENT_MARKER'))
  OR NEW.storage_key IS DISTINCT FROM 'blobs/'||NEW.project_id::text||'/'||NEW.id::text
  OR NEW.created_by::text IS DISTINCT FROM current_setting('anvil.actor_id',true) OR NEW.client_id::text IS DISTINCT FROM current_setting('anvil.client_id',true) OR NEW.command_id::text IS DISTINCT FROM current_setting('anvil.command_id',true)
  OR NOT EXISTS(SELECT 1 FROM anvil.commands c JOIN anvil.project_control pc ON pc.project_id=c.project_id
   JOIN anvil.project_members m ON m.project_id=c.project_id AND m.user_id=c.actor_id AND m.participation='OWNER' AND m.revoked_at IS NULL
   JOIN anvil.permission_policies p ON p.project_id=c.project_id
   JOIN anvil.authorization_receipts r ON r.id=c.authorization_receipt_id AND r.command_id=c.id AND r.scope_kind='PROJECT' AND r.scope_id=c.project_id
   WHERE c.id=NEW.command_id AND c.project_id=NEW.project_id AND c.actor_id=NEW.created_by AND c.client_id=NEW.client_id AND c.operation='uploadArtifact' AND c.state='APPLIED' AND c.expected_version=0
    AND pc.actor_id=c.actor_id AND pc.client_id=c.client_id AND pc.revoked_at IS NULL AND pc.generation=c.control_generation
    AND c.policy_ref->>'id'=p.id::text AND (c.policy_ref->>'version')::bigint=p.head_version AND r.policy_ref=c.policy_ref
    AND c.result_ref->'data'->'artifactRef'=jsonb_build_object('artifactId',NEW.id,'contentHash',NEW.content_hash,'bytes',NEW.bytes,'mediaType',NEW.media_type)
    AND c.result_ref->'data'->>'status'=CASE WHEN NEW.state='QUARANTINED' THEN 'ARTIFACT_QUARANTINED' ELSE 'ARTIFACT_READY' END
    AND c.result_ref->'data'->'inspection'=NEW.inspection_json)
 THEN RAISE EXCEPTION 'ARTIFACT_INSPECTION_EXACT_RECEIPT_REQUIRED' USING ERRCODE='42501';END IF;
 RETURN NEW;
END;
$$;
CREATE TRIGGER uploaded_artifact_inspection_guard BEFORE INSERT ON anvil.artifacts FOR EACH ROW EXECUTE FUNCTION anvil.guard_uploaded_artifact_inspection();
