-- FN11→FN04 한 연산의 forward 후보. 미적용: 실제 PG 구문/COMMIT/경합 검증 전 사용 불가.
-- 기존 migration 파일·정책·계정·서비스는 변경하지 않는다.
CREATE TABLE anvil.work_plan_approval_candidates (
 project_id uuid NOT NULL,request_id uuid NOT NULL,request_command_id uuid NOT NULL,
 candidate_command_id uuid NOT NULL,payload_hash text NOT NULL CHECK(payload_hash ~ '^[0-9a-f]{64}$'),
 payload_json jsonb NOT NULL CHECK(jsonb_typeof(payload_json)='object'),target_ref jsonb NOT NULL,
 created_by uuid NOT NULL,client_id uuid NOT NULL,control_generation bigint NOT NULL CHECK(control_generation>0),
 policy_ref jsonb NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(project_id,request_id),UNIQUE(project_id,candidate_command_id),UNIQUE(request_command_id),
 FOREIGN KEY(project_id,request_id) REFERENCES anvil.approval_requests(project_id,id) ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED,
 FOREIGN KEY(project_id,request_command_id) REFERENCES anvil.commands(project_id,id) ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED,
 FOREIGN KEY(created_by,client_id) REFERENCES anvil.clients(user_id,id) ON DELETE RESTRICT
);
REVOKE ALL ON anvil.work_plan_approval_candidates FROM anvil_v3_app;
GRANT SELECT,INSERT ON anvil.work_plan_approval_candidates TO anvil_v3_app;

CREATE FUNCTION anvil.work_plan_approval_target_valid(pid uuid,s jsonb) RETURNS boolean LANGUAGE sql AS $$
 SELECT COALESCE(s->>'operation'='saveWorkPlanDraft' AND (
 (s->'targetRef'='null'::jsonb AND s->>'expectedVersion'='0') OR EXISTS(
 SELECT 1 FROM anvil.work_plans w JOIN anvil.work_plan_versions v ON v.project_id=w.project_id AND v.plan_id=w.id AND v.version=w.head_version
 WHERE w.project_id=pid AND s->'targetRef'=jsonb_build_object('id',w.id,'version',v.version,'contentHash',v.content_hash)
 AND s->>'expectedVersion'=v.version::text)),false);
$$;
-- 0033의 기존 대상 검사는 그대로 위임하며 한 연산만 추가한다.
ALTER FUNCTION anvil.connection_candidate_approval_target_valid(uuid,jsonb) RENAME TO connection_candidate_approval_target_before_plan;
CREATE FUNCTION anvil.connection_candidate_approval_target_valid(pid uuid,s jsonb) RETURNS boolean LANGUAGE sql AS $$
 SELECT anvil.connection_candidate_approval_target_before_plan(pid,s) OR anvil.work_plan_approval_target_valid(pid,s);
$$;

CREATE FUNCTION anvil.work_plan_approval_candidate_valid(pid uuid,rid uuid) RETURNS boolean LANGUAGE sql AS $$
 SELECT EXISTS(SELECT 1 FROM anvil.work_plan_approval_candidates b
 JOIN anvil.approval_requests r ON r.project_id=b.project_id AND r.id=b.request_id
 JOIN anvil.commands c ON c.project_id=b.project_id AND c.id=b.request_command_id AND c.id=r.command_id
 JOIN anvil.authorization_receipts ar ON ar.command_id=c.id AND ar.id=c.authorization_receipt_id AND ar.scope_kind='PROJECT' AND ar.scope_id=pid
 WHERE b.project_id=pid AND b.request_id=rid AND r.action_scope_json->>'operation'='saveWorkPlanDraft'
 AND c.scope_kind='PROJECT' AND c.scope_id=pid AND c.operation='requestApproval' AND c.state='APPLIED' AND c.expected_version=0
 AND c.approval_consumption_id IS NULL AND c.payload_ref IS NULL AND ar.approval_decision_ref IS NULL
 AND c.actor_id=b.created_by AND c.client_id=b.client_id AND c.control_generation=b.control_generation
 AND r.created_by=b.created_by AND r.client_id=b.client_id AND r.candidate_command_id=b.candidate_command_id
 AND b.policy_ref=r.policy_ref AND b.policy_ref=c.policy_ref AND b.policy_ref=ar.policy_ref
 AND ar.subject_ref=jsonb_build_object('kind','HUMAN','userId',b.created_by,'clientId',b.client_id)
 AND r.required_decider_ref=jsonb_build_object('kind','HUMAN','userId',b.created_by)
 AND b.target_ref=r.action_scope_json->'targetRef' AND b.payload_hash=r.action_scope_json->>'payloadHash'
 AND b.payload_hash=anvil.execution_json_hash(b.payload_json)
 AND anvil.execution_json_shape(b.payload_json,ARRAY['documentRef','designRef','screenReviewRefs','tasks','reason'])
 AND jsonb_typeof(b.payload_json->'tasks')='array' AND jsonb_array_length(b.payload_json->'tasks')<=200
 AND jsonb_typeof(b.payload_json->'screenReviewRefs')='array' AND jsonb_array_length(b.payload_json->'screenReviewRefs')<=200
 AND anvil.result_text_valid(b.payload_json->'reason',20000)
 AND r.action_scope_json->'baselineRefs'='[]'::jsonb AND r.action_scope_json->'sourceScopes'='[]'::jsonb
 AND r.action_scope_json->'environmentRef'='null'::jsonb AND r.action_scope_json->'limitsRef'='null'::jsonb
 AND r.action_scope_json->>'controlGeneration'=b.control_generation::text
 AND r.action_scope_json->'requestedSubjectRef'=jsonb_build_object('kind','HUMAN','userId',b.created_by,'clientId',b.client_id)
 AND r.scope_digest=anvil.execution_json_hash(r.action_scope_json)
 AND c.request_hash=anvil.execution_json_hash(jsonb_build_object('schemaVersion',1,'projectId',pid,'commandId',c.command_id,
 'clientId',b.client_id,'controlGeneration',b.control_generation,'operation','requestApproval','targetId',NULL,'expectedVersion',0,
 'baselineRefs','[]'::jsonb,'approvalRef',NULL,'payload',jsonb_build_object('details',r.details_json,'candidatePayload',b.payload_json)))
 AND c.result_ref->'data'->'request'=r.request_json
 AND c.result_ref->'data'->>'status'='APPROVAL_REQUESTED'
 AND c.result_ref->'data'->'ref'=jsonb_build_object('id',r.id,'version',1,'contentHash',r.content_hash)
 AND r.content_hash=anvil.execution_json_hash(r.request_json-ARRAY['id','version','status','createdAt'])
 AND (SELECT count(*) FROM anvil.audit_events a WHERE a.project_id=pid AND a.command_id=c.id)=1
 AND EXISTS(SELECT 1 FROM anvil.audit_events a WHERE a.project_id=pid AND a.command_id=c.id AND a.operation_id=c.operation_id
 AND a.outcome='APPLIED' AND a.scope_digest=ar.scope_digest AND a.policy_ref=c.policy_ref AND a.target_ref=c.result_ref->'data'->'ref'));
$$;

CREATE FUNCTION anvil.guard_work_plan_approval_candidate() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF current_user<>'anvil_v3_app' THEN RETURN NEW;END IF;
 IF TG_OP<>'INSERT' THEN RAISE EXCEPTION 'WORK_PLAN_APPROVAL_CANDIDATE_IMMUTABLE' USING ERRCODE='42501';END IF;
 IF NEW.request_command_id::text IS DISTINCT FROM current_setting('anvil.command_id',true)
 OR NEW.created_by::text IS DISTINCT FROM current_setting('anvil.actor_id',true)
 OR NEW.client_id::text IS DISTINCT FROM current_setting('anvil.client_id',true)
 THEN RAISE EXCEPTION 'WORK_PLAN_APPROVAL_REQUEST_REQUIRED' USING ERRCODE='42501';END IF;
 RETURN NEW;
END;
$$;
CREATE TRIGGER work_plan_approval_candidate_guard BEFORE INSERT OR UPDATE OR DELETE ON anvil.work_plan_approval_candidates
 FOR EACH ROW EXECUTE FUNCTION anvil.guard_work_plan_approval_candidate();

CREATE FUNCTION anvil.work_plan_approval_sources_valid(pid uuid,p jsonb) RETURNS boolean LANGUAGE sql AS $$
 SELECT EXISTS(SELECT 1 FROM anvil.documents h JOIN anvil.document_versions v ON v.project_id=h.project_id AND v.document_id=h.id AND v.version=h.head_version
 JOIN anvil.form_versions f ON f.definition_id=v.form_definition_id AND f.version=v.form_version AND f.content_hash=v.form_hash
 JOIN anvil.artifacts a ON a.project_id=pid AND a.id=v.body_artifact_id AND a.state='READY'
 WHERE h.project_id=pid AND p->'documentRef'=jsonb_build_object('id',v.document_id,'version',v.version,'contentHash',v.content_hash) AND f.definition_json->>'formCode'='AF04')
 AND EXISTS(SELECT 1 FROM anvil.document_versions v JOIN anvil.form_versions f ON f.definition_id=v.form_definition_id AND f.version=v.form_version AND f.content_hash=v.form_hash
 JOIN anvil.artifacts a ON a.project_id=pid AND a.id=v.body_artifact_id AND a.state='READY'
 WHERE v.project_id=pid AND p->'designRef'=jsonb_build_object('id',v.document_id,'version',v.version,'contentHash',v.content_hash) AND f.definition_json->>'formCode'='AF02')
 AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(p->'tasks') task CROSS JOIN LATERAL jsonb_array_elements((task->'designRefs')||(task->'screenRefs')) link
 WHERE NOT EXISTS(SELECT 1 FROM anvil.design_items d WHERE d.project_id=pid
 AND p->'designRef'=jsonb_build_object('id',d.design_document_id,'version',d.document_version,'contentHash',d.document_hash)
 AND (link->>'kind'='DESIGN_ITEM' AND link->>'id'=d.id::text AND link->'versionRef'=d.item_json->'documentRef'
 AND link->>'localCode'=d.local_code AND link->>'anchor'=d.anchor
 OR link->>'kind'='SCREEN_REGION' AND EXISTS(SELECT 1 FROM anvil.screen_regions s
 JOIN anvil.document_versions v ON v.project_id=s.project_id AND v.document_id=s.source_document_id AND v.version=s.source_version AND v.content_hash=s.source_hash
 JOIN anvil.artifacts a ON a.project_id=pid AND a.id=v.body_artifact_id AND a.state='READY'
 WHERE s.project_id=pid AND s.design_item_id=d.id AND link->>'id'=s.id::text
 AND link->'versionRef'=jsonb_build_object('id',s.source_document_id,'version',s.source_version,'contentHash',s.source_hash)
 AND link->>'localCode'=s.screen_code AND link->>'anchor'=s.anchor))))
 AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(p->'screenReviewRefs') review WHERE
 NOT EXISTS(SELECT 1 FROM jsonb_array_elements(p->'tasks') task CROSS JOIN LATERAL jsonb_array_elements(task->'screenRefs') screen WHERE screen->'versionRef'=review->'targetRef')
 OR NOT EXISTS(SELECT 1 FROM anvil.content_reviews cr WHERE cr.project_id=pid AND cr.scope_kind='PROJECT' AND cr.target_kind='DOCUMENT'
 AND cr.id::text=review->>'id' AND review->'targetRef'=jsonb_build_object('id',cr.target_id,'version',cr.target_version,'contentHash',cr.target_hash)
 AND cr.criteria_version=1 AND cr.outcome='ACCEPTED' AND review->>'criteriaVersion'='1' AND review->>'outcome'='ACCEPTED'))
 AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(p->'screenReviewRefs') review GROUP BY review->'targetRef' HAVING count(*)>1);
$$;
CREATE FUNCTION anvil.lock_work_plan_approval_basis(pid uuid,p jsonb) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
 PERFORM project_id FROM anvil.project_control WHERE project_id=pid FOR UPDATE;
 PERFORM id FROM anvil.permission_policies WHERE project_id=pid FOR SHARE;
 PERFORM d.id FROM anvil.documents d JOIN anvil.document_versions v ON v.project_id=d.project_id AND v.document_id=d.id
 JOIN anvil.artifacts a ON a.project_id=v.project_id AND a.id=v.body_artifact_id
 WHERE d.project_id=pid AND jsonb_build_object('id',v.document_id,'version',v.version,'contentHash',v.content_hash) IN(
 SELECT p->'documentRef' UNION SELECT p->'designRef' UNION
 SELECT link->'versionRef' FROM jsonb_array_elements(p->'tasks') task CROSS JOIN LATERAL jsonb_array_elements(task->'screenRefs') link)
 ORDER BY d.id,v.version FOR SHARE OF d,v,a;
END;
$$;

-- 승인 소진 INSERT 전(APPROVED)과 계획 mutation 후(CONSUMED)를 구분한다.
CREATE FUNCTION anvil.work_plan_approval_execution_valid(pid uuid,cid uuid,did uuid,consumed boolean) RETURNS boolean LANGUAGE sql AS $$
 SELECT EXISTS(SELECT 1 FROM anvil.commands c
 JOIN anvil.authorization_receipts ar ON ar.id=c.authorization_receipt_id AND ar.command_id=c.id AND ar.scope_kind='PROJECT' AND ar.scope_id=pid AND ar.policy_ref=c.policy_ref AND ar.approval_decision_ref=did
 JOIN anvil.approval_decisions d ON d.project_id=pid AND d.id=did AND d.decision='APPROVE' AND d.request_version=1
 JOIN anvil.approval_requests r ON r.project_id=pid AND r.id=d.request_id AND r.scope_digest=d.scope_digest AND r.policy_ref=c.policy_ref
 JOIN anvil.work_plan_approval_candidates b ON b.project_id=pid AND b.request_id=r.id
 JOIN anvil.project_control pc ON pc.project_id=pid AND pc.actor_id=c.actor_id AND pc.client_id=c.client_id AND pc.generation=c.control_generation AND pc.revoked_at IS NULL
 JOIN anvil.project_members m ON m.project_id=pid AND m.user_id=c.actor_id AND m.participation='OWNER' AND m.revoked_at IS NULL
 JOIN anvil.projects p ON p.id=pid AND p.archived_at IS NULL
 JOIN anvil.permission_policies pp ON pp.project_id=pid AND pp.id::text=c.policy_ref->>'id' AND pp.head_version::text=c.policy_ref->>'version'
 JOIN anvil.permission_policy_versions pv ON pv.project_id=pid AND pv.policy_id=pp.id AND pv.version=pp.head_version AND pv.content_hash=c.policy_ref->>'contentHash'
 WHERE c.project_id=pid AND c.id=cid AND c.scope_kind='PROJECT' AND c.scope_id=pid AND c.operation='saveWorkPlanDraft' AND c.state='APPLIED'
 AND c.id::text=current_setting('anvil.command_id',true) AND c.actor_id::text=current_setting('anvil.actor_id',true) AND c.client_id::text=current_setting('anvil.client_id',true)
 AND anvil.work_plan_approval_candidate_valid(pid,r.id)
 AND anvil.work_plan_approval_sources_valid(pid,b.payload_json)
 AND r.status=CASE WHEN consumed THEN 'CONSUMED' ELSE 'APPROVED' END AND r.version=CASE WHEN consumed THEN 3 ELSE 2 END
 AND r.expires_at>clock_timestamp() AND c.approval_consumption_id IS NOT NULL
 AND c.command_id=b.candidate_command_id AND c.actor_id=b.created_by AND c.client_id=b.client_id AND c.control_generation=b.control_generation
 AND d.decided_by=c.actor_id AND d.client_id=c.client_id AND d.control_generation=c.control_generation
 AND d.decision_json->'policyRef'=c.policy_ref AND c.policy_ref=b.policy_ref
 AND c.expected_version=(r.action_scope_json->>'expectedVersion')::bigint
 AND (b.target_ref='null'::jsonb AND c.expected_version=0 OR EXISTS(SELECT 1 FROM anvil.work_plan_versions old
 WHERE old.project_id=pid AND b.target_ref=jsonb_build_object('id',old.plan_id,'version',old.version,'contentHash',old.content_hash)
 AND old.version=c.expected_version AND old.plan_id::text=c.result_ref->>'targetId'))
 AND (consumed OR anvil.work_plan_approval_target_valid(pid,r.action_scope_json))
 AND c.payload_ref=jsonb_build_object('kind','ONE_TIME_APPROVAL_SCOPE','payloadHash',b.payload_hash,'scopeDigest',r.scope_digest)
 AND ar.subject_ref=jsonb_build_object('kind','HUMAN','userId',c.actor_id,'clientId',c.client_id)
 AND c.request_hash=anvil.execution_json_hash(jsonb_build_object('schemaVersion',1,'projectId',pid,'commandId',c.command_id,'clientId',c.client_id,
 'controlGeneration',c.control_generation,'operation','saveWorkPlanDraft','targetId',b.target_ref->'id','expectedVersion',c.expected_version,
 'baselineRefs','[]'::jsonb,'approvalRef',jsonb_build_object('requestId',r.id,'decisionId',d.id,'scopeDigest',r.scope_digest),'payload',b.payload_json))
 AND c.result_ref->'data'->>'status'='WORK_PLAN_DRAFT_SAVED'
 AND c.result_ref->'data'->'ref'=c.result_ref->'data'->'workPlan'->'ref'
 AND c.result_ref->'data'->'ref'->>'id'=c.result_ref->>'targetId'
 AND c.result_ref->'data'->'ref'->>'version'=(c.expected_version+1)::text
 AND c.result_ref->'data'->'workPlan'->>'status'='DRAFT'
 AND (c.result_ref->'data'->'workPlan'-ARRAY['ref','status','dependencies','issues','relationalProjection'])=b.payload_json
 AND (SELECT count(*) FROM anvil.audit_events a WHERE a.project_id=pid AND a.command_id=c.id)=1
 AND EXISTS(SELECT 1 FROM anvil.audit_events a WHERE a.project_id=pid AND a.command_id=c.id AND a.operation_id=c.operation_id AND a.outcome='APPLIED'
 AND a.scope_digest=ar.scope_digest AND a.policy_ref=c.policy_ref AND a.target_ref=c.result_ref->'data'->'ref'
 AND a.approval_ref=jsonb_build_object('requestId',r.id,'decisionId',d.id,'scopeDigest',r.scope_digest))
 AND EXISTS(SELECT 1 FROM anvil.auth_sessions s JOIN anvil.users u ON u.id=s.user_id JOIN anvil.clients cl ON cl.id=s.client_id AND cl.user_id=s.user_id
 WHERE s.user_id=c.actor_id AND s.client_id=c.client_id AND s.revoked_at IS NULL AND u.status='ACTIVE' AND u.revoked_at IS NULL AND cl.revoked_at IS NULL
 AND s.credential_generation=u.credential_generation AND s.idle_expires_at>clock_timestamp() AND s.absolute_expires_at>clock_timestamp())
 AND EXISTS(SELECT 1 FROM jsonb_array_elements(pv.rules_json) rule WHERE rule->'subjectRef'=jsonb_build_object('kind','HUMAN','userId',c.actor_id)
 AND rule->'targetScopes'=jsonb_build_array(jsonb_build_object('kind','PROJECT','projectId',pid)) AND (rule->'operations') ? 'saveWorkPlanDraft'
 AND rule->>'disposition'='REQUIRE_APPROVAL' AND rule->'limitPolicyRef'='null'::jsonb AND (rule->>'expiresAt')::timestamptz>clock_timestamp())
 AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(pv.rules_json) rule WHERE rule->'subjectRef'=jsonb_build_object('kind','HUMAN','userId',c.actor_id)
 AND rule->'targetScopes'=jsonb_build_array(jsonb_build_object('kind','PROJECT','projectId',pid)) AND (rule->'operations') ? 'saveWorkPlanDraft'
 AND rule->>'disposition'='DENY' AND (rule->>'expiresAt')::timestamptz>clock_timestamp()));
$$;
ALTER FUNCTION anvil.one_time_consumption_command_authorized(uuid,uuid,uuid) RENAME TO one_time_consumption_command_before_plan;
CREATE FUNCTION anvil.one_time_consumption_command_authorized(pid uuid,cid uuid,did uuid) RETURNS boolean LANGUAGE sql AS $$
 SELECT CASE WHEN EXISTS(SELECT 1 FROM anvil.commands c JOIN anvil.approval_decisions d ON d.project_id=c.project_id AND d.id=did
 JOIN anvil.approval_requests r ON r.project_id=d.project_id AND r.id=d.request_id WHERE c.project_id=pid AND c.id=cid
 AND (c.operation='saveWorkPlanDraft' OR r.action_scope_json->>'operation'='saveWorkPlanDraft'))
 THEN anvil.work_plan_approval_execution_valid(pid,cid,did,false)
 ELSE anvil.one_time_consumption_command_before_plan(pid,cid,did) END;
$$;
ALTER FUNCTION anvil.work_plan_command_authorized(uuid,uuid,bigint) RENAME TO work_plan_command_before_approval;
CREATE FUNCTION anvil.work_plan_command_authorized(pid uuid,wid uuid,v bigint) RETURNS boolean LANGUAGE sql AS $$
 SELECT anvil.work_plan_command_before_approval(pid,wid,v) AND EXISTS(SELECT 1 FROM anvil.commands c
 WHERE c.project_id=pid AND c.id::text=current_setting('anvil.command_id',true)
 AND (c.approval_consumption_id IS NULL OR EXISTS(SELECT 1 FROM anvil.approval_consumptions ac
 WHERE ac.project_id=pid AND ac.id=c.approval_consumption_id AND ac.command_id=c.id AND anvil.work_plan_approval_execution_valid(pid,c.id,ac.decision_id,true))));
$$;

-- TS analyzePlanDependencies와 같은 순서: 원 업무/START→ACCEPTANCE/원 선행 순서,
-- 없는 업무·자기참조·빈/긴 코드 제외 후 동일 edge 첫 항목만 보존한다.
-- DB UTF8의 4-byte 문자는 JS 문자열에서 surrogate pair 두 단위다.
CREATE FUNCTION anvil.work_plan_utf16_length(value text) RETURNS bigint LANGUAGE sql IMMUTABLE AS $$
 SELECT COALESCE(sum(CASE WHEN octet_length(ch)=4 THEN 2 ELSE 1 END),0)::bigint FROM regexp_split_to_table(value,'') ch;
$$;
CREATE FUNCTION anvil.work_plan_text_present(value text) RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
 SELECT length(btrim(value,(SELECT string_agg(chr(c),'') FROM unnest(ARRAY[9,10,11,12,13,32,160,5760,8192,8193,8194,8195,8196,8197,8198,8199,8200,8201,8202,8232,8233,8239,8287,12288,65279]) c)))>0;
$$;
CREATE FUNCTION anvil.work_plan_approval_dependencies(tasks jsonb) RETURNS jsonb LANGUAGE sql IMMUTABLE AS $$
 WITH cards AS(SELECT task,n FROM jsonb_array_elements(tasks) WITH ORDINALITY t(task,n)),
 raw AS(SELECT task->>'taskCode' task_code,dep#>>'{}' dep_code,phase,p,n,dn FROM cards
 CROSS JOIN LATERAL(VALUES('START',1,task->'startPrerequisites'),('ACCEPTANCE',2,task->'acceptancePrerequisites')) phases(phase,p,items)
 CROSS JOIN LATERAL jsonb_array_elements(items) WITH ORDINALITY e(dep,dn)),
 valid AS(SELECT DISTINCT ON(task_code,dep_code,phase) * FROM raw
 WHERE anvil.work_plan_text_present(dep_code) AND anvil.work_plan_utf16_length(dep_code)<=200 AND task_code<>dep_code AND EXISTS(SELECT 1 FROM cards WHERE task->>'taskCode'=dep_code)
 ORDER BY task_code,dep_code,phase,n,p,dn)
 SELECT COALESCE(jsonb_agg(jsonb_build_object('taskCode',task_code,'dependencyTaskCode',dep_code,'phase',phase) ORDER BY n,p,dn),'[]'::jsonb) FROM valid;
$$;
CREATE FUNCTION anvil.work_plan_approval_structure_invalid(tasks jsonb) RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
 WITH RECURSIVE cards AS(SELECT task FROM jsonb_array_elements(tasks) task),
 edges AS(SELECT edge->>'taskCode' a,edge->>'dependencyTaskCode' b,edge->>'phase' phase FROM jsonb_array_elements(anvil.work_plan_approval_dependencies(tasks)) edge),
 reach(a,b,phase) AS(SELECT a,b,phase FROM edges UNION SELECT r.a,e.b,r.phase FROM reach r JOIN edges e ON e.a=r.b AND e.phase=r.phase)
 SELECT EXISTS(SELECT 1 FROM cards GROUP BY task->>'taskCode' HAVING count(*)>1)
 OR (SELECT COALESCE(sum(jsonb_array_length(task->'startPrerequisites')+jsonb_array_length(task->'acceptancePrerequisites')),0) FROM cards)<>jsonb_array_length(anvil.work_plan_approval_dependencies(tasks))
 OR EXISTS(SELECT 1 FROM reach WHERE a=b);
$$;

-- 원 tasks만으로 결정되는 필수 경고의 코드/위치를 검사한다.
-- 원문 파일 본문의 의미 판정은 이 함수의 증거가 아니며 기존 서버 검사가 맡는다.
CREATE FUNCTION anvil.work_plan_approval_required_issues(tasks jsonb) RETURNS TABLE(code text,location text) LANGUAGE sql IMMUTABLE AS $$
 WITH cards AS(SELECT task,n-1 n FROM jsonb_array_elements(tasks) WITH ORDINALITY c(task,n)),
 raw_edges AS(SELECT task->>'taskCode' a,dep#>>'{}' b,phase,n,p,dn FROM cards
 CROSS JOIN LATERAL(VALUES('START',1,task->'startPrerequisites'),('ACCEPTANCE',2,task->'acceptancePrerequisites')) phases(phase,p,items)
 CROSS JOIN LATERAL jsonb_array_elements(items) WITH ORDINALITY e(dep,dn)),
 edges AS(SELECT *,row_number() OVER(ORDER BY n,p,dn)-1 edge_n,
 row_number() OVER(PARTITION BY a,b,phase ORDER BY n,p,dn) occurrence FROM raw_edges)
 SELECT 'TASKS_MISSING','tasks' WHERE jsonb_array_length(tasks)=0
 UNION ALL SELECT 'DUPLICATE_TASK_CODE','tasks['||n||'].taskCode' FROM cards c WHERE EXISTS(SELECT 1 FROM cards old WHERE old.n<c.n AND old.task->>'taskCode'=c.task->>'taskCode')
 UNION ALL SELECT 'CARD_TEXT_MISSING','tasks['||n||'].'||field FROM cards
 CROSS JOIN LATERAL unnest(ARRAY['title','purpose','ownerRole','rollback','recoveryNotes']) field WHERE NOT anvil.work_plan_text_present(task->>field)
 UNION ALL SELECT 'CARD_LIST_MISSING','tasks['||n||'].'||field FROM cards
 CROSS JOIN LATERAL unnest(ARRAY['inputs','outputs','included','excluded','allowedFileRefs','steps','acceptanceCriteria','evidenceRequirements']) field
 WHERE jsonb_array_length(task->field)=0 OR EXISTS(SELECT 1 FROM jsonb_array_elements_text(task->field) item WHERE NOT anvil.work_plan_text_present(item))
 UNION ALL SELECT 'DESIGN_LINK_MISSING','tasks['||n||'].designRefs' FROM cards WHERE jsonb_array_length(task->'designRefs')=0
 UNION ALL SELECT 'SCREEN_LINK_MISSING','tasks['||n||'].screenRefs' FROM cards WHERE task->>'type'='SCREEN' AND jsonb_array_length(task->'screenRefs')=0
 UNION ALL SELECT 'TEST_COVERAGE_MISSING','tasks['||n||'].testCases' FROM cards
 CROSS JOIN LATERAL unnest(ARRAY['NORMAL','IMPORTANT_FAILURE','DIRECT_IMPACT']) kind
 WHERE NOT EXISTS(SELECT 1 FROM jsonb_array_elements(task->'testCases') tc WHERE tc->>'kind'=kind)
 UNION ALL SELECT 'TEST_CASE_INCOMPLETE','tasks['||n||'].testCases['||(tn-1)||']' FROM cards
 CROSS JOIN LATERAL jsonb_array_elements(task->'testCases') WITH ORDINALITY tests(tc,tn)
 WHERE jsonb_array_length(tc->'steps')=0 OR NOT anvil.work_plan_text_present(tc->>'expected') OR NOT anvil.work_plan_text_present(tc->>'environment')
 OR EXISTS(SELECT 1 FROM jsonb_array_elements_text(tc->'steps') step WHERE NOT anvil.work_plan_text_present(step))
 OR EXISTS(SELECT 1 FROM jsonb_array_elements(task->'testCases') WITH ORDINALITY old(value,ord) WHERE ord<tn AND value->>'id'=tc->>'id')
 UNION ALL SELECT 'DEPENDENCY_INPUT_INVALID','dependencies['||edge_n||']' FROM edges WHERE anvil.work_plan_utf16_length(b)>200 OR NOT anvil.work_plan_text_present(b)
 UNION ALL SELECT 'DEPENDENCY_TASK_NOT_FOUND','dependencies['||edge_n||']' FROM edges WHERE anvil.work_plan_utf16_length(b)<=200 AND anvil.work_plan_text_present(b) AND NOT EXISTS(SELECT 1 FROM cards WHERE task->>'taskCode'=b)
 UNION ALL SELECT 'SELF_DEPENDENCY','dependencies['||edge_n||']' FROM edges WHERE a=b
 UNION ALL SELECT 'DUPLICATE_DEPENDENCY','dependencies['||edge_n||']' FROM edges WHERE occurrence>1 AND a<>b AND anvil.work_plan_utf16_length(b)<=200 AND anvil.work_plan_text_present(b) AND EXISTS(SELECT 1 FROM cards WHERE task->>'taskCode'=b);
$$;

CREATE FUNCTION anvil.check_work_plan_approval_command(pid uuid,cid uuid) RETURNS void LANGUAGE plpgsql AS $$
DECLARE c anvil.commands%ROWTYPE;r anvil.approval_requests%ROWTYPE;b anvil.work_plan_approval_candidates%ROWTYPE;v anvil.work_plan_versions%ROWTYPE;s jsonb;did uuid;
BEGIN
 SELECT * INTO c FROM anvil.commands WHERE project_id=pid AND id=cid;
 IF c.id IS NULL THEN RAISE EXCEPTION 'WORK_PLAN_APPROVAL_COMMAND_MISSING' USING ERRCODE='42501';END IF;
 IF c.operation='requestApproval' THEN
  SELECT * INTO r FROM anvil.approval_requests WHERE project_id=pid AND command_id=cid;
  IF r.action_scope_json->>'operation'='saveWorkPlanDraft' OR c.result_ref->'data'->'request'->'details'->'actionScope'->>'operation'='saveWorkPlanDraft' THEN
   IF r.id IS NULL OR NOT anvil.work_plan_approval_candidate_valid(pid,r.id) THEN RAISE EXCEPTION 'WORK_PLAN_APPROVAL_CANDIDATE_REQUIRED' USING ERRCODE='42501';END IF;
   IF c.id::text=current_setting('anvil.command_id',true) THEN
    SELECT * INTO b FROM anvil.work_plan_approval_candidates WHERE project_id=pid AND request_id=r.id;
    PERFORM anvil.lock_work_plan_approval_basis(pid,b.payload_json);
    IF NOT anvil.work_plan_approval_target_valid(pid,r.action_scope_json) OR NOT anvil.work_plan_approval_sources_valid(pid,b.payload_json)
    THEN RAISE EXCEPTION 'WORK_PLAN_APPROVAL_REQUEST_BASIS_REQUIRED' USING ERRCODE='42501';END IF;
   END IF;
  END IF;
 ELSIF c.operation='decideApproval' THEN
  SELECT rq.* INTO r FROM anvil.approval_decisions d JOIN anvil.approval_requests rq ON rq.project_id=d.project_id AND rq.id=d.request_id WHERE d.project_id=pid AND d.command_id=cid;
  IF r.action_scope_json->>'operation'='saveWorkPlanDraft' THEN
   IF NOT anvil.work_plan_approval_candidate_valid(pid,r.id) THEN RAISE EXCEPTION 'WORK_PLAN_APPROVAL_CANDIDATE_REQUIRED' USING ERRCODE='42501';END IF;
   SELECT * INTO b FROM anvil.work_plan_approval_candidates WHERE project_id=pid AND request_id=r.id;
   IF c.id::text=current_setting('anvil.command_id',true) THEN PERFORM anvil.lock_work_plan_approval_basis(pid,b.payload_json);END IF;
   IF c.id::text=current_setting('anvil.command_id',true) AND (NOT anvil.one_time_decision_command_authorized(pid,cid)
   OR NOT anvil.work_plan_approval_target_valid(pid,r.action_scope_json) OR NOT anvil.work_plan_approval_sources_valid(pid,b.payload_json))
   THEN RAISE EXCEPTION 'WORK_PLAN_APPROVAL_DECISION_BASIS_REQUIRED' USING ERRCODE='42501';END IF;
  END IF;
 ELSIF c.operation='saveWorkPlanDraft' AND c.approval_consumption_id IS NOT NULL THEN
  SELECT d.id INTO did FROM anvil.approval_consumptions ac JOIN anvil.approval_decisions d ON d.project_id=ac.project_id AND d.id=ac.decision_id
  WHERE ac.project_id=pid AND ac.id=c.approval_consumption_id AND ac.command_id=cid;
  SELECT rq.* INTO r FROM anvil.approval_consumptions ac JOIN anvil.approval_decisions d ON d.project_id=ac.project_id AND d.id=ac.decision_id
   JOIN anvil.approval_requests rq ON rq.project_id=d.project_id AND rq.id=d.request_id WHERE ac.project_id=pid AND ac.id=c.approval_consumption_id AND ac.command_id=cid;
  IF did IS NULL OR r.status<>'CONSUMED' OR r.version<>3 OR NOT anvil.work_plan_approval_candidate_valid(pid,r.id)
  THEN RAISE EXCEPTION 'WORK_PLAN_APPROVAL_CONSUMPTION_REQUIRED' USING ERRCODE='42501';END IF;
  SELECT * INTO b FROM anvil.work_plan_approval_candidates WHERE project_id=pid AND request_id=r.id;
  IF c.id::text=current_setting('anvil.command_id',true) THEN PERFORM anvil.lock_work_plan_approval_basis(pid,b.payload_json);END IF;
  SELECT * INTO v FROM anvil.work_plan_versions WHERE project_id=pid AND command_id=cid;
  s=c.result_ref->'data'->'workPlan';
  IF NOT anvil.execution_json_shape(s,ARRAY['ref','status','documentRef','designRef','screenReviewRefs','tasks','dependencies','reason','issues','relationalProjection'])
  OR jsonb_typeof(s->'dependencies') IS DISTINCT FROM 'array' OR jsonb_typeof(s->'issues') IS DISTINCT FROM 'array'
  OR s->>'relationalProjection' NOT IN('STORED','ISSUES_ONLY') OR s->>'status' IS DISTINCT FROM 'DRAFT'
  OR s->'dependencies' IS DISTINCT FROM anvil.work_plan_approval_dependencies(b.payload_json->'tasks')
  OR s->>'relationalProjection' IS DISTINCT FROM CASE WHEN anvil.work_plan_approval_structure_invalid(b.payload_json->'tasks') THEN 'ISSUES_ONLY' ELSE 'STORED' END
  OR EXISTS(SELECT 1 FROM anvil.work_plan_approval_required_issues(b.payload_json->'tasks') required
   WHERE (SELECT count(*) FROM jsonb_array_elements(s->'issues') issue WHERE issue->>'code'=required.code AND issue->>'location'=required.location)
    <(SELECT count(*) FROM anvil.work_plan_approval_required_issues(b.payload_json->'tasks') other WHERE other.code=required.code AND other.location=required.location))
  OR EXISTS(SELECT 1 FROM jsonb_array_elements(s->'issues') issue
   WHERE issue->>'code' IN('TASKS_MISSING','DUPLICATE_TASK_CODE','CARD_TEXT_MISSING','CARD_LIST_MISSING','DESIGN_LINK_MISSING','SCREEN_LINK_MISSING','TEST_COVERAGE_MISSING','TEST_CASE_INCOMPLETE','DEPENDENCY_INPUT_INVALID','DEPENDENCY_TASK_NOT_FOUND','SELF_DEPENDENCY','DUPLICATE_DEPENDENCY')
   AND NOT EXISTS(SELECT 1 FROM anvil.work_plan_approval_required_issues(b.payload_json->'tasks') required WHERE issue->>'code'=required.code AND issue->>'location'=required.location))
  OR v.command_id IS NULL OR v.version<>c.expected_version+1 OR v.plan_id::text IS DISTINCT FROM c.result_ref->>'targetId'
  OR v.version_json IS DISTINCT FROM s OR v.content_hash IS DISTINCT FROM anvil.execution_json_hash(s-ARRAY['ref','status'])
  OR s->'ref' IS DISTINCT FROM jsonb_build_object('id',v.plan_id,'version',v.version,'contentHash',v.content_hash)
  OR (s-ARRAY['ref','status','dependencies','issues','relationalProjection']) IS DISTINCT FROM b.payload_json
  OR c.request_hash IS DISTINCT FROM anvil.execution_json_hash(jsonb_build_object('schemaVersion',1,'projectId',pid,'commandId',c.command_id,'clientId',c.client_id,'controlGeneration',c.control_generation,'operation','saveWorkPlanDraft','targetId',b.target_ref->'id','expectedVersion',c.expected_version,'baselineRefs','[]'::jsonb,'approvalRef',jsonb_build_object('requestId',r.id,'decisionId',did,'scopeDigest',r.scope_digest),'payload',b.payload_json))
  THEN RAISE EXCEPTION 'WORK_PLAN_APPROVAL_EXACT_VERSION_REQUIRED' USING ERRCODE='42501';END IF;
  IF s->>'relationalProjection'='STORED' THEN
   IF (SELECT count(*) FROM anvil.plan_tasks t WHERE t.project_id=pid AND t.plan_id=v.plan_id AND t.plan_version=v.version)<>jsonb_array_length(s->'tasks')
   OR EXISTS(SELECT 1 FROM jsonb_array_elements(s->'tasks') task WHERE NOT EXISTS(SELECT 1 FROM anvil.plan_tasks t WHERE t.project_id=pid AND t.plan_id=v.plan_id AND t.plan_version=v.version AND t.task_code=task->>'taskCode' AND t.card_json=task AND t.card_hash=anvil.execution_json_hash(task)))
   OR (SELECT count(*) FROM anvil.plan_dependencies t WHERE t.project_id=pid AND t.plan_id=v.plan_id AND t.plan_version=v.version)<>jsonb_array_length(s->'dependencies')
   OR EXISTS(SELECT 1 FROM jsonb_array_elements(s->'dependencies') dep WHERE NOT EXISTS(SELECT 1 FROM anvil.plan_dependencies t WHERE t.project_id=pid AND t.plan_id=v.plan_id AND t.plan_version=v.version AND dep=jsonb_build_object('taskCode',t.task_code,'dependencyTaskCode',t.dependency_task_code,'phase',t.phase)))
   THEN RAISE EXCEPTION 'WORK_PLAN_APPROVAL_PROJECTION_REQUIRED' USING ERRCODE='42501';END IF;
  ELSIF s->>'relationalProjection'<>'ISSUES_ONLY' OR EXISTS(SELECT 1 FROM anvil.plan_tasks t WHERE t.project_id=pid AND t.plan_id=v.plan_id AND t.plan_version=v.version)
   OR EXISTS(SELECT 1 FROM anvil.plan_dependencies t WHERE t.project_id=pid AND t.plan_id=v.plan_id AND t.plan_version=v.version)
   THEN RAISE EXCEPTION 'WORK_PLAN_APPROVAL_PROJECTION_INVALID' USING ERRCODE='42501';
  END IF;
  -- 그 transaction의 현재 명령만 현재 head/권한과 대조한다. 후속 합법 개정은 과거 version을 무효화하지 않는다.
  IF c.id::text=current_setting('anvil.command_id',true) AND (
   NOT anvil.work_plan_approval_execution_valid(pid,cid,did,true) OR NOT EXISTS(SELECT 1 FROM anvil.work_plans w WHERE w.project_id=pid AND w.id=v.plan_id AND w.head_version=v.version))
   THEN RAISE EXCEPTION 'WORK_PLAN_APPROVAL_FINAL_CURRENT_REQUIRED' USING ERRCODE='42501';END IF;
 END IF;
END;
$$;

CREATE FUNCTION anvil.work_plan_approval_complete() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE pid uuid;cid uuid;current_cid uuid;
BEGIN
 IF current_user<>'anvil_v3_app' THEN RETURN NEW;END IF;
 IF TG_TABLE_NAME='commands' THEN
  IF NEW.scope_kind<>'PROJECT' THEN RETURN NEW;END IF;
 END IF;
 IF TG_TABLE_NAME='authorization_receipts' THEN
  IF NEW.scope_kind<>'PROJECT' THEN RETURN NEW;END IF;pid=NEW.scope_id;cid=NEW.command_id;
 ELSE pid=NEW.project_id;
  IF TG_TABLE_NAME='commands' THEN cid=NEW.id;
  ELSIF TG_TABLE_NAME='work_plan_approval_candidates' THEN cid=NEW.request_command_id;
  ELSIF TG_TABLE_NAME='work_plans' THEN SELECT command_id INTO cid FROM anvil.work_plan_versions WHERE project_id=pid AND plan_id=NEW.id AND version=NEW.head_version;
  ELSIF TG_TABLE_NAME IN('plan_tasks','plan_dependencies') THEN SELECT command_id INTO cid FROM anvil.work_plan_versions WHERE project_id=pid AND plan_id=NEW.plan_id AND version=NEW.plan_version;
  ELSE cid=NEW.command_id;END IF;
 END IF;
 IF cid IS NOT NULL THEN PERFORM anvil.check_work_plan_approval_command(pid,cid);END IF;
 current_cid=NULLIF(current_setting('anvil.command_id',true),'')::uuid;
 IF current_cid IS NOT NULL AND current_cid IS DISTINCT FROM cid AND EXISTS(SELECT 1 FROM anvil.commands WHERE project_id=pid AND id=current_cid)
 THEN PERFORM anvil.check_work_plan_approval_command(pid,current_cid);END IF;
 RETURN NEW;
END;
$$;
CREATE CONSTRAINT TRIGGER work_plan_candidate_complete AFTER INSERT ON anvil.work_plan_approval_candidates DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION anvil.work_plan_approval_complete();
CREATE CONSTRAINT TRIGGER work_plan_request_complete AFTER INSERT OR UPDATE ON anvil.approval_requests DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION anvil.work_plan_approval_complete();
CREATE CONSTRAINT TRIGGER work_plan_command_complete AFTER INSERT OR UPDATE ON anvil.commands DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION anvil.work_plan_approval_complete();
CREATE CONSTRAINT TRIGGER work_plan_receipt_complete AFTER INSERT ON anvil.authorization_receipts DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION anvil.work_plan_approval_complete();
CREATE CONSTRAINT TRIGGER work_plan_consumption_complete AFTER INSERT ON anvil.approval_consumptions DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION anvil.work_plan_approval_complete();
CREATE CONSTRAINT TRIGGER work_plan_decision_complete AFTER INSERT ON anvil.approval_decisions DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION anvil.work_plan_approval_complete();
CREATE CONSTRAINT TRIGGER work_plan_version_complete AFTER INSERT ON anvil.work_plan_versions DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION anvil.work_plan_approval_complete();
CREATE CONSTRAINT TRIGGER work_plan_head_complete AFTER INSERT OR UPDATE ON anvil.work_plans DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION anvil.work_plan_approval_complete();
CREATE CONSTRAINT TRIGGER work_plan_task_complete AFTER INSERT ON anvil.plan_tasks DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION anvil.work_plan_approval_complete();
CREATE CONSTRAINT TRIGGER work_plan_dependency_complete AFTER INSERT ON anvil.plan_dependencies DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION anvil.work_plan_approval_complete();
CREATE CONSTRAINT TRIGGER work_plan_audit_complete AFTER INSERT ON anvil.audit_events DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION anvil.work_plan_approval_complete();
