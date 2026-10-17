-- 44: 적용43은 보존하고 challenge의 숫자1 계약만 SQL NULL/type/value에 fail-closed로 보정한다.
CREATE OR REPLACE FUNCTION anvil.guard_host_trust_challenge() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE r anvil.connector_registrations%ROWTYPE;reason text;
BEGIN
 IF current_user<>'anvil_v3_app' THEN RETURN NEW;END IF;
 SELECT * INTO r FROM anvil.connector_registrations WHERE id=NEW.registration_id AND project_id=NEW.project_id;
 SELECT reason_code INTO reason FROM anvil.audit_events WHERE event_id::text=current_setting('anvil.connector_event_id',true) AND project_id=NEW.project_id;
 IF r.id IS NULL OR NOT anvil.connector_protocol_event(r.id,reason) THEN RAISE EXCEPTION 'CONNECTOR_CHALLENGE_CONTEXT_REQUIRED' USING ERRCODE='42501';END IF;
 IF TG_OP='INSERT' THEN
  IF NOT ((reason='ENROLLED' AND NEW.purpose='HOST_PROOF' AND r.state='CREATED') OR (reason='EXCHANGE_CHALLENGE' AND NEW.purpose='EXCHANGE' AND r.state='CONFIRMED'))
  OR NEW.failed_attempts<>0 OR NEW.consumed_at IS NOT NULL OR NEW.proof_signature IS NOT NULL OR NEW.expires_at>r.expires_at
  OR (SELECT count(*) FROM jsonb_object_keys(NEW.payload_json))<>8 OR NEW.payload_json->'protocolVersion' IS DISTINCT FROM '1'::jsonb
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
