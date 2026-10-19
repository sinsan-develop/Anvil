-- C3 source-only 후보. 논리 execution_receipts의 SEND 명령별 1회 permit 보조 저장이다.
-- 실제 DB 미적용. 별도 SEND command guard 미지원은 그대로이며 이 표로 허가를 대신하지 않는다.
-- 기존 START/STOP guard·START 실행당 1회 UNIQUE·기존 두 reverse trigger는 변경하지 않는다.
CREATE TABLE anvil.execution_instruction_permits (
 project_id uuid NOT NULL,execution_id uuid NOT NULL,generation bigint NOT NULL CHECK(generation BETWEEN 1 AND 9007199254740991),
 id uuid NOT NULL,version bigint NOT NULL CHECK(version=1),command_id uuid NOT NULL,
 command_record_id uuid NOT NULL,command_record_version bigint NOT NULL CHECK(command_record_version=1),
 grant_id uuid NOT NULL,grant_version bigint NOT NULL CHECK(grant_version=1),
 reservation_id uuid NOT NULL,reservation_version bigint NOT NULL CHECK(reservation_version=1),
 proof_result_id uuid NOT NULL,proof_result_version bigint NOT NULL CHECK(proof_result_version=1),
 envelope_hash text NOT NULL CHECK(envelope_hash~'^[0-9a-f]{64}$'),
 content_hash text NOT NULL CHECK(content_hash~'^[0-9a-f]{64}$'),snapshot_json jsonb NOT NULL CHECK(jsonb_typeof(snapshot_json)='object'),
 PRIMARY KEY(project_id,id,version),UNIQUE(project_id,id),UNIQUE(project_id,execution_id,generation,command_id),
 UNIQUE(project_id,proof_result_id,proof_result_version),
 FOREIGN KEY(project_id,execution_id,generation) REFERENCES anvil.executions(project_id,id,generation),
 FOREIGN KEY(project_id,command_record_id,command_record_version) REFERENCES anvil.execution_commands(project_id,id,version),
 FOREIGN KEY(project_id,grant_id,grant_version,execution_id,generation) REFERENCES anvil.execution_grants(project_id,id,version,execution_id,generation),
 FOREIGN KEY(project_id,reservation_id,reservation_version) REFERENCES anvil.usage_reservations(project_id,reservation_id,version),
 FOREIGN KEY(project_id,proof_result_id,proof_result_version) REFERENCES anvil.execution_receipts(project_id,id,version)
);
GRANT SELECT ON anvil.execution_instruction_permits TO anvil_v3_app;
REVOKE INSERT,UPDATE,DELETE ON anvil.execution_instruction_permits FROM anvil_v3_app;

CREATE FUNCTION anvil.guard_instruction_permit() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE s jsonb;sc jsonb;req jsonb;f jsonb;g anvil.execution_grants%ROWTYPE;q anvil.execution_commands%ROWTYPE;
 r anvil.execution_receipts%ROWTYPE;ch anvil.execution_challenges%ROWTYPE;u anvil.usage_reservations%ROWTYPE;
 source_refs jsonb;deadline timestamptz;at_time timestamptz=clock_timestamp();
BEGIN
 IF TG_OP<>'INSERT' THEN RAISE EXCEPTION 'INSTRUCTION_PERMIT_IMMUTABLE' USING ERRCODE='42501';END IF;
 s=NEW.snapshot_json;sc=s->'scope';req=s->'request';f=s->'currentFact';
 SELECT * INTO g FROM anvil.execution_grants WHERE project_id=NEW.project_id AND id=NEW.grant_id AND version=NEW.grant_version;
 SELECT * INTO q FROM anvil.execution_commands WHERE project_id=NEW.project_id AND id=NEW.command_record_id AND version=NEW.command_record_version;
 SELECT * INTO r FROM anvil.execution_receipts WHERE project_id=NEW.project_id AND id=NEW.proof_result_id AND version=NEW.proof_result_version;
 SELECT * INTO ch FROM anvil.execution_challenges WHERE project_id=r.project_id AND id=r.challenge_id AND version=1;
 SELECT * INTO u FROM anvil.usage_reservations WHERE project_id=NEW.project_id AND reservation_id=NEW.reservation_id ORDER BY version DESC LIMIT 1;
 deadline=anvil.synthetic_grant_deadline(NEW.project_id,g.id,g.version,g.content_hash);
 IF g.id IS NULL OR q.id IS NULL OR r.id IS NULL OR ch.id IS NULL OR u.reservation_id IS NULL OR deadline IS NULL
  OR NOT anvil.synthetic_challenge_context(NEW.project_id,g.id,g.version,sc->'grantRef')
  OR g.execution_id IS DISTINCT FROM NEW.execution_id OR g.generation IS DISTINCT FROM NEW.generation
  OR q.execution_id IS DISTINCT FROM NEW.execution_id OR q.generation IS DISTINCT FROM NEW.generation OR q.grant_id IS DISTINCT FROM g.id OR q.grant_version IS DISTINCT FROM g.version
  OR r.grant_id IS DISTINCT FROM g.id OR r.grant_version IS DISTINCT FROM g.version
  OR q.snapshot_json->>'state' IS DISTINCT FROM 'SYNTHETIC_INSTRUCTION_QUEUED' OR q.snapshot_json->'envelope'->>'operation' IS DISTINCT FROM 'SEND_INSTRUCTION'
  OR q.snapshot_json->'envelope'->>'commandId' IS DISTINCT FROM NEW.command_id::text OR q.envelope_hash IS DISTINCT FROM NEW.envelope_hash
  OR NOT anvil.execution_json_shape(s,ARRAY['scope','commandId','commandRef','request','requestHash','proofRef','authorizationReceiptRef','bindingHash','currentFact','reservationRef','state','issuedAt','expiresAt','commandExpiresAt','grantExpiresAt','proofExpiresAt','executionAuthorized','dispatchPerformed'])
  OR NOT anvil.execution_json_shape(sc,ARRAY['mode','projectId','connectorId','executionId','executionGeneration','grantRef','credentialGeneration'])
  OR sc->>'mode' IS DISTINCT FROM 'EXECUTION' OR sc->'projectId' IS DISTINCT FROM to_jsonb(NEW.project_id)
  OR sc->'executionId' IS DISTINCT FROM to_jsonb(NEW.execution_id) OR sc->'executionGeneration' IS DISTINCT FROM to_jsonb(NEW.generation)
  OR sc->'credentialGeneration' IS DISTINCT FROM '1'::jsonb OR sc->'connectorId' IS DISTINCT FROM g.snapshot_json->'binding'->'registration'->'connectorId'
  OR sc->'grantRef' IS DISTINCT FROM jsonb_build_object('id',g.id,'version',g.version,'contentHash',g.content_hash)
  OR s->>'commandId' IS DISTINCT FROM NEW.command_id::text OR s->'commandRef' IS DISTINCT FROM jsonb_build_object('id',q.id,'version',q.version,'contentHash',q.content_hash)
  OR NEW.content_hash IS DISTINCT FROM anvil.execution_json_hash(s) OR octet_length(anvil.execution_authority_canonical(s))>2097152
  OR s->>'state' IS DISTINCT FROM 'SYNTHETIC_INSTRUCTION_CONSUMED_NO_AUTHORITY'
  OR s->'executionAuthorized' IS DISTINCT FROM 'false'::jsonb OR s->'dispatchPerformed' IS DISTINCT FROM 'false'::jsonb
  OR s->'proofRef' IS DISTINCT FROM jsonb_build_object('id',r.id,'version',r.version,'contentHash',r.content_hash)
  OR r.content_hash IS DISTINCT FROM anvil.execution_json_hash(r.snapshot_json)
  OR s->'authorizationReceiptRef' IS DISTINCT FROM q.authorization_ref OR q.snapshot_json->'envelope'->'context'->'authorizationReceiptRef' IS DISTINCT FROM q.authorization_ref
  OR s->'reservationRef' IS DISTINCT FROM jsonb_build_object('id',u.reservation_id,'version',u.version,'contentHash',u.content_hash)
  OR u.version IS DISTINCT FROM NEW.reservation_version OR u.created_command_id IS DISTINCT FROM q.created_command_id
  OR u.snapshot_json->>'state' IS DISTINCT FROM 'RESERVED' OR u.content_hash IS DISTINCT FROM anvil.execution_json_hash(u.snapshot_json)
  OR u.snapshot_json->'claim'->>'operation' IS DISTINCT FROM 'SEND_INSTRUCTION' OR u.snapshot_json->'claim'->>'commandId' IS DISTINCT FROM NEW.command_id::text
  OR u.snapshot_json->'claim'->'projectId' IS DISTINCT FROM to_jsonb(NEW.project_id) OR u.snapshot_json->'claim'->'executionId' IS DISTINCT FROM to_jsonb(NEW.execution_id)
  OR u.snapshot_json->'claim'->'executionGeneration' IS DISTINCT FROM to_jsonb(NEW.generation)
  OR u.snapshot_json->'claim'->'policyRef' IS DISTINCT FROM f->'intent'->'budgetPolicyRef'
  OR u.snapshot_json->'claim'->'assignmentRef' IS DISTINCT FROM f->'intent'->'assignmentRef'
  OR u.snapshot_json->'claim'->'demand'->'attempts' IS DISTINCT FROM '0'::jsonb
  OR jsonb_typeof(u.snapshot_json->'claim'->'demand'->'calls') IS DISTINCT FROM 'number'
  OR (u.snapshot_json->'claim'->'demand'->>'calls') !~ '^[0-9]+$'
  OR (u.snapshot_json->'claim'->'demand'->>'calls')::numeric NOT BETWEEN 1 AND 9007199254740991
  OR u.snapshot_json->'executionAuthorized' IS DISTINCT FROM 'false'::jsonb OR u.snapshot_json->'dispatchPerformed' IS DISTINCT FROM 'false'::jsonb
  OR s->'reservationRef' IS DISTINCT FROM q.snapshot_json->'reservationRef' OR s->'reservationRef' IS DISTINCT FROM q.snapshot_json->'envelope'->'context'->'budgetRef'
  OR s->'reservationRef'->'id' IS NOT DISTINCT FROM f->'budgetReservationRef'->'id' THEN RAISE EXCEPTION 'INSTRUCTION_PERMIT_EXACT_BINDING_REQUIRED' USING ERRCODE='42501';END IF;
 IF NOT EXISTS(SELECT 1 FROM anvil.commands c JOIN anvil.authorization_receipts a ON a.id=c.authorization_receipt_id AND a.command_id=c.id AND a.scope_kind='PROJECT' AND a.scope_id=c.project_id AND a.approval_decision_ref IS NULL
   JOIN anvil.audit_events audit ON audit.project_id=c.project_id AND audit.command_id=c.id AND audit.operation_id=c.operation_id
   JOIN anvil.delivery_outbox o ON o.project_id=c.project_id AND o.command_id=c.id
   WHERE c.project_id=NEW.project_id AND c.id=q.created_command_id AND c.state='APPLIED' AND c.operation='queueExecutionCommand'
    AND c.scope_kind='PROJECT' AND c.scope_id=NEW.project_id AND c.command_id=NEW.command_id AND c.expected_version=NEW.generation
    AND c.actor_id::text=f->'subject'->>'userId' AND c.client_id::text=f->'subject'->>'clientId' AND to_jsonb(c.control_generation)=f->'subject'->'controlGeneration'
    AND c.result_ref->'data'->'ref'=s->'commandRef' AND c.policy_ref=f->'permissionPolicyRef'
    AND jsonb_build_object('id',a.id,'version',1,'contentHash',a.scope_digest)=q.authorization_ref
    AND a.subject_ref=jsonb_build_object('kind','HUMAN','userId',c.actor_id,'clientId',c.client_id) AND a.policy_ref=c.policy_ref
    AND audit.outcome='APPLIED' AND audit.source_kind='HUMAN_COMMAND' AND audit.policy_ref=c.policy_ref AND audit.scope_digest=a.scope_digest
    AND o.kind='EXECUTION_INSTRUCTION_SYNTHETIC_ONLY' AND o.state='HELD_SYNTHETIC_ONLY' AND o.attempt_count=0
    AND o.payload_ref=jsonb_build_object('commandRef',s->'commandRef','grantRef',sc->'grantRef','envelopeHash',NEW.envelope_hash)) THEN
  RAISE EXCEPTION 'INSTRUCTION_PERMIT_EXACT_BINDING_REQUIRED' USING ERRCODE='42501';END IF;
 IF NOT anvil.execution_json_shape(f,ARRAY['schemaVersion','purpose','transport','projectId','executionId','executionGeneration','subject','agentSession','registration','intent','preparationRef','permissionPolicyRef','budgetReservationRef','basisRefs','latestInstructionRefs','understandingReviewRef','checks','writerState','expires','checkedAt','executionAuthorized','dispatchPerformed'])
  OR f-ARRAY['checkedAt','expires'] IS DISTINCT FROM (q.snapshot_json->'currentBinding'->'fact')-'expires'
  OR f->>'writerState' IS DISTINCT FROM 'OWNED' OR f->'executionAuthorized' IS DISTINCT FROM 'false'::jsonb OR f->'dispatchPerformed' IS DISTINCT FROM 'false'::jsonb
  OR NOT anvil.execution_json_shape(f->'checks',ARRAY['subject','session','registration','permissionPolicy','basis','context','capability','source','osFence','budget','storage','understanding'])
  OR EXISTS(SELECT 1 FROM jsonb_each(f->'checks')v WHERE NOT anvil.execution_json_shape(v.value,ARRAY['state','evidenceRefs']) OR v.key<>'understanding' AND v.value->>'state' IS DISTINCT FROM 'VERIFIED_CURRENT')
  OR f->'intent'->>'mode'='WORK' AND (NOT anvil.execution_preparation_ref_valid(f->'understandingReviewRef') OR f->'checks'->'understanding'->>'state' IS DISTINCT FROM 'VERIFIED_CURRENT')
  OR f->'intent'->>'mode'='CONTEXT_REVIEW' AND EXISTS(SELECT 1 FROM jsonb_array_elements(f->'intent'->'sourceScopes') source,jsonb_array_elements(source->'targets') target WHERE target->>'access' IS DISTINCT FROM 'READ')
  OR s->>'bindingHash' IS DISTINCT FROM anvil.execution_json_hash(jsonb_build_object('scope',sc,'commandRef',s->'commandRef','authorizationReceiptRef',q.authorization_ref,'reservationRef',s->'reservationRef','fact',f-ARRAY['checkedAt','expires']))
  OR NOT anvil.execution_json_shape(req,ARRAY['envelopeHash','localAttemptRef','sourceObservationRefs','osOwnershipRef'])
  OR NOT anvil.execution_preparation_ref_valid(req->'localAttemptRef') OR req->'localAttemptRef'->'version' IS DISTINCT FROM '1'::jsonb
  OR NOT anvil.execution_preparation_ref_valid(req->'osOwnershipRef') OR req->>'envelopeHash' IS DISTINCT FROM NEW.envelope_hash
  OR s->>'requestHash' IS DISTINCT FROM anvil.execution_json_hash(req) THEN RAISE EXCEPTION 'INSTRUCTION_PERMIT_EXACT_BINDING_REQUIRED' USING ERRCODE='42501';END IF;
 SELECT jsonb_agg(v.ref ORDER BY v.pos) INTO source_refs FROM(SELECT source->'observationRef' AS ref,min(pos) AS pos FROM jsonb_array_elements(f->'intent'->'sourceScopes') WITH ORDINALITY AS x(source,pos) GROUP BY source->'observationRef')v;
 IF req->'sourceObservationRefs' IS DISTINCT FROM source_refs OR NOT(f->'checks'->'osFence'->'evidenceRefs' @> jsonb_build_array(req->'osOwnershipRef'))
  OR ch.snapshot_json->'request'->>'purpose' IS DISTINCT FROM 'EXECUTION_REQUEST' OR ch.snapshot_json->'request'->'target'->>'method' IS DISTINCT FROM 'POST'
  OR ch.snapshot_json->'request'->'target'->>'path' IS DISTINCT FROM '/api/v1/connectors/'||(sc->>'connectorId')||'/executions/'||NEW.execution_id::text||'/commands/'||NEW.command_id::text||'/permit'
  OR ch.snapshot_json->'request'->'target'->>'queryHash' IS DISTINCT FROM anvil.execution_json_hash('{}'::jsonb)
  OR ch.snapshot_json->'request'->'target'->>'bodyHash' IS DISTINCT FROM anvil.execution_json_hash(req)
  OR s->'commandExpiresAt' IS DISTINCT FROM q.snapshot_json->'envelope'->'expiresAt'
  OR s->'grantExpiresAt' IS DISTINCT FROM q.snapshot_json->'currentBinding'->'grantExpiresAt'
  OR s->'proofExpiresAt' IS DISTINCT FROM ch.snapshot_json->'publicChallenge'->'expiresAt'
  OR NOT anvil.execution_iso_valid(s->'issuedAt') OR NOT anvil.execution_iso_valid(s->'expiresAt') OR NOT anvil.execution_iso_valid(f->'checkedAt')
  OR (s->>'issuedAt')::timestamptz>at_time OR (s->>'issuedAt')::timestamptz<at_time-interval '30 seconds'
  OR (f->>'checkedAt')::timestamptz>(s->>'issuedAt')::timestamptz OR (f->>'checkedAt')::timestamptz<(s->>'issuedAt')::timestamptz-interval '30 seconds'
  OR NOT anvil.execution_json_shape(f->'expires',ARRAY['humanSession','permissionPolicy','registration','budget','automaticScope'])
  OR EXISTS(SELECT 1 FROM jsonb_each(f->'expires')v WHERE NOT anvil.execution_iso_valid(v.value))
  OR (s->>'expiresAt')::timestamptz<=(s->>'issuedAt')::timestamptz OR (s->>'expiresAt')::timestamptz>LEAST((s->>'issuedAt')::timestamptz+interval '30 seconds',(f->>'checkedAt')::timestamptz+interval '30 seconds',deadline,(s->>'commandExpiresAt')::timestamptz,(s->>'grantExpiresAt')::timestamptz,(s->>'proofExpiresAt')::timestamptz,(SELECT min(value::timestamptz) FROM jsonb_each_text(f->'expires')))
  OR (s->>'expiresAt')::timestamptz<=at_time
  OR (SELECT count(*) FROM anvil.execution_instruction_permits WHERE project_id=NEW.project_id AND execution_id=NEW.execution_id AND generation=NEW.generation)>=50 THEN
  RAISE EXCEPTION 'INSTRUCTION_PERMIT_EXACT_BINDING_REQUIRED' USING ERRCODE='42501';END IF;
 IF (SELECT octet_length(anvil.execution_authority_canonical(jsonb_build_object('complete',true,'permits',
   COALESCE(jsonb_agg(jsonb_build_object('ref',jsonb_build_object('id',id,'version',version,'contentHash',content_hash),'snapshot',snapshot_json) ORDER BY id),'[]'::jsonb)
   ||jsonb_build_array(jsonb_build_object('ref',jsonb_build_object('id',NEW.id,'version',NEW.version,'contentHash',NEW.content_hash),'snapshot',s)))))
   FROM anvil.execution_instruction_permits WHERE project_id=NEW.project_id AND execution_id=NEW.execution_id AND generation=NEW.generation)>2097152 THEN
  RAISE EXCEPTION 'INSTRUCTION_PERMIT_JOURNAL_LIMIT' USING ERRCODE='42501';END IF;
 RETURN NEW;
EXCEPTION WHEN OTHERS THEN RAISE EXCEPTION 'INSTRUCTION_PERMIT_EXACT_BINDING_REQUIRED' USING ERRCODE='42501';
END;
$$;
CREATE FUNCTION anvil.guard_instruction_permit_complete() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE c anvil.execution_challenges%ROWTYPE;r anvil.execution_receipts%ROWTYPE;
BEGIN
 SELECT * INTO r FROM anvil.execution_receipts WHERE project_id=NEW.project_id AND id=NEW.proof_result_id AND version=NEW.proof_result_version;
 SELECT * INTO c FROM anvil.execution_challenges WHERE project_id=r.project_id AND id=r.challenge_id AND version=2;
 IF c.id IS NULL OR r.id IS NULL OR c.grant_id IS DISTINCT FROM NEW.grant_id OR c.grant_version IS DISTINCT FROM NEW.grant_version
  OR c.snapshot_json->'consumption'->'resultRef' IS DISTINCT FROM NEW.snapshot_json->'proofRef'
  OR anvil.synthetic_grant_deadline(NEW.project_id,NEW.grant_id,NEW.grant_version,NEW.snapshot_json->'scope'->'grantRef'->>'contentHash') IS NULL
  OR clock_timestamp()>=(NEW.snapshot_json->>'expiresAt')::timestamptz THEN RAISE EXCEPTION 'INSTRUCTION_PERMIT_PROOF_ATOMIC_REQUIRED' USING ERRCODE='42501';END IF;RETURN NULL;
END;
$$;
CREATE TRIGGER instruction_permit_guard BEFORE INSERT OR UPDATE OR DELETE ON anvil.execution_instruction_permits FOR EACH ROW EXECUTE FUNCTION anvil.guard_instruction_permit();
CREATE CONSTRAINT TRIGGER instruction_permit_complete AFTER INSERT ON anvil.execution_instruction_permits DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION anvil.guard_instruction_permit_complete();
GRANT INSERT ON anvil.execution_instruction_permits TO anvil_v3_app;
REVOKE UPDATE,DELETE ON anvil.execution_instruction_permits FROM anvil_v3_app;

-- PMO 수용 source-only 한정 분기. 기존 두 deferred trigger의 정의/대상/시점은 유지한다.
CREATE OR REPLACE FUNCTION anvil.guard_execution_permit_proof_complete() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE r anvil.execution_receipts%ROWTYPE;c anvil.execution_challenges%ROWTYPE;q anvil.execution_commands%ROWTYPE;n bigint;
BEGIN
 IF TG_TABLE_NAME='execution_receipts' THEN r=NEW;SELECT * INTO c FROM anvil.execution_challenges WHERE project_id=r.project_id AND id=r.challenge_id AND version=2;
 ELSE IF NEW.version<>2 THEN RETURN NULL;END IF;c=NEW;SELECT * INTO r FROM anvil.execution_receipts WHERE project_id=c.project_id AND challenge_id=c.id AND grant_id=c.grant_id AND grant_version=c.grant_version;END IF;
 IF c.snapshot_json->'request'->'target'->>'path' ~ '/commands/[^/]+/permit$' THEN
  SELECT count(*) INTO n FROM anvil.execution_commands cmd JOIN anvil.execution_grants g ON g.project_id=cmd.project_id AND g.id=cmd.grant_id AND g.version=cmd.grant_version AND g.execution_id=cmd.execution_id AND g.generation=cmd.generation
   WHERE cmd.project_id=r.project_id AND cmd.grant_id=r.grant_id AND cmd.grant_version=r.grant_version
    AND c.grant_id=r.grant_id AND c.grant_version=r.grant_version
    AND c.snapshot_json->'request'->'target'->>'path'='/api/v1/connectors/'||(g.snapshot_json->'binding'->'registration'->>'connectorId')||'/executions/'||cmd.execution_id::text||'/commands/'||(cmd.snapshot_json->'envelope'->>'commandId')||'/permit';
  IF n<>1 THEN RAISE EXCEPTION 'EXECUTION_PERMIT_PROOF_REVERSE_ATOMIC_REQUIRED' USING ERRCODE='42501';END IF;
  SELECT cmd.* INTO q FROM anvil.execution_commands cmd JOIN anvil.execution_grants g ON g.project_id=cmd.project_id AND g.id=cmd.grant_id AND g.version=cmd.grant_version AND g.execution_id=cmd.execution_id AND g.generation=cmd.generation
   WHERE cmd.project_id=r.project_id AND cmd.grant_id=r.grant_id AND cmd.grant_version=r.grant_version
    AND c.snapshot_json->'request'->'target'->>'path'='/api/v1/connectors/'||(g.snapshot_json->'binding'->'registration'->>'connectorId')||'/executions/'||cmd.execution_id::text||'/commands/'||(cmd.snapshot_json->'envelope'->>'commandId')||'/permit';
  IF q.snapshot_json->'envelope'->>'operation'='START_SESSION' THEN
 IF c.snapshot_json->'request'->'target'->>'path' ~ '/commands/[^/]+/permit$' AND NOT EXISTS(
  SELECT 1 FROM anvil.execution_start_permits p WHERE p.project_id=r.project_id AND p.proof_result_id=r.id AND p.proof_result_version=r.version
   AND p.snapshot_json->'proofRef'=jsonb_build_object('id',r.id,'version',r.version,'contentHash',r.content_hash)
   AND c.snapshot_json->'consumption'->'resultRef'=p.snapshot_json->'proofRef') THEN RAISE EXCEPTION 'EXECUTION_PERMIT_PROOF_REVERSE_ATOMIC_REQUIRED' USING ERRCODE='42501';END IF;
  ELSIF q.snapshot_json->'envelope'->>'operation'='SEND_INSTRUCTION' AND q.snapshot_json->>'state'='SYNTHETIC_INSTRUCTION_QUEUED' THEN
   IF NOT EXISTS(SELECT 1 FROM anvil.execution_instruction_permits p WHERE p.project_id=r.project_id AND p.execution_id=q.execution_id AND p.generation=q.generation
    AND p.command_record_id=q.id AND p.command_record_version=q.version AND p.command_id::text=q.snapshot_json->'envelope'->>'commandId'
    AND p.grant_id=r.grant_id AND p.grant_version=r.grant_version AND p.proof_result_id=r.id AND p.proof_result_version=r.version AND p.envelope_hash=q.envelope_hash
    AND p.snapshot_json->'commandRef'=jsonb_build_object('id',q.id,'version',q.version,'contentHash',q.content_hash)
    AND p.snapshot_json->'authorizationReceiptRef'=q.authorization_ref AND p.snapshot_json->'reservationRef'=q.snapshot_json->'reservationRef'
    AND p.snapshot_json->'proofRef'=jsonb_build_object('id',r.id,'version',r.version,'contentHash',r.content_hash)
    AND c.snapshot_json->'consumption'->'resultRef'=p.snapshot_json->'proofRef') THEN RAISE EXCEPTION 'EXECUTION_PERMIT_PROOF_REVERSE_ATOMIC_REQUIRED' USING ERRCODE='42501';END IF;
  ELSE RAISE EXCEPTION 'EXECUTION_PERMIT_PROOF_REVERSE_ATOMIC_REQUIRED' USING ERRCODE='42501';END IF;
 END IF;RETURN NULL;
END;
$$;
