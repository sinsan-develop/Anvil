-- 적용41/데이터/권한은 보존하고 PL/pgSQL OLD와 충돌하는 SELECT alias만 보정한다.
CREATE OR REPLACE FUNCTION anvil.guard_connection_candidate() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE cmd anvil.commands%ROWTYPE;body jsonb;cid uuid;v bigint;
BEGIN
 IF current_user<>'anvil_v3_app' THEN RETURN NEW;END IF;
 SELECT * INTO cmd FROM anvil.commands WHERE id::text=current_setting('anvil.command_id',true);
 body=cmd.result_ref->'data'->'candidate';
 IF TG_TABLE_NAME='connection_candidates' THEN
  cid=NEW.id;v=NEW.head_version;
  IF TG_OP='INSERT' THEN
   IF v<>1 THEN RAISE EXCEPTION 'CANDIDATE_HEAD_REQUIRED' USING ERRCODE='42501';END IF;
  ELSIF NEW.project_id IS DISTINCT FROM OLD.project_id OR NEW.kind IS DISTINCT FROM OLD.kind OR NEW.created_by IS DISTINCT FROM OLD.created_by OR NEW.created_at IS DISTINCT FROM OLD.created_at OR v<>OLD.head_version+1 THEN
   RAISE EXCEPTION 'CANDIDATE_HEAD_REQUIRED' USING ERRCODE='42501';
  END IF;
 ELSE
  cid=NEW.candidate_id;v=NEW.version;
  IF NEW.command_id IS DISTINCT FROM cmd.id OR NEW.created_by IS DISTINCT FROM cmd.actor_id OR NEW.client_id IS DISTINCT FROM cmd.client_id
  OR cmd.result_ref->'data'->'candidate' IS DISTINCT FROM NEW.snapshot_json OR cmd.result_ref->'data'->'ref' IS DISTINCT FROM jsonb_build_object('id',cid,'version',v,'contentHash',NEW.content_hash)
  OR NEW.expires_at IS DISTINCT FROM (body->'input'->>'expiresAt')::timestamptz OR NEW.expires_at<=clock_timestamp()
  OR NOT EXISTS(SELECT 1 FROM anvil.connection_candidates c WHERE c.project_id=NEW.project_id AND c.id=cid AND c.head_version=v AND c.kind=NEW.kind) THEN
   RAISE EXCEPTION 'CANDIDATE_VERSION_RECEIPT_REQUIRED' USING ERRCODE='42501';
  END IF;
 END IF;
 IF cmd.id IS NULL OR cmd.project_id IS DISTINCT FROM NEW.project_id OR NEW.created_by IS DISTINCT FROM cmd.actor_id OR cmd.expected_version<>v-1
 OR body->>'kind' IS DISTINCT FROM NEW.kind OR body->'input'->'policyRef' IS DISTINCT FROM cmd.policy_ref
 OR cmd.result_ref->'data'->>'status' IS DISTINCT FROM 'CANDIDATE_STORED' OR cmd.result_ref->'data'->'ref'->>'id' IS DISTINCT FROM cid::text OR cmd.result_ref->'data'->'ref'->>'version' IS DISTINCT FROM v::text
 OR body->'readiness'->>'state' IS DISTINCT FROM 'NOT_READY' OR body->'readiness'->'executionAuthorized' IS DISTINCT FROM 'false'::jsonb
 OR jsonb_array_length(body->'capabilities') IS DISTINCT FROM 6
 OR EXISTS(SELECT 1 FROM jsonb_array_elements(body->'capabilities') capability WHERE capability->'measurement'->>'state' IS DISTINCT FROM 'UNVERIFIED' OR capability->>'controlLevel' IS DISTINCT FROM 'UNVERIFIED')
 OR (cmd.operation='registerConnection' AND NEW.kind<>'CONNECTION_CANDIDATE') OR (cmd.operation='saveEnvironment' AND NEW.kind<>'ENVIRONMENT_CANDIDATE')
 OR NOT anvil.connection_candidate_authorized(NEW.project_id,cmd.operation) THEN
  RAISE EXCEPTION 'CANDIDATE_CURRENT_AUTHORIZATION_REQUIRED' USING ERRCODE='42501';
 END IF;
 IF v=1 THEN
  IF cmd.result_ref->'data'->'previousRef' IS DISTINCT FROM 'null'::jsonb THEN RAISE EXCEPTION 'CANDIDATE_BASE_REQUIRED' USING ERRCODE='42501';END IF;
 ELSE
  IF NOT EXISTS(SELECT 1 FROM anvil.connection_candidate_versions prior_version WHERE prior_version.project_id=NEW.project_id AND prior_version.candidate_id=cid AND prior_version.version=v-1
    AND cmd.result_ref->'data'->'previousRef'=jsonb_build_object('id',cid,'version',prior_version.version,'contentHash',prior_version.content_hash)) THEN RAISE EXCEPTION 'CANDIDATE_BASE_REQUIRED' USING ERRCODE='42501';END IF;
 END IF;
 RETURN NEW;
END;
$$;

