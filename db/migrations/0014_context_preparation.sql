-- FN05 준비 후보. 실제 적용/PG 검증 전이며 기존0012/0013·일회 승인 소비는 변경하지 않는다.
CREATE TABLE anvil.context_bundles(
 project_id uuid NOT NULL,id uuid PRIMARY KEY,version bigint NOT NULL CHECK(version=1),
 assignment_id uuid NOT NULL,assignment_version bigint NOT NULL,assignment_hash text NOT NULL CHECK(assignment_hash~'^[0-9a-f]{64}$'),
 assignment_ref jsonb NOT NULL,baseline_refs jsonb NOT NULL,budget_ref jsonb NOT NULL,manifest_json jsonb NOT NULL,request_payload jsonb NOT NULL,
 content_hash text NOT NULL CHECK(content_hash~'^[0-9a-f]{64}$'),created_by uuid NOT NULL,client_id uuid NOT NULL,command_id uuid NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(project_id,id),UNIQUE(project_id,id,version),UNIQUE(project_id,command_id),
 FOREIGN KEY(project_id,assignment_id,assignment_version) REFERENCES anvil.assignment_versions(project_id,assignment_id,version),
 FOREIGN KEY(project_id,command_id) REFERENCES anvil.commands(project_id,id),FOREIGN KEY(created_by,client_id) REFERENCES anvil.clients(user_id,id)
);
CREATE INDEX context_assignment_recent ON anvil.context_bundles(project_id,assignment_id,assignment_version,assignment_hash,created_at DESC,id DESC);
CREATE TABLE anvil.context_items(
 project_id uuid NOT NULL,bundle_id uuid NOT NULL,bundle_version bigint NOT NULL,item_id text NOT NULL,category text NOT NULL,required boolean NOT NULL CHECK(required),
 source_ref jsonb NOT NULL,source_hash text CHECK(source_hash~'^[0-9a-f]{64}$'),included_state text NOT NULL CHECK(included_state IN('INCLUDED','MISSING','REDACTED','EXCLUDED')),
 reason text NOT NULL,delivery_parts jsonb NOT NULL,issue text,
 PRIMARY KEY(project_id,bundle_id,bundle_version,item_id),FOREIGN KEY(project_id,bundle_id,bundle_version) REFERENCES anvil.context_bundles(project_id,id,version)
);
GRANT SELECT,INSERT ON anvil.context_bundles,anvil.context_items TO anvil_v3_app;
REVOKE UPDATE,DELETE ON anvil.context_bundles,anvil.context_items FROM anvil_v3_app;

CREATE FUNCTION anvil.context_preparation_authorized(pid uuid) RETURNS boolean LANGUAGE sql AS $$
 SELECT EXISTS(SELECT 1 FROM anvil.commands c
 JOIN anvil.authorization_receipts ar ON ar.id=c.authorization_receipt_id AND ar.command_id=c.id AND ar.scope_kind='PROJECT' AND ar.scope_id=c.project_id AND ar.policy_ref=c.policy_ref
 JOIN anvil.project_control pc ON pc.project_id=c.project_id AND pc.actor_id=c.actor_id AND pc.client_id=c.client_id AND pc.generation=c.control_generation AND pc.revoked_at IS NULL
 JOIN anvil.project_members m ON m.project_id=c.project_id AND m.user_id=c.actor_id AND m.participation='OWNER' AND m.revoked_at IS NULL
 JOIN anvil.projects p ON p.id=c.project_id AND p.archived_at IS NULL
 JOIN anvil.permission_policies pp ON pp.project_id=c.project_id AND pp.id::text=c.policy_ref->>'id' AND pp.head_version::text=c.policy_ref->>'version'
 JOIN anvil.permission_policy_versions pv ON pv.project_id=pp.project_id AND pv.policy_id=pp.id AND pv.version=pp.head_version AND pv.content_hash=c.policy_ref->>'contentHash'
 WHERE c.id::text=current_setting('anvil.command_id',true) AND c.project_id=pid AND c.scope_kind='PROJECT' AND c.scope_id=pid AND c.operation='buildTaskContext' AND c.state='APPLIED'
 AND c.actor_id::text=current_setting('anvil.actor_id',true) AND c.client_id::text=current_setting('anvil.client_id',true)
 AND c.approval_consumption_id IS NULL AND c.payload_ref IS NULL AND ar.approval_decision_ref IS NULL
 AND ar.subject_ref=jsonb_build_object('kind','HUMAN','userId',c.actor_id,'clientId',c.client_id)
 AND EXISTS(SELECT 1 FROM anvil.audit_events a WHERE a.project_id=pid AND a.command_id=c.id AND a.operation_id=c.operation_id AND a.outcome='APPLIED' AND a.source_kind='HUMAN_COMMAND' AND a.scope_digest=ar.scope_digest)
 AND EXISTS(SELECT 1 FROM anvil.auth_sessions s JOIN anvil.users u ON u.id=s.user_id JOIN anvil.clients cl ON cl.id=s.client_id AND cl.user_id=s.user_id
  WHERE s.user_id=c.actor_id AND s.client_id=c.client_id AND s.revoked_at IS NULL AND u.status='ACTIVE' AND u.revoked_at IS NULL AND cl.revoked_at IS NULL
  AND s.credential_generation=u.credential_generation AND s.idle_expires_at>clock_timestamp() AND s.absolute_expires_at>clock_timestamp())
 AND EXISTS(SELECT 1 FROM jsonb_array_elements(pv.rules_json) rule WHERE rule->'subjectRef'=jsonb_build_object('kind','HUMAN','userId',c.actor_id)
  AND rule->'targetScopes'=jsonb_build_array(jsonb_build_object('kind','PROJECT','projectId',pid)) AND (rule->'operations') ? 'buildTaskContext' AND rule->>'disposition'='AUTO' AND (rule->>'expiresAt')::timestamptz>clock_timestamp())
 AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(pv.rules_json) rule WHERE rule->'subjectRef'=jsonb_build_object('kind','HUMAN','userId',c.actor_id)
  AND rule->'targetScopes'=jsonb_build_array(jsonb_build_object('kind','PROJECT','projectId',pid)) AND (rule->'operations') ? 'buildTaskContext' AND rule->>'disposition' IN('DENY','REQUIRE_APPROVAL') AND (rule->>'expiresAt')::timestamptz>clock_timestamp())
 );
$$;

CREATE FUNCTION anvil.context_metadata_reason(value text) RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
 SELECT anvil.assignment_content_reason(value) AND value !~* '-----BEGIN ([A-Z0-9]+ )?PRIVATE KEY-----|\mBearer[[:space:]]+[A-Za-z0-9_.~+/-]{16,}|\m(password|passwd|api[_-]?key|access[_-]?token|token|secret)[[:space:]]*[:=][[:space:]]*["'']?[^[:space:]"'']{4,}';
$$;

CREATE FUNCTION anvil.context_positive_integer(value jsonb,maximum bigint) RETURNS boolean LANGUAGE plpgsql IMMUTABLE AS $$
BEGIN
 IF jsonb_typeof(value) IS DISTINCT FROM 'number' OR maximum IS NULL OR maximum<1 THEN RETURN false;END IF;
 IF (value#>>'{}') !~ '^[1-9][0-9]*$' THEN RETURN false;END IF;
 RETURN (value#>>'{}')::numeric<=maximum;
EXCEPTION WHEN OTHERS THEN RETURN false;
END;
$$;

-- 원문 바이트는 보호 보관소/서버 reader가 확인한다. 이 함수는 DB 참조·현재 상태와 평문 없는 metadata를 검사하며 전달/이해를 증명하지 않는다.
CREATE FUNCTION anvil.context_preparation_manifest_valid(pid uuid,s jsonb) RETURNS boolean LANGUAGE plpgsql STABLE AS $$
DECLARE p jsonb;slot jsonb;choice jsonb;item jsonb;binding jsonb;part jsonb;ref jsonb;body jsonb;current_const jsonb;
 codes text[]=ARRAY['PURPOSE_REASON','RULES_SCOPE','LATEST_INSTRUCTIONS','DECISIONS_REASON','CURRENT_POSITION','ACTUAL_GAPS','NEXT_ACTION'];
 states text[]=ARRAY['NOT_SELECTED','CURRENT_READ','PROPOSED','CONFIRMED','EXCLUDED','SUPERSEDED','CURRENT_CONFIRMATION_REVIEW_REQUIRED','ARTIFACT_QUARANTINED','KNOWLEDGE_SENSITIVE_CONTENT_SUSPECTED','SUPERSEDED_INSTRUCTION','STORED_NOT_EFFECTIVENESS_APPROVED'];
 issues text[]=ARRAY['SOURCE_MISSING','SOURCE_REDACTED','SOURCE_EXCLUDED','SENSITIVE_CONTENT_SUSPECTED','CHARACTER_EXCEEDS_PART_LIMIT','PART_LIMIT_EXCEEDED','SOURCE_EMPTY'];
 slot_i int;source_i int;item_i int=0;part_i int=0;local_i int;offset_bytes bigint;total_bytes bigint=0;selected_count int=0;expected_id text;eligible boolean;k text;
BEGIN
 p=s->'preparationInput';
 IF jsonb_typeof(s) IS DISTINCT FROM 'object' OR (SELECT count(*) FROM jsonb_object_keys(s))<>22 OR s->>'projectId' IS DISTINCT FROM pid::text OR s->'version' IS DISTINCT FROM '1'::jsonb
  OR s-ARRAY['id','projectId','version','preparationInput','assignmentRef','baselineRefs','purposeRef','constitutionRef','latestInstructionRefs','currentPositionRef','items','sourceBindings','missingRequired','excluded','deliveryPlan','budgetRef','unverified','sourceAuthorizationVerified','budgetVerified','ready','executionAuthorized','dispatchPerformed']<>'{}'::jsonb
  OR s->'sourceAuthorizationVerified' IS DISTINCT FROM 'false'::jsonb OR s->'budgetVerified' IS DISTINCT FROM 'false'::jsonb OR s->'ready' IS DISTINCT FROM 'false'::jsonb OR s->'executionAuthorized' IS DISTINCT FROM 'false'::jsonb OR s->'dispatchPerformed' IS DISTINCT FROM 'false'::jsonb
  OR jsonb_typeof(p) IS DISTINCT FROM 'object' OR (SELECT count(*) FROM jsonb_object_keys(p))<>5 OR p-ARRAY['assignmentRef','budgetRef','slots','limits','reason']<>'{}'::jsonb
  OR p->'assignmentRef' IS DISTINCT FROM s->'assignmentRef' OR p->'budgetRef' IS DISTINCT FROM s->'budgetRef' OR NOT anvil.context_metadata_reason(p->>'reason')
  OR jsonb_typeof(p->'slots') IS DISTINCT FROM 'array' OR jsonb_array_length(p->'slots')<>7
  OR jsonb_typeof(p->'limits') IS DISTINCT FROM 'object' OR (SELECT count(*) FROM jsonb_object_keys(p->'limits'))<>2
  OR (p->'limits')-ARRAY['maxPartBytes','maxParts']<>'{}'::jsonb OR anvil.context_positive_integer(p->'limits'->'maxPartBytes',2097152) IS DISTINCT FROM true OR anvil.context_positive_integer(p->'limits'->'maxParts',200) IS DISTINCT FROM true
  OR jsonb_typeof(s->'items') IS DISTINCT FROM 'array' OR jsonb_typeof(s->'sourceBindings') IS DISTINCT FROM 'array' OR jsonb_array_length(s->'items')<>jsonb_array_length(s->'sourceBindings') OR jsonb_array_length(s->'items') NOT BETWEEN 7 AND 207
  OR jsonb_typeof(s->'deliveryPlan') IS DISTINCT FROM 'object' OR (SELECT count(*) FROM jsonb_object_keys(s->'deliveryPlan'))<>4
  OR (s->'deliveryPlan')-ARRAY['state','parts','multipartRequired','limits']<>'{}'::jsonb OR s->'deliveryPlan'->>'state' IS DISTINCT FROM 'PREPARATION_ONLY' OR s->'deliveryPlan'->'limits' IS DISTINCT FROM p->'limits'
  OR jsonb_typeof(s->'deliveryPlan'->'parts') IS DISTINCT FROM 'array' OR jsonb_array_length(s->'deliveryPlan'->'parts')>(p->'limits'->>'maxParts')::int
  OR octet_length(anvil.assignment_draft_canonical(s))>2097152 THEN RETURN false;END IF;
 SELECT jsonb_build_object('id',pid,'version',application_version,'contentHash',application_hash) INTO current_const FROM anvil.project_constitutions WHERE project_id=pid;
 IF s->'constitutionRef' IS DISTINCT FROM COALESCE(current_const,'null'::jsonb) THEN RETURN false;END IF;
 FOR slot_i IN 0..6 LOOP
  slot=p->'slots'->slot_i;
  IF jsonb_typeof(slot) IS DISTINCT FROM 'object' OR (SELECT count(*) FROM jsonb_object_keys(slot))<>3 OR slot-ARRAY['code','sources','reason']<>'{}'::jsonb OR slot->>'code' IS DISTINCT FROM codes[slot_i+1]
   OR NOT anvil.context_metadata_reason(slot->>'reason') OR jsonb_typeof(slot->'sources') IS DISTINCT FROM 'array'
   OR (SELECT count(DISTINCT value) FROM jsonb_array_elements(slot->'sources'))<>jsonb_array_length(slot->'sources') OR slot_i IN(0,1) AND jsonb_array_length(slot->'sources')>1 THEN RETURN false;END IF;
  selected_count=selected_count+jsonb_array_length(slot->'sources');IF selected_count>200 THEN RETURN false;END IF;
  FOR source_i IN 0..greatest(0,jsonb_array_length(slot->'sources')-1) LOOP
   choice=CASE WHEN jsonb_array_length(slot->'sources')=0 THEN 'null'::jsonb ELSE slot->'sources'->source_i END;
   expected_id=codes[slot_i+1]||CASE WHEN choice='null'::jsonb THEN '' ELSE '_'||(source_i+1)::text END;
   item=s->'items'->item_i;binding=s->'sourceBindings'->item_i;body=NULL;eligible=false;
   ref=CASE WHEN choice='null'::jsonb THEN 'null'::jsonb WHEN choice->>'kind'='USER_INSTRUCTION' THEN choice->'messageRef' ELSE choice->'versionRef' END;
   IF item IS NULL OR binding IS NULL OR jsonb_typeof(item) IS DISTINCT FROM 'object' OR (SELECT count(*) FROM jsonb_object_keys(item))<>9 OR item-ARRAY['itemId','category','required','sourceRef','sourceHash','reason','includedState','deliveryParts','issue']<>'{}'::jsonb
    OR item->>'itemId' IS DISTINCT FROM expected_id OR item->>'category' IS DISTINCT FROM codes[slot_i+1] OR item->'required' IS DISTINCT FROM 'true'::jsonb OR item->'sourceRef' IS DISTINCT FROM ref OR item->>'sourceHash' IS DISTINCT FROM ref->>'contentHash'
    OR item->>'reason' IS DISTINCT FROM slot->>'reason' OR item->>'includedState' IS NULL OR item->>'includedState' NOT IN('INCLUDED','MISSING','REDACTED','EXCLUDED') OR jsonb_typeof(item->'deliveryParts') IS DISTINCT FROM 'array'
    OR jsonb_typeof(binding) IS DISTINCT FROM 'object' OR (SELECT count(*) FROM jsonb_object_keys(binding))<>4 OR binding-ARRAY['itemId','selection','bodyRef','sourceState']<>'{}'::jsonb
    OR binding->>'itemId' IS DISTINCT FROM expected_id OR binding->'selection' IS DISTINCT FROM choice OR binding->>'sourceState' IS NULL OR NOT(binding->>'sourceState'=ANY(states))
    OR item->'issue' IS DISTINCT FROM 'null'::jsonb AND (item->>'issue' IS NULL OR NOT(item->>'issue'=ANY(issues))) THEN RETURN false;END IF;
   IF choice='null'::jsonb THEN
    IF item->>'includedState'<>'MISSING' OR binding->'bodyRef' IS DISTINCT FROM 'null'::jsonb OR binding->>'sourceState'<>'NOT_SELECTED' THEN RETURN false;END IF;
   ELSE
    IF jsonb_typeof(ref) IS DISTINCT FROM 'object' OR (SELECT count(*) FROM jsonb_object_keys(ref))<>3 OR ref->>'contentHash' IS NULL OR ref->>'contentHash' !~ '^[0-9a-f]{64}$'
     OR choice->>'kind'='USER_INSTRUCTION' AND ref-ARRAY['kind','id','contentHash']<>'{}'::jsonb
     OR choice->>'kind'<>'USER_INSTRUCTION' AND (ref-ARRAY['id','version','contentHash']<>'{}'::jsonb OR jsonb_typeof(ref->'version') IS DISTINCT FROM 'number' OR ref->>'version' !~ '^[1-9][0-9]*$') THEN RETURN false;END IF;
    IF choice->>'kind'='KNOWLEDGE_VERSION' THEN
     IF slot_i=2 OR (SELECT count(*) FROM jsonb_object_keys(choice))<>2 OR choice-ARRAY['kind','versionRef']<>'{}'::jsonb THEN RETURN false;END IF;
     SELECT v.entry_json->'contentRef',e.kind,e.head_version=v.version
      AND EXISTS(SELECT 1 FROM anvil.knowledge_events ev WHERE ev.project_id=pid AND ev.entry_id=v.entry_id AND ev.version=v.version AND ev.kind='CONFIRMED')
      AND NOT EXISTS(SELECT 1 FROM anvil.knowledge_events ev WHERE ev.project_id=pid AND ev.entry_id=v.entry_id AND ev.version=v.version AND ev.kind='EXCLUDED')
      AND EXISTS(SELECT 1 FROM anvil.knowledge_events ev JOIN anvil.content_reviews r ON r.project_id=ev.project_id AND r.id=(SELECT r2.id FROM anvil.content_reviews r2 JOIN anvil.audit_events a ON a.project_id=r2.project_id AND a.command_id=r2.command_id WHERE r2.scope_kind='PROJECT' AND r2.project_id=pid AND r2.target_kind='KNOWLEDGE' AND r2.target_id=v.entry_id AND r2.target_version=v.version AND r2.target_hash=v.content_hash AND r2.criteria_version=1 AND r2.source_kind='HUMAN_REVIEW' ORDER BY a.server_sequence DESC LIMIT 1)
       WHERE ev.project_id=pid AND ev.entry_id=v.entry_id AND ev.version=v.version AND ev.kind='CONFIRMED' AND r.outcome='ACCEPTED' AND ev.review_refs @> jsonb_build_array(jsonb_build_object('id',r.id,'targetRef',jsonb_build_object('id',v.entry_id,'version',v.version,'contentHash',v.content_hash),'criteriaVersion',1,'outcome','ACCEPTED')))
      INTO body,k,eligible FROM anvil.knowledge_versions v JOIN anvil.knowledge_entries e ON e.project_id=v.project_id AND e.id=v.entry_id WHERE v.project_id=pid AND v.entry_id::text=ref->>'id' AND v.version=(ref->>'version')::bigint AND v.content_hash=ref->>'contentHash';
     IF body IS NULL OR slot_i=0 AND k<>'PURPOSE' OR slot_i=1 AND k<>'CONSTITUTION' OR slot_i=3 AND k<>'DECISION' THEN RETURN false;END IF;
     IF slot_i=1 AND NOT EXISTS(SELECT 1 FROM anvil.project_constitutions pc WHERE pc.project_id=pid AND pc.entry_id::text=ref->>'id' AND pc.version=(ref->>'version')::bigint) THEN RETURN false;END IF;
    ELSIF choice->>'kind'='DOCUMENT_VERSION' THEN
     IF slot_i NOT IN(4,5,6) OR (SELECT count(*) FROM jsonb_object_keys(choice))<>2 OR choice-ARRAY['kind','versionRef']<>'{}'::jsonb THEN RETURN false;END IF;
     SELECT v.content_json->'body',d.confirmed_version=v.version AND (SELECT r.outcome FROM anvil.content_reviews r JOIN anvil.audit_events a ON a.project_id=r.project_id AND a.command_id=r.command_id WHERE r.scope_kind='PROJECT' AND r.project_id=pid AND r.target_kind='DOCUMENT' AND r.target_id=v.document_id AND r.target_version=v.version AND r.target_hash=v.content_hash AND r.criteria_version=1 AND r.source_kind='HUMAN_REVIEW' ORDER BY a.server_sequence DESC LIMIT 1)='ACCEPTED'
      INTO body,eligible FROM anvil.document_versions v JOIN anvil.documents d ON d.project_id=v.project_id AND d.id=v.document_id WHERE v.project_id=pid AND v.document_id::text=ref->>'id' AND v.version=(ref->>'version')::bigint AND v.content_hash=ref->>'contentHash';
    ELSIF choice->>'kind'='USER_INSTRUCTION' THEN
     IF slot_i<>2 OR (SELECT count(*) FROM jsonb_object_keys(choice))<>3 OR choice-ARRAY['kind','conversationId','messageRef']<>'{}'::jsonb OR ref->>'kind' IS DISTINCT FROM 'CONVERSATION' THEN RETURN false;END IF;
     SELECT m.message_json->'message'->'bodyRef',NOT EXISTS(SELECT 1 FROM anvil.conversation_messages newer WHERE newer.project_id=pid AND newer.conversation_id=m.conversation_id AND newer.supersedes_instruction_id=m.id)
      INTO body,eligible FROM anvil.conversation_messages m WHERE m.project_id=pid AND m.id::text=ref->>'id' AND m.conversation_id::text=choice->>'conversationId' AND m.kind='USER_INSTRUCTION' AND m.author_ref->>'kind'='HUMAN' AND m.content_hash=ref->>'contentHash';
    ELSE RETURN false;END IF;
    IF body IS NULL OR binding->'bodyRef' IS DISTINCT FROM 'null'::jsonb AND binding->'bodyRef' IS DISTINCT FROM body THEN RETURN false;END IF;
   END IF;
   offset_bytes=0;local_i=0;
   IF item->>'includedState'='INCLUDED' THEN
    IF eligible IS DISTINCT FROM true OR binding->'bodyRef' IS DISTINCT FROM body OR item->'issue' IS DISTINCT FROM 'null'::jsonb OR jsonb_array_length(item->'deliveryParts')=0
     OR NOT EXISTS(SELECT 1 FROM anvil.artifacts a WHERE a.project_id=pid AND a.id::text=body->>'artifactId' AND a.state='READY' AND a.bytes=(body->>'bytes')::bigint AND a.content_hash=body->>'contentHash' AND a.media_type=body->>'mediaType') THEN RETURN false;END IF;
    FOR part IN SELECT value FROM jsonb_array_elements(s->'deliveryPlan'->'parts') WITH ORDINALITY part_row(value,n) WHERE n>part_i AND n<=part_i+jsonb_array_length(item->'deliveryParts') ORDER BY n LOOP
     IF jsonb_typeof(part) IS DISTINCT FROM 'object' OR (SELECT count(*) FROM jsonb_object_keys(part))<>8 OR part-ARRAY['partId','itemId','sourceRef','bodyRef','order','byteOffset','utf8Bytes','contentHash']<>'{}'::jsonb
      OR part->>'partId' IS DISTINCT FROM expected_id||':'||(local_i+1)::text OR item->'deliveryParts'->>local_i IS DISTINCT FROM part->>'partId' OR part->>'itemId' IS DISTINCT FROM expected_id
      OR part->'sourceRef' IS DISTINCT FROM ref OR part->'bodyRef' IS DISTINCT FROM body OR part->'order' IS DISTINCT FROM to_jsonb(part_i+local_i+1) OR part->'byteOffset' IS DISTINCT FROM to_jsonb(offset_bytes)
      OR part->>'contentHash' IS NULL OR part->>'contentHash' !~ '^[0-9a-f]{64}$' OR anvil.context_positive_integer(part->'utf8Bytes',(p->'limits'->>'maxPartBytes')::bigint) IS DISTINCT FROM true THEN RETURN false;END IF;
     offset_bytes=offset_bytes+(part->>'utf8Bytes')::bigint;local_i=local_i+1;
    END LOOP;
    IF local_i<>jsonb_array_length(item->'deliveryParts') OR offset_bytes<>(body->>'bytes')::bigint THEN RETURN false;END IF;
    part_i=part_i+local_i;total_bytes=total_bytes+offset_bytes;IF total_bytes>2097152 THEN RETURN false;END IF;
   ELSIF jsonb_array_length(item->'deliveryParts')<>0 THEN RETURN false;END IF;
   item_i=item_i+1;
  END LOOP;
 END LOOP;
 IF item_i<>jsonb_array_length(s->'items') OR part_i<>jsonb_array_length(s->'deliveryPlan'->'parts') OR s->'deliveryPlan'->'multipartRequired' IS DISTINCT FROM to_jsonb(part_i>1)
  OR s->'purposeRef' IS DISTINCT FROM COALESCE(p->'slots'->0->'sources'->0->'versionRef','null'::jsonb)
  OR s->'latestInstructionRefs' IS DISTINCT FROM (SELECT COALESCE(jsonb_agg(value->'messageRef' ORDER BY n),'[]'::jsonb) FROM jsonb_array_elements(p->'slots'->2->'sources') WITH ORDINALITY v(value,n))
  OR s->'currentPositionRef' IS DISTINCT FROM (CASE WHEN jsonb_array_length(p->'slots'->4->'sources')=1 THEN p->'slots'->4->'sources'->0->'versionRef' ELSE 'null'::jsonb END)
  OR s->'missingRequired' IS DISTINCT FROM (SELECT COALESCE(jsonb_agg(value->'itemId' ORDER BY n),'[]'::jsonb) FROM jsonb_array_elements(s->'items') WITH ORDINALITY v(value,n) WHERE value->>'includedState'<>'INCLUDED')
  OR s->'excluded' IS DISTINCT FROM (SELECT COALESCE(jsonb_agg(value->'itemId' ORDER BY n),'[]'::jsonb) FROM jsonb_array_elements(s->'items') WITH ORDINALITY v(value,n) WHERE value->>'includedState'='EXCLUDED')
  OR s->'unverified' IS DISTINCT FROM ('["CONTEXT_SELECTION_REVIEW_REQUIRED","INSTRUCTION_EFFECTIVENESS_UNVERIFIED","CURRENT_STATE_MEANING_UNVERIFIED","BUDGET_UNVERIFIED","DELIVERY_NOT_CONNECTED","UNDERSTANDING_NOT_REVIEWED","EXECUTION_NOT_CONNECTED"]'::jsonb||(CASE WHEN jsonb_array_length(p->'slots'->4->'sources')>1 THEN '["CURRENT_POSITION_AMBIGUOUS"]'::jsonb ELSE '[]'::jsonb END)) THEN RETURN false;END IF;
 RETURN true;
EXCEPTION WHEN OTHERS THEN RETURN false;
END;
$$;

CREATE FUNCTION anvil.guard_context_preparation() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE cmd anvil.commands%ROWTYPE;assignment anvil.assignment_versions%ROWTYPE;draft anvil.assignment_draft_versions%ROWTYPE;bundle anvil.context_bundles%ROWTYPE;s jsonb;ref jsonb;expected jsonb;
BEGIN
 IF current_user<>'anvil_v3_app' THEN IF TG_OP='DELETE' THEN RETURN OLD;ELSE RETURN NEW;END IF;END IF;
 IF TG_OP<>'INSERT' THEN RAISE EXCEPTION 'CONTEXT_HISTORY_IMMUTABLE' USING ERRCODE='42501';END IF;
 PERFORM id FROM anvil.projects WHERE id=NEW.project_id FOR UPDATE;
 SELECT * INTO cmd FROM anvil.commands WHERE id::text=current_setting('anvil.command_id',true);
 IF cmd.id IS NULL OR NOT anvil.context_preparation_authorized(NEW.project_id) THEN RAISE EXCEPTION 'CONTEXT_CURRENT_AUTHORIZATION_REQUIRED' USING ERRCODE='42501';END IF;
 IF TG_TABLE_NAME='context_items' THEN
  SELECT * INTO bundle FROM anvil.context_bundles WHERE project_id=NEW.project_id AND id=NEW.bundle_id AND version=NEW.bundle_version;
  SELECT value INTO expected FROM jsonb_array_elements(bundle.manifest_json->'items') WHERE value->>'itemId'=NEW.item_id;
  IF bundle.id IS NULL OR bundle.command_id IS DISTINCT FROM cmd.id OR expected IS NULL OR expected IS DISTINCT FROM jsonb_build_object('itemId',NEW.item_id,'category',NEW.category,'required',NEW.required,'sourceRef',NEW.source_ref,'sourceHash',NEW.source_hash,'includedState',NEW.included_state,'reason',NEW.reason,'deliveryParts',NEW.delivery_parts,'issue',NEW.issue) THEN RAISE EXCEPTION 'CONTEXT_ITEM_MANIFEST_REQUIRED' USING ERRCODE='42501';END IF;
 ELSE
  s=NEW.manifest_json;ref=jsonb_build_object('id',NEW.id,'version',1,'contentHash',NEW.content_hash);
  SELECT * INTO assignment FROM anvil.assignment_versions WHERE project_id=NEW.project_id AND assignment_id=NEW.assignment_id AND version=NEW.assignment_version;
  SELECT * INTO draft FROM anvil.assignment_draft_versions WHERE project_id=NEW.project_id AND draft_id=NEW.assignment_id AND version=NEW.assignment_version;
  IF assignment.assignment_id IS NULL OR assignment.content_hash IS DISTINCT FROM NEW.assignment_hash OR assignment.version_json->'contentConfirmed' IS DISTINCT FROM 'true'::jsonb
   OR (SELECT head_version FROM anvil.assignment_drafts WHERE project_id=NEW.project_id AND id=NEW.assignment_id) IS DISTINCT FROM NEW.assignment_version OR NOT anvil.assignment_draft_basis_current(NEW.project_id,draft.version_json->'basis')
   OR NEW.command_id IS DISTINCT FROM cmd.id OR NEW.created_by IS DISTINCT FROM cmd.actor_id OR NEW.client_id IS DISTINCT FROM cmd.client_id OR cmd.expected_version<>0
   OR NEW.assignment_ref IS DISTINCT FROM jsonb_build_object('id',NEW.assignment_id,'version',NEW.assignment_version,'contentHash',NEW.assignment_hash)
   OR s->>'id' IS DISTINCT FROM NEW.id::text OR s->'assignmentRef' IS DISTINCT FROM NEW.assignment_ref OR s->'baselineRefs' IS DISTINCT FROM NEW.baseline_refs OR s->'budgetRef' IS DISTINCT FROM NEW.budget_ref
   OR NEW.baseline_refs IS DISTINCT FROM assignment.version_json->'definition'->'baselineRefs' OR NEW.budget_ref IS DISTINCT FROM assignment.version_json->'definition'->'budgetRef'
   OR jsonb_typeof(NEW.request_payload) IS DISTINCT FROM 'object' OR NEW.request_payload-'slots' IS DISTINCT FROM (s->'preparationInput')-'slots'
   OR jsonb_typeof(NEW.request_payload->'slots') IS DISTINCT FROM 'array' OR jsonb_array_length(NEW.request_payload->'slots')<>7
   OR (SELECT jsonb_agg(value ORDER BY value->>'code' COLLATE "C") FROM jsonb_array_elements(NEW.request_payload->'slots')) IS DISTINCT FROM (SELECT jsonb_agg(value ORDER BY value->>'code' COLLATE "C") FROM jsonb_array_elements(s->'preparationInput'->'slots'))
   OR NOT anvil.context_preparation_manifest_valid(NEW.project_id,s) OR NEW.content_hash IS DISTINCT FROM encode(sha256(convert_to(anvil.assignment_draft_canonical(s),'UTF8')),'hex')
   OR cmd.result_ref->>'status' IS DISTINCT FROM 'APPLIED' OR cmd.result_ref->>'projectId' IS DISTINCT FROM NEW.project_id::text OR cmd.result_ref->>'targetId' IS DISTINCT FROM NEW.id::text OR cmd.result_ref->'version' IS DISTINCT FROM '1'::jsonb
   OR cmd.result_ref->'data' IS DISTINCT FROM jsonb_build_object('ref',ref,'status','CONTEXT_PREPARED','ready',false,'executionAuthorized',false,'dispatchPerformed',false)
   OR cmd.request_hash IS DISTINCT FROM encode(sha256(convert_to(anvil.assignment_draft_canonical(jsonb_build_object('schemaVersion',1,'projectId',NEW.project_id,'commandId',cmd.command_id,'clientId',cmd.client_id,'controlGeneration',cmd.control_generation,'operation','buildTaskContext','targetId','null'::jsonb,'expectedVersion',0,'baselineRefs','[]'::jsonb,'approvalRef','null'::jsonb,'payload',NEW.request_payload)),'UTF8')),'hex')
   THEN RAISE EXCEPTION 'CONTEXT_EXACT_ASSIGNMENT_MANIFEST_RECEIPT_REQUIRED' USING ERRCODE='42501';END IF;
 END IF;
 RETURN NEW;
END;
$$;
CREATE TRIGGER context_bundle_guard BEFORE INSERT OR UPDATE OR DELETE ON anvil.context_bundles FOR EACH ROW EXECUTE FUNCTION anvil.guard_context_preparation();
CREATE TRIGGER context_item_guard BEFORE INSERT OR UPDATE OR DELETE ON anvil.context_items FOR EACH ROW EXECUTE FUNCTION anvil.guard_context_preparation();
CREATE FUNCTION anvil.context_items_complete() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE expected_count int;actual_count int;
BEGIN
 IF current_user<>'anvil_v3_app' THEN RETURN NULL;END IF;
 SELECT jsonb_array_length(manifest_json->'items') INTO expected_count FROM anvil.context_bundles WHERE project_id=NEW.project_id AND id=NEW.id AND version=NEW.version;
 SELECT count(*) INTO actual_count FROM anvil.context_items WHERE project_id=NEW.project_id AND bundle_id=NEW.id AND bundle_version=NEW.version;
 IF expected_count IS NULL OR actual_count IS DISTINCT FROM expected_count THEN RAISE EXCEPTION 'CONTEXT_ITEMS_INCOMPLETE' USING ERRCODE='42501';END IF;
 RETURN NULL;
END;
$$;
CREATE CONSTRAINT TRIGGER context_items_complete_guard AFTER INSERT ON anvil.context_bundles DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION anvil.context_items_complete();
