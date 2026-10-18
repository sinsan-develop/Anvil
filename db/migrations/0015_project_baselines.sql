-- FN01 기능 분류 시작 기준선 후보. 실제 적용/PG 검증 승인이 아니며 기존 SQL·행을 보존한다.
CREATE TABLE anvil.baseline_drafts(
 project_id uuid NOT NULL REFERENCES anvil.projects(id),id uuid NOT NULL,
 head_version bigint NOT NULL CHECK(head_version BETWEEN 1 AND 9007199254740991),
 created_by uuid NOT NULL,client_id uuid NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(project_id,id),FOREIGN KEY(project_id,created_by) REFERENCES anvil.project_members(project_id,user_id),
 FOREIGN KEY(created_by,client_id) REFERENCES anvil.clients(user_id,id)
);
CREATE TABLE anvil.baseline_draft_versions(
 project_id uuid NOT NULL,draft_id uuid NOT NULL,version bigint NOT NULL CHECK(version BETWEEN 1 AND 9007199254740991),
 content_hash text NOT NULL CHECK(content_hash~'^[0-9a-f]{64}$'),version_json jsonb NOT NULL,
 created_by uuid NOT NULL,client_id uuid NOT NULL,command_id uuid NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(project_id,draft_id,version),UNIQUE(project_id,command_id),
 FOREIGN KEY(project_id,draft_id) REFERENCES anvil.baseline_drafts(project_id,id),
 FOREIGN KEY(project_id,command_id) REFERENCES anvil.commands(project_id,id),FOREIGN KEY(created_by,client_id) REFERENCES anvil.clients(user_id,id)
);
ALTER TABLE anvil.baseline_drafts ADD CONSTRAINT baseline_draft_head_fk FOREIGN KEY(project_id,id,head_version)
 REFERENCES anvil.baseline_draft_versions(project_id,draft_id,version) DEFERRABLE INITIALLY DEFERRED;
CREATE TABLE anvil.baseline_content_reviews(
 project_id uuid NOT NULL,review_id uuid NOT NULL,draft_id uuid NOT NULL,draft_version bigint NOT NULL,draft_hash text NOT NULL CHECK(draft_hash~'^[0-9a-f]{64}$'),
 content_hash text NOT NULL CHECK(content_hash~'^[0-9a-f]{64}$'),review_json jsonb NOT NULL,
 created_by uuid NOT NULL,client_id uuid NOT NULL,command_id uuid NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(project_id,review_id),UNIQUE(project_id,command_id),
 FOREIGN KEY(project_id,draft_id,draft_version) REFERENCES anvil.baseline_draft_versions(project_id,draft_id,version),
 FOREIGN KEY(project_id,command_id) REFERENCES anvil.commands(project_id,id),FOREIGN KEY(created_by,client_id) REFERENCES anvil.clients(user_id,id)
);
-- nullable는 아래 FEATURE_STATUS_V1 source-kind guard와 묶인다. 기존행 metadata는 NULL 그대로다.
ALTER TABLE anvil.project_baselines ALTER COLUMN source_snapshot_ref DROP NOT NULL;
ALTER TABLE anvil.project_baselines ADD COLUMN baseline_kind text;
ALTER TABLE anvil.project_baselines ADD COLUMN draft_id uuid;
ALTER TABLE anvil.project_baselines ADD COLUMN draft_version bigint;
ALTER TABLE anvil.project_baselines ADD COLUMN command_id uuid;
ALTER TABLE anvil.project_baselines ADD COLUMN client_id uuid;
ALTER TABLE anvil.project_baselines ADD COLUMN source_snapshot_version bigint;
ALTER TABLE anvil.project_baselines ADD COLUMN source_snapshot_hash text;
ALTER TABLE anvil.project_baselines ADD CONSTRAINT feature_baseline_metadata CHECK(COALESCE((
 (baseline_kind IS NULL AND draft_id IS NULL AND draft_version IS NULL AND command_id IS NULL AND client_id IS NULL AND source_snapshot_version IS NULL AND source_snapshot_hash IS NULL AND source_snapshot_ref IS NOT NULL)
 OR (baseline_kind='FEATURE_STATUS_V1' AND draft_id IS NOT NULL AND draft_version IS NOT NULL AND command_id IS NOT NULL AND client_id IS NOT NULL
  AND ((source_snapshot_ref IS NULL AND source_snapshot_version IS NULL AND source_snapshot_hash IS NULL)
   OR (source_snapshot_ref IS NOT NULL AND source_snapshot_version=1 AND source_snapshot_hash~'^[0-9a-f]{64}$')))
),false));
ALTER TABLE anvil.project_baselines ADD CONSTRAINT feature_baseline_draft_fk FOREIGN KEY(project_id,draft_id,draft_version) REFERENCES anvil.baseline_draft_versions(project_id,draft_id,version);
ALTER TABLE anvil.project_baselines ADD CONSTRAINT feature_baseline_command_fk FOREIGN KEY(project_id,command_id) REFERENCES anvil.commands(project_id,id);
ALTER TABLE anvil.project_baselines ADD CONSTRAINT feature_baseline_client_fk FOREIGN KEY(created_by,client_id) REFERENCES anvil.clients(user_id,id);
ALTER TABLE anvil.project_baselines ADD CONSTRAINT feature_baseline_snapshot_fk FOREIGN KEY(project_id,source_snapshot_ref,source_snapshot_version) REFERENCES anvil.source_snapshots(project_id,id,version);
CREATE UNIQUE INDEX feature_baseline_command_once ON anvil.project_baselines(project_id,command_id) WHERE baseline_kind='FEATURE_STATUS_V1';
CREATE UNIQUE INDEX feature_baseline_draft_once ON anvil.project_baselines(project_id,draft_id,draft_version) WHERE baseline_kind='FEATURE_STATUS_V1';
ALTER TABLE anvil.project_baselines ADD CONSTRAINT feature_baseline_exact_ref UNIQUE(project_id,id,version,content_hash);
CREATE TABLE anvil.baseline_heads(
 project_id uuid PRIMARY KEY REFERENCES anvil.projects(id),baseline_id uuid NOT NULL,baseline_version bigint NOT NULL,baseline_hash text NOT NULL,
 FOREIGN KEY(project_id,baseline_id,baseline_version,baseline_hash) REFERENCES anvil.project_baselines(project_id,id,version,content_hash)
);
CREATE INDEX baseline_draft_project_order ON anvil.baseline_drafts(project_id,updated_at DESC,id DESC);
CREATE INDEX baseline_review_target ON anvil.baseline_content_reviews(project_id,draft_id,draft_version);
CREATE INDEX baseline_adoption_project_order ON anvil.project_baselines(project_id,created_at DESC,id DESC);
GRANT SELECT,INSERT,UPDATE ON anvil.baseline_drafts,anvil.baseline_heads TO anvil_v3_app;
REVOKE DELETE ON anvil.baseline_drafts,anvil.baseline_heads FROM anvil_v3_app;
GRANT SELECT,INSERT ON anvil.baseline_draft_versions,anvil.baseline_content_reviews,anvil.project_baselines TO anvil_v3_app;
REVOKE UPDATE,DELETE ON anvil.baseline_draft_versions,anvil.baseline_content_reviews,anvil.project_baselines FROM anvil_v3_app;

CREATE FUNCTION anvil.baseline_keys(v jsonb,keys text[]) RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
 SELECT COALESCE(jsonb_typeof(v)='object' AND (SELECT count(*) FROM jsonb_object_keys(v))=cardinality(keys) AND v-keys='{}'::jsonb,false);
$$;
CREATE FUNCTION anvil.baseline_text(v jsonb,max_len int DEFAULT 20000,no_control boolean DEFAULT false) RETURNS boolean LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE s text;n bigint;
BEGIN
 IF jsonb_typeof(v) IS DISTINCT FROM 'string' THEN RETURN false;END IF;s=v#>>'{}';
 SELECT COALESCE(sum(CASE WHEN ascii(c)>65535 THEN 2 ELSE 1 END),0) INTO n FROM regexp_split_to_table(s,'') c;
 RETURN anvil.assignment_content_reason(s) AND n<=max_len AND (NOT no_control OR s!~'[[:cntrl:]]');
EXCEPTION WHEN OTHERS THEN RETURN false;
END;
$$;
CREATE FUNCTION anvil.baseline_ref(v jsonb,nullable boolean DEFAULT false) RETURNS boolean LANGUAGE plpgsql IMMUTABLE AS $$
BEGIN
 IF v='null'::jsonb THEN RETURN nullable;END IF;
 RETURN anvil.baseline_keys(v,ARRAY['id','version','contentHash']) AND jsonb_typeof(v->'id')='string'
  AND v->>'id'~'^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
  AND jsonb_typeof(v->'version')='number' AND v->>'version'~'^[1-9][0-9]*$' AND (v->>'version')::numeric<=9007199254740991
  AND jsonb_typeof(v->'contentHash')='string' AND v->>'contentHash'~'^[0-9a-f]{64}$';
EXCEPTION WHEN OTHERS THEN RETURN false;
END;
$$;
CREATE FUNCTION anvil.baseline_sensitive_free(v jsonb) RETURNS boolean LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE part jsonb;s text;
BEGIN
 IF jsonb_typeof(v)='string' THEN
  s=v#>>'{}';RETURN s!~*'-----BEGIN ([A-Z0-9]+ )?PRIVATE KEY-----|\mBearer[[:space:]]+[A-Za-z0-9_.~+/-]{16,}|\m(password|passwd|api[_-]?key|access[_-]?token|token|secret)[[:space:]]*[:=][[:space:]]*["'']?[^[:space:]"'']{4,}';
 ELSIF jsonb_typeof(v)='array' THEN FOR part IN SELECT value FROM jsonb_array_elements(v) LOOP IF NOT anvil.baseline_sensitive_free(part) THEN RETURN false;END IF;END LOOP;
 ELSIF jsonb_typeof(v)='object' THEN FOR part IN SELECT value FROM jsonb_each(v) LOOP IF NOT anvil.baseline_sensitive_free(part) THEN RETURN false;END IF;END LOOP;END IF;
 RETURN true;
END;
$$;
CREATE FUNCTION anvil.baseline_evidence_valid(v jsonb) RETURNS boolean LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE item jsonb;seen text[]='{}';
BEGIN
 IF jsonb_typeof(v) IS DISTINCT FROM 'array' OR jsonb_array_length(v)>200 THEN RETURN false;END IF;
 FOR item IN SELECT value FROM jsonb_array_elements(v) LOOP
  IF NOT anvil.baseline_keys(item,ARRAY['artifactId','bytes','contentHash','mediaType']) OR jsonb_typeof(item->'artifactId') IS DISTINCT FROM 'string'
   OR item->>'artifactId'!~'^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' OR (item->>'artifactId')=ANY(seen)
   OR jsonb_typeof(item->'bytes') IS DISTINCT FROM 'number' OR item->>'bytes'!~'^(0|[1-9][0-9]*)$' OR (item->>'bytes')::numeric>20971520
   OR jsonb_typeof(item->'contentHash') IS DISTINCT FROM 'string' OR item->>'contentHash'!~'^[0-9a-f]{64}$' OR NOT anvil.baseline_text(item->'mediaType',200,true) THEN RETURN false;END IF;
  seen=array_append(seen,item->>'artifactId');
 END LOOP;RETURN true;
EXCEPTION WHEN OTHERS THEN RETURN false;
END;
$$;
CREATE FUNCTION anvil.baseline_evidence_current(pid uuid,v jsonb) RETURNS boolean LANGUAGE plpgsql AS $$
DECLARE item jsonb;
BEGIN
 IF NOT anvil.baseline_evidence_valid(v) THEN RETURN false;END IF;
 FOR item IN SELECT value FROM jsonb_array_elements(v) LOOP
  IF NOT EXISTS(SELECT 1 FROM anvil.artifacts a WHERE a.project_id=pid AND a.id::text=item->>'artifactId' AND a.bytes=(item->>'bytes')::bigint
   AND a.content_hash=item->>'contentHash' AND a.media_type=item->>'mediaType' AND a.state='READY' AND a.storage_key='blobs/'||pid::text||'/'||a.id::text
   AND (a.inspection_json IS NULL OR a.inspection_json->>'state'='NO_KNOWN_MARKER')) THEN RETURN false;END IF;
 END LOOP;RETURN true;
END;
$$;
CREATE FUNCTION anvil.baseline_input_valid(p jsonb) RETURNS boolean LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE s jsonb;item jsonb;seen text[]='{}';total int=0;
BEGIN
 IF NOT anvil.baseline_keys(p,ARRAY['baseRef','source','items','coverageReason','reason']) OR anvil.baseline_ref(p->'baseRef',true) IS DISTINCT FROM true
  OR NOT anvil.baseline_text(p->'coverageReason') OR NOT anvil.baseline_text(p->'reason') OR octet_length(anvil.assignment_draft_canonical(p))>2097152 OR NOT anvil.baseline_sensitive_free(p)
  OR jsonb_typeof(p->'items') IS DISTINCT FROM 'array' OR jsonb_array_length(p->'items') NOT BETWEEN 1 AND 200 THEN RETURN false;END IF;
 s=p->'source';
 IF NOT anvil.baseline_keys(s,ARRAY['kind','declarationRef','sourceRootRef','snapshotRef','grantRef','unverifiedReason']) OR NOT anvil.baseline_text(s->'unverifiedReason') THEN RETURN false;END IF;
 IF s->>'kind'='NONE_SELECTED' THEN
  IF s->'declarationRef' IS DISTINCT FROM 'null'::jsonb OR s->'sourceRootRef' IS DISTINCT FROM 'null'::jsonb OR s->'snapshotRef' IS DISTINCT FROM 'null'::jsonb OR s->'grantRef' IS DISTINCT FROM 'null'::jsonb THEN RETURN false;END IF;
 ELSIF s->>'kind'='DECLARATION_ONLY' THEN
  IF anvil.baseline_ref(s->'declarationRef') IS DISTINCT FROM true OR s->'sourceRootRef' IS DISTINCT FROM 'null'::jsonb OR s->'snapshotRef' IS DISTINCT FROM 'null'::jsonb OR s->'grantRef' IS DISTINCT FROM 'null'::jsonb THEN RETURN false;END IF;
 ELSIF s->>'kind'='ATTRIBUTE_REPORT' THEN
  IF anvil.baseline_ref(s->'declarationRef',true) IS DISTINCT FROM true OR anvil.baseline_ref(s->'sourceRootRef') IS DISTINCT FROM true OR anvil.baseline_ref(s->'snapshotRef') IS DISTINCT FROM true
   OR anvil.baseline_ref(s->'grantRef') IS DISTINCT FROM true OR s->'snapshotRef'->'version' IS DISTINCT FROM '1'::jsonb OR s->'grantRef'->'version' IS DISTINCT FROM '1'::jsonb THEN RETURN false;END IF;
 ELSE RETURN false;END IF;
 FOR item IN SELECT value FROM jsonb_array_elements(p->'items') LOOP
  IF NOT anvil.baseline_keys(item,ARRAY['itemId','title','designRef','featureState','evidenceRefs','limitations','reason']) OR NOT anvil.baseline_text(item->'itemId',200,true)
   OR (item->>'itemId')=ANY(seen) OR NOT anvil.baseline_text(item->'title',200) OR anvil.baseline_ref(item->'designRef',true) IS DISTINCT FROM true
   OR jsonb_typeof(item->'featureState') IS DISTINCT FROM 'string' OR item->>'featureState' NOT IN('IMPLEMENTED_CORE_CHECKED','IMPLEMENTED_UNCHECKED','PARTIAL','NOT_IMPLEMENTED')
   OR NOT anvil.baseline_text(item->'limitations') OR NOT anvil.baseline_text(item->'reason') OR NOT anvil.baseline_evidence_valid(item->'evidenceRefs')
   OR item->>'featureState'='IMPLEMENTED_CORE_CHECKED' AND jsonb_array_length(item->'evidenceRefs')=0 THEN RETURN false;END IF;
  seen=array_append(seen,item->>'itemId');total=total+jsonb_array_length(item->'evidenceRefs');
 END LOOP;RETURN total<=200;
EXCEPTION WHEN OTHERS THEN RETURN false;
END;
$$;
CREATE FUNCTION anvil.baseline_source_current(pid uuid,s jsonb,b jsonb) RETURNS boolean LANGUAGE plpgsql AS $$
DECLARE declaration_record record;snap record;g record;summary jsonb;expected jsonb;
BEGIN
 IF NOT anvil.baseline_keys(b,ARRAY['kind','declaration','observation','declarationReportRelation']) OR b->'kind' IS DISTINCT FROM s->'kind' OR b->>'declarationReportRelation' IS DISTINCT FROM 'UNVERIFIED' THEN RETURN false;END IF;
 SELECT d.*,v.content_hash,v.authority,v.readiness INTO declaration_record FROM anvil.project_source_declarations d JOIN anvil.source_declaration_versions v ON v.id=d.declaration_id AND v.version=d.declaration_version WHERE d.project_id=pid;
 IF declaration_record.project_id IS NOT NULL THEN
  expected=jsonb_build_object('id',declaration_record.declaration_id,'version',declaration_record.declaration_version,'contentHash',declaration_record.content_hash);
  IF s->'declarationRef' IS DISTINCT FROM expected OR b->'declaration' IS DISTINCT FROM jsonb_build_object('ref',expected,'authority','USER_DECLARED','readiness','UNVERIFIED') OR declaration_record.authority<>'USER_DECLARED' OR declaration_record.readiness<>'UNVERIFIED' THEN RETURN false;END IF;
 ELSE IF s->'declarationRef' IS DISTINCT FROM 'null'::jsonb OR b->'declaration' IS DISTINCT FROM 'null'::jsonb THEN RETURN false;END IF;END IF;
 IF s->>'kind'<>'ATTRIBUTE_REPORT' THEN RETURN b->'observation'='null'::jsonb;END IF;
 SELECT * INTO snap FROM anvil.source_snapshots WHERE project_id=pid AND id::text=s->'snapshotRef'->>'id' AND version=1;
 SELECT * INTO g FROM anvil.source_read_grants WHERE project_id=pid AND id::text=s->'grantRef'->>'id';
 IF snap.id IS NULL OR g.id IS NULL OR snap.grant_id<>g.id OR snap.content_hash IS DISTINCT FROM s->'snapshotRef'->>'contentHash' OR g.scope_digest IS DISTINCT FROM s->'grantRef'->>'contentHash'
  OR g.scope_json->'sourceRootRef' IS DISTINCT FROM s->'sourceRootRef' OR snap.source_root_id::text IS DISTINCT FROM s->'sourceRootRef'->>'id' OR to_jsonb(snap.source_root_version) IS DISTINCT FROM s->'sourceRootRef'->'version'
  OR snap.evidence_class<>'CONNECTOR_REPORTED' OR snap.os_verification<>'UNVERIFIED' THEN RETURN false;END IF;
 SELECT jsonb_build_object('rootState',snap.report_json->'root'->>'state','total',count(*),'observed',count(*) FILTER(WHERE value->>'state'='OBSERVED'),'missing',count(*) FILTER(WHERE value->>'state'='MISSING'),'denied',count(*) FILTER(WHERE value->>'state'='DENIED'),'changed',count(*) FILTER(WHERE value->>'state'='CHANGED'),'unverified',count(*) FILTER(WHERE value->>'state'='UNVERIFIED')) INTO summary FROM jsonb_array_elements(snap.report_json->'files');
 expected=jsonb_build_object('snapshotRef',s->'snapshotRef','grantRef',s->'grantRef','sourceRootRef',s->'sourceRootRef','connectorRef',g.scope_json->'connectorRef','observedSummary',summary,
  'observedAt',to_char(snap.observed_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),'finishedAt',to_char(snap.finished_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),'receivedAt',to_char(snap.received_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),'evidenceClass','CONNECTOR_REPORTED','osVerification','UNVERIFIED','executionAuthorized',false);
 RETURN b->'observation'=expected;
EXCEPTION WHEN OTHERS THEN RETURN false;
END;
$$;
CREATE FUNCTION anvil.baseline_items_current(pid uuid,p jsonb) RETURNS boolean LANGUAGE plpgsql AS $$
DECLARE item jsonb;doc record;
BEGIN
 FOR item IN SELECT value FROM jsonb_array_elements(p->'items') LOOP
  IF NOT anvil.baseline_evidence_current(pid,item->'evidenceRefs') THEN RETURN false;END IF;
  IF item->'designRef'<>'null'::jsonb THEN
   SELECT * INTO doc FROM anvil.document_versions WHERE project_id=pid AND document_id::text=item->'designRef'->>'id' AND version=(item->'designRef'->>'version')::bigint;
   IF doc.document_id IS NULL OR doc.content_hash IS DISTINCT FROM item->'designRef'->>'contentHash' OR NOT anvil.baseline_evidence_current(pid,jsonb_build_array(doc.content_json->'body')) THEN RETURN false;END IF;
  END IF;
 END LOOP;RETURN true;
EXCEPTION WHEN OTHERS THEN RETURN false;
END;
$$;
CREATE FUNCTION anvil.baseline_draft_valid(pid uuid,s jsonb) RETURNS boolean LANGUAGE plpgsql AS $$
BEGIN
 RETURN anvil.baseline_keys(s,ARRAY['schemaVersion','input','sourceBinding','evidenceBindings','issues','recordedBy','recordedAt','contentConfirmed','sourceAuthorizationVerified','coverageVerified','executionAuthorized','dispatchPerformed'])
 AND s->'schemaVersion'='1'::jsonb AND s->'contentConfirmed'='false'::jsonb AND s->'sourceAuthorizationVerified'='false'::jsonb AND s->'coverageVerified'='false'::jsonb AND s->'executionAuthorized'='false'::jsonb AND s->'dispatchPerformed'='false'::jsonb
 AND anvil.baseline_input_valid(s->'input') AND anvil.baseline_source_current(pid,s->'input'->'source',s->'sourceBinding') AND anvil.baseline_items_current(pid,s->'input')
 AND s->'evidenceBindings'=(SELECT jsonb_agg(jsonb_build_object('itemId',value->'itemId','evidenceRefs',value->'evidenceRefs') ORDER BY n) FROM jsonb_array_elements(s->'input'->'items') WITH ORDINALITY v(value,n))
 AND s->'issues'='[{"code":"CONTENT_REVIEW_REQUIRED","location":"items"},{"code":"SOURCE_UNVERIFIED","location":"source"},{"code":"COVERAGE_UNVERIFIED","location":"coverageReason"},{"code":"EXECUTION_NOT_CONNECTED","location":"execution"}]'::jsonb
 AND octet_length(anvil.assignment_draft_canonical(s))<=2097152;
EXCEPTION WHEN OTHERS THEN RETURN false;
END;
$$;

CREATE FUNCTION anvil.baseline_outcome(v jsonb) RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
 SELECT COALESCE(jsonb_typeof(v)='string' AND v#>>'{}' IN('ACCEPTED','REWORK','BLOCKED','NOT_EXECUTED'),false);
$$;
CREATE FUNCTION anvil.baseline_core_valid(c jsonb,e jsonb,required boolean) RETURNS boolean LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE field text;proof jsonb;t text;
BEGIN
 IF c='null'::jsonb THEN RETURN NOT required;END IF;
 IF NOT anvil.baseline_keys(c,ARRAY['basis','environment','checkedAt','normalFlow','storageRead','importantFailure']) OR jsonb_typeof(c->'basis') IS DISTINCT FROM 'string'
  OR c->>'basis' NOT IN('ACTUAL','MOCK','STATIC','NOT_EXECUTED','UNKNOWN') OR NOT anvil.baseline_text(c->'environment')
  OR jsonb_typeof(c->'checkedAt') IS DISTINCT FROM 'string' OR c->>'checkedAt'!~'^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}\.[0-9]{3}Z$'
  OR required AND c->>'basis'<>'ACTUAL' THEN RETURN false;END IF;
 t=to_char((c->>'checkedAt')::timestamptz AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');IF t IS DISTINCT FROM c->>'checkedAt' THEN RETURN false;END IF;
 FOREACH field IN ARRAY ARRAY['normalFlow','storageRead','importantFailure'] LOOP
  IF NOT anvil.baseline_evidence_valid(c->field) OR required AND jsonb_array_length(c->field)=0 THEN RETURN false;END IF;
  FOR proof IN SELECT value FROM jsonb_array_elements(c->field) LOOP IF NOT e @> jsonb_build_array(proof) THEN RETURN false;END IF;END LOOP;
 END LOOP;RETURN true;
EXCEPTION WHEN OTHERS THEN RETURN false;
END;
$$;
CREATE FUNCTION anvil.baseline_review_valid(pid uuid,s jsonb,d jsonb) RETURNS boolean LANGUAGE plpgsql AS $$
DECLARE p jsonb;item jsonb;original jsonb;proof jsonb;seen text[]='{}';total int=0;
BEGIN
 IF NOT anvil.baseline_keys(s,ARRAY['input','reviewedBy','reviewedAt','independence']) OR s->>'independence' IS DISTINCT FROM 'NOT_CLAIMED'
  OR jsonb_typeof(s->'reviewedAt') IS DISTINCT FROM 'string' OR NOT anvil.baseline_sensitive_free(s) OR octet_length(anvil.assignment_draft_canonical(s))>2097152 THEN RETURN false;END IF;
 p=s->'input';
 IF NOT anvil.baseline_keys(p,ARRAY['draftRef','criteriaVersion','reviewerKind','items','coverage','outcome','reason']) OR anvil.baseline_ref(p->'draftRef') IS DISTINCT FROM true
  OR p->'criteriaVersion' IS DISTINCT FROM '1'::jsonb OR p->>'reviewerKind' IS DISTINCT FROM 'HUMAN' OR NOT anvil.baseline_outcome(p->'outcome') OR NOT anvil.baseline_text(p->'reason')
  OR NOT anvil.baseline_keys(p->'coverage',ARRAY['outcome','reason']) OR NOT anvil.baseline_outcome(p->'coverage'->'outcome') OR NOT anvil.baseline_text(p->'coverage'->'reason')
  OR jsonb_typeof(p->'items') IS DISTINCT FROM 'array' OR jsonb_array_length(p->'items')<>jsonb_array_length(d->'input'->'items')
  OR p->>'outcome'='ACCEPTED' AND p->'coverage'->>'outcome'<>'ACCEPTED' THEN RETURN false;END IF;
 FOR item IN SELECT value FROM jsonb_array_elements(p->'items') LOOP
  IF NOT anvil.baseline_keys(item,ARRAY['itemId','featureState','outcome','reason','evidenceRefs','coreEvidence']) OR NOT anvil.baseline_text(item->'itemId',200,true) OR (item->>'itemId')=ANY(seen)
   OR jsonb_typeof(item->'featureState') IS DISTINCT FROM 'string' OR NOT anvil.baseline_outcome(item->'outcome') OR NOT anvil.baseline_text(item->'reason') OR NOT anvil.baseline_evidence_current(pid,item->'evidenceRefs')
   OR NOT anvil.baseline_core_valid(item->'coreEvidence',item->'evidenceRefs',item->>'featureState'='IMPLEMENTED_CORE_CHECKED' AND item->>'outcome'='ACCEPTED')
   OR p->>'outcome'='ACCEPTED' AND item->>'outcome'<>'ACCEPTED' THEN RETURN false;END IF;
  SELECT value INTO original FROM jsonb_array_elements(d->'input'->'items') WHERE value->'itemId'=item->'itemId';
  IF original IS NULL OR item->'featureState' IS DISTINCT FROM original->'featureState' OR item->'coreEvidence'<>'null'::jsonb AND (item->'coreEvidence'->>'checkedAt')::timestamptz>(s->>'reviewedAt')::timestamptz THEN RETURN false;END IF;
  FOR proof IN SELECT value FROM jsonb_array_elements(original->'evidenceRefs') LOOP IF NOT (item->'evidenceRefs') @> jsonb_build_array(proof) THEN RETURN false;END IF;END LOOP;
  seen=array_append(seen,item->>'itemId');total=total+jsonb_array_length(item->'evidenceRefs');
 END LOOP;RETURN total<=200;
EXCEPTION WHEN OTHERS THEN RETURN false;
END;
$$;
CREATE FUNCTION anvil.baseline_authorized(pid uuid,op text) RETURNS boolean LANGUAGE sql AS $$
 SELECT op IN('saveBaselineDraft','reviewBaselineContent','confirmBaseline') AND EXISTS(SELECT 1 FROM anvil.commands c
 JOIN anvil.authorization_receipts ar ON ar.id=c.authorization_receipt_id AND ar.command_id=c.id AND ar.scope_kind='PROJECT' AND ar.scope_id=c.project_id AND ar.policy_ref=c.policy_ref
 JOIN anvil.project_control pc ON pc.project_id=c.project_id AND pc.actor_id=c.actor_id AND pc.client_id=c.client_id AND pc.generation=c.control_generation AND pc.revoked_at IS NULL
 JOIN anvil.project_members m ON m.project_id=c.project_id AND m.user_id=c.actor_id AND m.participation='OWNER' AND m.revoked_at IS NULL
 JOIN anvil.projects p ON p.id=c.project_id AND p.archived_at IS NULL
 JOIN anvil.permission_policies pp ON pp.project_id=c.project_id AND pp.id::text=c.policy_ref->>'id' AND pp.head_version::text=c.policy_ref->>'version'
 JOIN anvil.permission_policy_versions pv ON pv.project_id=pp.project_id AND pv.policy_id=pp.id AND pv.version=pp.head_version AND pv.content_hash=c.policy_ref->>'contentHash'
 WHERE c.id::text=current_setting('anvil.command_id',true) AND c.project_id=pid AND c.scope_kind='PROJECT' AND c.scope_id=pid AND c.operation=op AND c.state='APPLIED'
 AND c.actor_id::text=current_setting('anvil.actor_id',true) AND c.client_id::text=current_setting('anvil.client_id',true)
 AND c.approval_consumption_id IS NULL AND c.payload_ref IS NULL AND ar.approval_decision_ref IS NULL
 AND ar.subject_ref=jsonb_build_object('kind','HUMAN','userId',c.actor_id,'clientId',c.client_id)
 AND EXISTS(SELECT 1 FROM anvil.audit_events a WHERE a.project_id=pid AND a.command_id=c.id AND a.operation_id=c.operation_id AND a.outcome='APPLIED' AND a.source_kind='HUMAN_COMMAND' AND a.scope_digest=ar.scope_digest)
 AND EXISTS(SELECT 1 FROM anvil.auth_sessions s JOIN anvil.users u ON u.id=s.user_id JOIN anvil.clients cl ON cl.id=s.client_id AND cl.user_id=s.user_id
  WHERE s.user_id=c.actor_id AND s.client_id=c.client_id AND s.revoked_at IS NULL AND u.status='ACTIVE' AND u.revoked_at IS NULL AND cl.revoked_at IS NULL
  AND s.credential_generation=u.credential_generation AND s.idle_expires_at>clock_timestamp() AND s.absolute_expires_at>clock_timestamp())
 AND EXISTS(SELECT 1 FROM jsonb_array_elements(pv.rules_json) rule WHERE rule->'subjectRef'=jsonb_build_object('kind','HUMAN','userId',c.actor_id)
  AND rule->'targetScopes'=jsonb_build_array(jsonb_build_object('kind','PROJECT','projectId',pid)) AND (rule->'operations') ? op AND rule->>'disposition'='AUTO' AND (rule->>'expiresAt')::timestamptz>clock_timestamp())
 AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(pv.rules_json) rule WHERE rule->'subjectRef'=jsonb_build_object('kind','HUMAN','userId',c.actor_id)
  AND rule->'targetScopes'=jsonb_build_array(jsonb_build_object('kind','PROJECT','projectId',pid)) AND (rule->'operations') ? op AND rule->>'disposition' IN('DENY','REQUIRE_APPROVAL') AND (rule->>'expiresAt')::timestamptz>clock_timestamp())
 );
$$;
CREATE FUNCTION anvil.guard_feature_baseline() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE cmd anvil.commands%ROWTYPE;d anvil.baseline_draft_versions%ROWTYPE;b anvil.project_baselines%ROWTYPE;review_record anvil.baseline_content_reviews%ROWTYPE;
 s jsonb;payload jsonb;ref jsonb;rid uuid;dv bigint;op text;status text;target jsonb;expected bigint;latest jsonb;chosen jsonb;previous jsonb;max_version bigint;scope text;
BEGIN
 IF current_user<>'anvil_v3_app' THEN IF TG_OP='DELETE' THEN RETURN OLD;ELSE RETURN NEW;END IF;END IF;
 IF TG_OP='DELETE' OR TG_OP='UPDATE' AND TG_TABLE_NAME NOT IN('baseline_drafts','baseline_heads') THEN RAISE EXCEPTION 'FEATURE_BASELINE_HISTORY_IMMUTABLE' USING ERRCODE='42501';END IF;
 PERFORM id FROM anvil.projects WHERE id=NEW.project_id FOR UPDATE;
 SELECT * INTO cmd FROM anvil.commands WHERE id::text=current_setting('anvil.command_id',true);
 s=cmd.result_ref->'data'->'snapshot';
 IF TG_TABLE_NAME IN('baseline_drafts','baseline_draft_versions') THEN
  op='saveBaselineDraft';status='BASELINE_DRAFT_STORED';
  IF TG_TABLE_NAME='baseline_drafts' THEN rid=NEW.id;dv=NEW.head_version;
   IF TG_OP='INSERT' THEN IF dv<>1 THEN RAISE EXCEPTION 'BASELINE_HEAD_CAS_REQUIRED' USING ERRCODE='42501';END IF;
   ELSIF dv<>OLD.head_version+1 OR to_jsonb(NEW)-ARRAY['head_version','updated_at'] IS DISTINCT FROM to_jsonb(OLD)-ARRAY['head_version','updated_at'] THEN RAISE EXCEPTION 'BASELINE_HEAD_CAS_REQUIRED' USING ERRCODE='42501';END IF;
  ELSE rid=NEW.draft_id;dv=NEW.version;
   IF NEW.command_id IS DISTINCT FROM cmd.id OR NEW.version_json IS DISTINCT FROM s OR NEW.content_hash IS DISTINCT FROM encode(sha256(convert_to(anvil.assignment_draft_canonical(s),'UTF8')),'hex')
    OR NOT EXISTS(SELECT 1 FROM anvil.baseline_drafts h WHERE h.project_id=NEW.project_id AND h.id=rid AND h.head_version=dv) THEN RAISE EXCEPTION 'BASELINE_EXACT_DRAFT_REQUIRED' USING ERRCODE='42501';END IF;
  END IF;
  payload=s->'input';expected=dv-1;target=CASE WHEN dv=1 THEN 'null'::jsonb ELSE to_jsonb(rid) END;
  IF (TG_TABLE_NAME='baseline_draft_versions' OR TG_OP='INSERT') AND (NEW.created_by IS DISTINCT FROM cmd.actor_id OR NEW.client_id IS DISTINCT FROM cmd.client_id) THEN RAISE EXCEPTION 'BASELINE_CURRENT_WRITER_REQUIRED' USING ERRCODE='42501';END IF;
  IF NOT anvil.baseline_draft_valid(NEW.project_id,s)
   OR s->'recordedBy' IS DISTINCT FROM jsonb_build_object('kind','HUMAN','userId',cmd.actor_id) OR (s->>'recordedAt')::timestamptz IS DISTINCT FROM date_trunc('milliseconds',transaction_timestamp()) THEN RAISE EXCEPTION 'BASELINE_VALID_DRAFT_REQUIRED' USING ERRCODE='42501';END IF;
  IF dv=1 THEN IF payload->'baseRef' IS DISTINCT FROM 'null'::jsonb THEN RAISE EXCEPTION 'BASELINE_HEAD_CAS_REQUIRED' USING ERRCODE='42501';END IF;
  ELSE SELECT * INTO d FROM anvil.baseline_draft_versions WHERE project_id=NEW.project_id AND draft_id=rid AND version=dv-1;
   IF d.draft_id IS NULL OR payload->'baseRef' IS DISTINCT FROM jsonb_build_object('id',rid,'version',dv-1,'contentHash',d.content_hash) THEN RAISE EXCEPTION 'BASELINE_HEAD_CAS_REQUIRED' USING ERRCODE='42501';END IF;
  END IF;
  ref=jsonb_build_object('id',rid,'version',dv,'contentHash',encode(sha256(convert_to(anvil.assignment_draft_canonical(s),'UTF8')),'hex'));
 ELSIF TG_TABLE_NAME='baseline_content_reviews' THEN
  op='reviewBaselineContent';status='BASELINE_CONTENT_REVIEWED';rid=NEW.draft_id;dv=NEW.draft_version;expected=dv;target=to_jsonb(rid);payload=s->'input';
  SELECT * INTO d FROM anvil.baseline_draft_versions WHERE project_id=NEW.project_id AND draft_id=rid AND version=dv;
  IF NEW.command_id IS DISTINCT FROM cmd.id OR NEW.created_by IS DISTINCT FROM cmd.actor_id OR NEW.client_id IS DISTINCT FROM cmd.client_id OR NEW.review_json IS DISTINCT FROM s OR d.draft_id IS NULL OR NEW.draft_hash IS DISTINCT FROM d.content_hash
   OR NOT EXISTS(SELECT 1 FROM anvil.baseline_drafts h WHERE h.project_id=NEW.project_id AND h.id=rid AND h.head_version=dv)
   OR payload->'draftRef' IS DISTINCT FROM jsonb_build_object('id',rid,'version',dv,'contentHash',d.content_hash) OR NOT anvil.baseline_draft_valid(NEW.project_id,d.version_json)
   OR NOT anvil.baseline_review_valid(NEW.project_id,s,d.version_json) OR s->'reviewedBy' IS DISTINCT FROM jsonb_build_object('kind','HUMAN','userId',cmd.actor_id)
   OR (s->>'reviewedAt')::timestamptz IS DISTINCT FROM date_trunc('milliseconds',transaction_timestamp()) OR NEW.content_hash IS DISTINCT FROM encode(sha256(convert_to(anvil.assignment_draft_canonical(s),'UTF8')),'hex') THEN RAISE EXCEPTION 'BASELINE_EXACT_REVIEW_REQUIRED' USING ERRCODE='42501';END IF;
  ref=jsonb_build_object('id',NEW.review_id,'version',1,'contentHash',NEW.content_hash);
 ELSIF TG_TABLE_NAME='project_baselines' THEN
  op='confirmBaseline';status='FEATURE_BASELINE_ADOPTED';rid=NEW.draft_id;dv=NEW.draft_version;expected=dv;target=to_jsonb(rid);
  SELECT * INTO d FROM anvil.baseline_draft_versions WHERE project_id=NEW.project_id AND draft_id=rid AND version=dv;
  SELECT jsonb_build_object('id',baseline_id,'version',baseline_version,'contentHash',baseline_hash) INTO previous FROM anvil.baseline_heads WHERE project_id=NEW.project_id;
  SELECT COALESCE(MAX(version),0)+1 INTO max_version FROM anvil.project_baselines WHERE project_id=NEW.project_id;
  IF NEW.baseline_kind IS DISTINCT FROM 'FEATURE_STATUS_V1' OR NEW.command_id IS DISTINCT FROM cmd.id OR NEW.created_by IS DISTINCT FROM cmd.actor_id OR NEW.client_id IS DISTINCT FROM cmd.client_id OR d.draft_id IS NULL
   OR NEW.version IS DISTINCT FROM max_version OR NEW.content_json IS DISTINCT FROM s OR NEW.content_hash IS DISTINCT FROM encode(sha256(convert_to(anvil.assignment_draft_canonical(s),'UTF8')),'hex')
   OR NOT EXISTS(SELECT 1 FROM anvil.baseline_drafts h WHERE h.project_id=NEW.project_id AND h.id=rid AND h.head_version=dv)
   OR NOT anvil.baseline_keys(s,ARRAY['schemaVersion','kind','draftRef','input','sourceBinding','evidenceBindings','reviewRefs','previousBaselineRef','reason','acknowledged','adoptedBy','adoptedAt','contentConfirmed','sourceAuthorizationVerified','coverageVerified','executionAuthorized','dispatchPerformed'])
   OR s->'schemaVersion' IS DISTINCT FROM '1'::jsonb OR s->>'kind' IS DISTINCT FROM 'FEATURE_STATUS_V1' OR s->'draftRef' IS DISTINCT FROM jsonb_build_object('id',rid,'version',dv,'contentHash',d.content_hash)
   OR s->'input' IS DISTINCT FROM d.version_json->'input' OR s->'sourceBinding' IS DISTINCT FROM d.version_json->'sourceBinding' OR s->'evidenceBindings' IS DISTINCT FROM d.version_json->'evidenceBindings'
   OR s->'previousBaselineRef' IS DISTINCT FROM COALESCE(previous,'null'::jsonb) OR s->'acknowledged' IS DISTINCT FROM 'true'::jsonb OR s->'contentConfirmed' IS DISTINCT FROM 'true'::jsonb
   OR s->'sourceAuthorizationVerified' IS DISTINCT FROM 'false'::jsonb OR s->'coverageVerified' IS DISTINCT FROM 'false'::jsonb OR s->'executionAuthorized' IS DISTINCT FROM 'false'::jsonb OR s->'dispatchPerformed' IS DISTINCT FROM 'false'::jsonb
   OR NOT anvil.baseline_text(s->'reason') OR NOT anvil.baseline_sensitive_free(s) OR octet_length(anvil.assignment_draft_canonical(s))>2097152
   OR s->'adoptedBy' IS DISTINCT FROM jsonb_build_object('kind','HUMAN','userId',cmd.actor_id) OR (s->>'adoptedAt')::timestamptz IS DISTINCT FROM date_trunc('milliseconds',transaction_timestamp())
   OR NOT anvil.baseline_draft_valid(NEW.project_id,d.version_json) OR jsonb_typeof(s->'reviewRefs') IS DISTINCT FROM 'array' OR jsonb_array_length(s->'reviewRefs') NOT BETWEEN 1 AND 200
   OR NEW.source_snapshot_ref::text IS DISTINCT FROM s->'input'->'source'->'snapshotRef'->>'id' OR to_jsonb(NEW.source_snapshot_version) IS DISTINCT FROM NULLIF(s->'input'->'source'->'snapshotRef'->'version','null'::jsonb)
   OR NEW.source_snapshot_hash IS DISTINCT FROM s->'input'->'source'->'snapshotRef'->>'contentHash' THEN RAISE EXCEPTION 'BASELINE_CONTENT_ADOPTION_REQUIRED' USING ERRCODE='42501';END IF;
  SELECT jsonb_build_object('id',r.review_id,'version',1,'contentHash',r.content_hash) INTO latest FROM anvil.baseline_content_reviews r JOIN anvil.audit_events a ON a.project_id=r.project_id AND a.command_id=r.command_id AND a.outcome='APPLIED'
   WHERE r.project_id=NEW.project_id AND r.draft_id=rid AND r.draft_version=dv ORDER BY a.server_sequence DESC LIMIT 1;
  IF latest IS NULL OR NOT (s->'reviewRefs') @> jsonb_build_array(latest) OR (SELECT count(DISTINCT value) FROM jsonb_array_elements(s->'reviewRefs'))<>jsonb_array_length(s->'reviewRefs') THEN RAISE EXCEPTION 'BASELINE_LATEST_REVIEW_REQUIRED' USING ERRCODE='42501';END IF;
  FOR chosen IN SELECT value FROM jsonb_array_elements(s->'reviewRefs') LOOP
   SELECT * INTO review_record FROM anvil.baseline_content_reviews WHERE project_id=NEW.project_id AND review_id::text=chosen->>'id';
   IF review_record.review_id IS NULL OR chosen IS DISTINCT FROM jsonb_build_object('id',review_record.review_id,'version',1,'contentHash',review_record.content_hash) OR review_record.draft_id IS DISTINCT FROM rid OR review_record.draft_version IS DISTINCT FROM dv OR review_record.draft_hash IS DISTINCT FROM d.content_hash
    OR review_record.review_json->'input'->>'outcome' IS DISTINCT FROM 'ACCEPTED' OR NOT anvil.baseline_review_valid(NEW.project_id,review_record.review_json,d.version_json) OR review_record.content_hash IS DISTINCT FROM encode(sha256(convert_to(anvil.assignment_draft_canonical(review_record.review_json),'UTF8')),'hex')
    OR NOT EXISTS(SELECT 1 FROM anvil.commands rc JOIN anvil.audit_events ra ON ra.project_id=rc.project_id AND ra.command_id=rc.id AND ra.outcome='APPLIED' WHERE rc.id=review_record.command_id AND rc.project_id=NEW.project_id AND rc.operation='reviewBaselineContent' AND rc.state='APPLIED' AND rc.result_ref->'data'->'ref'=chosen AND rc.result_ref->'data'->'snapshot'=review_record.review_json) THEN RAISE EXCEPTION 'BASELINE_ACCEPTED_REVIEW_REQUIRED' USING ERRCODE='42501';END IF;
  END LOOP;
  payload=jsonb_build_object('draftRef',s->'draftRef','reviewRefs',s->'reviewRefs','reason',s->'reason','acknowledged',true);
  ref=jsonb_build_object('id',NEW.id,'version',NEW.version,'contentHash',NEW.content_hash);
 ELSIF TG_TABLE_NAME='baseline_heads' THEN
  op='confirmBaseline';status='FEATURE_BASELINE_ADOPTED';
  SELECT * INTO b FROM anvil.project_baselines WHERE project_id=NEW.project_id AND id=NEW.baseline_id AND version=NEW.baseline_version;
  IF b.id IS NULL OR b.baseline_kind IS DISTINCT FROM 'FEATURE_STATUS_V1' OR b.command_id IS DISTINCT FROM cmd.id OR b.content_hash IS DISTINCT FROM NEW.baseline_hash THEN RAISE EXCEPTION 'BASELINE_EXPLICIT_HEAD_REQUIRED' USING ERRCODE='42501';END IF;
  IF TG_OP='UPDATE' THEN previous=jsonb_build_object('id',OLD.baseline_id,'version',OLD.baseline_version,'contentHash',OLD.baseline_hash);ELSE previous='null'::jsonb;END IF;
  IF s->'previousBaselineRef' IS DISTINCT FROM previous OR s IS DISTINCT FROM b.content_json THEN RAISE EXCEPTION 'BASELINE_EXPLICIT_HEAD_REQUIRED' USING ERRCODE='42501';END IF;
  rid=b.draft_id;dv=b.draft_version;expected=dv;target=to_jsonb(rid);payload=jsonb_build_object('draftRef',s->'draftRef','reviewRefs',s->'reviewRefs','reason',s->'reason','acknowledged',true);
  ref=jsonb_build_object('id',NEW.baseline_id,'version',NEW.baseline_version,'contentHash',NEW.baseline_hash);
 ELSE RAISE EXCEPTION 'BASELINE_TABLE_INVALID' USING ERRCODE='42501';END IF;
 scope=encode(sha256(convert_to(anvil.assignment_draft_canonical(jsonb_build_object('projectId',NEW.project_id,'actorId',cmd.actor_id,'clientId',cmd.client_id,'controlGeneration',cmd.control_generation,'requestHash',cmd.request_hash,'policyRef',cmd.policy_ref,'targetRef',ref)),'UTF8')),'hex');
 IF cmd.id IS NULL OR NOT anvil.baseline_authorized(NEW.project_id,op) OR cmd.expected_version IS DISTINCT FROM expected
  OR cmd.result_ref->>'status' IS DISTINCT FROM 'APPLIED' OR cmd.result_ref->>'projectId' IS DISTINCT FROM NEW.project_id::text OR cmd.result_ref->>'targetId' IS DISTINCT FROM ref->>'id' OR cmd.result_ref->'version' IS DISTINCT FROM ref->'version'
  OR cmd.result_ref->'data'->>'status' IS DISTINCT FROM status OR cmd.result_ref->'data'->'ref' IS DISTINCT FROM ref
  OR NOT EXISTS(SELECT 1 FROM anvil.authorization_receipts ar WHERE ar.command_id=cmd.id AND ar.id=cmd.authorization_receipt_id AND ar.scope_digest=scope)
  OR cmd.request_hash IS DISTINCT FROM encode(sha256(convert_to(anvil.assignment_draft_canonical(jsonb_build_object('schemaVersion',1,'projectId',NEW.project_id,'commandId',cmd.command_id,'clientId',cmd.client_id,'controlGeneration',cmd.control_generation,'operation',op,'targetId',target,'expectedVersion',expected,'baselineRefs','[]'::jsonb,'approvalRef','null'::jsonb,'payload',payload)),'UTF8')),'hex') THEN RAISE EXCEPTION 'BASELINE_CURRENT_EXACT_RECEIPT_REQUIRED' USING ERRCODE='42501';END IF;
 RETURN NEW;
END;
$$;
CREATE TRIGGER baseline_draft_guard BEFORE INSERT OR UPDATE OR DELETE ON anvil.baseline_drafts FOR EACH ROW EXECUTE FUNCTION anvil.guard_feature_baseline();
CREATE TRIGGER baseline_draft_version_guard BEFORE INSERT OR UPDATE OR DELETE ON anvil.baseline_draft_versions FOR EACH ROW EXECUTE FUNCTION anvil.guard_feature_baseline();
CREATE TRIGGER baseline_content_review_guard BEFORE INSERT OR UPDATE OR DELETE ON anvil.baseline_content_reviews FOR EACH ROW EXECUTE FUNCTION anvil.guard_feature_baseline();
CREATE TRIGGER feature_baseline_adoption_guard BEFORE INSERT OR UPDATE OR DELETE ON anvil.project_baselines FOR EACH ROW EXECUTE FUNCTION anvil.guard_feature_baseline();
CREATE TRIGGER feature_baseline_head_guard BEFORE INSERT OR UPDATE OR DELETE ON anvil.baseline_heads FOR EACH ROW EXECUTE FUNCTION anvil.guard_feature_baseline();
CREATE FUNCTION anvil.feature_baseline_head_complete() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF current_user='anvil_v3_app' AND NEW.baseline_kind='FEATURE_STATUS_V1' AND NOT EXISTS(SELECT 1 FROM anvil.baseline_heads WHERE project_id=NEW.project_id AND baseline_id=NEW.id AND baseline_version=NEW.version AND baseline_hash=NEW.content_hash) THEN RAISE EXCEPTION 'BASELINE_HEAD_INCOMPLETE' USING ERRCODE='42501';END IF;
 RETURN NULL;
END;
$$;
CREATE CONSTRAINT TRIGGER feature_baseline_head_complete_guard AFTER INSERT ON anvil.project_baselines DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION anvil.feature_baseline_head_complete();
