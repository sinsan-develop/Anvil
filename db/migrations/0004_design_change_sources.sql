-- 같은 승인된 요청의 출처만 연결한다. 현재 기준·실행·사용자 권한과 기존 이력은 바꾸지 않는다.
CREATE FUNCTION anvil.design_change_sources_valid(pid uuid,sources jsonb) RETURNS boolean LANGUAGE plpgsql STABLE AS $$
DECLARE r jsonb;kind text;rid uuid;
BEGIN
 IF jsonb_typeof(sources) IS DISTINCT FROM 'array' THEN RETURN false;END IF;
 IF jsonb_array_length(sources)>200 OR (SELECT count(DISTINCT value) FROM jsonb_array_elements(sources))<>jsonb_array_length(sources) THEN RETURN false;END IF;
 FOR r IN SELECT value FROM jsonb_array_elements(sources) LOOP
  IF jsonb_typeof(r) IS DISTINCT FROM 'object' OR jsonb_typeof(r->'kind') IS DISTINCT FROM 'string' OR jsonb_typeof(r->'id') IS DISTINCT FROM 'string' OR jsonb_typeof(r->'contentHash') IS DISTINCT FROM 'string' THEN RETURN false;END IF;
  kind=r->>'kind';
  IF kind NOT IN('DOCUMENT_VERSION','ARTIFACT','CONVERSATION','USER_INSTRUCTION') OR (r->>'id') !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' OR (r->>'contentHash') !~ '^[0-9a-f]{64}$' THEN RETURN false;END IF;
  rid=(r->>'id')::uuid;
  IF kind='DOCUMENT_VERSION' THEN
   IF NOT (r ?& ARRAY['kind','id','version','contentHash']) OR (r-ARRAY['kind','id','version','contentHash'])<>'{}'::jsonb OR jsonb_typeof(r->'version') IS DISTINCT FROM 'number' OR (r->>'version') !~ '^[1-9][0-9]{0,15}$' THEN RETURN false;END IF;
   IF (r->>'version')::bigint>9007199254740991 THEN RETURN false;END IF;
   IF NOT EXISTS(SELECT 1 FROM anvil.document_versions v WHERE v.project_id=pid AND v.document_id=rid AND v.version=(r->>'version')::bigint AND v.content_hash=r->>'contentHash') THEN RETURN false;END IF;
  ELSE
   IF NOT (r ?& ARRAY['kind','id','contentHash']) OR (r-ARRAY['kind','id','contentHash'])<>'{}'::jsonb THEN RETURN false;END IF;
   IF kind='ARTIFACT' THEN
    IF NOT EXISTS(SELECT 1 FROM anvil.artifacts a WHERE a.project_id=pid AND a.id=rid AND a.content_hash=r->>'contentHash' AND a.state='READY' AND a.bytes<=2097152 AND a.media_type IN('text/plain;charset=utf-8','text/markdown;charset=utf-8')) THEN RETURN false;END IF;
   ELSE
    IF NOT EXISTS(SELECT 1 FROM anvil.conversation_messages m WHERE m.project_id=pid AND m.id=rid AND m.content_hash=r->>'contentHash' AND (kind<>'USER_INSTRUCTION' OR m.kind='USER_INSTRUCTION')) THEN RETURN false;END IF;
   END IF;
  END IF;
 END LOOP;
 RETURN true;
END;
$$;
CREATE OR REPLACE FUNCTION anvil.guard_design_change_proposal() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE result jsonb;ref jsonb;snapshot jsonb;
BEGIN
 IF current_user<>'anvil_v3_app' THEN RETURN NEW;END IF;
 IF NOT anvil.design_change_command_authorized(NEW.project_id) OR NEW.command_id::text IS DISTINCT FROM current_setting('anvil.command_id',true) OR NEW.created_by::text IS DISTINCT FROM current_setting('anvil.actor_id',true) OR NEW.client_id::text IS DISTINCT FROM current_setting('anvil.client_id',true) THEN RAISE EXCEPTION 'DESIGN_CHANGE_CURRENT_AUTHORIZATION_REQUIRED' USING ERRCODE='42501';END IF;
 SELECT c.result_ref->'data' INTO result FROM anvil.commands c WHERE c.id=NEW.command_id;ref=result->'ref';snapshot=result->'change';
 IF result IS NULL OR ref IS NULL OR snapshot IS NULL OR NEW.version<>1 OR NEW.change_json IS DISTINCT FROM snapshot OR ref IS DISTINCT FROM jsonb_build_object('id',NEW.id,'version',1,'contentHash',NEW.content_hash)
 OR snapshot->'ref' IS DISTINCT FROM ref OR snapshot->>'status' IS DISTINCT FROM 'PROPOSED' OR snapshot->'beforeRef' IS DISTINCT FROM jsonb_build_object('id',NEW.before_id,'version',NEW.before_version,'contentHash',NEW.before_hash)
 OR snapshot->>'afterProposalRef' IS DISTINCT FROM NEW.proposal_id::text OR NOT anvil.design_change_sources_valid(NEW.project_id,snapshot->'sourceRefs') OR snapshot->'requestedBy' IS DISTINCT FROM jsonb_build_object('kind','HUMAN','userId',NEW.created_by)
 OR NOT EXISTS(SELECT 1 FROM anvil.documents d JOIN anvil.document_versions v ON v.project_id=d.project_id AND v.document_id=d.id AND v.version=d.head_version JOIN anvil.form_versions f ON f.definition_id=v.form_definition_id AND f.version=v.form_version AND f.content_hash=v.form_hash
 JOIN anvil.document_proposals p ON p.project_id=d.project_id AND p.document_id=d.id AND p.base_version=v.version AND p.base_hash=v.content_hash AND p.id=NEW.proposal_id
 WHERE d.project_id=NEW.project_id AND d.id=NEW.before_id AND d.head_version=NEW.before_version AND d.confirmed_version=d.head_version AND v.content_hash=NEW.before_hash AND f.definition_json->>'formCode'='AF02'
 AND NOT EXISTS(SELECT 1 FROM anvil.document_proposal_selections s WHERE s.project_id=d.project_id AND s.proposal_id=p.id)
 AND (SELECT r.outcome FROM anvil.content_reviews r JOIN anvil.audit_events a ON a.project_id=r.project_id AND a.command_id=r.command_id WHERE r.project_id=d.project_id AND r.scope_kind='PROJECT' AND r.target_kind='DOCUMENT' AND r.target_id=d.id AND r.target_version=d.head_version AND r.target_hash=v.content_hash AND r.criteria_version=1 AND r.source_kind='HUMAN_REVIEW' ORDER BY a.server_sequence DESC LIMIT 1)='ACCEPTED')
 THEN RAISE EXCEPTION 'DESIGN_CHANGE_EXACT_BASE_PROPOSAL_REQUIRED' USING ERRCODE='42501';END IF;
 RETURN NEW;
END;
$$;
