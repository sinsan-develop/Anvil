-- P1 C3 합성 challenge/소비 저장. 실제 execution token·OS·Agent 권한을 발급하지 않는다.
CREATE TABLE anvil.execution_credentials (
 project_id uuid NOT NULL,id uuid NOT NULL,version bigint NOT NULL CHECK(version=1),grant_id uuid NOT NULL,grant_version bigint NOT NULL,
 credential_generation bigint NOT NULL CHECK(credential_generation=1),content_hash text NOT NULL CHECK(content_hash~'^[0-9a-f]{64}$'),snapshot_json jsonb NOT NULL,
 PRIMARY KEY(project_id,id,version),UNIQUE(project_id,grant_id,grant_version,credential_generation),
 FOREIGN KEY(project_id,grant_id,grant_version) REFERENCES anvil.execution_grants(project_id,id,version)
);
CREATE TABLE anvil.execution_challenges (
 project_id uuid NOT NULL,id uuid NOT NULL,version bigint NOT NULL CHECK(version IN(1,2)),grant_id uuid NOT NULL,grant_version bigint NOT NULL,
 server_sequence bigint NOT NULL CHECK(server_sequence BETWEEN 1 AND 20000),content_hash text NOT NULL CHECK(content_hash~'^[0-9a-f]{64}$'),snapshot_json jsonb NOT NULL,
 request_id uuid GENERATED ALWAYS AS ((snapshot_json->'publicChallenge'->>'requestId')::uuid) STORED,
 client_nonce text GENERATED ALWAYS AS (snapshot_json->'publicChallenge'->>'clientNonce') STORED,
 server_nonce text GENERATED ALWAYS AS (snapshot_json->'publicChallenge'->>'serverNonce') STORED,
 PRIMARY KEY(project_id,id,version),UNIQUE(project_id,grant_id,grant_version,server_sequence),
 FOREIGN KEY(project_id,grant_id,grant_version) REFERENCES anvil.execution_grants(project_id,id,version)
);
CREATE UNIQUE INDEX execution_challenge_request_once ON anvil.execution_challenges(project_id,grant_id,grant_version,request_id) WHERE version=1;
CREATE UNIQUE INDEX execution_challenge_client_nonce_once ON anvil.execution_challenges(project_id,grant_id,grant_version,client_nonce) WHERE version=1;
CREATE UNIQUE INDEX execution_challenge_server_nonce_once ON anvil.execution_challenges(project_id,grant_id,grant_version,server_nonce) WHERE version=1;
CREATE TABLE anvil.execution_receipts (
 project_id uuid NOT NULL,id uuid NOT NULL,version bigint NOT NULL CHECK(version=1),grant_id uuid NOT NULL,grant_version bigint NOT NULL,
 challenge_id uuid NOT NULL,challenge_version bigint NOT NULL CHECK(challenge_version=1),content_hash text NOT NULL CHECK(content_hash~'^[0-9a-f]{64}$'),snapshot_json jsonb NOT NULL,
 PRIMARY KEY(project_id,id,version),UNIQUE(project_id,grant_id,grant_version,challenge_id),
 FOREIGN KEY(project_id,grant_id,grant_version) REFERENCES anvil.execution_grants(project_id,id,version),
 FOREIGN KEY(project_id,challenge_id,challenge_version) REFERENCES anvil.execution_challenges(project_id,id,version)
);
GRANT SELECT ON anvil.execution_credentials,anvil.execution_challenges,anvil.execution_receipts TO anvil_v3_app;
REVOKE INSERT,UPDATE,DELETE ON anvil.execution_credentials,anvil.execution_challenges,anvil.execution_receipts FROM anvil_v3_app;

-- 현재 DB subject/제어·정확 정책·예산·미회수 writer 검사다. host P256 서명은 app codec이 검사한다.
-- 기존 합성 source/OS binding을 실제 OS 관측으로 승격하지 않는다.
CREATE FUNCTION anvil.synthetic_grant_deadline(pid uuid,gid uuid,ver bigint,digest text) RETURNS timestamptz LANGUAGE plpgsql AS $$
DECLARE g anvil.execution_grants%ROWTYPE;f jsonb;policy anvil.permission_policy_versions%ROWTYPE;b anvil.limit_policy_versions%ROWTYPE;
 s anvil.auth_sessions%ROWTYPE;u anvil.usage_reservations%ROWTYPE;a timestamptz;q timestamptz;at_time timestamptz=clock_timestamp();
BEGIN
 SELECT * INTO g FROM anvil.execution_grants WHERE project_id=pid AND id=gid AND version=ver AND content_hash=digest;
 IF g.id IS NULL OR g.content_hash IS DISTINCT FROM anvil.execution_json_hash(g.snapshot_json) OR g.snapshot_json->>'kind' IS DISTINCT FROM 'EXECUTION'
  OR g.snapshot_json->>'transport' IS DISTINCT FROM 'SYNTHETIC_ONLY' OR g.snapshot_json->>'state' IS DISTINCT FROM 'SYNTHETIC_PLAN'
  OR g.snapshot_json->'executionAuthorized' IS DISTINCT FROM 'false'::jsonb OR g.snapshot_json->'dispatchPerformed' IS DISTINCT FROM 'false'::jsonb
  OR NOT anvil.execution_iso_valid(g.snapshot_json->'expiresAt') OR (g.snapshot_json->>'expiresAt')::timestamptz<=at_time THEN RETURN NULL;END IF;
 f=g.snapshot_json->'binding';
 IF g.snapshot_json->>'factHash' IS DISTINCT FROM anvil.execution_json_hash(f) OR f->>'projectId' IS DISTINCT FROM pid::text
  OR f->>'executionId' IS DISTINCT FROM g.execution_id::text OR f->'executionGeneration' IS DISTINCT FROM to_jsonb(g.generation) THEN RETURN NULL;END IF;
 SELECT s0.* INTO s FROM anvil.auth_sessions s0 JOIN anvil.users usr ON usr.id=s0.user_id JOIN anvil.clients cl ON cl.id=s0.client_id AND cl.user_id=s0.user_id
  WHERE s0.id::text=f->'subject'->>'humanSessionId' AND s0.user_id::text=f->'subject'->>'userId' AND s0.client_id::text=f->'subject'->>'clientId'
  AND s0.revoked_at IS NULL AND usr.status='ACTIVE' AND usr.revoked_at IS NULL AND cl.revoked_at IS NULL
  AND s0.credential_generation=usr.credential_generation AND to_jsonb(usr.credential_generation)=f->'subject'->'credentialGeneration'
  AND s0.idle_expires_at>at_time AND s0.absolute_expires_at>at_time FOR SHARE OF s0,usr,cl;
 IF s.id IS NULL THEN RETURN NULL;END IF;
 PERFORM p.id FROM anvil.projects p JOIN anvil.project_members m ON m.project_id=p.id AND m.user_id=s.user_id
  JOIN anvil.project_control pc ON pc.project_id=p.id AND pc.actor_id=s.user_id AND pc.client_id=s.client_id
  WHERE p.id=pid AND p.archived_at IS NULL AND m.participation='OWNER' AND m.revoked_at IS NULL AND pc.revoked_at IS NULL
   AND to_jsonb(pc.generation)=f->'subject'->'controlGeneration' FOR UPDATE OF p;
 IF NOT FOUND THEN RETURN NULL;END IF;
 IF NOT EXISTS(SELECT 1 FROM anvil.executions e JOIN anvil.writer_claims w ON w.project_id=e.project_id AND w.execution_id=e.id AND w.generation=e.generation
  WHERE e.project_id=pid AND e.id=g.execution_id AND e.generation=g.generation AND e.transport='SYNTHETIC_ONLY' AND e.state='SYNTHETIC_QUEUED'
  AND w.grant_id=gid AND w.grant_version=ver AND w.ownership_state='SYNTHETIC_CLAIM' AND w.reclaimed_at IS NULL AND w.expires_at>at_time
  AND w.scope_json=f->'intent'->'sourceScopes') THEN RETURN NULL;END IF;
 SELECT v.* INTO policy FROM anvil.permission_policies p JOIN anvil.permission_policy_versions v ON v.project_id=p.project_id AND v.policy_id=p.id AND v.version=p.head_version
  WHERE p.project_id=pid AND jsonb_build_object('id',p.id,'version',p.head_version,'contentHash',v.content_hash)=f->'permissionPolicyRef' FOR SHARE OF p;
 IF policy.policy_id IS NULL OR policy.content_hash IS DISTINCT FROM anvil.execution_json_hash(jsonb_build_object('rules',policy.rules_json,'reason',policy.reason,'reviewRefs',policy.review_refs)) THEN RETURN NULL;END IF;
 SELECT * INTO b FROM anvil.limit_policy_versions v WHERE v.project_id=pid AND v.scope_json=jsonb_build_object('kind','PROJECT','projectId',pid) ORDER BY version DESC LIMIT 1;
 IF b.policy_id IS NULL OR jsonb_build_object('id',b.policy_id,'version',b.version,'contentHash',b.content_hash) IS DISTINCT FROM f->'intent'->'budgetPolicyRef'
  OR b.snapshot_json->>'state' IS DISTINCT FROM 'APPLIED' OR b.content_hash IS DISTINCT FROM anvil.execution_json_hash(b.snapshot_json)
  OR NOT anvil.limit_policy_limits_valid(b.snapshot_json->'limits') OR NOT anvil.execution_iso_valid(b.snapshot_json->'expiresAt')
  OR (b.snapshot_json->>'expiresAt')::timestamptz<=at_time THEN RETURN NULL;END IF;
 SELECT * INTO u FROM anvil.usage_reservations WHERE project_id=pid AND reservation_id::text=f->'budgetReservationRef'->>'id' ORDER BY version DESC LIMIT 1;
 IF u.reservation_id IS NULL OR jsonb_build_object('id',u.reservation_id,'version',u.version,'contentHash',u.content_hash) IS DISTINCT FROM f->'budgetReservationRef'
  OR u.content_hash IS DISTINCT FROM anvil.execution_json_hash(u.snapshot_json) OR u.snapshot_json->>'state' IS DISTINCT FROM 'RESERVED' THEN RETURN NULL;END IF;
 a=anvil.execution_policy_deadline(policy.rules_json,pid,g.execution_id,g.generation,s.user_id,'authorizeExecution',f->'intent'->'budgetPolicyRef',f->'intent'->'sourceScopes',at_time);
 q=anvil.execution_policy_deadline(policy.rules_json,pid,g.execution_id,g.generation,s.user_id,'queueExecutionCommand',f->'intent'->'budgetPolicyRef',f->'intent'->'sourceScopes',at_time);
 IF a IS NULL OR q IS NULL THEN RETURN NULL;END IF;
 RETURN LEAST(a,q,(g.snapshot_json->>'expiresAt')::timestamptz,s.idle_expires_at,s.absolute_expires_at,(b.snapshot_json->>'expiresAt')::timestamptz);
EXCEPTION WHEN OTHERS THEN RETURN NULL;
END;
$$;
CREATE FUNCTION anvil.synthetic_challenge_context(pid uuid,gid uuid,ver bigint,ref jsonb) RETURNS boolean LANGUAGE sql AS $$
 SELECT COALESCE(ref=jsonb_build_object('id',gid,'version',ver,'contentHash',current_setting('anvil.synthetic_grant_hash',true))
  AND pid::text=current_setting('anvil.synthetic_project_id',true) AND gid::text=current_setting('anvil.synthetic_grant_id',true)
  AND anvil.synthetic_grant_deadline(pid,gid,ver,ref->>'contentHash')>clock_timestamp(),false);
$$;
CREATE FUNCTION anvil.execution_nonce_valid(v jsonb) RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
 SELECT COALESCE(jsonb_typeof(v)='string' AND v#>>'{}' ~ '^[A-Za-z0-9_-]{42}[AEIMQUYcgkosw048]$',false);
$$;
CREATE FUNCTION anvil.guard_synthetic_credential_reservation() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE s jsonb=NEW.snapshot_json;
BEGIN
 IF TG_OP<>'INSERT' THEN RAISE EXCEPTION 'SYNTHETIC_CREDENTIAL_HISTORY_IMMUTABLE' USING ERRCODE='42501';END IF;
 IF NOT anvil.execution_json_shape(s,ARRAY['transport','state','grantRef','credentialGeneration','reservedAt','credentialIssued','executionAuthorized','dispatchPerformed'])
  OR s->>'transport' IS DISTINCT FROM 'SYNTHETIC_ONLY' OR s->>'state' IS DISTINCT FROM 'SYNTHETIC_RESERVED_NO_TOKEN' OR s->'credentialGeneration' IS DISTINCT FROM '1'::jsonb
  OR s->'credentialIssued' IS DISTINCT FROM 'false'::jsonb OR s->'executionAuthorized' IS DISTINCT FROM 'false'::jsonb OR s->'dispatchPerformed' IS DISTINCT FROM 'false'::jsonb
  OR NOT anvil.execution_iso_valid(s->'reservedAt') OR (s->>'reservedAt')::timestamptz>clock_timestamp() OR (s->>'reservedAt')::timestamptz<clock_timestamp()-interval '30 seconds'
  OR NEW.content_hash IS DISTINCT FROM anvil.execution_json_hash(s) OR NOT anvil.synthetic_challenge_context(NEW.project_id,NEW.grant_id,NEW.grant_version,s->'grantRef') THEN
   RAISE EXCEPTION 'SYNTHETIC_CREDENTIAL_EXACT_CURRENT_GRANT_REQUIRED' USING ERRCODE='42501';END IF;
 RETURN NEW;
EXCEPTION WHEN OTHERS THEN RAISE EXCEPTION 'SYNTHETIC_CREDENTIAL_EXACT_CURRENT_GRANT_REQUIRED' USING ERRCODE='42501';
END;
$$;

CREATE FUNCTION anvil.guard_execution_challenge() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE s jsonb;g anvil.execution_grants%ROWTYPE;p jsonb;r jsonb;b jsonb;previous anvil.execution_challenges%ROWTYPE;
 at_time timestamptz=clock_timestamp();deadline timestamptz;event_time timestamptz;last_time timestamptz;prefix text;suffix text;target jsonb;
BEGIN
 IF TG_OP<>'INSERT' THEN RAISE EXCEPTION 'EXECUTION_CHALLENGE_HISTORY_IMMUTABLE' USING ERRCODE='42501';END IF;
 s=NEW.snapshot_json;p=s->'publicChallenge';r=s->'request';b=s->'binding';
 SELECT * INTO g FROM anvil.execution_grants WHERE project_id=NEW.project_id AND id=NEW.grant_id AND version=NEW.grant_version;
 IF g.id IS NULL OR NOT anvil.synthetic_challenge_context(NEW.project_id,NEW.grant_id,NEW.grant_version,b->'grantRef') THEN RAISE EXCEPTION 'EXECUTION_CHALLENGE_CURRENT_GRANT_REQUIRED' USING ERRCODE='42501';END IF;
 deadline=anvil.synthetic_grant_deadline(NEW.project_id,NEW.grant_id,NEW.grant_version,g.content_hash);
 IF NOT anvil.execution_json_shape(s,ARRAY['sequence','binding','request','requestHash','publicChallenge','previousRef','consumption'])
  OR NEW.content_hash IS DISTINCT FROM anvil.execution_json_hash(s) OR octet_length(anvil.execution_authority_canonical(s))>2097152
  OR s->'sequence' IS DISTINCT FROM to_jsonb(NEW.server_sequence)
  OR b IS DISTINCT FROM jsonb_build_object('transport','SYNTHETIC_ONLY','mode','EXECUTION','projectId',NEW.project_id,'connectorId',g.snapshot_json->'binding'->'registration'->'connectorId',
    'executionId',g.execution_id,'executionGeneration',g.generation,'grantRef',jsonb_build_object('id',g.id,'version',g.version,'contentHash',g.content_hash),
    'scopeDigest',g.snapshot_json->'scopeDigest','credentialGeneration',1,'publicKeyFingerprint',g.snapshot_json->'binding'->'registration'->'hostPublicKeyFingerprint')
  OR NOT EXISTS(SELECT 1 FROM anvil.execution_credentials c WHERE c.project_id=NEW.project_id AND c.grant_id=NEW.grant_id AND c.grant_version=NEW.grant_version AND c.credential_generation=1)
  OR NOT anvil.execution_json_shape(p,ARRAY['id','requestId','purpose','grantRef','credentialGeneration','scopeDigest','serverNonce','clientNonce','issuedAt','expiresAt'])
  OR p->>'id' IS DISTINCT FROM NEW.id::text OR p->'requestId' IS DISTINCT FROM r->'requestId' OR p->'purpose' IS DISTINCT FROM r->'purpose'
  OR p->'grantRef' IS DISTINCT FROM b->'grantRef' OR p->'credentialGeneration' IS DISTINCT FROM '1'::jsonb OR p->'scopeDigest' IS DISTINCT FROM b->'scopeDigest'
  OR NOT anvil.execution_nonce_valid(p->'serverNonce') OR NOT anvil.execution_nonce_valid(p->'clientNonce') OR p->'clientNonce' IS DISTINCT FROM r->'clientNonce'
  OR NOT anvil.execution_iso_valid(p->'issuedAt') OR NOT anvil.execution_iso_valid(p->'expiresAt') OR (p->>'issuedAt')::timestamptz>at_time
  OR (p->>'expiresAt')::timestamptz<=(p->>'issuedAt')::timestamptz
  OR (p->>'expiresAt')::timestamptz>(p->>'issuedAt')::timestamptz+(CASE WHEN p->>'purpose'='CREDENTIAL_EXCHANGE' THEN interval '2 minutes' ELSE interval '30 seconds' END)
  OR NOT anvil.execution_json_shape(r,ARRAY['requestId','purpose','grantRef','credentialGeneration','target','clientNonce','issuedAt'])
  OR jsonb_typeof(r->'requestId') IS DISTINCT FROM 'string' OR r->>'requestId' !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
  OR r->'purpose' NOT IN('"CREDENTIAL_EXCHANGE"'::jsonb,'"EXECUTION_REQUEST"'::jsonb) OR r->'grantRef' IS DISTINCT FROM b->'grantRef'
  OR r->'credentialGeneration' IS DISTINCT FROM '1'::jsonb OR s->>'requestHash' IS DISTINCT FROM anvil.execution_json_hash(r) OR NOT anvil.execution_iso_valid(r->'issuedAt') THEN
   RAISE EXCEPTION 'EXECUTION_CHALLENGE_INPUT_INVALID' USING ERRCODE='42501';END IF;
 target=r->'target';prefix='/api/v1/connectors/'||(b->>'connectorId')||'/executions/'||g.execution_id::text;
 suffix=substr(target->>'path',length(prefix)+1);
 IF NOT anvil.execution_json_shape(target,ARRAY['method','path','queryHash','bodyHash']) OR jsonb_typeof(target->'path') IS DISTINCT FROM 'string'
  OR target->>'path' IS DISTINCT FROM prefix||suffix OR target->>'path' COLLATE "C" ~ '[[:cntrl:]]'
  OR target->>'path' ~ '[  ]' OR jsonb_typeof(target->'queryHash') IS DISTINCT FROM 'string' OR target->>'queryHash' !~ '^[0-9a-f]{64}$'
  OR jsonb_typeof(target->'bodyHash') IS DISTINCT FROM 'string' OR target->>'bodyHash' !~ '^[0-9a-f]{64}$' THEN RAISE EXCEPTION 'EXECUTION_CHALLENGE_TARGET_INVALID' USING ERRCODE='42501';END IF;
 IF r->>'purpose'='CREDENTIAL_EXCHANGE' THEN
  IF target->>'method' IS DISTINCT FROM 'POST' OR suffix IS DISTINCT FROM '/credential-exchange' THEN RAISE EXCEPTION 'EXECUTION_CHALLENGE_TARGET_INVALID' USING ERRCODE='42501';END IF;
 ELSE
  IF NOT COALESCE(target->>'method'='GET' AND (suffix='/commands' OR suffix~'^/commands/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/materials/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$')
    OR target->>'method'='POST' AND (suffix IN('/receipts','/observations','/heartbeat') OR suffix~'^/commands/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/permit$'),false) THEN
   RAISE EXCEPTION 'EXECUTION_CHALLENGE_TARGET_INVALID' USING ERRCODE='42501';END IF;
 END IF;
 IF NEW.server_sequence IS DISTINCT FROM (SELECT COALESCE(MAX(server_sequence),0)+1 FROM anvil.execution_challenges WHERE project_id=NEW.project_id AND grant_id=NEW.grant_id AND grant_version=NEW.grant_version) THEN
  RAISE EXCEPTION 'EXECUTION_CHALLENGE_SEQUENCE_INVALID' USING ERRCODE='42501';END IF;
 SELECT * INTO previous FROM anvil.execution_challenges WHERE project_id=NEW.project_id AND id=NEW.id ORDER BY version DESC LIMIT 1;
 IF NEW.version=1 THEN
  IF previous.id IS NOT NULL OR s->'previousRef' IS DISTINCT FROM 'null'::jsonb OR s->'consumption' IS DISTINCT FROM 'null'::jsonb
   OR (p->>'issuedAt')::timestamptz<at_time-interval '30 seconds' OR abs(extract(epoch FROM (r->>'issuedAt')::timestamptz-at_time))>30
   OR (p->>'expiresAt')::timestamptz>deadline THEN RAISE EXCEPTION 'EXECUTION_CHALLENGE_ISSUE_INVALID' USING ERRCODE='42501';END IF;
  IF (SELECT count(*) FROM anvil.execution_challenges WHERE project_id=NEW.project_id AND grant_id=NEW.grant_id AND grant_version=NEW.grant_version AND version=1)>=10000 THEN
   RAISE EXCEPTION 'EXECUTION_CHALLENGE_LIFETIME_LIMIT' USING ERRCODE='42501';END IF;
  IF (SELECT count(*) FROM anvil.execution_challenges c WHERE c.project_id=NEW.project_id AND c.grant_id=NEW.grant_id AND c.grant_version=NEW.grant_version AND c.version=1
    AND c.snapshot_json->'publicChallenge'->'purpose'=p->'purpose' AND (c.snapshot_json->'publicChallenge'->>'issuedAt')::timestamptz>at_time-interval '1 minute')>=(CASE WHEN p->>'purpose'='CREDENTIAL_EXCHANGE' THEN 5 ELSE 60 END) THEN
   RAISE EXCEPTION 'EXECUTION_CHALLENGE_RATE_LIMIT' USING ERRCODE='42501';END IF;
  IF r->>'purpose'='EXECUTION_REQUEST' AND EXISTS(SELECT 1 FROM anvil.execution_challenges c WHERE c.project_id=NEW.project_id AND c.grant_id=NEW.grant_id AND c.grant_version=NEW.grant_version AND c.version=1
   AND c.snapshot_json->'publicChallenge'->>'purpose'='EXECUTION_REQUEST' AND (c.snapshot_json->'publicChallenge'->>'expiresAt')::timestamptz>at_time
   AND NOT EXISTS(SELECT 1 FROM anvil.execution_challenges used WHERE used.project_id=c.project_id AND used.id=c.id AND used.version=2)) THEN
    RAISE EXCEPTION 'EXECUTION_CHALLENGE_ACTIVE' USING ERRCODE='42501';END IF;
  event_time=(p->>'issuedAt')::timestamptz;
 ELSE
  IF previous.version IS DISTINCT FROM 1 OR s->'previousRef' IS DISTINCT FROM jsonb_build_object('id',previous.id,'version',previous.version,'contentHash',previous.content_hash)
   OR at_time>=(p->>'expiresAt')::timestamptz
   OR s-ARRAY['sequence','previousRef','consumption'] IS DISTINCT FROM previous.snapshot_json-ARRAY['sequence','previousRef','consumption']
   OR NOT anvil.execution_json_shape(s->'consumption',ARRAY['proofHash','resultRef','consumedAt']) OR NOT anvil.execution_preparation_ref_valid(s->'consumption'->'resultRef')
   OR jsonb_typeof(s->'consumption'->'proofHash') IS DISTINCT FROM 'string' OR s->'consumption'->>'proofHash' !~ '^[0-9a-f]{64}$'
   OR NOT anvil.execution_iso_valid(s->'consumption'->'consumedAt') OR (s->'consumption'->>'consumedAt')::timestamptz>=LEAST((p->>'expiresAt')::timestamptz,deadline)
   OR (s->'consumption'->>'consumedAt')::timestamptz<(p->>'issuedAt')::timestamptz THEN RAISE EXCEPTION 'EXECUTION_CHALLENGE_CONSUMPTION_INVALID' USING ERRCODE='42501';END IF;
  event_time=(s->'consumption'->>'consumedAt')::timestamptz;
 END IF;
 SELECT COALESCE((snapshot_json->'consumption'->>'consumedAt')::timestamptz,(snapshot_json->'publicChallenge'->>'issuedAt')::timestamptz) INTO last_time
  FROM anvil.execution_challenges WHERE project_id=NEW.project_id AND grant_id=NEW.grant_id AND grant_version=NEW.grant_version ORDER BY server_sequence DESC LIMIT 1;
 IF event_time>at_time OR event_time<at_time-interval '30 seconds' OR (last_time IS NOT NULL AND event_time<last_time) THEN RAISE EXCEPTION 'EXECUTION_CHALLENGE_TIME_INVALID' USING ERRCODE='42501';END IF;
 RETURN NEW;
EXCEPTION WHEN OTHERS THEN RAISE EXCEPTION 'EXECUTION_CHALLENGE_EXACT_CURRENT_HISTORY_REQUIRED' USING ERRCODE='42501';
END;
$$;

CREATE FUNCTION anvil.guard_synthetic_execution_receipt() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE s jsonb;c anvil.execution_challenges%ROWTYPE;
BEGIN
 IF TG_OP<>'INSERT' THEN RAISE EXCEPTION 'EXECUTION_RECEIPT_IMMUTABLE' USING ERRCODE='42501';END IF;
 s=NEW.snapshot_json;
 SELECT * INTO c FROM anvil.execution_challenges WHERE project_id=NEW.project_id AND id=NEW.challenge_id AND version=1 AND grant_id=NEW.grant_id AND grant_version=NEW.grant_version;
 IF c.id IS NULL OR NOT anvil.synthetic_challenge_context(NEW.project_id,NEW.grant_id,NEW.grant_version,c.snapshot_json->'binding'->'grantRef')
  OR NOT anvil.execution_json_shape(s,ARRAY['kind','challengeRef','requestId','proofHash','recordedAt','credentialIssued','executionAuthorized','dispatchPerformed'])
  OR s->>'kind' IS DISTINCT FROM 'SYNTHETIC_PROOF_RESULT' OR NEW.content_hash IS DISTINCT FROM anvil.execution_json_hash(s)
  OR s->'challengeRef' IS DISTINCT FROM jsonb_build_object('id',c.id,'version',1,'contentHash',c.content_hash) OR s->'requestId' IS DISTINCT FROM c.snapshot_json->'request'->'requestId'
  OR jsonb_typeof(s->'proofHash') IS DISTINCT FROM 'string' OR s->>'proofHash' !~ '^[0-9a-f]{64}$'
  OR s->'credentialIssued' IS DISTINCT FROM 'false'::jsonb OR s->'executionAuthorized' IS DISTINCT FROM 'false'::jsonb OR s->'dispatchPerformed' IS DISTINCT FROM 'false'::jsonb
  OR NOT anvil.execution_iso_valid(s->'recordedAt') OR (s->>'recordedAt')::timestamptz>clock_timestamp() OR (s->>'recordedAt')::timestamptz<clock_timestamp()-interval '30 seconds'
  OR (s->>'recordedAt')::timestamptz<(c.snapshot_json->'publicChallenge'->>'issuedAt')::timestamptz
  OR clock_timestamp()>=(c.snapshot_json->'publicChallenge'->>'expiresAt')::timestamptz
  OR (s->>'recordedAt')::timestamptz>=(c.snapshot_json->'publicChallenge'->>'expiresAt')::timestamptz THEN RAISE EXCEPTION 'EXECUTION_RECEIPT_EXACT_CHALLENGE_REQUIRED' USING ERRCODE='42501';END IF;
 RETURN NEW;
EXCEPTION WHEN OTHERS THEN RAISE EXCEPTION 'EXECUTION_RECEIPT_EXACT_CHALLENGE_REQUIRED' USING ERRCODE='42501';
END;
$$;
CREATE FUNCTION anvil.guard_execution_challenge_complete() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE r anvil.execution_receipts%ROWTYPE;c anvil.execution_challenges%ROWTYPE;
BEGIN
 IF anvil.synthetic_grant_deadline(NEW.project_id,NEW.grant_id,NEW.grant_version,(SELECT content_hash FROM anvil.execution_grants WHERE project_id=NEW.project_id AND id=NEW.grant_id AND version=NEW.grant_version)) IS NULL THEN
  RAISE EXCEPTION 'EXECUTION_CHALLENGE_CURRENT_GRANT_REQUIRED' USING ERRCODE='42501';END IF;
 IF TG_TABLE_NAME='execution_credentials' THEN
  IF NOT EXISTS(SELECT 1 FROM anvil.execution_challenges WHERE project_id=NEW.project_id AND grant_id=NEW.grant_id AND grant_version=NEW.grant_version AND version=1) THEN
   RAISE EXCEPTION 'SYNTHETIC_CREDENTIAL_CHALLENGE_REQUIRED' USING ERRCODE='42501';END IF;RETURN NULL;
 ELSIF TG_TABLE_NAME='execution_receipts' THEN
  r=NEW;SELECT * INTO c FROM anvil.execution_challenges WHERE project_id=r.project_id AND id=r.challenge_id AND version=2;
 ELSE
  IF NEW.version=1 THEN RETURN NULL;END IF;c=NEW;
  SELECT * INTO r FROM anvil.execution_receipts WHERE project_id=c.project_id AND challenge_id=c.id AND grant_id=c.grant_id AND grant_version=c.grant_version;
 END IF;
 IF c.id IS NULL OR r.id IS NULL OR c.grant_id IS DISTINCT FROM r.grant_id OR c.grant_version IS DISTINCT FROM r.grant_version
  OR clock_timestamp()>=(c.snapshot_json->'publicChallenge'->>'expiresAt')::timestamptz
  OR c.snapshot_json->'consumption'->'resultRef' IS DISTINCT FROM jsonb_build_object('id',r.id,'version',r.version,'contentHash',r.content_hash)
  OR c.snapshot_json->'consumption'->'proofHash' IS DISTINCT FROM r.snapshot_json->'proofHash'
  OR (r.snapshot_json->>'recordedAt')::timestamptz>(c.snapshot_json->'consumption'->>'consumedAt')::timestamptz THEN
   RAISE EXCEPTION 'EXECUTION_CHALLENGE_ATOMIC_RESULT_REQUIRED' USING ERRCODE='42501';END IF;
 RETURN NULL;
END;
$$;
CREATE TRIGGER synthetic_credential_reservation_guard BEFORE INSERT OR UPDATE OR DELETE ON anvil.execution_credentials FOR EACH ROW EXECUTE FUNCTION anvil.guard_synthetic_credential_reservation();
CREATE TRIGGER execution_challenge_guard BEFORE INSERT OR UPDATE OR DELETE ON anvil.execution_challenges FOR EACH ROW EXECUTE FUNCTION anvil.guard_execution_challenge();
CREATE TRIGGER synthetic_execution_receipt_guard BEFORE INSERT OR UPDATE OR DELETE ON anvil.execution_receipts FOR EACH ROW EXECUTE FUNCTION anvil.guard_synthetic_execution_receipt();
CREATE CONSTRAINT TRIGGER synthetic_credential_challenge_complete AFTER INSERT ON anvil.execution_credentials DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION anvil.guard_execution_challenge_complete();
CREATE CONSTRAINT TRIGGER execution_challenge_complete AFTER INSERT ON anvil.execution_challenges DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION anvil.guard_execution_challenge_complete();
CREATE CONSTRAINT TRIGGER synthetic_execution_receipt_complete AFTER INSERT ON anvil.execution_receipts DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION anvil.guard_execution_challenge_complete();
GRANT INSERT ON anvil.execution_credentials,anvil.execution_challenges,anvil.execution_receipts TO anvil_v3_app;

-- 관측은 합성 공급자의 주장만 보존하며 STARTED/STOPPED도 실제 실행/회수 확정이 아니다.
CREATE TABLE anvil.execution_observations (
 project_id uuid NOT NULL,execution_id uuid NOT NULL,generation bigint NOT NULL,id uuid NOT NULL,version bigint NOT NULL CHECK(version=1),
 event_sequence bigint NOT NULL CHECK(event_sequence BETWEEN 1 AND 10000),grant_id uuid NOT NULL,grant_version bigint NOT NULL,
 content_hash text NOT NULL CHECK(content_hash~'^[0-9a-f]{64}$'),snapshot_json jsonb NOT NULL,
 event_id uuid GENERATED ALWAYS AS ((snapshot_json->'event'->>'eventId')::uuid) STORED,
 PRIMARY KEY(project_id,execution_id,generation,id,version),UNIQUE(project_id,execution_id,generation,event_sequence),UNIQUE(project_id,execution_id,generation,event_id),
 FOREIGN KEY(project_id,execution_id,generation) REFERENCES anvil.executions(project_id,id,generation),
 FOREIGN KEY(project_id,grant_id,grant_version) REFERENCES anvil.execution_grants(project_id,id,version)
);
CREATE TABLE anvil.execution_acknowledgements (
 project_id uuid NOT NULL,execution_id uuid NOT NULL,generation bigint NOT NULL,id uuid NOT NULL,version bigint NOT NULL CHECK(version BETWEEN 1 AND 10000),
 grant_id uuid NOT NULL,grant_version bigint NOT NULL,content_hash text NOT NULL CHECK(content_hash~'^[0-9a-f]{64}$'),snapshot_json jsonb NOT NULL,
 PRIMARY KEY(project_id,execution_id,generation,id,version),UNIQUE(project_id,execution_id,generation,version),
 FOREIGN KEY(project_id,execution_id,generation) REFERENCES anvil.executions(project_id,id,generation),
 FOREIGN KEY(project_id,grant_id,grant_version) REFERENCES anvil.execution_grants(project_id,id,version)
);
GRANT SELECT ON anvil.execution_observations,anvil.execution_acknowledgements TO anvil_v3_app;
REVOKE INSERT,UPDATE,DELETE ON anvil.execution_observations,anvil.execution_acknowledgements FROM anvil_v3_app;
CREATE FUNCTION anvil.execution_observation_current(pid uuid,eid uuid,gen bigint,gid uuid,ver bigint) RETURNS boolean LANGUAGE sql AS $$
 SELECT COALESCE(EXISTS(SELECT 1 FROM anvil.execution_grants g WHERE g.project_id=pid AND g.id=gid AND g.version=ver AND g.execution_id=eid AND g.generation=gen
  AND anvil.synthetic_challenge_context(pid,gid,ver,jsonb_build_object('id',gid,'version',ver,'contentHash',g.content_hash))
  AND EXISTS(SELECT 1 FROM anvil.execution_credentials c WHERE c.project_id=pid AND c.grant_id=gid AND c.grant_version=ver AND c.credential_generation=1)),false);
$$;
CREATE FUNCTION anvil.execution_observation_summary(pid uuid,eid uuid,gen bigint) RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE item record;highest bigint=0;expected bigint=1;max_seq bigint=0;stored bigint=0;digest text=anvil.execution_json_hash('[]'::jsonb);gaps jsonb='[]'::jsonb;
BEGIN
 FOR item IN SELECT event_sequence,snapshot_json->'event' AS event FROM anvil.execution_observations WHERE project_id=pid AND execution_id=eid AND generation=gen ORDER BY event_sequence LOOP
  IF item.event_sequence>expected THEN gaps=gaps||jsonb_build_array(jsonb_build_object('from',expected,'to',item.event_sequence-1));END IF;
  expected=item.event_sequence+1;max_seq=item.event_sequence;stored=stored+1;
  IF item.event_sequence=highest+1 THEN highest=highest+1;digest=anvil.execution_json_hash(jsonb_build_object('previous',digest,'eventHash',anvil.execution_json_hash(item.event)));END IF;
 END LOOP;
 RETURN jsonb_build_object('execution',jsonb_build_object('projectId',pid,'executionId',eid,'executionGeneration',gen),'highestContiguous',highest,'maxSequence',max_seq,'contiguousDigest',digest,'gaps',gaps,'storedCount',stored,'writerReleaseVerified',false,'executionAuthorized',false,'dispatchPerformed',false);
END;
$$;
CREATE FUNCTION anvil.guard_execution_observation() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE s jsonb;e jsonb;g anvil.execution_grants%ROWTYPE;at_time timestamptz=clock_timestamp();
BEGIN
 IF TG_OP<>'INSERT' THEN RAISE EXCEPTION 'EXECUTION_OBSERVATION_IMMUTABLE' USING ERRCODE='42501';END IF;
 s=NEW.snapshot_json;e=s->'event';SELECT * INTO g FROM anvil.execution_grants WHERE project_id=NEW.project_id AND id=NEW.grant_id AND version=NEW.grant_version;
 IF NEW.version IS DISTINCT FROM 1 OR NOT anvil.execution_observation_current(NEW.project_id,NEW.execution_id,NEW.generation,NEW.grant_id,NEW.grant_version)
  OR NOT anvil.execution_json_shape(s,ARRAY['event','grantRef','credentialGeneration','mode','receivedAt','transport','verification'])
  OR s->'grantRef' IS DISTINCT FROM jsonb_build_object('id',g.id,'version',g.version,'contentHash',g.content_hash) OR s->'credentialGeneration' IS DISTINCT FROM '1'::jsonb
  OR s->>'mode' IS DISTINCT FROM 'EXECUTION' OR s->>'transport' IS DISTINCT FROM 'SYNTHETIC_ONLY' OR s->>'verification' IS DISTINCT FROM 'PROVIDER_CLAIM_ONLY'
  OR NEW.content_hash IS DISTINCT FROM anvil.execution_json_hash(s) OR octet_length(anvil.execution_authority_canonical(e))>65536
  OR NOT anvil.execution_iso_valid(s->'receivedAt') OR (s->>'receivedAt')::timestamptz>at_time OR (s->>'receivedAt')::timestamptz<at_time-interval '30 seconds'
  OR NOT anvil.execution_json_shape(e,ARRAY['projectId','executionId','executionGeneration','sequence','eventId','type','commandId','envelopeHash','localRecordRef','processRef','occurredAt','reasonCode'])
  OR e->'projectId' IS DISTINCT FROM to_jsonb(NEW.project_id) OR e->'executionId' IS DISTINCT FROM to_jsonb(NEW.execution_id) OR e->'executionGeneration' IS DISTINCT FROM to_jsonb(NEW.generation)
  OR e->'sequence' IS DISTINCT FROM to_jsonb(NEW.event_sequence) OR NOT anvil.execution_preparation_ref_valid(e->'localRecordRef')
  OR (e->'processRef' IS DISTINCT FROM 'null'::jsonb AND NOT anvil.execution_preparation_ref_valid(e->'processRef'))
  OR jsonb_typeof(e->'eventId') IS DISTINCT FROM 'string' OR e->>'eventId' !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
  OR jsonb_typeof(e->'commandId') IS DISTINCT FROM 'string' OR e->>'commandId' !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
  OR jsonb_typeof(e->'envelopeHash') IS DISTINCT FROM 'string' OR e->>'envelopeHash' !~ '^[0-9a-f]{64}$'
  OR NOT EXISTS(SELECT 1 FROM anvil.execution_commands c WHERE c.project_id=NEW.project_id AND c.execution_id=NEW.execution_id AND c.generation=NEW.generation
   AND c.envelope_hash=e->>'envelopeHash' AND c.snapshot_json->'envelope'->>'commandId'=e->>'commandId')
  OR jsonb_typeof(e->'type') IS DISTINCT FROM 'string' OR e->>'type' NOT IN('RECEIVED','PREPARED','START_ATTEMPTED','PERMIT_RECORDED','PROVIDER_RESPONSE_RECEIVED','STARTED','REJECTED','UNKNOWN','STOP_REQUESTED','STOPPED','STOP_UNCONFIRMED','HEARTBEAT')
  OR jsonb_typeof(e->'reasonCode') IS DISTINCT FROM 'string' OR e->>'reasonCode' NOT IN('NONE','UNVERIFIED_PROVIDER_CLAIM','PROVIDER_RESPONSE_LOST','RECORD_UNCERTAIN','STOP_UNCONFIRMED','REJECTED_BY_PROVIDER')
  OR NOT anvil.execution_iso_valid(e->'occurredAt') OR (e->>'occurredAt')::timestamptz>at_time+interval '30 seconds' THEN RAISE EXCEPTION 'EXECUTION_OBSERVATION_EXACT_CLAIM_REQUIRED' USING ERRCODE='42501';END IF;
 IF (SELECT count(*) FROM anvil.execution_observations WHERE project_id=NEW.project_id AND execution_id=NEW.execution_id AND generation=NEW.generation)>=10000
  OR (SELECT COALESCE(sum(octet_length(anvil.execution_authority_canonical(snapshot_json))),0) FROM anvil.execution_observations WHERE project_id=NEW.project_id AND execution_id=NEW.execution_id AND generation=NEW.generation)+octet_length(anvil.execution_authority_canonical(s))>16777216 THEN
  RAISE EXCEPTION 'EXECUTION_OBSERVATION_LIMIT' USING ERRCODE='42501';END IF;
 RETURN NEW;
EXCEPTION WHEN OTHERS THEN RAISE EXCEPTION 'EXECUTION_OBSERVATION_EXACT_CLAIM_REQUIRED' USING ERRCODE='42501';
END;
$$;
CREATE FUNCTION anvil.guard_execution_acknowledgement() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE s jsonb;prior anvil.execution_acknowledgements%ROWTYPE;summary jsonb;at_time timestamptz=clock_timestamp();
BEGIN
 IF TG_OP<>'INSERT' THEN RAISE EXCEPTION 'EXECUTION_ACK_IMMUTABLE' USING ERRCODE='42501';END IF;s=NEW.snapshot_json;
 SELECT * INTO prior FROM anvil.execution_acknowledgements WHERE project_id=NEW.project_id AND execution_id=NEW.execution_id AND generation=NEW.generation ORDER BY version DESC LIMIT 1;
 summary=anvil.execution_observation_summary(NEW.project_id,NEW.execution_id,NEW.generation);
 IF NOT anvil.execution_observation_current(NEW.project_id,NEW.execution_id,NEW.generation,NEW.grant_id,NEW.grant_version)
  OR NEW.version IS DISTINCT FROM COALESCE(prior.version,0)+1 OR (prior.id IS NOT NULL AND NEW.id IS DISTINCT FROM prior.id)
  OR NOT anvil.execution_json_shape(s,ARRAY['execution','highestContiguous','maxSequence','contiguousDigest','gaps','storedCount','writerReleaseVerified','executionAuthorized','dispatchPerformed','recordedAt'])
  OR NEW.content_hash IS DISTINCT FROM anvil.execution_json_hash(s) OR s-'recordedAt' IS DISTINCT FROM summary
  OR (summary->>'storedCount')::bigint<=COALESCE((prior.snapshot_json->>'storedCount')::bigint,0)
  OR NOT anvil.execution_iso_valid(s->'recordedAt') OR (s->>'recordedAt')::timestamptz>at_time OR (s->>'recordedAt')::timestamptz<at_time-interval '30 seconds'
  OR (prior.id IS NOT NULL AND (s->>'recordedAt')::timestamptz<(prior.snapshot_json->>'recordedAt')::timestamptz) THEN
   RAISE EXCEPTION 'EXECUTION_ACK_EXACT_CONTIGUOUS_REQUIRED' USING ERRCODE='42501';END IF;
 RETURN NEW;
EXCEPTION WHEN OTHERS THEN RAISE EXCEPTION 'EXECUTION_ACK_EXACT_CONTIGUOUS_REQUIRED' USING ERRCODE='42501';
END;
$$;
CREATE FUNCTION anvil.guard_execution_observation_complete() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE latest anvil.execution_acknowledgements%ROWTYPE;
BEGIN
 IF NOT anvil.execution_observation_current(NEW.project_id,NEW.execution_id,NEW.generation,NEW.grant_id,NEW.grant_version) THEN RAISE EXCEPTION 'EXECUTION_OBSERVATION_CURRENT_REQUIRED' USING ERRCODE='42501';END IF;
 SELECT * INTO latest FROM anvil.execution_acknowledgements WHERE project_id=NEW.project_id AND execution_id=NEW.execution_id AND generation=NEW.generation ORDER BY version DESC LIMIT 1;
 IF latest.id IS NULL OR latest.content_hash IS DISTINCT FROM anvil.execution_json_hash(latest.snapshot_json)
  OR latest.snapshot_json-'recordedAt' IS DISTINCT FROM anvil.execution_observation_summary(NEW.project_id,NEW.execution_id,NEW.generation) THEN
   RAISE EXCEPTION 'EXECUTION_OBSERVATION_ACK_ATOMIC_REQUIRED' USING ERRCODE='42501';END IF;RETURN NULL;
END;
$$;
CREATE TRIGGER execution_observation_guard BEFORE INSERT OR UPDATE OR DELETE ON anvil.execution_observations FOR EACH ROW EXECUTE FUNCTION anvil.guard_execution_observation();
CREATE TRIGGER execution_acknowledgement_guard BEFORE INSERT OR UPDATE OR DELETE ON anvil.execution_acknowledgements FOR EACH ROW EXECUTE FUNCTION anvil.guard_execution_acknowledgement();
CREATE CONSTRAINT TRIGGER execution_observation_complete AFTER INSERT ON anvil.execution_observations DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION anvil.guard_execution_observation_complete();
CREATE CONSTRAINT TRIGGER execution_acknowledgement_complete AFTER INSERT ON anvil.execution_acknowledgements DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION anvil.guard_execution_observation_complete();
GRANT INSERT ON anvil.execution_observations,anvil.execution_acknowledgements TO anvil_v3_app;

-- 같은 서명 요청은 이후 ACK가 진전해도 최초 결과의 ACK 버전을 그대로 반환한다.
CREATE TABLE anvil.execution_observation_results (
 project_id uuid NOT NULL,execution_id uuid NOT NULL,generation bigint NOT NULL,
 proof_result_id uuid NOT NULL,proof_result_version bigint NOT NULL CHECK(proof_result_version=1),ack_id uuid NOT NULL,ack_version bigint NOT NULL,
 content_hash text NOT NULL CHECK(content_hash~'^[0-9a-f]{64}$'),snapshot_json jsonb NOT NULL,
 PRIMARY KEY(project_id,execution_id,generation,proof_result_id,proof_result_version),UNIQUE(project_id,proof_result_id,proof_result_version),
 FOREIGN KEY(project_id,proof_result_id,proof_result_version) REFERENCES anvil.execution_receipts(project_id,id,version),
 FOREIGN KEY(project_id,execution_id,generation,ack_id,ack_version) REFERENCES anvil.execution_acknowledgements(project_id,execution_id,generation,id,version)
);
GRANT SELECT ON anvil.execution_observation_results TO anvil_v3_app;
REVOKE INSERT,UPDATE,DELETE ON anvil.execution_observation_results FROM anvil_v3_app;
CREATE FUNCTION anvil.guard_execution_observation_result() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE s jsonb;r anvil.execution_receipts%ROWTYPE;c anvil.execution_challenges%ROWTYPE;a anvil.execution_acknowledgements%ROWTYPE;g anvil.execution_grants%ROWTYPE;at_time timestamptz=clock_timestamp();
BEGIN
 IF TG_OP<>'INSERT' THEN RAISE EXCEPTION 'EXECUTION_OBSERVATION_RESULT_IMMUTABLE' USING ERRCODE='42501';END IF;s=NEW.snapshot_json;
 SELECT * INTO r FROM anvil.execution_receipts WHERE project_id=NEW.project_id AND id=NEW.proof_result_id AND version=NEW.proof_result_version;
 SELECT * INTO c FROM anvil.execution_challenges WHERE project_id=r.project_id AND id=r.challenge_id AND version=r.challenge_version;
 SELECT * INTO g FROM anvil.execution_grants WHERE project_id=r.project_id AND id=r.grant_id AND version=r.grant_version;
 SELECT * INTO a FROM anvil.execution_acknowledgements WHERE project_id=NEW.project_id AND execution_id=NEW.execution_id AND generation=NEW.generation ORDER BY version DESC LIMIT 1;
 IF r.id IS NULL OR c.id IS NULL OR g.id IS NULL OR a.id IS NULL OR g.execution_id IS DISTINCT FROM NEW.execution_id OR g.generation IS DISTINCT FROM NEW.generation
  OR NOT anvil.execution_observation_current(NEW.project_id,NEW.execution_id,NEW.generation,g.id,g.version)
  OR NOT anvil.execution_json_shape(s,ARRAY['transport','proofResultRef','ackRef','bodyHash','recordedAt','executionAuthorized','dispatchPerformed'])
  OR NEW.content_hash IS DISTINCT FROM anvil.execution_json_hash(s) OR s->>'transport' IS DISTINCT FROM 'SYNTHETIC_ONLY'
  OR s->'executionAuthorized' IS DISTINCT FROM 'false'::jsonb OR s->'dispatchPerformed' IS DISTINCT FROM 'false'::jsonb
  OR s->'proofResultRef' IS DISTINCT FROM jsonb_build_object('id',r.id,'version',r.version,'contentHash',r.content_hash)
  OR s->'ackRef' IS DISTINCT FROM jsonb_build_object('id',a.id,'version',a.version,'contentHash',a.content_hash)
  OR NEW.ack_id IS DISTINCT FROM a.id OR NEW.ack_version IS DISTINCT FROM a.version
  OR r.content_hash IS DISTINCT FROM anvil.execution_json_hash(r.snapshot_json) OR a.content_hash IS DISTINCT FROM anvil.execution_json_hash(a.snapshot_json)
  OR c.snapshot_json->'request'->>'purpose' IS DISTINCT FROM 'EXECUTION_REQUEST'
  OR c.snapshot_json->'request'->'target'->>'method' IS DISTINCT FROM 'POST'
  OR c.snapshot_json->'request'->'target'->>'path' IS DISTINCT FROM '/api/v1/connectors/'||(g.snapshot_json->'binding'->'registration'->>'connectorId')||'/executions/'||NEW.execution_id::text||'/observations'
  OR c.snapshot_json->'request'->'target'->>'queryHash' IS DISTINCT FROM anvil.execution_json_hash('{}'::jsonb)
  OR s->'bodyHash' IS DISTINCT FROM c.snapshot_json->'request'->'target'->'bodyHash'
  OR NOT anvil.execution_iso_valid(s->'recordedAt') OR (s->>'recordedAt')::timestamptz>at_time OR (s->>'recordedAt')::timestamptz<at_time-interval '30 seconds' THEN
   RAISE EXCEPTION 'EXECUTION_OBSERVATION_RESULT_EXACT_BINDING_REQUIRED' USING ERRCODE='42501';END IF;
 RETURN NEW;
EXCEPTION WHEN OTHERS THEN RAISE EXCEPTION 'EXECUTION_OBSERVATION_RESULT_EXACT_BINDING_REQUIRED' USING ERRCODE='42501';
END;
$$;
CREATE TRIGGER execution_observation_result_guard BEFORE INSERT OR UPDATE OR DELETE ON anvil.execution_observation_results FOR EACH ROW EXECUTE FUNCTION anvil.guard_execution_observation_result();
GRANT INSERT ON anvil.execution_observation_results TO anvil_v3_app;

-- 합성 시작 허가는 같은 실행/세대에서 1회만 보존한다. 실제 OS 실행 권한은 아니다.
CREATE TABLE anvil.execution_start_permits (
 project_id uuid NOT NULL,execution_id uuid NOT NULL,generation bigint NOT NULL,id uuid NOT NULL,version bigint NOT NULL CHECK(version=1),
 proof_result_id uuid NOT NULL,proof_result_version bigint NOT NULL CHECK(proof_result_version=1),content_hash text NOT NULL CHECK(content_hash~'^[0-9a-f]{64}$'),snapshot_json jsonb NOT NULL,
 PRIMARY KEY(project_id,execution_id,generation,id,version),UNIQUE(project_id,execution_id,generation),UNIQUE(project_id,proof_result_id,proof_result_version),
 FOREIGN KEY(project_id,execution_id,generation) REFERENCES anvil.executions(project_id,id,generation),
 FOREIGN KEY(project_id,proof_result_id,proof_result_version) REFERENCES anvil.execution_receipts(project_id,id,version)
);
GRANT SELECT ON anvil.execution_start_permits TO anvil_v3_app;
REVOKE INSERT,UPDATE,DELETE ON anvil.execution_start_permits FROM anvil_v3_app;
CREATE FUNCTION anvil.guard_execution_start_permit() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE s jsonb;sc jsonb;req jsonb;g anvil.execution_grants%ROWTYPE;c anvil.execution_commands%ROWTYPE;r anvil.execution_receipts%ROWTYPE;ch anvil.execution_challenges%ROWTYPE;source_refs jsonb;deadline timestamptz;at_time timestamptz=clock_timestamp();
BEGIN
 IF TG_OP<>'INSERT' THEN RAISE EXCEPTION 'EXECUTION_START_PERMIT_IMMUTABLE' USING ERRCODE='42501';END IF;s=NEW.snapshot_json;sc=s->'scope';req=s->'request';
 SELECT * INTO g FROM anvil.execution_grants WHERE project_id=NEW.project_id AND id=(sc->'grantRef'->>'id')::uuid AND version=(sc->'grantRef'->>'version')::bigint;
 SELECT * INTO c FROM anvil.execution_commands WHERE project_id=NEW.project_id AND execution_id=NEW.execution_id AND generation=NEW.generation AND snapshot_json->'envelope'->>'commandId'=s->>'commandId';
 SELECT * INTO r FROM anvil.execution_receipts WHERE project_id=NEW.project_id AND id=NEW.proof_result_id AND version=NEW.proof_result_version;
 SELECT * INTO ch FROM anvil.execution_challenges WHERE project_id=r.project_id AND id=r.challenge_id AND version=1;
 SELECT jsonb_agg(v.ref ORDER BY v.pos) INTO source_refs FROM(SELECT source->'observationRef' AS ref,min(pos) AS pos FROM jsonb_array_elements(g.snapshot_json->'binding'->'intent'->'sourceScopes') WITH ORDINALITY AS x(source,pos) GROUP BY source->'observationRef')v;
 deadline=anvil.synthetic_grant_deadline(NEW.project_id,g.id,g.version,g.content_hash);
 IF NEW.version IS DISTINCT FROM 1 OR NEW.proof_result_version IS DISTINCT FROM 1 OR g.id IS NULL OR c.id IS NULL OR r.id IS NULL OR ch.id IS NULL OR deadline IS NULL
  OR g.execution_id IS DISTINCT FROM NEW.execution_id OR g.generation IS DISTINCT FROM NEW.generation OR r.grant_id IS DISTINCT FROM g.id OR r.grant_version IS DISTINCT FROM g.version
  OR NOT anvil.synthetic_challenge_context(NEW.project_id,g.id,g.version,sc->'grantRef')
  OR NOT anvil.execution_json_shape(s,ARRAY['scope','commandId','commandRef','request','requestHash','proofRef','bindingHash','state','issuedAt','expiresAt','executionAuthorized','dispatchPerformed'])
  OR NOT anvil.execution_json_shape(sc,ARRAY['mode','projectId','connectorId','executionId','executionGeneration','grantRef','credentialGeneration'])
  OR sc->>'mode' IS DISTINCT FROM 'EXECUTION' OR sc->'projectId' IS DISTINCT FROM to_jsonb(NEW.project_id) OR sc->'executionId' IS DISTINCT FROM to_jsonb(NEW.execution_id)
  OR sc->'executionGeneration' IS DISTINCT FROM to_jsonb(NEW.generation) OR sc->'credentialGeneration' IS DISTINCT FROM '1'::jsonb
  OR sc->'connectorId' IS DISTINCT FROM g.snapshot_json->'binding'->'registration'->'connectorId'
  OR sc->'grantRef' IS DISTINCT FROM jsonb_build_object('id',g.id,'version',g.version,'contentHash',g.content_hash)
  OR NEW.content_hash IS DISTINCT FROM anvil.execution_json_hash(s) OR s->>'state' IS DISTINCT FROM 'SYNTHETIC_CONSUMED_NO_AUTHORITY'
  OR s->'executionAuthorized' IS DISTINCT FROM 'false'::jsonb OR s->'dispatchPerformed' IS DISTINCT FROM 'false'::jsonb
  OR s->'commandRef' IS DISTINCT FROM jsonb_build_object('id',c.id,'version',c.version,'contentHash',c.content_hash)
  OR c.grant_id IS DISTINCT FROM g.id OR c.grant_version IS DISTINCT FROM g.version OR c.snapshot_json->>'operation' IS DISTINCT FROM 'START_SESSION'
  OR s->'proofRef' IS DISTINCT FROM jsonb_build_object('id',r.id,'version',r.version,'contentHash',r.content_hash) OR r.content_hash IS DISTINCT FROM anvil.execution_json_hash(r.snapshot_json)
  OR jsonb_typeof(s->'bindingHash') IS DISTINCT FROM 'string' OR s->>'bindingHash' !~ '^[0-9a-f]{64}$'
  OR NOT anvil.execution_json_shape(req,ARRAY['envelopeHash','localAttemptRef','sourceObservationRefs','osOwnershipRef'])
  OR NOT anvil.execution_preparation_ref_valid(req->'localAttemptRef') OR NOT anvil.execution_preparation_ref_valid(req->'osOwnershipRef')
  OR req->>'envelopeHash' IS DISTINCT FROM c.envelope_hash OR req->'sourceObservationRefs' IS DISTINCT FROM source_refs
  OR NOT(g.snapshot_json->'binding'->'checks'->'osFence'->'evidenceRefs' @> jsonb_build_array(req->'osOwnershipRef'))
  OR s->>'requestHash' IS DISTINCT FROM anvil.execution_json_hash(req)
  OR ch.snapshot_json->'request'->>'purpose' IS DISTINCT FROM 'EXECUTION_REQUEST' OR ch.snapshot_json->'request'->'target'->>'method' IS DISTINCT FROM 'POST'
  OR ch.snapshot_json->'request'->'target'->>'path' IS DISTINCT FROM '/api/v1/connectors/'||(sc->>'connectorId')||'/executions/'||NEW.execution_id::text||'/commands/'||(s->>'commandId')||'/permit'
  OR ch.snapshot_json->'request'->'target'->>'queryHash' IS DISTINCT FROM anvil.execution_json_hash('{}'::jsonb)
  OR ch.snapshot_json->'request'->'target'->>'bodyHash' IS DISTINCT FROM anvil.execution_json_hash(req)
  OR NOT anvil.execution_iso_valid(s->'issuedAt') OR NOT anvil.execution_iso_valid(s->'expiresAt')
  OR (s->>'issuedAt')::timestamptz>at_time OR (s->>'issuedAt')::timestamptz<at_time-interval '30 seconds'
  OR (s->>'expiresAt')::timestamptz<=(s->>'issuedAt')::timestamptz OR (s->>'expiresAt')::timestamptz>(s->>'issuedAt')::timestamptz+interval '30 seconds'
  OR (s->>'expiresAt')::timestamptz>LEAST(deadline,(c.snapshot_json->'envelope'->>'expiresAt')::timestamptz,(ch.snapshot_json->'publicChallenge'->>'expiresAt')::timestamptz)
  OR (s->>'expiresAt')::timestamptz<=at_time THEN RAISE EXCEPTION 'EXECUTION_START_PERMIT_EXACT_BINDING_REQUIRED' USING ERRCODE='42501';END IF;
 RETURN NEW;
EXCEPTION WHEN OTHERS THEN RAISE EXCEPTION 'EXECUTION_START_PERMIT_EXACT_BINDING_REQUIRED' USING ERRCODE='42501';
END;
$$;
CREATE FUNCTION anvil.guard_execution_start_permit_complete() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE sc jsonb=NEW.snapshot_json->'scope';g anvil.execution_grants%ROWTYPE;
BEGIN
 SELECT * INTO g FROM anvil.execution_grants WHERE project_id=NEW.project_id AND id=(sc->'grantRef'->>'id')::uuid AND version=(sc->'grantRef'->>'version')::bigint;
 IF g.id IS NULL OR anvil.synthetic_grant_deadline(NEW.project_id,g.id,g.version,g.content_hash) IS NULL OR clock_timestamp()>=(NEW.snapshot_json->>'expiresAt')::timestamptz
  OR NOT EXISTS(SELECT 1 FROM anvil.execution_receipts r JOIN anvil.execution_challenges c ON c.project_id=r.project_id AND c.id=r.challenge_id AND c.version=2
   WHERE r.project_id=NEW.project_id AND r.id=NEW.proof_result_id AND r.version=NEW.proof_result_version AND r.grant_id=g.id AND r.grant_version=g.version
    AND c.snapshot_json->'consumption'->'resultRef'=NEW.snapshot_json->'proofRef') THEN RAISE EXCEPTION 'EXECUTION_START_PERMIT_PROOF_ATOMIC_REQUIRED' USING ERRCODE='42501';END IF;RETURN NULL;
END;
$$;
CREATE TRIGGER execution_start_permit_guard BEFORE INSERT OR UPDATE OR DELETE ON anvil.execution_start_permits FOR EACH ROW EXECUTE FUNCTION anvil.guard_execution_start_permit();
CREATE CONSTRAINT TRIGGER execution_start_permit_complete AFTER INSERT ON anvil.execution_start_permits DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION anvil.guard_execution_start_permit_complete();
GRANT INSERT ON anvil.execution_start_permits TO anvil_v3_app;
