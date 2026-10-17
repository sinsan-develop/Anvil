-- 43: 상태 조회 전용 host 신뢰. 프로젝트/환경/파일/실행 grant 테이블은 만들지 않는다.
CREATE TABLE anvil.connectors(
 id uuid PRIMARY KEY,project_id uuid NOT NULL REFERENCES anvil.projects(id),owner_user_id uuid NOT NULL REFERENCES anvil.users(id),
 client_id uuid NOT NULL,credential_generation bigint NOT NULL CHECK(credential_generation>0),
 host_label text NOT NULL,host_fingerprint text NOT NULL CHECK(host_fingerprint~'^[0-9a-f]{64}$'),
 public_key_spki text CHECK(public_key_spki~'^[A-Za-z0-9_-]{122}$'),connector_version text,
 registration_id uuid NOT NULL UNIQUE,generation bigint NOT NULL CHECK(generation BETWEEN 1 AND 9007199254740991),
 status text NOT NULL CHECK(status IN('REGISTRATION_PENDING','TRUSTED','REVOKED')),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),revoked_at timestamptz,
 UNIQUE(project_id,id),FOREIGN KEY(owner_user_id,client_id) REFERENCES anvil.clients(user_id,id),
 CHECK(status<>'TRUSTED' OR public_key_spki IS NOT NULL),CHECK((status='REVOKED')=(revoked_at IS NOT NULL))
);
CREATE TABLE anvil.connector_registrations(
 id uuid PRIMARY KEY,project_id uuid NOT NULL,connector_id uuid NOT NULL UNIQUE,
 requested_by uuid NOT NULL,client_id uuid NOT NULL,session_id uuid NOT NULL REFERENCES anvil.auth_sessions(id),
 credential_generation bigint NOT NULL CHECK(credential_generation>0),control_generation bigint NOT NULL CHECK(control_generation>0),
 version bigint NOT NULL CHECK(version BETWEEN 1 AND 9007199254740991),
 state text NOT NULL CHECK(state IN('CREATED','CHALLENGED','PROVED_WAITING_CONFIRMATION','CONFIRMED','REJECTED','ISSUED','REVOKED')),
 expected_host_fingerprint text NOT NULL CHECK(expected_host_fingerprint~'^[0-9a-f]{64}$'),observed_host_fingerprint text CHECK(observed_host_fingerprint~'^[0-9a-f]{64}$'),
 code_digest text NOT NULL UNIQUE CHECK(code_digest~'^[0-9a-f]{64}$'),code_consumed_at timestamptz,enroll_request_hash text CHECK(enroll_request_hash~'^[0-9a-f]{64}$'),
 failed_attempts integer NOT NULL DEFAULT 0 CHECK(failed_attempts BETWEEN 0 AND 5),
 scope_json jsonb NOT NULL,scope_digest text NOT NULL CHECK(scope_digest~'^[0-9a-f]{64}$'),policy_ref jsonb NOT NULL,
 created_command_id uuid NOT NULL REFERENCES anvil.commands(id),decision_command_id uuid REFERENCES anvil.commands(id),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),expires_at timestamptz NOT NULL,proofed_at timestamptz,issued_at timestamptz,revoked_at timestamptz,
 UNIQUE(project_id,id),FOREIGN KEY(project_id,connector_id) REFERENCES anvil.connectors(project_id,id) DEFERRABLE INITIALLY DEFERRED,
 FOREIGN KEY(requested_by,client_id) REFERENCES anvil.clients(user_id,id),
 CHECK(expires_at>created_at AND expires_at<=created_at+interval '10 minutes'),
 CHECK((scope_json->>'kind'='HOST_TRUST_REGISTRATION' AND scope_json->>'credentialScope'='REGISTRATION_STATUS_ONLY' AND scope_json->'grants'='[]'::jsonb) IS TRUE)
);
ALTER TABLE anvil.connectors ADD CONSTRAINT connector_registration_pair FOREIGN KEY(project_id,registration_id)
 REFERENCES anvil.connector_registrations(project_id,id) DEFERRABLE INITIALLY DEFERRED;
CREATE TABLE anvil.connector_registration_challenges(
 id uuid PRIMARY KEY,project_id uuid NOT NULL,registration_id uuid NOT NULL,
 purpose text NOT NULL CHECK(purpose IN('HOST_PROOF','EXCHANGE')),payload_json jsonb NOT NULL,
 preflight_digest text CHECK(preflight_digest~'^[0-9a-f]{64}$'),failed_attempts integer NOT NULL DEFAULT 0 CHECK(failed_attempts BETWEEN 0 AND 5),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),expires_at timestamptz NOT NULL,consumed_at timestamptz,
 proof_signature text CHECK(proof_signature~'^[A-Za-z0-9_-]{86}$'),
 UNIQUE(registration_id,purpose),FOREIGN KEY(project_id,registration_id) REFERENCES anvil.connector_registrations(project_id,id),
 CHECK(expires_at>created_at AND expires_at<=created_at+interval '2 minutes'),
 CHECK((consumed_at IS NULL)=(proof_signature IS NULL)),CHECK((purpose='HOST_PROOF')=(preflight_digest IS NULL))
);
CREATE TABLE anvil.connector_credentials(
 id uuid PRIMARY KEY,project_id uuid NOT NULL,connector_id uuid NOT NULL,registration_id uuid NOT NULL UNIQUE,
 generation bigint NOT NULL CHECK(generation>0),token_digest text NOT NULL UNIQUE CHECK(token_digest~'^[0-9a-f]{64}$'),
 scope text NOT NULL CHECK(scope='REGISTRATION_STATUS_ONLY'),scope_digest text NOT NULL CHECK(scope_digest~'^[0-9a-f]{64}$'),
 issued_at timestamptz NOT NULL,expires_at timestamptz NOT NULL,revoked_at timestamptz,
 FOREIGN KEY(project_id,connector_id) REFERENCES anvil.connectors(project_id,id),FOREIGN KEY(project_id,registration_id) REFERENCES anvil.connector_registrations(project_id,id),
 CHECK(expires_at>issued_at AND expires_at<=issued_at+interval '15 minutes')
);
GRANT SELECT,INSERT,UPDATE ON anvil.connectors,anvil.connector_registrations,anvil.connector_registration_challenges,anvil.connector_credentials TO anvil_v3_app;
REVOKE DELETE ON anvil.connectors,anvil.connector_registrations,anvil.connector_registration_challenges,anvil.connector_credentials FROM anvil_v3_app;

CREATE FUNCTION anvil.connector_basis_current(rid uuid,recent boolean) RETURNS boolean LANGUAGE sql AS $$
 SELECT EXISTS(SELECT 1 FROM anvil.connector_registrations r
 JOIN anvil.users u ON u.id=r.requested_by AND u.status='ACTIVE' AND u.revoked_at IS NULL AND u.credential_generation=r.credential_generation
 JOIN anvil.clients cl ON cl.user_id=u.id AND cl.id=r.client_id AND cl.revoked_at IS NULL
 JOIN anvil.auth_sessions s ON s.id=r.session_id AND s.user_id=u.id AND s.client_id=cl.id AND s.credential_generation=u.credential_generation AND s.revoked_at IS NULL
 JOIN anvil.projects p ON p.id=r.project_id AND p.archived_at IS NULL
 JOIN anvil.project_members pm ON pm.project_id=p.id AND pm.user_id=u.id AND pm.participation='OWNER' AND pm.revoked_at IS NULL
 JOIN anvil.project_control pc ON pc.project_id=p.id AND pc.actor_id=u.id AND pc.client_id=cl.id AND pc.generation=r.control_generation AND pc.revoked_at IS NULL
 JOIN anvil.permission_policies pp ON pp.project_id=p.id AND pp.id::text=r.policy_ref->>'id' AND pp.head_version::text=r.policy_ref->>'version'
 JOIN anvil.permission_policy_versions pv ON pv.project_id=p.id AND pv.policy_id=pp.id AND pv.version=pp.head_version AND pv.content_hash=r.policy_ref->>'contentHash'
 WHERE r.id=rid AND s.idle_expires_at>clock_timestamp() AND s.absolute_expires_at>clock_timestamp() AND (NOT recent OR s.reauth_until>clock_timestamp())
 AND EXISTS(SELECT 1 FROM jsonb_array_elements(pv.rules_json) rule WHERE rule->'subjectRef'=jsonb_build_object('kind','HUMAN','userId',u.id)
  AND rule->'targetScopes'=jsonb_build_array(jsonb_build_object('kind','PROJECT','projectId',p.id)) AND (rule->'operations') ? 'registerConnector' AND rule->>'disposition' IN('AUTO','REQUIRE_APPROVAL') AND (rule->>'expiresAt')::timestamptz>clock_timestamp())
 AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(pv.rules_json) rule WHERE rule->'subjectRef'=jsonb_build_object('kind','HUMAN','userId',u.id)
  AND rule->'targetScopes'=jsonb_build_array(jsonb_build_object('kind','PROJECT','projectId',p.id)) AND (rule->'operations') ? 'registerConnector' AND rule->>'disposition'='DENY' AND (rule->>'expiresAt')::timestamptz>clock_timestamp()));
$$;

CREATE FUNCTION anvil.connector_human_authorized(pid uuid,op text) RETURNS boolean LANGUAGE sql AS $$
 SELECT EXISTS(SELECT 1 FROM anvil.commands c
 JOIN anvil.authorization_receipts ar ON ar.id=c.authorization_receipt_id AND ar.command_id=c.id AND ar.scope_kind='PROJECT' AND ar.scope_id=pid AND ar.policy_ref=c.policy_ref
 JOIN anvil.project_control pc ON pc.project_id=pid AND pc.actor_id=c.actor_id AND pc.client_id=c.client_id AND pc.generation=c.control_generation AND pc.revoked_at IS NULL
 JOIN anvil.project_members pm ON pm.project_id=pid AND pm.user_id=c.actor_id AND pm.participation='OWNER' AND pm.revoked_at IS NULL
 JOIN anvil.projects p ON p.id=pid AND p.archived_at IS NULL
 JOIN anvil.permission_policies pp ON pp.project_id=pid AND pp.id::text=c.policy_ref->>'id' AND pp.head_version::text=c.policy_ref->>'version'
 JOIN anvil.permission_policy_versions pv ON pv.project_id=pid AND pv.policy_id=pp.id AND pv.version=pp.head_version AND pv.content_hash=c.policy_ref->>'contentHash'
 WHERE c.id::text=current_setting('anvil.command_id',true) AND c.actor_id::text=current_setting('anvil.actor_id',true) AND c.client_id::text=current_setting('anvil.client_id',true)
 AND c.scope_kind='PROJECT' AND c.scope_id=pid AND c.project_id=pid AND c.operation=op AND op IN('registerConnector','confirmConnectorRegistration','revokeConnector') AND c.state='APPLIED'
 AND ar.subject_ref=jsonb_build_object('kind','HUMAN','userId',c.actor_id,'clientId',c.client_id)
 AND EXISTS(SELECT 1 FROM anvil.auth_sessions s JOIN anvil.users u ON u.id=s.user_id JOIN anvil.clients cl ON cl.id=s.client_id AND cl.user_id=u.id WHERE s.user_id=c.actor_id AND s.client_id=c.client_id
  AND u.status='ACTIVE' AND u.revoked_at IS NULL AND cl.revoked_at IS NULL AND s.revoked_at IS NULL AND s.credential_generation=u.credential_generation AND s.reauth_until>clock_timestamp() AND s.idle_expires_at>clock_timestamp() AND s.absolute_expires_at>clock_timestamp())
 AND EXISTS(SELECT 1 FROM jsonb_array_elements(pv.rules_json) rule WHERE rule->'subjectRef'=jsonb_build_object('kind','HUMAN','userId',c.actor_id) AND rule->'targetScopes'=jsonb_build_array(jsonb_build_object('kind','PROJECT','projectId',pid)) AND (rule->'operations') ? op AND rule->>'disposition' IN('AUTO','REQUIRE_APPROVAL') AND (rule->>'expiresAt')::timestamptz>clock_timestamp())
 AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(pv.rules_json) rule WHERE rule->'subjectRef'=jsonb_build_object('kind','HUMAN','userId',c.actor_id) AND rule->'targetScopes'=jsonb_build_array(jsonb_build_object('kind','PROJECT','projectId',pid)) AND (rule->'operations') ? op AND rule->>'disposition'='DENY' AND (rule->>'expiresAt')::timestamptz>clock_timestamp())
 AND (NOT EXISTS(SELECT 1 FROM jsonb_array_elements(pv.rules_json) rule WHERE rule->'subjectRef'=jsonb_build_object('kind','HUMAN','userId',c.actor_id) AND rule->'targetScopes'=jsonb_build_array(jsonb_build_object('kind','PROJECT','projectId',pid)) AND (rule->'operations') ? op AND rule->>'disposition'='REQUIRE_APPROVAL' AND (rule->>'expiresAt')::timestamptz>clock_timestamp())
  OR EXISTS(SELECT 1 FROM anvil.approval_consumptions ac WHERE ac.project_id=pid AND ac.command_id=c.id AND ac.id=c.approval_consumption_id AND ac.decision_id=ar.approval_decision_ref)));
$$;

CREATE FUNCTION anvil.connector_protocol_event(rid uuid,reason text) RETURNS boolean LANGUAGE sql AS $$
 SELECT anvil.connector_basis_current(rid,true) AND EXISTS(SELECT 1 FROM anvil.connector_registrations r JOIN anvil.audit_events e ON e.project_id=r.project_id
 WHERE r.id=rid AND r.id::text=current_setting('anvil.connector_registration_id',true) AND e.event_id::text=current_setting('anvil.connector_event_id',true)
 AND e.source_kind='CONNECTOR_PROTOCOL' AND e.reason_code=reason AND e.scope_digest=r.scope_digest AND e.policy_ref=r.policy_ref
 AND e.actor_ref=jsonb_build_object('kind','CONNECTOR','connectorId',r.connector_id,'registrationId',r.id) AND e.client_ref=r.client_id);
$$;

CREATE FUNCTION anvil.guard_host_trust_connector() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE c anvil.commands%ROWTYPE;r anvil.connector_registrations%ROWTYPE;
BEGIN
 IF current_user<>'anvil_v3_app' THEN RETURN NEW;END IF;
 SELECT * INTO c FROM anvil.commands WHERE id::text=current_setting('anvil.command_id',true);
 IF TG_OP='INSERT' THEN
  IF NOT anvil.connector_human_authorized(NEW.project_id,'registerConnector') OR NEW.generation<>1 OR NEW.status<>'REGISTRATION_PENDING' OR NEW.public_key_spki IS NOT NULL OR NEW.connector_version IS NOT NULL OR NEW.revoked_at IS NOT NULL
  OR NEW.owner_user_id IS DISTINCT FROM c.actor_id OR NEW.client_id IS DISTINCT FROM c.client_id OR c.expected_version<>0
  OR c.result_ref->'data'->'connectorRef'->>'id' IS DISTINCT FROM NEW.id::text OR c.result_ref->'data'->'registrationRef'->>'id' IS DISTINCT FROM NEW.registration_id::text
  OR c.result_ref->'data'->'scope'->>'hostLabel' IS DISTINCT FROM NEW.host_label OR c.result_ref->'data'->'scope'->>'expectedHostFingerprint' IS DISTINCT FROM NEW.host_fingerprint
  OR c.result_ref->'data'->'scope'->'subject'->>'credentialGeneration' IS DISTINCT FROM NEW.credential_generation::text THEN RAISE EXCEPTION 'CONNECTOR_EXACT_HUMAN_REGISTRATION_REQUIRED' USING ERRCODE='42501';END IF;
  RETURN NEW;
 END IF;
 SELECT * INTO r FROM anvil.connector_registrations WHERE id=OLD.registration_id AND connector_id=OLD.id;
 IF r.id IS NULL THEN RAISE EXCEPTION 'CONNECTOR_REGISTRATION_REQUIRED' USING ERRCODE='42501';END IF;
 IF anvil.connector_human_authorized(NEW.project_id,'revokeConnector') AND (to_jsonb(NEW)-ARRAY['generation','status','revoked_at'])=(to_jsonb(OLD)-ARRAY['generation','status','revoked_at'])
 AND OLD.status<>'REVOKED' AND NEW.status='REVOKED' AND NEW.generation=OLD.generation+1 AND NEW.revoked_at IS NOT NULL AND c.expected_version=OLD.generation
 AND c.result_ref->'data'->'connectorRef'->>'id'=NEW.id::text AND c.result_ref->'data'->'connectorRef'->>'version'=NEW.generation::text THEN RETURN NEW;END IF;
 IF anvil.connector_protocol_event(r.id,'ENROLLED') AND OLD.status='REGISTRATION_PENDING' AND OLD.public_key_spki IS NULL AND NEW.public_key_spki IS NOT NULL AND NEW.connector_version IS NOT NULL
 AND (to_jsonb(NEW)-ARRAY['public_key_spki','connector_version'])=(to_jsonb(OLD)-ARRAY['public_key_spki','connector_version']) THEN RETURN NEW;END IF;
 IF anvil.connector_protocol_event(r.id,'ISSUED') AND r.state='ISSUED' AND OLD.status='REGISTRATION_PENDING' AND NEW.status='TRUSTED'
 AND (to_jsonb(NEW)-'status')=(to_jsonb(OLD)-'status') AND EXISTS(SELECT 1 FROM anvil.connector_credentials cr WHERE cr.connector_id=NEW.id AND cr.registration_id=r.id AND cr.generation=NEW.generation AND cr.revoked_at IS NULL) THEN RETURN NEW;END IF;
 RAISE EXCEPTION 'CONNECTOR_EXACT_TRANSITION_REQUIRED' USING ERRCODE='42501';
END;
$$;
CREATE TRIGGER host_trust_connector_guard BEFORE INSERT OR UPDATE ON anvil.connectors FOR EACH ROW EXECUTE FUNCTION anvil.guard_host_trust_connector();

CREATE FUNCTION anvil.guard_host_trust_registration() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE c anvil.commands%ROWTYPE;reason text;
BEGIN
 IF current_user<>'anvil_v3_app' THEN RETURN NEW;END IF;
 SELECT * INTO c FROM anvil.commands WHERE id::text=current_setting('anvil.command_id',true);
 IF TG_OP='INSERT' THEN
  IF NOT anvil.connector_human_authorized(NEW.project_id,'registerConnector') OR NEW.version<>1 OR NEW.state<>'CREATED' OR NEW.failed_attempts<>0 OR NEW.code_consumed_at IS NOT NULL OR NEW.enroll_request_hash IS NOT NULL OR NEW.observed_host_fingerprint IS NOT NULL OR NEW.proofed_at IS NOT NULL OR NEW.issued_at IS NOT NULL OR NEW.revoked_at IS NOT NULL OR NEW.decision_command_id IS NOT NULL
  OR NEW.created_command_id IS DISTINCT FROM c.id OR NEW.requested_by IS DISTINCT FROM c.actor_id OR NEW.client_id IS DISTINCT FROM c.client_id OR NEW.control_generation IS DISTINCT FROM c.control_generation OR NEW.policy_ref IS DISTINCT FROM c.policy_ref
  OR NEW.scope_json IS DISTINCT FROM c.result_ref->'data'->'scope' OR NEW.scope_digest IS DISTINCT FROM c.result_ref->'data'->>'scopeDigest' OR NEW.id::text IS DISTINCT FROM c.result_ref->'data'->'registrationRef'->>'id'
  OR NEW.connector_id::text IS DISTINCT FROM c.result_ref->'data'->'connectorRef'->>'id' OR NEW.expected_host_fingerprint IS DISTINCT FROM NEW.scope_json->>'expectedHostFingerprint'
  OR NEW.expires_at IS DISTINCT FROM (NEW.scope_json->>'expiresAt')::timestamptz OR NOT EXISTS(SELECT 1 FROM anvil.auth_sessions s WHERE s.id=NEW.session_id AND s.user_id=NEW.requested_by AND s.client_id=NEW.client_id AND s.credential_generation=NEW.credential_generation AND s.revoked_at IS NULL)
  OR NEW.expires_at>(SELECT min((rule->>'expiresAt')::timestamptz) FROM anvil.permission_policy_versions pv CROSS JOIN LATERAL jsonb_array_elements(pv.rules_json) rule WHERE pv.project_id=NEW.project_id AND pv.policy_id::text=NEW.policy_ref->>'id' AND pv.version::text=NEW.policy_ref->>'version' AND rule->'subjectRef'=jsonb_build_object('kind','HUMAN','userId',NEW.requested_by) AND rule->'targetScopes'=jsonb_build_array(jsonb_build_object('kind','PROJECT','projectId',NEW.project_id)) AND (rule->'operations') ? 'registerConnector' AND (rule->>'expiresAt')::timestamptz>clock_timestamp())
  THEN RAISE EXCEPTION 'CONNECTOR_EXACT_REGISTRATION_RECEIPT_REQUIRED' USING ERRCODE='42501';END IF;
  RETURN NEW;
 END IF;
 IF NEW.version<>OLD.version+1 THEN RAISE EXCEPTION 'CONNECTOR_REGISTRATION_VERSION_REQUIRED' USING ERRCODE='42501';END IF;
 IF anvil.connector_human_authorized(NEW.project_id,'confirmConnectorRegistration') AND anvil.connector_basis_current(OLD.id,true) AND OLD.state='PROVED_WAITING_CONFIRMATION' AND OLD.expires_at>clock_timestamp() AND NEW.state IN('CONFIRMED','REJECTED')
 AND NEW.decision_command_id=c.id AND c.expected_version=OLD.version AND c.result_ref->'data'->'registrationRef'->>'id'=NEW.id::text AND c.result_ref->'data'->>'scopeDigest'=OLD.scope_digest
 AND (to_jsonb(NEW)-ARRAY['version','state','decision_command_id'])=(to_jsonb(OLD)-ARRAY['version','state','decision_command_id']) THEN RETURN NEW;END IF;
 IF anvil.connector_human_authorized(NEW.project_id,'revokeConnector') AND NEW.state='REVOKED' AND OLD.state<>'REVOKED' AND NEW.revoked_at IS NOT NULL
 AND c.result_ref->'data'->>'registrationId'=NEW.id::text AND (to_jsonb(NEW)-ARRAY['version','state','revoked_at'])=(to_jsonb(OLD)-ARRAY['version','state','revoked_at']) THEN RETURN NEW;END IF;
 SELECT reason_code INTO reason FROM anvil.audit_events WHERE event_id::text=current_setting('anvil.connector_event_id',true) AND project_id=OLD.project_id;
 IF NOT anvil.connector_protocol_event(OLD.id,reason) OR OLD.failed_attempts>=5 OR OLD.expires_at<=clock_timestamp()
 OR NOT EXISTS(SELECT 1 FROM anvil.audit_events e WHERE e.event_id::text=current_setting('anvil.connector_event_id',true) AND e.target_ref->>'id'=NEW.id::text AND e.target_ref->>'version'=NEW.version::text) THEN RAISE EXCEPTION 'CONNECTOR_PROTOCOL_CONTEXT_REQUIRED' USING ERRCODE='42501';END IF;
 IF reason='PROOF_DENIED' AND NEW.failed_attempts=OLD.failed_attempts+1 AND (to_jsonb(NEW)-ARRAY['version','failed_attempts'])=(to_jsonb(OLD)-ARRAY['version','failed_attempts']) THEN RETURN NEW;END IF;
 IF reason='ENROLLED' AND OLD.state='CREATED' AND NEW.state='CHALLENGED' AND NEW.code_consumed_at IS NOT NULL AND NEW.enroll_request_hash IS NOT NULL AND NEW.observed_host_fingerprint=OLD.expected_host_fingerprint
 AND (to_jsonb(NEW)-ARRAY['version','state','code_consumed_at','enroll_request_hash','observed_host_fingerprint'])=(to_jsonb(OLD)-ARRAY['version','state','code_consumed_at','enroll_request_hash','observed_host_fingerprint']) THEN RETURN NEW;END IF;
 IF reason='PROVED' AND OLD.state='CHALLENGED' AND NEW.state='PROVED_WAITING_CONFIRMATION' AND NEW.proofed_at IS NOT NULL
 AND (to_jsonb(NEW)-ARRAY['version','state','proofed_at'])=(to_jsonb(OLD)-ARRAY['version','state','proofed_at']) THEN RETURN NEW;END IF;
 IF reason='EXCHANGE_CHALLENGE' AND OLD.state='CONFIRMED' AND (to_jsonb(NEW)-'version')=(to_jsonb(OLD)-'version') THEN RETURN NEW;END IF;
 IF reason='ISSUED' AND OLD.state='CONFIRMED' AND NEW.state='ISSUED' AND NEW.issued_at IS NOT NULL
 AND (to_jsonb(NEW)-ARRAY['version','state','issued_at'])=(to_jsonb(OLD)-ARRAY['version','state','issued_at']) THEN RETURN NEW;END IF;
 RAISE EXCEPTION 'CONNECTOR_REGISTRATION_TRANSITION_REQUIRED' USING ERRCODE='42501';
END;
$$;
CREATE TRIGGER host_trust_registration_guard BEFORE INSERT OR UPDATE ON anvil.connector_registrations FOR EACH ROW EXECUTE FUNCTION anvil.guard_host_trust_registration();

CREATE FUNCTION anvil.guard_host_trust_challenge() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE r anvil.connector_registrations%ROWTYPE;reason text;
BEGIN
 IF current_user<>'anvil_v3_app' THEN RETURN NEW;END IF;
 SELECT * INTO r FROM anvil.connector_registrations WHERE id=NEW.registration_id AND project_id=NEW.project_id;
 SELECT reason_code INTO reason FROM anvil.audit_events WHERE event_id::text=current_setting('anvil.connector_event_id',true) AND project_id=NEW.project_id;
 IF r.id IS NULL OR NOT anvil.connector_protocol_event(r.id,reason) THEN RAISE EXCEPTION 'CONNECTOR_CHALLENGE_CONTEXT_REQUIRED' USING ERRCODE='42501';END IF;
 IF TG_OP='INSERT' THEN
  IF NOT ((reason='ENROLLED' AND NEW.purpose='HOST_PROOF' AND r.state='CREATED') OR (reason='EXCHANGE_CHALLENGE' AND NEW.purpose='EXCHANGE' AND r.state='CONFIRMED'))
  OR NEW.failed_attempts<>0 OR NEW.consumed_at IS NOT NULL OR NEW.proof_signature IS NOT NULL OR NEW.expires_at>r.expires_at
  OR (SELECT count(*) FROM jsonb_object_keys(NEW.payload_json))<>8 OR NEW.payload_json->>'protocolVersion'<>'1'
  OR NEW.payload_json->>'installationId' IS DISTINCT FROM r.scope_json->>'installationId' OR NEW.payload_json->>'registrationId' IS DISTINCT FROM r.id::text
  OR NEW.payload_json->>'scopeDigest' IS DISTINCT FROM r.scope_digest OR NEW.payload_json->>'publicKeyFingerprint' IS DISTINCT FROM r.expected_host_fingerprint
  OR NEW.payload_json->>'serverNonce' IS NULL OR NEW.payload_json->>'clientNonce' IS NULL OR NEW.payload_json->>'serverNonce'!~'^[A-Za-z0-9_-]{43}$' OR NEW.payload_json->>'clientNonce'!~'^[A-Za-z0-9_-]{43}$'
  OR (NEW.payload_json->>'expiresAt')::timestamptz IS DISTINCT FROM NEW.expires_at THEN RAISE EXCEPTION 'CONNECTOR_EXACT_CHALLENGE_REQUIRED' USING ERRCODE='42501';END IF;
  RETURN NEW;
 END IF;
 IF OLD.consumed_at IS NOT NULL THEN RAISE EXCEPTION 'CONNECTOR_CHALLENGE_CONSUMED' USING ERRCODE='42501';END IF;
 IF reason='PROOF_DENIED' AND NEW.failed_attempts=OLD.failed_attempts+1 AND (to_jsonb(NEW)-'failed_attempts')=(to_jsonb(OLD)-'failed_attempts') THEN RETURN NEW;END IF;
 IF ((reason='PROVED' AND OLD.purpose='HOST_PROOF') OR (reason='ISSUED' AND OLD.purpose='EXCHANGE')) AND OLD.expires_at>clock_timestamp() AND NEW.consumed_at IS NOT NULL AND NEW.proof_signature IS NOT NULL
 AND (to_jsonb(NEW)-ARRAY['consumed_at','proof_signature'])=(to_jsonb(OLD)-ARRAY['consumed_at','proof_signature']) THEN RETURN NEW;END IF;
 RAISE EXCEPTION 'CONNECTOR_CHALLENGE_TRANSITION_REQUIRED' USING ERRCODE='42501';
END;
$$;
CREATE TRIGGER host_trust_challenge_guard BEFORE INSERT OR UPDATE ON anvil.connector_registration_challenges FOR EACH ROW EXECUTE FUNCTION anvil.guard_host_trust_challenge();

CREATE FUNCTION anvil.guard_host_trust_credential() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE r anvil.connector_registrations%ROWTYPE;g bigint;
BEGIN
 IF current_user<>'anvil_v3_app' THEN RETURN NEW;END IF;
 SELECT * INTO r FROM anvil.connector_registrations WHERE id=NEW.registration_id AND project_id=NEW.project_id AND connector_id=NEW.connector_id;
 SELECT generation INTO g FROM anvil.connectors WHERE id=NEW.connector_id AND project_id=NEW.project_id;
 IF TG_OP='INSERT' THEN
  IF r.id IS NULL OR r.state<>'CONFIRMED' OR NOT anvil.connector_protocol_event(r.id,'ISSUED') OR NEW.generation IS DISTINCT FROM g OR NEW.scope<>'REGISTRATION_STATUS_ONLY' OR NEW.scope_digest IS DISTINCT FROM r.scope_digest OR NEW.revoked_at IS NOT NULL
  OR NOT EXISTS(SELECT 1 FROM anvil.connector_registration_challenges ch WHERE ch.registration_id=r.id AND ch.purpose='EXCHANGE' AND ch.consumed_at IS NULL AND ch.expires_at>clock_timestamp())
  OR NEW.expires_at>(SELECT min((rule->>'expiresAt')::timestamptz) FROM anvil.permission_policy_versions pv CROSS JOIN LATERAL jsonb_array_elements(pv.rules_json) rule WHERE pv.project_id=r.project_id AND pv.policy_id::text=r.policy_ref->>'id' AND pv.version::text=r.policy_ref->>'version' AND rule->'subjectRef'=jsonb_build_object('kind','HUMAN','userId',r.requested_by) AND rule->'targetScopes'=jsonb_build_array(jsonb_build_object('kind','PROJECT','projectId',r.project_id)) AND (rule->'operations') ? 'registerConnector' AND (rule->>'expiresAt')::timestamptz>clock_timestamp())
  THEN RAISE EXCEPTION 'CONNECTOR_EXACT_CREDENTIAL_ISSUANCE_REQUIRED' USING ERRCODE='42501';END IF;
  RETURN NEW;
 END IF;
 IF anvil.connector_human_authorized(NEW.project_id,'revokeConnector') AND NEW.revoked_at IS NOT NULL AND OLD.revoked_at IS NULL AND (to_jsonb(NEW)-'revoked_at')=(to_jsonb(OLD)-'revoked_at')
 AND EXISTS(SELECT 1 FROM anvil.commands c WHERE c.id::text=current_setting('anvil.command_id',true) AND c.result_ref->'data'->'connectorRef'->>'id'=NEW.connector_id::text) THEN RETURN NEW;END IF;
 RAISE EXCEPTION 'CONNECTOR_CREDENTIAL_IMMUTABLE' USING ERRCODE='42501';
END;
$$;
CREATE TRIGGER host_trust_credential_guard BEFORE INSERT OR UPDATE ON anvil.connector_credentials FOR EACH ROW EXECUTE FUNCTION anvil.guard_host_trust_credential();

-- 기존3연산의 소비 조건은 그대로 두고 새3연산은 실제 현재 대상/ref까지 추가 결박한다.
CREATE FUNCTION anvil.host_trust_approval_target_valid(pid uuid,scope jsonb) RETURNS boolean LANGUAGE sql AS $$
 SELECT COALESCE(
 (scope->>'operation'='registerConnector' AND scope->'targetRef'='null'::jsonb AND scope->>'expectedVersion'='0')
 OR (scope->>'operation'='confirmConnectorRegistration' AND EXISTS(
  SELECT 1 FROM anvil.connector_registrations r JOIN anvil.audit_events e ON e.project_id=r.project_id
  WHERE r.project_id=pid AND r.id::text=scope->'targetRef'->>'id' AND r.version::text=scope->>'expectedVersion'
  AND r.state='PROVED_WAITING_CONFIRMATION' AND r.expires_at>clock_timestamp() AND e.source_kind='CONNECTOR_PROTOCOL' AND e.reason_code='PROVED'
  AND e.target_ref=scope->'targetRef' AND e.scope_digest=r.scope_digest AND e.policy_ref=r.policy_ref))
 OR (scope->>'operation'='revokeConnector' AND EXISTS(
  SELECT 1 FROM anvil.connectors h JOIN anvil.connector_registrations r ON r.id=h.registration_id AND r.connector_id=h.id AND r.project_id=h.project_id
  JOIN anvil.commands c ON c.id=r.created_command_id AND c.project_id=r.project_id
  WHERE h.project_id=pid AND h.status<>'REVOKED' AND h.generation=1 AND scope->>'expectedVersion'='1'
  AND c.result_ref->'data'->'connectorRef'=scope->'targetRef')),false);
$$;
CREATE OR REPLACE FUNCTION anvil.connection_candidate_approval_target_valid(pid uuid,scope jsonb) RETURNS boolean LANGUAGE sql AS $$
 SELECT (scope->>'operation' IN('registerConnection','saveEnvironment') AND
 ((scope->'targetRef'='null'::jsonb AND scope->>'expectedVersion'='0') OR EXISTS(
 SELECT 1 FROM anvil.connection_candidates c JOIN anvil.connection_candidate_versions v ON v.project_id=c.project_id AND v.candidate_id=c.id AND v.version=c.head_version
 WHERE c.project_id=pid AND scope->'targetRef'=jsonb_build_object('id',c.id,'version',v.version,'contentHash',v.content_hash) AND scope->>'expectedVersion'=v.version::text
 AND c.kind=CASE scope->>'operation' WHEN 'registerConnection' THEN 'CONNECTION_CANDIDATE' ELSE 'ENVIRONMENT_CANDIDATE' END)))
 OR anvil.host_trust_approval_target_valid(pid,scope);
$$;

CREATE OR REPLACE FUNCTION anvil.one_time_consumption_command_authorized(p_project uuid,p_command uuid,p_decision uuid) RETURNS boolean LANGUAGE sql AS $$
 SELECT EXISTS(SELECT 1 FROM anvil.commands c
 JOIN anvil.authorization_receipts ar ON ar.id=c.authorization_receipt_id AND ar.command_id=c.id AND ar.scope_kind='PROJECT' AND ar.scope_id=c.project_id AND ar.policy_ref=c.policy_ref AND ar.approval_decision_ref=p_decision
 JOIN anvil.approval_decisions d ON d.id=p_decision AND d.project_id=c.project_id AND d.decision='APPROVE' AND d.command_id IS NOT NULL AND d.decision_json IS NOT NULL
 JOIN anvil.approval_requests r ON r.id=d.request_id AND r.project_id=d.project_id AND r.version=2 AND r.status='APPROVED' AND r.command_id IS NOT NULL AND r.policy_ref=c.policy_ref AND r.scope_digest=d.scope_digest AND d.request_version=1
 JOIN anvil.project_control pc ON pc.project_id=c.project_id AND pc.actor_id=c.actor_id AND pc.client_id=c.client_id AND pc.generation=c.control_generation AND pc.revoked_at IS NULL
 JOIN anvil.project_members pm ON pm.project_id=c.project_id AND pm.user_id=c.actor_id AND pm.participation='OWNER' AND pm.revoked_at IS NULL
 JOIN anvil.permission_policies pp ON pp.project_id=c.project_id AND pp.id::text=c.policy_ref->>'id' AND pp.head_version=(c.policy_ref->>'version')::bigint
 JOIN anvil.permission_policy_versions pv ON pv.project_id=pp.project_id AND pv.policy_id=pp.id AND pv.version=pp.head_version AND pv.content_hash=c.policy_ref->>'contentHash'
 WHERE c.id=p_command AND c.project_id=p_project AND c.scope_kind='PROJECT' AND c.scope_id=c.project_id AND c.operation IN('uploadArtifact','registerConnection','saveEnvironment','registerConnector','confirmConnectorRegistration','revokeConnector') AND (c.operation IN('uploadArtifact','registerConnection','saveEnvironment') OR anvil.host_trust_approval_target_valid(p_project,r.action_scope_json)) AND c.state='APPLIED' AND c.expected_version=(r.action_scope_json->>'expectedVersion')::bigint AND (c.operation<>'uploadArtifact' OR c.expected_version=0) AND (c.operation='uploadArtifact' OR c.result_ref->'data'->'previousRef'=r.action_scope_json->'targetRef')
 AND c.id::text=current_setting('anvil.command_id',true) AND c.actor_id::text=current_setting('anvil.actor_id',true) AND c.client_id::text=current_setting('anvil.client_id',true)
 AND c.approval_consumption_id IS NOT NULL AND c.command_id=r.candidate_command_id AND r.created_by=c.actor_id AND r.client_id=c.client_id AND d.decided_by=r.created_by AND d.client_id=r.client_id AND d.control_generation=pc.generation
 AND r.required_decider_ref=jsonb_build_object('kind','HUMAN','userId',c.actor_id)
 AND r.request_json->>'controlGeneration'=pc.generation::text AND r.action_scope_json->>'controlGeneration'=pc.generation::text AND r.expires_at>clock_timestamp()
 AND ar.subject_ref=jsonb_build_object('kind','HUMAN','userId',c.actor_id,'clientId',c.client_id)
 AND c.payload_ref=jsonb_build_object('kind','ONE_TIME_APPROVAL_SCOPE','payloadHash',r.action_scope_json->>'payloadHash','scopeDigest',r.scope_digest)
 AND EXISTS(SELECT 1 FROM jsonb_array_elements(pv.rules_json) AS rules(rule) WHERE rule->'subjectRef'=jsonb_build_object('kind','HUMAN','userId',c.actor_id) AND rule->'targetScopes'=jsonb_build_array(jsonb_build_object('kind','PROJECT','projectId',p_project)) AND (rule->'operations') ? c.operation AND rule->>'disposition'='REQUIRE_APPROVAL' AND (rule->>'expiresAt')::timestamptz>clock_timestamp())
 AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(pv.rules_json) AS rules(rule) WHERE rule->'subjectRef'=jsonb_build_object('kind','HUMAN','userId',c.actor_id) AND rule->'targetScopes'=jsonb_build_array(jsonb_build_object('kind','PROJECT','projectId',p_project)) AND (rule->'operations') ? c.operation AND rule->>'disposition'='DENY' AND (rule->>'expiresAt')::timestamptz>clock_timestamp()));
$$;
