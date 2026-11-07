-- A-3 후보46: 작성/검토용. 기존45 migration/실제DB 적용·runner 연결은 변경하지 않는다.
-- 실제 PG canonical 상호운용·guard/권한·COMMIT/rollback 검증 전 적용/사용 금지.
CREATE TABLE anvil.source_read_grants(
 project_id uuid NOT NULL REFERENCES anvil.projects(id),id uuid NOT NULL,version integer NOT NULL DEFAULT 1 CHECK(version=1),
 source_root_id uuid NOT NULL,source_root_version bigint NOT NULL,source_root_hash text NOT NULL CHECK(source_root_hash~'^[0-9a-f]{64}$'),
 connector_id uuid NOT NULL,connector_generation bigint NOT NULL CHECK(connector_generation BETWEEN 1 AND 9007199254740991),
 registration_id uuid NOT NULL,registration_version bigint NOT NULL CHECK(registration_version BETWEEN 1 AND 9007199254740991),
 requested_by uuid NOT NULL,client_id uuid NOT NULL,session_id uuid NOT NULL REFERENCES anvil.auth_sessions(id),
 credential_generation bigint NOT NULL CHECK(credential_generation BETWEEN 1 AND 9007199254740991),control_generation bigint NOT NULL CHECK(control_generation BETWEEN 1 AND 9007199254740991),
 policy_ref jsonb NOT NULL,scope_json jsonb NOT NULL CHECK(jsonb_typeof(scope_json)='object'),scope_digest text NOT NULL CHECK(scope_digest~'^[0-9a-f]{64}$'),
 created_command_id uuid NOT NULL,created_at timestamptz NOT NULL,expires_at timestamptz NOT NULL,
 revoked_at timestamptz,revoke_command_id uuid,exchange_failures integer NOT NULL DEFAULT 0 CHECK(exchange_failures BETWEEN 0 AND 5),
 PRIMARY KEY(project_id,id),UNIQUE(project_id,created_command_id),
 FOREIGN KEY(project_id,source_root_id,source_root_version) REFERENCES anvil.source_root_versions(project_id,root_id,version),
 FOREIGN KEY(project_id,connector_id) REFERENCES anvil.connectors(project_id,id),
 FOREIGN KEY(project_id,registration_id) REFERENCES anvil.connector_registrations(project_id,id),
 FOREIGN KEY(project_id,created_command_id) REFERENCES anvil.commands(project_id,id),
 FOREIGN KEY(project_id,revoke_command_id) REFERENCES anvil.commands(project_id,id),
 FOREIGN KEY(project_id,requested_by) REFERENCES anvil.project_members(project_id,user_id),
 FOREIGN KEY(requested_by,client_id) REFERENCES anvil.clients(user_id,id),
 CHECK(expires_at>created_at AND expires_at<=created_at+interval '2 hours'),
 CHECK((revoked_at IS NULL)=(revoke_command_id IS NULL)),CHECK(revoked_at IS NULL OR revoked_at>=created_at)
);
CREATE INDEX source_read_grants_project_order ON anvil.source_read_grants(project_id,created_at DESC,id DESC);
CREATE TABLE anvil.source_read_challenges(
 id uuid PRIMARY KEY,project_id uuid NOT NULL,grant_id uuid NOT NULL,
 preflight_digest text NOT NULL CHECK(preflight_digest~'^[0-9a-f]{64}$'),payload_json jsonb NOT NULL CHECK(jsonb_typeof(payload_json)='object'),
 created_at timestamptz NOT NULL,expires_at timestamptz NOT NULL,consumed_at timestamptz,
 proof_signature text CHECK(proof_signature~'^[A-Za-z0-9_-]{85}[AQgw]$'),failed_attempts integer NOT NULL DEFAULT 0 CHECK(failed_attempts BETWEEN 0 AND 5),
 UNIQUE(project_id,grant_id),FOREIGN KEY(project_id,grant_id) REFERENCES anvil.source_read_grants(project_id,id),
 CHECK(expires_at>created_at AND expires_at<=created_at+interval '2 minutes'),CHECK((consumed_at IS NULL)=(proof_signature IS NULL)),
 CHECK(consumed_at IS NULL OR consumed_at>=created_at AND consumed_at<expires_at)
);
CREATE TABLE anvil.source_read_credentials(
 id uuid PRIMARY KEY,project_id uuid NOT NULL,grant_id uuid NOT NULL,connector_id uuid NOT NULL,
 connector_generation bigint NOT NULL CHECK(connector_generation BETWEEN 1 AND 9007199254740991),
 token_digest text NOT NULL UNIQUE CHECK(token_digest~'^[0-9a-f]{64}$'),scope text NOT NULL CHECK(scope='SOURCE_OBSERVE_READ_ONLY'),
 scope_digest text NOT NULL CHECK(scope_digest~'^[0-9a-f]{64}$'),issued_at timestamptz NOT NULL,expires_at timestamptz NOT NULL,
 revoked_at timestamptz,consumed_at timestamptz,UNIQUE(project_id,grant_id),
 FOREIGN KEY(project_id,grant_id) REFERENCES anvil.source_read_grants(project_id,id),
 FOREIGN KEY(project_id,connector_id) REFERENCES anvil.connectors(project_id,id),
 CHECK(expires_at>issued_at AND expires_at<=issued_at+interval '5 minutes'),
 CHECK(consumed_at IS NULL OR consumed_at>=issued_at AND consumed_at<expires_at),
 CHECK(revoked_at IS NULL OR revoked_at>=issued_at)
);
CREATE TABLE anvil.source_snapshots(
 project_id uuid NOT NULL,id uuid NOT NULL,version integer NOT NULL DEFAULT 1 CHECK(version=1),grant_id uuid NOT NULL,report_command_id uuid NOT NULL,
 source_root_id uuid NOT NULL,source_root_version bigint NOT NULL,connector_id uuid NOT NULL,generation bigint NOT NULL CHECK(generation BETWEEN 1 AND 9007199254740991),
 scope_digest text NOT NULL CHECK(scope_digest~'^[0-9a-f]{64}$'),report_json jsonb NOT NULL CHECK(jsonb_typeof(report_json)='object'),
 content_hash text NOT NULL CHECK(content_hash~'^[0-9a-f]{64}$'),signature text NOT NULL CHECK(signature~'^[A-Za-z0-9_-]{85}[AQgw]$'),
 observed_at timestamptz NOT NULL,finished_at timestamptz NOT NULL,received_at timestamptz NOT NULL,
 evidence_class text NOT NULL CHECK(evidence_class='CONNECTOR_REPORTED'),os_verification text NOT NULL CHECK(os_verification='UNVERIFIED'),
 PRIMARY KEY(project_id,id,version),UNIQUE(project_id,grant_id),UNIQUE(project_id,report_command_id),
 FOREIGN KEY(project_id,grant_id) REFERENCES anvil.source_read_grants(project_id,id),
 FOREIGN KEY(project_id,source_root_id,source_root_version) REFERENCES anvil.source_root_versions(project_id,root_id,version),
 FOREIGN KEY(project_id,connector_id) REFERENCES anvil.connectors(project_id,id),
 CHECK(finished_at>=observed_at AND finished_at-observed_at<=interval '30 seconds'),CHECK(finished_at<=received_at+interval '30 seconds')
);

CREATE FUNCTION anvil.source_read_exact(v jsonb,keys text[]) RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
 SELECT jsonb_typeof(v)='object' AND COALESCE((SELECT array_agg(k ORDER BY k COLLATE "C") FROM jsonb_object_keys(v) k),'{}'::text[])
  =(SELECT array_agg(k ORDER BY k COLLATE "C") FROM unnest(keys) k);
$$;
CREATE FUNCTION anvil.source_read_canonical_json(v jsonb) RETURNS text LANGUAGE plpgsql IMMUTABLE STRICT AS $$
DECLARE result text;n numeric;
BEGIN
 CASE jsonb_typeof(v)
 WHEN 'object' THEN SELECT '{'||COALESCE(string_agg(to_jsonb(key)::text||':'||anvil.source_read_canonical_json(value),',' ORDER BY key COLLATE "C"),'')||'}' INTO result FROM jsonb_each(v);
 WHEN 'array' THEN SELECT '['||COALESCE(string_agg(anvil.source_read_canonical_json(value),',' ORDER BY ordinal),'')||']' INTO result FROM jsonb_array_elements(v) WITH ORDINALITY x(value,ordinal);
 WHEN 'number' THEN n=(v::text)::numeric;IF n<>trunc(n) OR abs(n)>9007199254740991 THEN RAISE EXCEPTION 'SOURCE_READ_UNSAFE_NUMBER' USING ERRCODE='22023';END IF;result=trunc(n)::text;
 WHEN 'string' THEN result=v::text;
 WHEN 'boolean' THEN result=v::text;
 WHEN 'null' THEN result='null';
 ELSE RAISE EXCEPTION 'SOURCE_READ_JSON_INVALID' USING ERRCODE='22023';
 END CASE;RETURN result;
END;
$$;
CREATE FUNCTION anvil.source_read_hash(v jsonb) RETURNS text LANGUAGE sql IMMUTABLE STRICT AS $$
 SELECT encode(sha256(convert_to(anvil.source_read_canonical_json(v),'UTF8')),'hex');
$$;
CREATE FUNCTION anvil.source_read_iso(t timestamptz) RETURNS text LANGUAGE sql STABLE STRICT AS $$
 SELECT to_char(t AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
$$;
CREATE FUNCTION anvil.source_read_ref(v jsonb) RETURNS boolean LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE n numeric;
BEGIN
 IF NOT COALESCE(anvil.source_read_exact(v,ARRAY['id','version','contentHash']),false)
  OR jsonb_typeof(v->'id') IS DISTINCT FROM 'string' OR (v->>'id')!~'^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
  OR jsonb_typeof(v->'contentHash') IS DISTINCT FROM 'string' OR (v->>'contentHash')!~'^[0-9a-f]{64}$'
  OR jsonb_typeof(v->'version') IS DISTINCT FROM 'number' THEN RETURN false;END IF;
 n=(v->>'version')::numeric;RETURN n BETWEEN 1 AND 9007199254740991 AND n=trunc(n);
EXCEPTION WHEN OTHERS THEN RETURN false;
END;
$$;
CREATE FUNCTION anvil.source_read_policy_allows(pid uuid,uid uuid,ref jsonb,op text) RETURNS boolean LANGUAGE sql VOLATILE AS $$
 SELECT EXISTS(SELECT 1 FROM anvil.permission_policies p JOIN anvil.permission_policy_versions v ON v.project_id=p.project_id AND v.policy_id=p.id AND v.version=p.head_version
 WHERE p.project_id=pid AND ref=jsonb_build_object('id',p.id,'version',p.head_version,'contentHash',v.content_hash)
 AND anvil.source_read_hash(jsonb_build_object('rules',v.rules_json,'reason',v.reason,'reviewRefs',v.review_refs))=v.content_hash
 AND EXISTS(SELECT 1 FROM jsonb_array_elements(v.rules_json) r WHERE r->'subjectRef'=jsonb_build_object('kind','HUMAN','userId',uid)
  AND r->'targetScopes'=jsonb_build_array(jsonb_build_object('kind','PROJECT','projectId',pid)) AND (r->'operations') ? op AND r->>'disposition'='AUTO' AND (r->>'expiresAt')::timestamptz>clock_timestamp())
 AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(v.rules_json) r WHERE r->'subjectRef'=jsonb_build_object('kind','HUMAN','userId',uid)
  AND r->'targetScopes'=jsonb_build_array(jsonb_build_object('kind','PROJECT','projectId',pid)) AND (r->'operations') ? op AND r->>'disposition' IN('DENY','REQUIRE_APPROVAL') AND (r->>'expiresAt')::timestamptz>clock_timestamp()));
$$;
CREATE FUNCTION anvil.source_read_basis_current(pid uuid,gid uuid) RETURNS boolean LANGUAGE sql VOLATILE AS $$
 SELECT EXISTS(SELECT 1 FROM anvil.source_read_grants g
 JOIN anvil.users u ON u.id=g.requested_by AND u.status='ACTIVE' AND u.revoked_at IS NULL AND u.credential_generation=g.credential_generation
 JOIN anvil.clients cl ON cl.id=g.client_id AND cl.user_id=u.id AND cl.revoked_at IS NULL
 JOIN anvil.auth_sessions s ON s.id=g.session_id AND s.user_id=u.id AND s.client_id=cl.id AND s.credential_generation=u.credential_generation AND s.revoked_at IS NULL
 JOIN anvil.projects p ON p.id=g.project_id AND p.archived_at IS NULL
 JOIN anvil.project_members m ON m.project_id=p.id AND m.user_id=u.id AND m.participation='OWNER' AND m.revoked_at IS NULL
 JOIN anvil.project_control pc ON pc.project_id=p.id AND pc.actor_id=u.id AND pc.client_id=cl.id AND pc.generation=g.control_generation AND pc.revoked_at IS NULL
 JOIN anvil.source_roots root ON root.project_id=p.id AND root.id=g.source_root_id AND root.head_version=g.source_root_version
 JOIN anvil.source_root_versions v ON v.project_id=root.project_id AND v.root_id=root.id AND v.version=root.head_version AND v.content_hash=g.source_root_hash AND v.status='DECLARED'
 JOIN anvil.connectors h ON h.project_id=p.id AND h.id=g.connector_id AND h.registration_id=g.registration_id AND h.generation=g.connector_generation AND h.status='TRUSTED' AND h.revoked_at IS NULL
 JOIN anvil.connector_registrations r ON r.project_id=p.id AND r.id=g.registration_id AND r.connector_id=h.id AND r.version=g.registration_version AND r.state='ISSUED' AND r.revoked_at IS NULL
 WHERE g.project_id=pid AND g.id=gid AND g.revoked_at IS NULL AND g.exchange_failures<5 AND g.expires_at>clock_timestamp()
 AND s.idle_expires_at>clock_timestamp() AND s.absolute_expires_at>clock_timestamp() AND r.expires_at>clock_timestamp()
 AND v.authority='USER_DECLARED' AND v.readiness='UNVERIFIED' AND v.content_hash=anvil.source_root_snapshot_hash(v.declaration_json,v.status,v.reason)
 AND v.declaration_json->>'connectorId'=h.id::text AND r.policy_ref=g.policy_ref
 AND g.scope_json->>'installationId'=r.scope_json->>'installationId' AND g.scope_json->>'hostFingerprint'=r.expected_host_fingerprint AND h.host_fingerprint=r.expected_host_fingerprint
 AND g.scope_json->'registrationRef'=jsonb_build_object('id',r.id,'version',r.version,'contentHash',anvil.source_read_hash(jsonb_build_object('registrationId',r.id,'version',r.version,'state',r.state,'scopeDigest',r.scope_digest)))
 AND g.scope_json->'connectorRef'=jsonb_build_object('id',h.id,'version',h.generation,'contentHash',anvil.source_read_hash(jsonb_build_object('connectorId',h.id,'registrationId',r.id,'scopeDigest',r.scope_digest,'generation',h.generation)))
 AND anvil.connector_basis_current(r.id,false) AND anvil.source_read_policy_allows(pid,u.id,g.policy_ref,'requestSourceReadObservation'));
$$;
CREATE FUNCTION anvil.source_read_command_authorized(pid uuid,op text) RETURNS boolean LANGUAGE sql VOLATILE AS $$
 SELECT EXISTS(SELECT 1 FROM anvil.commands c
 JOIN anvil.authorization_receipts ar ON ar.id=c.authorization_receipt_id AND ar.command_id=c.id AND ar.scope_kind='PROJECT' AND ar.scope_id=c.project_id AND ar.policy_ref=c.policy_ref
 JOIN anvil.project_control pc ON pc.project_id=c.project_id AND pc.actor_id=c.actor_id AND pc.client_id=c.client_id AND pc.generation=c.control_generation AND pc.revoked_at IS NULL
 JOIN anvil.project_members m ON m.project_id=c.project_id AND m.user_id=c.actor_id AND m.participation='OWNER' AND m.revoked_at IS NULL
 JOIN anvil.projects p ON p.id=c.project_id AND p.archived_at IS NULL
 WHERE c.id::text=current_setting('anvil.command_id',true) AND c.actor_id::text=current_setting('anvil.actor_id',true) AND c.client_id::text=current_setting('anvil.client_id',true)
 AND c.scope_kind='PROJECT' AND c.scope_id=pid AND c.project_id=pid AND c.operation=op AND op IN('requestSourceReadObservation','revokeSourceReadObservation') AND c.state='APPLIED'
 AND c.approval_consumption_id IS NULL AND c.payload_ref IS NULL AND ar.approval_decision_ref IS NULL
 AND ar.subject_ref=jsonb_build_object('kind','HUMAN','userId',c.actor_id,'clientId',c.client_id)
 AND EXISTS(SELECT 1 FROM anvil.audit_events a WHERE a.project_id=pid AND a.command_id=c.id AND a.operation_id=c.operation_id AND a.outcome='APPLIED' AND a.source_kind='HUMAN_COMMAND')
 AND EXISTS(SELECT 1 FROM anvil.auth_sessions s JOIN anvil.users u ON u.id=s.user_id JOIN anvil.clients cl ON cl.id=s.client_id AND cl.user_id=u.id
  WHERE s.user_id=c.actor_id AND s.client_id=c.client_id AND u.status='ACTIVE' AND u.revoked_at IS NULL AND cl.revoked_at IS NULL AND s.revoked_at IS NULL
  AND s.credential_generation=u.credential_generation AND s.reauth_until>clock_timestamp() AND s.idle_expires_at>clock_timestamp() AND s.absolute_expires_at>clock_timestamp())
 AND anvil.source_read_policy_allows(pid,c.actor_id,c.policy_ref,op));
$$;
CREATE FUNCTION anvil.source_read_event_current(pid uuid,gid uuid,reason text,outcome text,target jsonb) RETURNS boolean LANGUAGE sql VOLATILE AS $$
 SELECT EXISTS(SELECT 1 FROM anvil.audit_events a JOIN anvil.source_read_grants g ON g.project_id=a.project_id AND g.id=gid
 WHERE a.project_id=pid AND a.event_id::text=current_setting('anvil.source_read_event_id',true)
 AND g.project_id::text=current_setting('anvil.source_read_project_id',true) AND g.id::text=current_setting('anvil.source_read_grant_id',true)
 AND a.source_kind='SOURCE_OBSERVATION_PROTOCOL' AND a.reason_code=$3 AND a.outcome=$4 AND a.target_ref=$5
 AND a.command_id IS NULL AND a.operation_id IS NULL AND a.approval_ref IS NULL AND a.correction_of IS NULL
 AND a.actor_ref=jsonb_build_object('kind','CONNECTOR','connectorId',g.connector_id,'registrationId',g.registration_id)
 AND a.client_ref=g.client_id AND a.scope_digest=g.scope_digest AND a.policy_ref=g.policy_ref
 AND a.recorded_at>=transaction_timestamp() AND anvil.source_read_basis_current(pid,gid));
$$;
CREATE FUNCTION anvil.source_read_utf16_length(v text) RETURNS integer LANGUAGE sql IMMUTABLE STRICT AS $$
 SELECT COALESCE(sum(CASE WHEN ascii(c)>65535 THEN 2 ELSE 1 END),0)::integer FROM regexp_split_to_table(v,'') c WHERE c<>'';
$$;
CREATE FUNCTION anvil.source_read_relative_file(p text) RETURNS boolean LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE part text;
BEGIN
 IF p IS NULL OR p='' OR p<>normalize(p,NFC) OR octet_length(p)>1024 OR p COLLATE "C" ~ '[[:cntrl:]\\:%?*"<>|]' THEN RETURN false;END IF;
 FOREACH part IN ARRAY string_to_array(p,'/') LOOP
  IF part='' OR part IN('.','..') OR anvil.source_read_utf16_length(part)>255 OR part~'[. ]$' OR part~*'^(CON|PRN|AUX|NUL|COM[1-9¹²³]|LPT[1-9¹²³])(\.|$)' THEN RETURN false;END IF;
 END LOOP;RETURN true;
END;
$$;
-- Generated from Node v24.18.0 Unicode 17.0 String.prototype.toUpperCase; 1580 changed scalar values.
-- Mapping UTF-8 SHA256 c32dcca8c6ed359801a837f6d4fa9a2d067a2ee3927f62e24ba06a7f518e7bed.
-- PostgreSQL locale/Unicode version does not define the protocol duplicate meaning.
CREATE FUNCTION anvil.source_read_uppercase_v1(v text) RETURNS text LANGUAGE sql IMMUTABLE STRICT AS $$
 SELECT COALESCE(string_agg(COALESCE(mapping.m->>p.c,p.c),'' ORDER BY p.n),'')
 FROM regexp_split_to_table(v,'') WITH ORDINALITY AS p(c,n)
 CROSS JOIN (SELECT $a3_unicode17${"a":"A","b":"B","c":"C","d":"D","e":"E","f":"F","g":"G","h":"H","i":"I","j":"J","k":"K","l":"L","m":"M","n":"N","o":"O","p":"P","q":"Q","r":"R","s":"S","t":"T","u":"U","v":"V","w":"W","x":"X","y":"Y","z":"Z","µ":"Μ","ß":"SS","à":"À","á":"Á","â":"Â","ã":"Ã","ä":"Ä","å":"Å","æ":"Æ","ç":"Ç","è":"È","é":"É","ê":"Ê","ë":"Ë","ì":"Ì","í":"Í","î":"Î","ï":"Ï","ð":"Ð","ñ":"Ñ","ò":"Ò","ó":"Ó","ô":"Ô","õ":"Õ","ö":"Ö","ø":"Ø","ù":"Ù","ú":"Ú","û":"Û","ü":"Ü","ý":"Ý","þ":"Þ","ÿ":"Ÿ","ā":"Ā","ă":"Ă","ą":"Ą","ć":"Ć","ĉ":"Ĉ","ċ":"Ċ","č":"Č","ď":"Ď","đ":"Đ","ē":"Ē","ĕ":"Ĕ","ė":"Ė","ę":"Ę","ě":"Ě","ĝ":"Ĝ","ğ":"Ğ","ġ":"Ġ","ģ":"Ģ","ĥ":"Ĥ","ħ":"Ħ","ĩ":"Ĩ","ī":"Ī","ĭ":"Ĭ","į":"Į","ı":"I","ĳ":"Ĳ","ĵ":"Ĵ","ķ":"Ķ","ĺ":"Ĺ","ļ":"Ļ","ľ":"Ľ","ŀ":"Ŀ","ł":"Ł","ń":"Ń","ņ":"Ņ","ň":"Ň","ŉ":"ʼN","ŋ":"Ŋ","ō":"Ō","ŏ":"Ŏ","ő":"Ő","œ":"Œ","ŕ":"Ŕ","ŗ":"Ŗ","ř":"Ř","ś":"Ś","ŝ":"Ŝ","ş":"Ş","š":"Š","ţ":"Ţ","ť":"Ť","ŧ":"Ŧ","ũ":"Ũ","ū":"Ū","ŭ":"Ŭ","ů":"Ů","ű":"Ű","ų":"Ų","ŵ":"Ŵ","ŷ":"Ŷ","ź":"Ź","ż":"Ż","ž":"Ž","ſ":"S","ƀ":"Ƀ","ƃ":"Ƃ","ƅ":"Ƅ","ƈ":"Ƈ","ƌ":"Ƌ","ƒ":"Ƒ","ƕ":"Ƕ","ƙ":"Ƙ","ƚ":"Ƚ","ƛ":"Ƛ","ƞ":"Ƞ","ơ":"Ơ","ƣ":"Ƣ","ƥ":"Ƥ","ƨ":"Ƨ","ƭ":"Ƭ","ư":"Ư","ƴ":"Ƴ","ƶ":"Ƶ","ƹ":"Ƹ","ƽ":"Ƽ","ƿ":"Ƿ","ǅ":"Ǆ","ǆ":"Ǆ","ǈ":"Ǉ","ǉ":"Ǉ","ǋ":"Ǌ","ǌ":"Ǌ","ǎ":"Ǎ","ǐ":"Ǐ","ǒ":"Ǒ","ǔ":"Ǔ","ǖ":"Ǖ","ǘ":"Ǘ","ǚ":"Ǚ","ǜ":"Ǜ","ǝ":"Ǝ","ǟ":"Ǟ","ǡ":"Ǡ","ǣ":"Ǣ","ǥ":"Ǥ","ǧ":"Ǧ","ǩ":"Ǩ","ǫ":"Ǫ","ǭ":"Ǭ","ǯ":"Ǯ","ǰ":"J̌","ǲ":"Ǳ","ǳ":"Ǳ","ǵ":"Ǵ","ǹ":"Ǹ","ǻ":"Ǻ","ǽ":"Ǽ","ǿ":"Ǿ","ȁ":"Ȁ","ȃ":"Ȃ","ȅ":"Ȅ","ȇ":"Ȇ","ȉ":"Ȉ","ȋ":"Ȋ","ȍ":"Ȍ","ȏ":"Ȏ","ȑ":"Ȑ","ȓ":"Ȓ","ȕ":"Ȕ","ȗ":"Ȗ","ș":"Ș","ț":"Ț","ȝ":"Ȝ","ȟ":"Ȟ","ȣ":"Ȣ","ȥ":"Ȥ","ȧ":"Ȧ","ȩ":"Ȩ","ȫ":"Ȫ","ȭ":"Ȭ","ȯ":"Ȯ","ȱ":"Ȱ","ȳ":"Ȳ","ȼ":"Ȼ","ȿ":"Ȿ","ɀ":"Ɀ","ɂ":"Ɂ","ɇ":"Ɇ","ɉ":"Ɉ","ɋ":"Ɋ","ɍ":"Ɍ","ɏ":"Ɏ","ɐ":"Ɐ","ɑ":"Ɑ","ɒ":"Ɒ","ɓ":"Ɓ","ɔ":"Ɔ","ɖ":"Ɖ","ɗ":"Ɗ","ə":"Ə","ɛ":"Ɛ","ɜ":"Ɜ","ɠ":"Ɠ","ɡ":"Ɡ","ɣ":"Ɣ","ɤ":"Ɤ","ɥ":"Ɥ","ɦ":"Ɦ","ɨ":"Ɨ","ɩ":"Ɩ","ɪ":"Ɪ","ɫ":"Ɫ","ɬ":"Ɬ","ɯ":"Ɯ","ɱ":"Ɱ","ɲ":"Ɲ","ɵ":"Ɵ","ɽ":"Ɽ","ʀ":"Ʀ","ʂ":"Ʂ","ʃ":"Ʃ","ʇ":"Ʇ","ʈ":"Ʈ","ʉ":"Ʉ","ʊ":"Ʊ","ʋ":"Ʋ","ʌ":"Ʌ","ʒ":"Ʒ","ʝ":"Ʝ","ʞ":"Ʞ","ͅ":"Ι","ͱ":"Ͱ","ͳ":"Ͳ","ͷ":"Ͷ","ͻ":"Ͻ","ͼ":"Ͼ","ͽ":"Ͽ","ΐ":"Ϊ́","ά":"Ά","έ":"Έ","ή":"Ή","ί":"Ί","ΰ":"Ϋ́","α":"Α","β":"Β","γ":"Γ","δ":"Δ","ε":"Ε","ζ":"Ζ","η":"Η","θ":"Θ","ι":"Ι","κ":"Κ","λ":"Λ","μ":"Μ","ν":"Ν","ξ":"Ξ","ο":"Ο","π":"Π","ρ":"Ρ","ς":"Σ","σ":"Σ","τ":"Τ","υ":"Υ","φ":"Φ","χ":"Χ","ψ":"Ψ","ω":"Ω","ϊ":"Ϊ","ϋ":"Ϋ","ό":"Ό","ύ":"Ύ","ώ":"Ώ","ϐ":"Β","ϑ":"Θ","ϕ":"Φ","ϖ":"Π","ϗ":"Ϗ","ϙ":"Ϙ","ϛ":"Ϛ","ϝ":"Ϝ","ϟ":"Ϟ","ϡ":"Ϡ","ϣ":"Ϣ","ϥ":"Ϥ","ϧ":"Ϧ","ϩ":"Ϩ","ϫ":"Ϫ","ϭ":"Ϭ","ϯ":"Ϯ","ϰ":"Κ","ϱ":"Ρ","ϲ":"Ϲ","ϳ":"Ϳ","ϵ":"Ε","ϸ":"Ϸ","ϻ":"Ϻ","а":"А","б":"Б","в":"В","г":"Г","д":"Д","е":"Е","ж":"Ж","з":"З","и":"И","й":"Й","к":"К","л":"Л","м":"М","н":"Н","о":"О","п":"П","р":"Р","с":"С","т":"Т","у":"У","ф":"Ф","х":"Х","ц":"Ц","ч":"Ч","ш":"Ш","щ":"Щ","ъ":"Ъ","ы":"Ы","ь":"Ь","э":"Э","ю":"Ю","я":"Я","ѐ":"Ѐ","ё":"Ё","ђ":"Ђ","ѓ":"Ѓ","є":"Є","ѕ":"Ѕ","і":"І","ї":"Ї","ј":"Ј","љ":"Љ","њ":"Њ","ћ":"Ћ","ќ":"Ќ","ѝ":"Ѝ","ў":"Ў","џ":"Џ","ѡ":"Ѡ","ѣ":"Ѣ","ѥ":"Ѥ","ѧ":"Ѧ","ѩ":"Ѩ","ѫ":"Ѫ","ѭ":"Ѭ","ѯ":"Ѯ","ѱ":"Ѱ","ѳ":"Ѳ","ѵ":"Ѵ","ѷ":"Ѷ","ѹ":"Ѹ","ѻ":"Ѻ","ѽ":"Ѽ","ѿ":"Ѿ","ҁ":"Ҁ","ҋ":"Ҋ","ҍ":"Ҍ","ҏ":"Ҏ","ґ":"Ґ","ғ":"Ғ","ҕ":"Ҕ","җ":"Җ","ҙ":"Ҙ","қ":"Қ","ҝ":"Ҝ","ҟ":"Ҟ","ҡ":"Ҡ","ң":"Ң","ҥ":"Ҥ","ҧ":"Ҧ","ҩ":"Ҩ","ҫ":"Ҫ","ҭ":"Ҭ","ү":"Ү","ұ":"Ұ","ҳ":"Ҳ","ҵ":"Ҵ","ҷ":"Ҷ","ҹ":"Ҹ","һ":"Һ","ҽ":"Ҽ","ҿ":"Ҿ","ӂ":"Ӂ","ӄ":"Ӄ","ӆ":"Ӆ","ӈ":"Ӈ","ӊ":"Ӊ","ӌ":"Ӌ","ӎ":"Ӎ","ӏ":"Ӏ","ӑ":"Ӑ","ӓ":"Ӓ","ӕ":"Ӕ","ӗ":"Ӗ","ә":"Ә","ӛ":"Ӛ","ӝ":"Ӝ","ӟ":"Ӟ","ӡ":"Ӡ","ӣ":"Ӣ","ӥ":"Ӥ","ӧ":"Ӧ","ө":"Ө","ӫ":"Ӫ","ӭ":"Ӭ","ӯ":"Ӯ","ӱ":"Ӱ","ӳ":"Ӳ","ӵ":"Ӵ","ӷ":"Ӷ","ӹ":"Ӹ","ӻ":"Ӻ","ӽ":"Ӽ","ӿ":"Ӿ","ԁ":"Ԁ","ԃ":"Ԃ","ԅ":"Ԅ","ԇ":"Ԇ","ԉ":"Ԉ","ԋ":"Ԋ","ԍ":"Ԍ","ԏ":"Ԏ","ԑ":"Ԑ","ԓ":"Ԓ","ԕ":"Ԕ","ԗ":"Ԗ","ԙ":"Ԙ","ԛ":"Ԛ","ԝ":"Ԝ","ԟ":"Ԟ","ԡ":"Ԡ","ԣ":"Ԣ","ԥ":"Ԥ","ԧ":"Ԧ","ԩ":"Ԩ","ԫ":"Ԫ","ԭ":"Ԭ","ԯ":"Ԯ","ա":"Ա","բ":"Բ","գ":"Գ","դ":"Դ","ե":"Ե","զ":"Զ","է":"Է","ը":"Ը","թ":"Թ","ժ":"Ժ","ի":"Ի","լ":"Լ","խ":"Խ","ծ":"Ծ","կ":"Կ","հ":"Հ","ձ":"Ձ","ղ":"Ղ","ճ":"Ճ","մ":"Մ","յ":"Յ","ն":"Ն","շ":"Շ","ո":"Ո","չ":"Չ","պ":"Պ","ջ":"Ջ","ռ":"Ռ","ս":"Ս","վ":"Վ","տ":"Տ","ր":"Ր","ց":"Ց","ւ":"Ւ","փ":"Փ","ք":"Ք","օ":"Օ","ֆ":"Ֆ","և":"ԵՒ","ა":"Ა","ბ":"Ბ","გ":"Გ","დ":"Დ","ე":"Ე","ვ":"Ვ","ზ":"Ზ","თ":"Თ","ი":"Ი","კ":"Კ","ლ":"Ლ","მ":"Მ","ნ":"Ნ","ო":"Ო","პ":"Პ","ჟ":"Ჟ","რ":"Რ","ს":"Ს","ტ":"Ტ","უ":"Უ","ფ":"Ფ","ქ":"Ქ","ღ":"Ღ","ყ":"Ყ","შ":"Შ","ჩ":"Ჩ","ც":"Ც","ძ":"Ძ","წ":"Წ","ჭ":"Ჭ","ხ":"Ხ","ჯ":"Ჯ","ჰ":"Ჰ","ჱ":"Ჱ","ჲ":"Ჲ","ჳ":"Ჳ","ჴ":"Ჴ","ჵ":"Ჵ","ჶ":"Ჶ","ჷ":"Ჷ","ჸ":"Ჸ","ჹ":"Ჹ","ჺ":"Ჺ","ჽ":"Ჽ","ჾ":"Ჾ","ჿ":"Ჿ","ᏸ":"Ᏸ","ᏹ":"Ᏹ","ᏺ":"Ᏺ","ᏻ":"Ᏻ","ᏼ":"Ᏼ","ᏽ":"Ᏽ","ᲀ":"В","ᲁ":"Д","ᲂ":"О","ᲃ":"С","ᲄ":"Т","ᲅ":"Т","ᲆ":"Ъ","ᲇ":"Ѣ","ᲈ":"Ꙋ","ᲊ":"Ᲊ","ᵹ":"Ᵹ","ᵽ":"Ᵽ","ᶎ":"Ᶎ","ḁ":"Ḁ","ḃ":"Ḃ","ḅ":"Ḅ","ḇ":"Ḇ","ḉ":"Ḉ","ḋ":"Ḋ","ḍ":"Ḍ","ḏ":"Ḏ","ḑ":"Ḑ","ḓ":"Ḓ","ḕ":"Ḕ","ḗ":"Ḗ","ḙ":"Ḙ","ḛ":"Ḛ","ḝ":"Ḝ","ḟ":"Ḟ","ḡ":"Ḡ","ḣ":"Ḣ","ḥ":"Ḥ","ḧ":"Ḧ","ḩ":"Ḩ","ḫ":"Ḫ","ḭ":"Ḭ","ḯ":"Ḯ","ḱ":"Ḱ","ḳ":"Ḳ","ḵ":"Ḵ","ḷ":"Ḷ","ḹ":"Ḹ","ḻ":"Ḻ","ḽ":"Ḽ","ḿ":"Ḿ","ṁ":"Ṁ","ṃ":"Ṃ","ṅ":"Ṅ","ṇ":"Ṇ","ṉ":"Ṉ","ṋ":"Ṋ","ṍ":"Ṍ","ṏ":"Ṏ","ṑ":"Ṑ","ṓ":"Ṓ","ṕ":"Ṕ","ṗ":"Ṗ","ṙ":"Ṙ","ṛ":"Ṛ","ṝ":"Ṝ","ṟ":"Ṟ","ṡ":"Ṡ","ṣ":"Ṣ","ṥ":"Ṥ","ṧ":"Ṧ","ṩ":"Ṩ","ṫ":"Ṫ","ṭ":"Ṭ","ṯ":"Ṯ","ṱ":"Ṱ","ṳ":"Ṳ","ṵ":"Ṵ","ṷ":"Ṷ","ṹ":"Ṹ","ṻ":"Ṻ","ṽ":"Ṽ","ṿ":"Ṿ","ẁ":"Ẁ","ẃ":"Ẃ","ẅ":"Ẅ","ẇ":"Ẇ","ẉ":"Ẉ","ẋ":"Ẋ","ẍ":"Ẍ","ẏ":"Ẏ","ẑ":"Ẑ","ẓ":"Ẓ","ẕ":"Ẕ","ẖ":"H̱","ẗ":"T̈","ẘ":"W̊","ẙ":"Y̊","ẚ":"Aʾ","ẛ":"Ṡ","ạ":"Ạ","ả":"Ả","ấ":"Ấ","ầ":"Ầ","ẩ":"Ẩ","ẫ":"Ẫ","ậ":"Ậ","ắ":"Ắ","ằ":"Ằ","ẳ":"Ẳ","ẵ":"Ẵ","ặ":"Ặ","ẹ":"Ẹ","ẻ":"Ẻ","ẽ":"Ẽ","ế":"Ế","ề":"Ề","ể":"Ể","ễ":"Ễ","ệ":"Ệ","ỉ":"Ỉ","ị":"Ị","ọ":"Ọ","ỏ":"Ỏ","ố":"Ố","ồ":"Ồ","ổ":"Ổ","ỗ":"Ỗ","ộ":"Ộ","ớ":"Ớ","ờ":"Ờ","ở":"Ở","ỡ":"Ỡ","ợ":"Ợ","ụ":"Ụ","ủ":"Ủ","ứ":"Ứ","ừ":"Ừ","ử":"Ử","ữ":"Ữ","ự":"Ự","ỳ":"Ỳ","ỵ":"Ỵ","ỷ":"Ỷ","ỹ":"Ỹ","ỻ":"Ỻ","ỽ":"Ỽ","ỿ":"Ỿ","ἀ":"Ἀ","ἁ":"Ἁ","ἂ":"Ἂ","ἃ":"Ἃ","ἄ":"Ἄ","ἅ":"Ἅ","ἆ":"Ἆ","ἇ":"Ἇ","ἐ":"Ἐ","ἑ":"Ἑ","ἒ":"Ἒ","ἓ":"Ἓ","ἔ":"Ἔ","ἕ":"Ἕ","ἠ":"Ἠ","ἡ":"Ἡ","ἢ":"Ἢ","ἣ":"Ἣ","ἤ":"Ἤ","ἥ":"Ἥ","ἦ":"Ἦ","ἧ":"Ἧ","ἰ":"Ἰ","ἱ":"Ἱ","ἲ":"Ἲ","ἳ":"Ἳ","ἴ":"Ἴ","ἵ":"Ἵ","ἶ":"Ἶ","ἷ":"Ἷ","ὀ":"Ὀ","ὁ":"Ὁ","ὂ":"Ὂ","ὃ":"Ὃ","ὄ":"Ὄ","ὅ":"Ὅ","ὐ":"Υ̓","ὑ":"Ὑ","ὒ":"Υ̓̀","ὓ":"Ὓ","ὔ":"Υ̓́","ὕ":"Ὕ","ὖ":"Υ̓͂","ὗ":"Ὗ","ὠ":"Ὠ","ὡ":"Ὡ","ὢ":"Ὢ","ὣ":"Ὣ","ὤ":"Ὤ","ὥ":"Ὥ","ὦ":"Ὦ","ὧ":"Ὧ","ὰ":"Ὰ","ά":"Ά","ὲ":"Ὲ","έ":"Έ","ὴ":"Ὴ","ή":"Ή","ὶ":"Ὶ","ί":"Ί","ὸ":"Ὸ","ό":"Ό","ὺ":"Ὺ","ύ":"Ύ","ὼ":"Ὼ","ώ":"Ώ","ᾀ":"ἈΙ","ᾁ":"ἉΙ","ᾂ":"ἊΙ","ᾃ":"ἋΙ","ᾄ":"ἌΙ","ᾅ":"ἍΙ","ᾆ":"ἎΙ","ᾇ":"ἏΙ","ᾈ":"ἈΙ","ᾉ":"ἉΙ","ᾊ":"ἊΙ","ᾋ":"ἋΙ","ᾌ":"ἌΙ","ᾍ":"ἍΙ","ᾎ":"ἎΙ","ᾏ":"ἏΙ","ᾐ":"ἨΙ","ᾑ":"ἩΙ","ᾒ":"ἪΙ","ᾓ":"ἫΙ","ᾔ":"ἬΙ","ᾕ":"ἭΙ","ᾖ":"ἮΙ","ᾗ":"ἯΙ","ᾘ":"ἨΙ","ᾙ":"ἩΙ","ᾚ":"ἪΙ","ᾛ":"ἫΙ","ᾜ":"ἬΙ","ᾝ":"ἭΙ","ᾞ":"ἮΙ","ᾟ":"ἯΙ","ᾠ":"ὨΙ","ᾡ":"ὩΙ","ᾢ":"ὪΙ","ᾣ":"ὫΙ","ᾤ":"ὬΙ","ᾥ":"ὭΙ","ᾦ":"ὮΙ","ᾧ":"ὯΙ","ᾨ":"ὨΙ","ᾩ":"ὩΙ","ᾪ":"ὪΙ","ᾫ":"ὫΙ","ᾬ":"ὬΙ","ᾭ":"ὭΙ","ᾮ":"ὮΙ","ᾯ":"ὯΙ","ᾰ":"Ᾰ","ᾱ":"Ᾱ","ᾲ":"ᾺΙ","ᾳ":"ΑΙ","ᾴ":"ΆΙ","ᾶ":"Α͂","ᾷ":"Α͂Ι","ᾼ":"ΑΙ","ι":"Ι","ῂ":"ῊΙ","ῃ":"ΗΙ","ῄ":"ΉΙ","ῆ":"Η͂","ῇ":"Η͂Ι","ῌ":"ΗΙ","ῐ":"Ῐ","ῑ":"Ῑ","ῒ":"Ϊ̀","ΐ":"Ϊ́","ῖ":"Ι͂","ῗ":"Ϊ͂","ῠ":"Ῠ","ῡ":"Ῡ","ῢ":"Ϋ̀","ΰ":"Ϋ́","ῤ":"Ρ̓","ῥ":"Ῥ","ῦ":"Υ͂","ῧ":"Ϋ͂","ῲ":"ῺΙ","ῳ":"ΩΙ","ῴ":"ΏΙ","ῶ":"Ω͂","ῷ":"Ω͂Ι","ῼ":"ΩΙ","ⅎ":"Ⅎ","ⅰ":"Ⅰ","ⅱ":"Ⅱ","ⅲ":"Ⅲ","ⅳ":"Ⅳ","ⅴ":"Ⅴ","ⅵ":"Ⅵ","ⅶ":"Ⅶ","ⅷ":"Ⅷ","ⅸ":"Ⅸ","ⅹ":"Ⅹ","ⅺ":"Ⅺ","ⅻ":"Ⅻ","ⅼ":"Ⅼ","ⅽ":"Ⅽ","ⅾ":"Ⅾ","ⅿ":"Ⅿ","ↄ":"Ↄ","ⓐ":"Ⓐ","ⓑ":"Ⓑ","ⓒ":"Ⓒ","ⓓ":"Ⓓ","ⓔ":"Ⓔ","ⓕ":"Ⓕ","ⓖ":"Ⓖ","ⓗ":"Ⓗ","ⓘ":"Ⓘ","ⓙ":"Ⓙ","ⓚ":"Ⓚ","ⓛ":"Ⓛ","ⓜ":"Ⓜ","ⓝ":"Ⓝ","ⓞ":"Ⓞ","ⓟ":"Ⓟ","ⓠ":"Ⓠ","ⓡ":"Ⓡ","ⓢ":"Ⓢ","ⓣ":"Ⓣ","ⓤ":"Ⓤ","ⓥ":"Ⓥ","ⓦ":"Ⓦ","ⓧ":"Ⓧ","ⓨ":"Ⓨ","ⓩ":"Ⓩ","ⰰ":"Ⰰ","ⰱ":"Ⰱ","ⰲ":"Ⰲ","ⰳ":"Ⰳ","ⰴ":"Ⰴ","ⰵ":"Ⰵ","ⰶ":"Ⰶ","ⰷ":"Ⰷ","ⰸ":"Ⰸ","ⰹ":"Ⰹ","ⰺ":"Ⰺ","ⰻ":"Ⰻ","ⰼ":"Ⰼ","ⰽ":"Ⰽ","ⰾ":"Ⰾ","ⰿ":"Ⰿ","ⱀ":"Ⱀ","ⱁ":"Ⱁ","ⱂ":"Ⱂ","ⱃ":"Ⱃ","ⱄ":"Ⱄ","ⱅ":"Ⱅ","ⱆ":"Ⱆ","ⱇ":"Ⱇ","ⱈ":"Ⱈ","ⱉ":"Ⱉ","ⱊ":"Ⱊ","ⱋ":"Ⱋ","ⱌ":"Ⱌ","ⱍ":"Ⱍ","ⱎ":"Ⱎ","ⱏ":"Ⱏ","ⱐ":"Ⱐ","ⱑ":"Ⱑ","ⱒ":"Ⱒ","ⱓ":"Ⱓ","ⱔ":"Ⱔ","ⱕ":"Ⱕ","ⱖ":"Ⱖ","ⱗ":"Ⱗ","ⱘ":"Ⱘ","ⱙ":"Ⱙ","ⱚ":"Ⱚ","ⱛ":"Ⱛ","ⱜ":"Ⱜ","ⱝ":"Ⱝ","ⱞ":"Ⱞ","ⱟ":"Ⱟ","ⱡ":"Ⱡ","ⱥ":"Ⱥ","ⱦ":"Ⱦ","ⱨ":"Ⱨ","ⱪ":"Ⱪ","ⱬ":"Ⱬ","ⱳ":"Ⱳ","ⱶ":"Ⱶ","ⲁ":"Ⲁ","ⲃ":"Ⲃ","ⲅ":"Ⲅ","ⲇ":"Ⲇ","ⲉ":"Ⲉ","ⲋ":"Ⲋ","ⲍ":"Ⲍ","ⲏ":"Ⲏ","ⲑ":"Ⲑ","ⲓ":"Ⲓ","ⲕ":"Ⲕ","ⲗ":"Ⲗ","ⲙ":"Ⲙ","ⲛ":"Ⲛ","ⲝ":"Ⲝ","ⲟ":"Ⲟ","ⲡ":"Ⲡ","ⲣ":"Ⲣ","ⲥ":"Ⲥ","ⲧ":"Ⲧ","ⲩ":"Ⲩ","ⲫ":"Ⲫ","ⲭ":"Ⲭ","ⲯ":"Ⲯ","ⲱ":"Ⲱ","ⲳ":"Ⲳ","ⲵ":"Ⲵ","ⲷ":"Ⲷ","ⲹ":"Ⲹ","ⲻ":"Ⲻ","ⲽ":"Ⲽ","ⲿ":"Ⲿ","ⳁ":"Ⳁ","ⳃ":"Ⳃ","ⳅ":"Ⳅ","ⳇ":"Ⳇ","ⳉ":"Ⳉ","ⳋ":"Ⳋ","ⳍ":"Ⳍ","ⳏ":"Ⳏ","ⳑ":"Ⳑ","ⳓ":"Ⳓ","ⳕ":"Ⳕ","ⳗ":"Ⳗ","ⳙ":"Ⳙ","ⳛ":"Ⳛ","ⳝ":"Ⳝ","ⳟ":"Ⳟ","ⳡ":"Ⳡ","ⳣ":"Ⳣ","ⳬ":"Ⳬ","ⳮ":"Ⳮ","ⳳ":"Ⳳ","ⴀ":"Ⴀ","ⴁ":"Ⴁ","ⴂ":"Ⴂ","ⴃ":"Ⴃ","ⴄ":"Ⴄ","ⴅ":"Ⴅ","ⴆ":"Ⴆ","ⴇ":"Ⴇ","ⴈ":"Ⴈ","ⴉ":"Ⴉ","ⴊ":"Ⴊ","ⴋ":"Ⴋ","ⴌ":"Ⴌ","ⴍ":"Ⴍ","ⴎ":"Ⴎ","ⴏ":"Ⴏ","ⴐ":"Ⴐ","ⴑ":"Ⴑ","ⴒ":"Ⴒ","ⴓ":"Ⴓ","ⴔ":"Ⴔ","ⴕ":"Ⴕ","ⴖ":"Ⴖ","ⴗ":"Ⴗ","ⴘ":"Ⴘ","ⴙ":"Ⴙ","ⴚ":"Ⴚ","ⴛ":"Ⴛ","ⴜ":"Ⴜ","ⴝ":"Ⴝ","ⴞ":"Ⴞ","ⴟ":"Ⴟ","ⴠ":"Ⴠ","ⴡ":"Ⴡ","ⴢ":"Ⴢ","ⴣ":"Ⴣ","ⴤ":"Ⴤ","ⴥ":"Ⴥ","ⴧ":"Ⴧ","ⴭ":"Ⴭ","ꙁ":"Ꙁ","ꙃ":"Ꙃ","ꙅ":"Ꙅ","ꙇ":"Ꙇ","ꙉ":"Ꙉ","ꙋ":"Ꙋ","ꙍ":"Ꙍ","ꙏ":"Ꙏ","ꙑ":"Ꙑ","ꙓ":"Ꙓ","ꙕ":"Ꙕ","ꙗ":"Ꙗ","ꙙ":"Ꙙ","ꙛ":"Ꙛ","ꙝ":"Ꙝ","ꙟ":"Ꙟ","ꙡ":"Ꙡ","ꙣ":"Ꙣ","ꙥ":"Ꙥ","ꙧ":"Ꙧ","ꙩ":"Ꙩ","ꙫ":"Ꙫ","ꙭ":"Ꙭ","ꚁ":"Ꚁ","ꚃ":"Ꚃ","ꚅ":"Ꚅ","ꚇ":"Ꚇ","ꚉ":"Ꚉ","ꚋ":"Ꚋ","ꚍ":"Ꚍ","ꚏ":"Ꚏ","ꚑ":"Ꚑ","ꚓ":"Ꚓ","ꚕ":"Ꚕ","ꚗ":"Ꚗ","ꚙ":"Ꚙ","ꚛ":"Ꚛ","ꜣ":"Ꜣ","ꜥ":"Ꜥ","ꜧ":"Ꜧ","ꜩ":"Ꜩ","ꜫ":"Ꜫ","ꜭ":"Ꜭ","ꜯ":"Ꜯ","ꜳ":"Ꜳ","ꜵ":"Ꜵ","ꜷ":"Ꜷ","ꜹ":"Ꜹ","ꜻ":"Ꜻ","ꜽ":"Ꜽ","ꜿ":"Ꜿ","ꝁ":"Ꝁ","ꝃ":"Ꝃ","ꝅ":"Ꝅ","ꝇ":"Ꝇ","ꝉ":"Ꝉ","ꝋ":"Ꝋ","ꝍ":"Ꝍ","ꝏ":"Ꝏ","ꝑ":"Ꝑ","ꝓ":"Ꝓ","ꝕ":"Ꝕ","ꝗ":"Ꝗ","ꝙ":"Ꝙ","ꝛ":"Ꝛ","ꝝ":"Ꝝ","ꝟ":"Ꝟ","ꝡ":"Ꝡ","ꝣ":"Ꝣ","ꝥ":"Ꝥ","ꝧ":"Ꝧ","ꝩ":"Ꝩ","ꝫ":"Ꝫ","ꝭ":"Ꝭ","ꝯ":"Ꝯ","ꝺ":"Ꝺ","ꝼ":"Ꝼ","ꝿ":"Ꝿ","ꞁ":"Ꞁ","ꞃ":"Ꞃ","ꞅ":"Ꞅ","ꞇ":"Ꞇ","ꞌ":"Ꞌ","ꞑ":"Ꞑ","ꞓ":"Ꞓ","ꞔ":"Ꞔ","ꞗ":"Ꞗ","ꞙ":"Ꞙ","ꞛ":"Ꞛ","ꞝ":"Ꞝ","ꞟ":"Ꞟ","ꞡ":"Ꞡ","ꞣ":"Ꞣ","ꞥ":"Ꞥ","ꞧ":"Ꞧ","ꞩ":"Ꞩ","ꞵ":"Ꞵ","ꞷ":"Ꞷ","ꞹ":"Ꞹ","ꞻ":"Ꞻ","ꞽ":"Ꞽ","ꞿ":"Ꞿ","ꟁ":"Ꟁ","ꟃ":"Ꟃ","ꟈ":"Ꟈ","ꟊ":"Ꟊ","ꟍ":"Ꟍ","꟏":"꟎","ꟑ":"Ꟑ","ꟓ":"꟒","ꟕ":"꟔","ꟗ":"Ꟗ","ꟙ":"Ꟙ","ꟛ":"Ꟛ","ꟶ":"Ꟶ","ꭓ":"Ꭓ","ꭰ":"Ꭰ","ꭱ":"Ꭱ","ꭲ":"Ꭲ","ꭳ":"Ꭳ","ꭴ":"Ꭴ","ꭵ":"Ꭵ","ꭶ":"Ꭶ","ꭷ":"Ꭷ","ꭸ":"Ꭸ","ꭹ":"Ꭹ","ꭺ":"Ꭺ","ꭻ":"Ꭻ","ꭼ":"Ꭼ","ꭽ":"Ꭽ","ꭾ":"Ꭾ","ꭿ":"Ꭿ","ꮀ":"Ꮀ","ꮁ":"Ꮁ","ꮂ":"Ꮂ","ꮃ":"Ꮃ","ꮄ":"Ꮄ","ꮅ":"Ꮅ","ꮆ":"Ꮆ","ꮇ":"Ꮇ","ꮈ":"Ꮈ","ꮉ":"Ꮉ","ꮊ":"Ꮊ","ꮋ":"Ꮋ","ꮌ":"Ꮌ","ꮍ":"Ꮍ","ꮎ":"Ꮎ","ꮏ":"Ꮏ","ꮐ":"Ꮐ","ꮑ":"Ꮑ","ꮒ":"Ꮒ","ꮓ":"Ꮓ","ꮔ":"Ꮔ","ꮕ":"Ꮕ","ꮖ":"Ꮖ","ꮗ":"Ꮗ","ꮘ":"Ꮘ","ꮙ":"Ꮙ","ꮚ":"Ꮚ","ꮛ":"Ꮛ","ꮜ":"Ꮜ","ꮝ":"Ꮝ","ꮞ":"Ꮞ","ꮟ":"Ꮟ","ꮠ":"Ꮠ","ꮡ":"Ꮡ","ꮢ":"Ꮢ","ꮣ":"Ꮣ","ꮤ":"Ꮤ","ꮥ":"Ꮥ","ꮦ":"Ꮦ","ꮧ":"Ꮧ","ꮨ":"Ꮨ","ꮩ":"Ꮩ","ꮪ":"Ꮪ","ꮫ":"Ꮫ","ꮬ":"Ꮬ","ꮭ":"Ꮭ","ꮮ":"Ꮮ","ꮯ":"Ꮯ","ꮰ":"Ꮰ","ꮱ":"Ꮱ","ꮲ":"Ꮲ","ꮳ":"Ꮳ","ꮴ":"Ꮴ","ꮵ":"Ꮵ","ꮶ":"Ꮶ","ꮷ":"Ꮷ","ꮸ":"Ꮸ","ꮹ":"Ꮹ","ꮺ":"Ꮺ","ꮻ":"Ꮻ","ꮼ":"Ꮼ","ꮽ":"Ꮽ","ꮾ":"Ꮾ","ꮿ":"Ꮿ","ﬀ":"FF","ﬁ":"FI","ﬂ":"FL","ﬃ":"FFI","ﬄ":"FFL","ﬅ":"ST","ﬆ":"ST","ﬓ":"ՄՆ","ﬔ":"ՄԵ","ﬕ":"ՄԻ","ﬖ":"ՎՆ","ﬗ":"ՄԽ","ａ":"Ａ","ｂ":"Ｂ","ｃ":"Ｃ","ｄ":"Ｄ","ｅ":"Ｅ","ｆ":"Ｆ","ｇ":"Ｇ","ｈ":"Ｈ","ｉ":"Ｉ","ｊ":"Ｊ","ｋ":"Ｋ","ｌ":"Ｌ","ｍ":"Ｍ","ｎ":"Ｎ","ｏ":"Ｏ","ｐ":"Ｐ","ｑ":"Ｑ","ｒ":"Ｒ","ｓ":"Ｓ","ｔ":"Ｔ","ｕ":"Ｕ","ｖ":"Ｖ","ｗ":"Ｗ","ｘ":"Ｘ","ｙ":"Ｙ","ｚ":"Ｚ","𐐨":"𐐀","𐐩":"𐐁","𐐪":"𐐂","𐐫":"𐐃","𐐬":"𐐄","𐐭":"𐐅","𐐮":"𐐆","𐐯":"𐐇","𐐰":"𐐈","𐐱":"𐐉","𐐲":"𐐊","𐐳":"𐐋","𐐴":"𐐌","𐐵":"𐐍","𐐶":"𐐎","𐐷":"𐐏","𐐸":"𐐐","𐐹":"𐐑","𐐺":"𐐒","𐐻":"𐐓","𐐼":"𐐔","𐐽":"𐐕","𐐾":"𐐖","𐐿":"𐐗","𐑀":"𐐘","𐑁":"𐐙","𐑂":"𐐚","𐑃":"𐐛","𐑄":"𐐜","𐑅":"𐐝","𐑆":"𐐞","𐑇":"𐐟","𐑈":"𐐠","𐑉":"𐐡","𐑊":"𐐢","𐑋":"𐐣","𐑌":"𐐤","𐑍":"𐐥","𐑎":"𐐦","𐑏":"𐐧","𐓘":"𐒰","𐓙":"𐒱","𐓚":"𐒲","𐓛":"𐒳","𐓜":"𐒴","𐓝":"𐒵","𐓞":"𐒶","𐓟":"𐒷","𐓠":"𐒸","𐓡":"𐒹","𐓢":"𐒺","𐓣":"𐒻","𐓤":"𐒼","𐓥":"𐒽","𐓦":"𐒾","𐓧":"𐒿","𐓨":"𐓀","𐓩":"𐓁","𐓪":"𐓂","𐓫":"𐓃","𐓬":"𐓄","𐓭":"𐓅","𐓮":"𐓆","𐓯":"𐓇","𐓰":"𐓈","𐓱":"𐓉","𐓲":"𐓊","𐓳":"𐓋","𐓴":"𐓌","𐓵":"𐓍","𐓶":"𐓎","𐓷":"𐓏","𐓸":"𐓐","𐓹":"𐓑","𐓺":"𐓒","𐓻":"𐓓","𐖗":"𐕰","𐖘":"𐕱","𐖙":"𐕲","𐖚":"𐕳","𐖛":"𐕴","𐖜":"𐕵","𐖝":"𐕶","𐖞":"𐕷","𐖟":"𐕸","𐖠":"𐕹","𐖡":"𐕺","𐖣":"𐕼","𐖤":"𐕽","𐖥":"𐕾","𐖦":"𐕿","𐖧":"𐖀","𐖨":"𐖁","𐖩":"𐖂","𐖪":"𐖃","𐖫":"𐖄","𐖬":"𐖅","𐖭":"𐖆","𐖮":"𐖇","𐖯":"𐖈","𐖰":"𐖉","𐖱":"𐖊","𐖳":"𐖌","𐖴":"𐖍","𐖵":"𐖎","𐖶":"𐖏","𐖷":"𐖐","𐖸":"𐖑","𐖹":"𐖒","𐖻":"𐖔","𐖼":"𐖕","𐳀":"𐲀","𐳁":"𐲁","𐳂":"𐲂","𐳃":"𐲃","𐳄":"𐲄","𐳅":"𐲅","𐳆":"𐲆","𐳇":"𐲇","𐳈":"𐲈","𐳉":"𐲉","𐳊":"𐲊","𐳋":"𐲋","𐳌":"𐲌","𐳍":"𐲍","𐳎":"𐲎","𐳏":"𐲏","𐳐":"𐲐","𐳑":"𐲑","𐳒":"𐲒","𐳓":"𐲓","𐳔":"𐲔","𐳕":"𐲕","𐳖":"𐲖","𐳗":"𐲗","𐳘":"𐲘","𐳙":"𐲙","𐳚":"𐲚","𐳛":"𐲛","𐳜":"𐲜","𐳝":"𐲝","𐳞":"𐲞","𐳟":"𐲟","𐳠":"𐲠","𐳡":"𐲡","𐳢":"𐲢","𐳣":"𐲣","𐳤":"𐲤","𐳥":"𐲥","𐳦":"𐲦","𐳧":"𐲧","𐳨":"𐲨","𐳩":"𐲩","𐳪":"𐲪","𐳫":"𐲫","𐳬":"𐲬","𐳭":"𐲭","𐳮":"𐲮","𐳯":"𐲯","𐳰":"𐲰","𐳱":"𐲱","𐳲":"𐲲","𐵰":"𐵐","𐵱":"𐵑","𐵲":"𐵒","𐵳":"𐵓","𐵴":"𐵔","𐵵":"𐵕","𐵶":"𐵖","𐵷":"𐵗","𐵸":"𐵘","𐵹":"𐵙","𐵺":"𐵚","𐵻":"𐵛","𐵼":"𐵜","𐵽":"𐵝","𐵾":"𐵞","𐵿":"𐵟","𐶀":"𐵠","𐶁":"𐵡","𐶂":"𐵢","𐶃":"𐵣","𐶄":"𐵤","𐶅":"𐵥","𑣀":"𑢠","𑣁":"𑢡","𑣂":"𑢢","𑣃":"𑢣","𑣄":"𑢤","𑣅":"𑢥","𑣆":"𑢦","𑣇":"𑢧","𑣈":"𑢨","𑣉":"𑢩","𑣊":"𑢪","𑣋":"𑢫","𑣌":"𑢬","𑣍":"𑢭","𑣎":"𑢮","𑣏":"𑢯","𑣐":"𑢰","𑣑":"𑢱","𑣒":"𑢲","𑣓":"𑢳","𑣔":"𑢴","𑣕":"𑢵","𑣖":"𑢶","𑣗":"𑢷","𑣘":"𑢸","𑣙":"𑢹","𑣚":"𑢺","𑣛":"𑢻","𑣜":"𑢼","𑣝":"𑢽","𑣞":"𑢾","𑣟":"𑢿","𖹠":"𖹀","𖹡":"𖹁","𖹢":"𖹂","𖹣":"𖹃","𖹤":"𖹄","𖹥":"𖹅","𖹦":"𖹆","𖹧":"𖹇","𖹨":"𖹈","𖹩":"𖹉","𖹪":"𖹊","𖹫":"𖹋","𖹬":"𖹌","𖹭":"𖹍","𖹮":"𖹎","𖹯":"𖹏","𖹰":"𖹐","𖹱":"𖹑","𖹲":"𖹒","𖹳":"𖹓","𖹴":"𖹔","𖹵":"𖹕","𖹶":"𖹖","𖹷":"𖹗","𖹸":"𖹘","𖹹":"𖹙","𖹺":"𖹚","𖹻":"𖹛","𖹼":"𖹜","𖹽":"𖹝","𖹾":"𖹞","𖹿":"𖹟","𖺻":"𖺠","𖺼":"𖺡","𖺽":"𖺢","𖺾":"𖺣","𖺿":"𖺤","𖻀":"𖺥","𖻁":"𖺦","𖻂":"𖺧","𖻃":"𖺨","𖻄":"𖺩","𖻅":"𖺪","𖻆":"𖺫","𖻇":"𖺬","𖻈":"𖺭","𖻉":"𖺮","𖻊":"𖺯","𖻋":"𖺰","𖻌":"𖺱","𖻍":"𖺲","𖻎":"𖺳","𖻏":"𖺴","𖻐":"𖺵","𖻑":"𖺶","𖻒":"𖺷","𖻓":"𖺸","𞤢":"𞤀","𞤣":"𞤁","𞤤":"𞤂","𞤥":"𞤃","𞤦":"𞤄","𞤧":"𞤅","𞤨":"𞤆","𞤩":"𞤇","𞤪":"𞤈","𞤫":"𞤉","𞤬":"𞤊","𞤭":"𞤋","𞤮":"𞤌","𞤯":"𞤍","𞤰":"𞤎","𞤱":"𞤏","𞤲":"𞤐","𞤳":"𞤑","𞤴":"𞤒","𞤵":"𞤓","𞤶":"𞤔","𞤷":"𞤕","𞤸":"𞤖","𞤹":"𞤗","𞤺":"𞤘","𞤻":"𞤙","𞤼":"𞤚","𞤽":"𞤛","𞤾":"𞤜","𞤿":"𞤝","𞥀":"𞤞","𞥁":"𞤟","𞥂":"𞤠","𞥃":"𞤡"}$a3_unicode17$::jsonb AS m) mapping WHERE p.c<>'';
$$;
CREATE FUNCTION anvil.source_read_targets(v jsonb) RETURNS boolean LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE item jsonb;seen text[]='{}';p text;folded text;
BEGIN
 IF jsonb_typeof(v) IS DISTINCT FROM 'array' OR jsonb_array_length(v) NOT BETWEEN 1 AND 200 THEN RETURN false;END IF;
 FOR item IN SELECT value FROM jsonb_array_elements(v) LOOP
  IF jsonb_typeof(item->'relativePath') IS DISTINCT FROM 'string' THEN RETURN false;END IF;p=item->>'relativePath';
  IF NOT anvil.source_read_relative_file(p) OR item IS DISTINCT FROM jsonb_build_object('relativePath',p,'kind','FILE','access','READ_ATTRIBUTES','recursive',false) THEN RETURN false;END IF;
  folded=anvil.source_read_uppercase_v1(p);IF folded COLLATE "C"=ANY(seen) THEN RETURN false;END IF;seen=array_append(seen,folded);
 END LOOP;RETURN true;
END;
$$;
CREATE FUNCTION anvil.source_read_scope_valid(g anvil.source_read_grants) RETURNS boolean LANGUAGE plpgsql STABLE AS $$
DECLARE d jsonb;v anvil.source_root_versions%ROWTYPE;expected jsonb;reason text;
BEGIN
 SELECT * INTO v FROM anvil.source_root_versions WHERE project_id=g.project_id AND root_id=g.source_root_id AND version=g.source_root_version;
 d=v.declaration_json;reason=g.scope_json->>'reason';
 IF v.root_id IS NULL OR v.status<>'DECLARED' OR v.authority<>'USER_DECLARED' OR v.readiness<>'UNVERIFIED'
  OR v.content_hash<>g.source_root_hash OR anvil.source_root_snapshot_hash(d,v.status,v.reason)<>g.source_root_hash
  OR jsonb_typeof(g.scope_json->'reason') IS DISTINCT FROM 'string' OR length(trim(reason))=0 OR anvil.source_read_utf16_length(reason)>20000
  OR regexp_replace(reason,E'[\t\n\r]','','g') COLLATE "C" ~ '[[:cntrl:]]'
  OR NOT anvil.source_read_ref(g.policy_ref) OR NOT anvil.source_read_ref(g.scope_json->'connectorRef') OR NOT anvil.source_read_ref(g.scope_json->'registrationRef')
  OR NOT anvil.source_read_targets(g.scope_json->'targets') THEN RETURN false;END IF;
 expected=jsonb_build_object('protocolVersion',1,'purpose','SOURCE_READ_OBSERVATION','installationId',g.scope_json->'installationId','projectId',g.project_id,
 'sourceRootRef',jsonb_build_object('id',g.source_root_id,'version',g.source_root_version,'contentHash',g.source_root_hash),
 'connectorRef',g.scope_json->'connectorRef','registrationRef',g.scope_json->'registrationRef',
 'pathHintHash',encode(sha256(convert_to(d->>'pathHint','UTF8')),'hex'),'hostFingerprint',g.scope_json->'hostFingerprint',
 'userId',g.requested_by,'clientId',g.client_id,'credentialGeneration',g.credential_generation,'controlGeneration',g.control_generation,
 'policyRef',g.policy_ref,'targets',g.scope_json->'targets','requestedAt',anvil.source_read_iso(g.created_at),'expiresAt',anvil.source_read_iso(g.expires_at),'reason',reason);
 RETURN g.scope_json=expected AND octet_length(anvil.source_read_canonical_json(expected))<=262144 AND anvil.source_read_hash(expected)=g.scope_digest
  AND g.scope_json->'connectorRef'->>'id'=g.connector_id::text AND (g.scope_json->'connectorRef'->>'version')::bigint=g.connector_generation
  AND g.scope_json->'registrationRef'->>'id'=g.registration_id::text AND (g.scope_json->'registrationRef'->>'version')::bigint=g.registration_version;
EXCEPTION WHEN OTHERS THEN RETURN false;
END;
$$;
CREATE FUNCTION anvil.guard_source_read_grant() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE cmd anvil.commands%ROWTYPE;data jsonb;ref jsonb;failures bigint;
BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'SOURCE_READ_GRANT_IMMUTABLE' USING ERRCODE='42501';END IF;
 ref=jsonb_build_object('id',NEW.id,'version',1,'contentHash',NEW.scope_digest);
 IF TG_OP='INSERT' THEN
  SELECT * INTO cmd FROM anvil.commands WHERE project_id=NEW.project_id AND id=NEW.created_command_id;data=cmd.result_ref->'data';
  IF NEW.version<>1 OR NEW.revoked_at IS NOT NULL OR NEW.revoke_command_id IS NOT NULL OR NEW.exchange_failures<>0
   OR cmd.id::text IS DISTINCT FROM current_setting('anvil.command_id',true) OR cmd.operation<>'requestSourceReadObservation' OR cmd.expected_version<>0
   OR NEW.requested_by IS DISTINCT FROM cmd.actor_id OR NEW.client_id IS DISTINCT FROM cmd.client_id OR NEW.control_generation IS DISTINCT FROM cmd.control_generation OR NEW.policy_ref IS DISTINCT FROM cmd.policy_ref
   OR NOT anvil.source_read_command_authorized(NEW.project_id,cmd.operation) OR NOT anvil.source_read_scope_valid(NEW) OR NOT anvil.source_read_basis_current(NEW.project_id,NEW.id)
   OR cmd.result_ref->>'status' IS DISTINCT FROM 'APPLIED' OR cmd.result_ref->>'targetId' IS DISTINCT FROM NEW.id::text OR cmd.result_ref->'version' IS DISTINCT FROM '1'::jsonb
   OR data IS DISTINCT FROM jsonb_build_object('ref',ref,'status','GRANT_RECORDED','grantRef',ref,'scopeDigest',NEW.scope_digest,'storedState','CREATED','scope',NEW.scope_json,'observationPermit','NOT_ISSUED','executionAuthorized',false,'agentDispatchPerformed',false,'baselineConfirmed',false)
   OR NEW.created_at<transaction_timestamp()-interval '1 millisecond' OR NEW.created_at>clock_timestamp() THEN RAISE EXCEPTION 'SOURCE_READ_GRANT_RECEIPT_REQUIRED' USING ERRCODE='42501';END IF;
  IF NOT EXISTS(SELECT 1 FROM anvil.auth_sessions s JOIN anvil.connector_registrations r ON r.project_id=NEW.project_id AND r.id=NEW.registration_id
   WHERE s.id=NEW.session_id AND s.user_id=NEW.requested_by AND s.client_id=NEW.client_id AND s.absolute_expires_at>=NEW.expires_at AND r.expires_at>=NEW.expires_at)
   OR EXISTS(SELECT 1 FROM anvil.permission_policy_versions v,jsonb_array_elements(v.rules_json) rule WHERE v.project_id=NEW.project_id AND v.policy_id::text=NEW.policy_ref->>'id' AND v.version::text=NEW.policy_ref->>'version'
    AND rule->'subjectRef'=jsonb_build_object('kind','HUMAN','userId',NEW.requested_by) AND rule->'targetScopes'=jsonb_build_array(jsonb_build_object('kind','PROJECT','projectId',NEW.project_id))
    AND (rule->'operations') ? 'requestSourceReadObservation' AND (rule->>'expiresAt')::timestamptz>clock_timestamp() AND (rule->>'expiresAt')::timestamptz<NEW.expires_at)
   THEN RAISE EXCEPTION 'SOURCE_READ_GRANT_EXPIRY_INVALID' USING ERRCODE='42501';END IF;
  RETURN NEW;
 END IF;
 IF (to_jsonb(NEW)-ARRAY['revoked_at','revoke_command_id','exchange_failures']) IS DISTINCT FROM (to_jsonb(OLD)-ARRAY['revoked_at','revoke_command_id','exchange_failures']) THEN RAISE EXCEPTION 'SOURCE_READ_GRANT_IMMUTABLE' USING ERRCODE='42501';END IF;
 IF NEW.exchange_failures=OLD.exchange_failures+1 AND NEW.revoked_at IS NOT DISTINCT FROM OLD.revoked_at AND NEW.revoke_command_id IS NOT DISTINCT FROM OLD.revoke_command_id AND OLD.exchange_failures<5 THEN
  SELECT count(*) INTO failures FROM anvil.audit_events a WHERE a.project_id=NEW.project_id AND a.target_ref=ref AND a.scope_digest=NEW.scope_digest AND a.source_kind='SOURCE_OBSERVATION_PROTOCOL' AND a.reason_code='SOURCE_READ_PROOF_DENIED' AND a.outcome='DENIED';
  IF failures<>NEW.exchange_failures OR NOT anvil.source_read_event_current(NEW.project_id,NEW.id,'SOURCE_READ_PROOF_DENIED','DENIED',ref) THEN RAISE EXCEPTION 'SOURCE_READ_PROOF_EVENT_REQUIRED' USING ERRCODE='42501';END IF;RETURN NEW;
 END IF;
 SELECT * INTO cmd FROM anvil.commands WHERE project_id=NEW.project_id AND id=NEW.revoke_command_id;data=cmd.result_ref->'data';
 IF OLD.revoked_at IS NOT NULL OR NEW.revoked_at IS NULL OR NEW.exchange_failures<>OLD.exchange_failures OR NEW.revoked_at<OLD.created_at OR NEW.revoked_at>clock_timestamp()
  OR cmd.id::text IS DISTINCT FROM current_setting('anvil.command_id',true) OR cmd.expected_version<>1 OR NOT anvil.source_read_command_authorized(NEW.project_id,'revokeSourceReadObservation')
  OR cmd.result_ref->>'targetId' IS DISTINCT FROM NEW.id::text OR cmd.result_ref->'version' IS DISTINCT FROM '1'::jsonb
  OR data IS DISTINCT FROM jsonb_build_object('ref',ref,'status','GRANT_REVOKED','grantRef',ref,'scopeDigest',NEW.scope_digest,'storedState','REVOKED','executionAuthorized',false,'agentDispatchPerformed',false,'baselineConfirmed',false)
  THEN RAISE EXCEPTION 'SOURCE_READ_REVOCATION_RECEIPT_REQUIRED' USING ERRCODE='42501';END IF;RETURN NEW;
END;
$$;
-- INSERT는 새 row를 현재성 helper가 볼 수 있는 AFTER, mutable 전이는 OLD를 보는 BEFORE다.
CREATE TRIGGER source_read_grant_insert_guard AFTER INSERT ON anvil.source_read_grants FOR EACH ROW EXECUTE FUNCTION anvil.guard_source_read_grant();
CREATE TRIGGER source_read_grant_mutation_guard BEFORE UPDATE OR DELETE ON anvil.source_read_grants FOR EACH ROW EXECUTE FUNCTION anvil.guard_source_read_grant();

CREATE FUNCTION anvil.guard_source_read_challenge() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE g anvil.source_read_grants%ROWTYPE;p jsonb;preflight jsonb;ref jsonb;valid boolean;
BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'SOURCE_READ_CHALLENGE_IMMUTABLE' USING ERRCODE='42501';END IF;
 SELECT * INTO g FROM anvil.source_read_grants WHERE project_id=NEW.project_id AND id=NEW.grant_id;p=NEW.payload_json;
 ref=jsonb_build_object('id',g.id,'version',1,'contentHash',g.scope_digest);
 preflight=jsonb_build_object('protocolVersion',1,'purpose','SOURCE_READ_PREFLIGHT','installationId',g.scope_json->'installationId','projectId',g.project_id,'connectorId',g.connector_id,
  'registrationId',g.registration_id,'connectorGeneration',g.connector_generation,'grantRef',ref,'scopeDigest',g.scope_digest,'publicKeyFingerprint',g.scope_json->'hostFingerprint','clientNonce',p->'clientNonce','expiresAt',g.scope_json->'expiresAt');
 IF g.id IS NULL OR jsonb_typeof(p->'clientNonce') IS DISTINCT FROM 'string' OR jsonb_typeof(p->'serverNonce') IS DISTINCT FROM 'string'
  OR p->>'clientNonce' !~ '^[A-Za-z0-9_-]{42}[AEIMQUYcgkosw048]$' OR p->>'serverNonce' !~ '^[A-Za-z0-9_-]{42}[AEIMQUYcgkosw048]$'
  OR p IS DISTINCT FROM (preflight||jsonb_build_object('purpose','SOURCE_READ_EXCHANGE','serverNonce',p->'serverNonce','issuedAt',anvil.source_read_iso(NEW.created_at),'expiresAt',anvil.source_read_iso(NEW.expires_at)))
  OR NEW.preflight_digest IS DISTINCT FROM anvil.source_read_hash(preflight) OR NEW.created_at<g.created_at OR NEW.expires_at>g.expires_at OR NEW.created_at>clock_timestamp()
  THEN RAISE EXCEPTION 'SOURCE_READ_CHALLENGE_EXACT_BINDING_REQUIRED' USING ERRCODE='42501';END IF;
 IF TG_OP='INSERT' THEN
  valid=NEW.consumed_at IS NULL AND NEW.proof_signature IS NULL AND NEW.failed_attempts=0 AND anvil.source_read_event_current(g.project_id,g.id,'SOURCE_READ_CHALLENGED','APPLIED',ref);
 ELSE
  IF (to_jsonb(NEW)-ARRAY['consumed_at','proof_signature','failed_attempts']) IS DISTINCT FROM (to_jsonb(OLD)-ARRAY['consumed_at','proof_signature','failed_attempts']) THEN RAISE EXCEPTION 'SOURCE_READ_CHALLENGE_IMMUTABLE' USING ERRCODE='42501';END IF;
  valid=OLD.consumed_at IS NULL AND NEW.consumed_at IS NOT NULL AND NEW.consumed_at<NEW.expires_at AND NEW.failed_attempts=OLD.failed_attempts AND NEW.proof_signature IS NOT NULL
   AND EXISTS(SELECT 1 FROM anvil.source_read_credentials c WHERE c.project_id=g.project_id AND c.grant_id=g.id AND c.issued_at=NEW.consumed_at)
   AND anvil.source_read_event_current(g.project_id,g.id,'SOURCE_READ_ISSUED','APPLIED',ref);
 END IF;
 IF NOT COALESCE(valid,false) THEN RAISE EXCEPTION 'SOURCE_READ_CHALLENGE_EVENT_REQUIRED' USING ERRCODE='42501';END IF;RETURN NEW;
END;
$$;
CREATE TRIGGER source_read_challenge_guard BEFORE INSERT OR UPDATE OR DELETE ON anvil.source_read_challenges FOR EACH ROW EXECUTE FUNCTION anvil.guard_source_read_challenge();

CREATE FUNCTION anvil.guard_source_read_credential() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE g anvil.source_read_grants%ROWTYPE;ref jsonb;valid boolean;cmd anvil.commands%ROWTYPE;
BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'SOURCE_READ_CREDENTIAL_IMMUTABLE' USING ERRCODE='42501';END IF;
 SELECT * INTO g FROM anvil.source_read_grants WHERE project_id=NEW.project_id AND id=NEW.grant_id;ref=jsonb_build_object('id',g.id,'version',1,'contentHash',g.scope_digest);
 IF g.id IS NULL OR NEW.connector_id<>g.connector_id OR NEW.connector_generation<>g.connector_generation OR NEW.scope_digest<>g.scope_digest OR NEW.expires_at>g.expires_at OR NEW.issued_at<g.created_at THEN RAISE EXCEPTION 'SOURCE_READ_CREDENTIAL_BINDING_REQUIRED' USING ERRCODE='42501';END IF;
 IF TG_OP='INSERT' THEN
  valid=NEW.revoked_at IS NULL AND NEW.consumed_at IS NULL AND NEW.issued_at<=clock_timestamp() AND NEW.issued_at>=transaction_timestamp()-interval '1 millisecond'
   AND anvil.source_read_event_current(g.project_id,g.id,'SOURCE_READ_ISSUED','APPLIED',ref)
   AND EXISTS(SELECT 1 FROM anvil.source_read_challenges ch WHERE ch.project_id=g.project_id AND ch.grant_id=g.id AND ch.consumed_at IS NULL AND ch.expires_at>clock_timestamp())
   AND EXISTS(SELECT 1 FROM anvil.auth_sessions s WHERE s.id=g.session_id AND s.absolute_expires_at>=NEW.expires_at)
   AND NOT EXISTS(SELECT 1 FROM anvil.connector_credentials c WHERE c.token_digest=NEW.token_digest);
 ELSE
  IF (to_jsonb(NEW)-ARRAY['revoked_at','consumed_at']) IS DISTINCT FROM (to_jsonb(OLD)-ARRAY['revoked_at','consumed_at']) THEN RAISE EXCEPTION 'SOURCE_READ_CREDENTIAL_IMMUTABLE' USING ERRCODE='42501';END IF;
  IF NEW.revoked_at IS NOT DISTINCT FROM OLD.revoked_at THEN
   valid=OLD.consumed_at IS NULL AND NEW.consumed_at IS NOT NULL AND NEW.revoked_at IS NULL AND EXISTS(SELECT 1 FROM anvil.source_snapshots sn
    WHERE sn.project_id=g.project_id AND sn.grant_id=g.id AND sn.received_at=NEW.consumed_at
    AND anvil.source_read_event_current(g.project_id,g.id,'SOURCE_READ_REPORT_STORED','APPLIED',jsonb_build_object('id',sn.id,'version',1,'contentHash',sn.content_hash)));
  ELSE
   SELECT * INTO cmd FROM anvil.commands WHERE project_id=g.project_id AND id=g.revoke_command_id;
   valid=OLD.revoked_at IS NULL AND NEW.revoked_at=g.revoked_at AND NEW.consumed_at IS NOT DISTINCT FROM OLD.consumed_at
    AND cmd.id::text=current_setting('anvil.command_id',true) AND anvil.source_read_command_authorized(g.project_id,'revokeSourceReadObservation')
    AND cmd.result_ref->'data'->'grantRef'=ref AND cmd.result_ref->'data'->>'status'='GRANT_REVOKED';
  END IF;
 END IF;
 IF NOT COALESCE(valid,false) THEN RAISE EXCEPTION 'SOURCE_READ_CREDENTIAL_EVENT_REQUIRED' USING ERRCODE='42501';END IF;RETURN NEW;
END;
$$;
CREATE TRIGGER source_read_credential_guard BEFORE INSERT OR UPDATE OR DELETE ON anvil.source_read_credentials FOR EACH ROW EXECUTE FUNCTION anvil.guard_source_read_credential();

CREATE FUNCTION anvil.source_read_item_state(v jsonb,is_root boolean) RETURNS boolean LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE s text;r text;allowed text[];
BEGIN
 IF NOT COALESCE(anvil.source_read_exact(v,ARRAY['state','facts','reasonCode']),false) OR jsonb_typeof(v->'state') IS DISTINCT FROM 'string' THEN RETURN false;END IF;
 s=v->>'state';r=v->>'reasonCode';
 IF s='OBSERVED' THEN RETURN v->'reasonCode'='null'::jsonb AND jsonb_typeof(v->'facts')='object';END IF;
 IF v->'facts' IS DISTINCT FROM 'null'::jsonb OR jsonb_typeof(v->'reasonCode') IS DISTINCT FROM 'string' THEN RETURN false;END IF;
 allowed=CASE s WHEN 'MISSING' THEN ARRAY['PATH_NOT_FOUND'] WHEN 'DENIED' THEN
  (CASE WHEN is_root THEN ARRAY['ACCESS_DENIED','REPARSE_DENIED','OUTSIDE_ROOT','ROOT_KIND_INVALID'] ELSE ARRAY['ACCESS_DENIED','REPARSE_DENIED','OUTSIDE_ROOT','NOT_REGULAR_FILE'] END)
 WHEN 'CHANGED' THEN ARRAY['IDENTITY_CHANGED'] WHEN 'UNVERIFIED' THEN ARRAY['OBSERVER_UNAVAILABLE','UNSUPPORTED_FILESYSTEM','TIME_LIMIT_REACHED','ROOT_UNAVAILABLE'] ELSE '{}'::text[] END;
 RETURN r=ANY(allowed);
EXCEPTION WHEN OTHERS THEN RETURN false;
END;
$$;
CREATE FUNCTION anvil.source_read_identity(v jsonb) RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
 SELECT jsonb_typeof(v->'volumeSerialHex')='string' AND (v->>'volumeSerialHex')~'^[0-9a-f]{16}$'
  AND jsonb_typeof(v->'fileIdHex')='string' AND (v->>'fileIdHex')~'^[0-9a-f]{32}$' AND v->'reparse'='false'::jsonb;
$$;
CREATE FUNCTION anvil.source_read_uint64(v jsonb) RETURNS boolean LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE n text;
BEGIN
 IF jsonb_typeof(v) IS DISTINCT FROM 'string' THEN RETURN false;END IF;n=v#>>'{}';
 IF n!~'^(0|[1-9][0-9]{0,19})$' THEN RETURN false;END IF;RETURN n::numeric<=18446744073709551615;
EXCEPTION WHEN OTHERS THEN RETURN false;
END;
$$;
CREATE FUNCTION anvil.source_read_report_valid(sn anvil.source_snapshots,g anvil.source_read_grants) RETURNS boolean LANGUAGE plpgsql STABLE AS $$
DECLARE p jsonb;root jsonb;facts jsonb;item jsonb;e jsonb;i integer;expected jsonb;ref jsonb;
BEGIN
 p=sn.report_json;root=p->'root';e=p->'localEvidence';ref=jsonb_build_object('id',g.id,'version',1,'contentHash',g.scope_digest);
 IF NOT COALESCE(anvil.source_read_exact(p,ARRAY['protocolVersion','commandId','grantRef','scopeDigest','connectorRef','hostFingerprint','observedAt','finishedAt','root','files','localEvidence','contentHash','signature']),false)
  OR NOT COALESCE(anvil.source_read_item_state(root,true),false) OR jsonb_typeof(p->'files') IS DISTINCT FROM 'array'
  OR jsonb_array_length(p->'files')<>jsonb_array_length(g.scope_json->'targets') OR octet_length(anvil.source_read_canonical_json(p))>1048576
  OR NOT COALESCE(anvil.source_read_exact(e,ARRAY['kind','observerProtocolVersion','observerImageHash','ownedProcessRef']),false) THEN RETURN false;END IF;
 expected=jsonb_build_object('protocolVersion',1,'commandId',sn.report_command_id,'grantRef',ref,'scopeDigest',g.scope_digest,'connectorRef',g.scope_json->'connectorRef','hostFingerprint',g.scope_json->'hostFingerprint',
  'observedAt',anvil.source_read_iso(sn.observed_at),'finishedAt',anvil.source_read_iso(sn.finished_at),'root',root,'files',p->'files','localEvidence',e,'contentHash',sn.content_hash,'signature',sn.signature);
 IF p<>expected OR sn.content_hash<>anvil.source_read_hash(p-ARRAY['signature','contentHash']) THEN RETURN false;END IF;
 facts=root->'facts';
 IF root->>'state'='OBSERVED' THEN
  IF NOT COALESCE(anvil.source_read_exact(facts,ARRAY['declaredRootRef','kind','canonicalPath','volumeSerialHex','fileIdHex','reparse']),false)
   OR facts->'declaredRootRef' IS DISTINCT FROM g.scope_json->'sourceRootRef' OR facts->>'kind' IS DISTINCT FROM 'DIRECTORY'
   OR NOT COALESCE(anvil.source_read_identity(facts),false) OR jsonb_typeof(facts->'canonicalPath') IS DISTINCT FROM 'string'
   OR length(trim(facts->>'canonicalPath'))=0 OR anvil.source_read_utf16_length(facts->>'canonicalPath')>4096
   OR (facts->>'canonicalPath') COLLATE "C" ~ '[[:cntrl:]]' THEN RETURN false;END IF;
 END IF;
 FOR i IN 0..jsonb_array_length(p->'files')-1 LOOP
  item=p->'files'->i;
  IF NOT COALESCE(anvil.source_read_exact(item,ARRAY['relativePath','state','facts','reasonCode']),false)
   OR item->'relativePath' IS DISTINCT FROM g.scope_json->'targets'->i->'relativePath'
   OR NOT COALESCE(anvil.source_read_item_state(item-ARRAY['relativePath'],false),false) THEN RETURN false;END IF;
  IF root->>'state'<>'OBSERVED' AND (item->>'state' IS DISTINCT FROM 'UNVERIFIED' OR item->>'reasonCode' IS DISTINCT FROM 'ROOT_UNAVAILABLE') THEN RETURN false;END IF;
  IF item->>'state'='OBSERVED' THEN
   facts=item->'facts';
   IF NOT COALESCE(anvil.source_read_exact(facts,ARRAY['kind','volumeSerialHex','fileIdHex','sizeBytesDecimal','lastWriteFileTimeDecimal','reparse']),false)
    OR facts->>'kind' IS DISTINCT FROM 'REGULAR_FILE' OR NOT COALESCE(anvil.source_read_identity(facts),false)
    OR facts->'volumeSerialHex' IS DISTINCT FROM root->'facts'->'volumeSerialHex'
    OR NOT anvil.source_read_uint64(facts->'sizeBytesDecimal') OR NOT anvil.source_read_uint64(facts->'lastWriteFileTimeDecimal') THEN RETURN false;END IF;
  END IF;
 END LOOP;
 IF jsonb_typeof(e->'kind') IS DISTINCT FROM 'string' OR e->>'kind' NOT IN('NATIVE_METADATA_REPORT','OBSERVER_UNAVAILABLE') OR e->'observerProtocolVersion' IS DISTINCT FROM '1'::jsonb
  OR NOT (e->'observerImageHash'='null'::jsonb OR jsonb_typeof(e->'observerImageHash')='string' AND e->>'observerImageHash'~'^[0-9a-f]{64}$')
  OR NOT (e->'ownedProcessRef'='null'::jsonb OR anvil.source_read_ref(e->'ownedProcessRef'))
  OR e->>'kind'='OBSERVER_UNAVAILABLE' AND (e->'observerImageHash' IS DISTINCT FROM 'null'::jsonb OR e->'ownedProcessRef' IS DISTINCT FROM 'null'::jsonb OR root->>'state' IS DISTINCT FROM 'UNVERIFIED' OR root->>'reasonCode' IS DISTINCT FROM 'OBSERVER_UNAVAILABLE') THEN RETURN false;END IF;
 RETURN sn.version=1 AND sn.source_root_id=g.source_root_id AND sn.source_root_version=g.source_root_version AND sn.connector_id=g.connector_id AND sn.generation=g.connector_generation AND sn.scope_digest=g.scope_digest;
EXCEPTION WHEN OTHERS THEN RETURN false;
END;
$$;
CREATE FUNCTION anvil.guard_source_snapshot() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE g anvil.source_read_grants%ROWTYPE;c anvil.source_read_credentials%ROWTYPE;ref jsonb;
BEGIN
 IF TG_OP<>'INSERT' THEN RAISE EXCEPTION 'SOURCE_SNAPSHOT_IMMUTABLE' USING ERRCODE='42501';END IF;
 SELECT * INTO g FROM anvil.source_read_grants WHERE project_id=NEW.project_id AND id=NEW.grant_id;
 SELECT * INTO c FROM anvil.source_read_credentials WHERE project_id=NEW.project_id AND grant_id=NEW.grant_id;
 ref=jsonb_build_object('id',NEW.id,'version',1,'contentHash',NEW.content_hash);
 IF g.id IS NULL OR c.id IS NULL OR c.revoked_at IS NOT NULL OR c.consumed_at IS NOT NULL OR NOT anvil.source_read_report_valid(NEW,g)
  OR NOT anvil.source_read_event_current(g.project_id,g.id,'SOURCE_READ_REPORT_STORED','APPLIED',ref)
  OR c.connector_id<>g.connector_id OR c.connector_generation<>g.connector_generation OR c.scope<>'SOURCE_OBSERVE_READ_ONLY' OR c.scope_digest<>g.scope_digest
  OR NEW.received_at<c.issued_at OR NEW.received_at>=c.expires_at OR NEW.received_at>=g.expires_at
  OR NEW.observed_at<c.issued_at-interval '30 seconds' OR NEW.received_at<transaction_timestamp()-interval '1 millisecond' OR NEW.received_at>clock_timestamp()
  THEN RAISE EXCEPTION 'SOURCE_SNAPSHOT_EXACT_REPORT_REQUIRED' USING ERRCODE='42501';END IF;RETURN NEW;
END;
$$;
CREATE TRIGGER source_snapshot_guard BEFORE INSERT OR UPDATE OR DELETE ON anvil.source_snapshots FOR EACH ROW EXECUTE FUNCTION anvil.guard_source_snapshot();
CREATE FUNCTION anvil.check_source_snapshot_consumption() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM anvil.source_read_credentials c WHERE c.project_id=NEW.project_id AND c.grant_id=NEW.grant_id AND c.consumed_at=NEW.received_at)
 THEN RAISE EXCEPTION 'SOURCE_SNAPSHOT_ATOMIC_CONSUMPTION_REQUIRED' USING ERRCODE='42501';END IF;RETURN NEW;
END;
$$;
CREATE CONSTRAINT TRIGGER source_snapshot_consumption AFTER INSERT ON anvil.source_snapshots DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION anvil.check_source_snapshot_consumption();

GRANT SELECT,INSERT ON anvil.source_read_grants,anvil.source_read_challenges,anvil.source_read_credentials,anvil.source_snapshots TO anvil_v3_app;
GRANT UPDATE(revoked_at,revoke_command_id,exchange_failures) ON anvil.source_read_grants TO anvil_v3_app;
GRANT UPDATE(consumed_at,proof_signature,failed_attempts) ON anvil.source_read_challenges TO anvil_v3_app;
GRANT UPDATE(revoked_at,consumed_at) ON anvil.source_read_credentials TO anvil_v3_app;
REVOKE DELETE ON anvil.source_read_grants,anvil.source_read_challenges,anvil.source_read_credentials FROM anvil_v3_app;
REVOKE UPDATE,DELETE ON anvil.source_snapshots FROM anvil_v3_app;
-- P-256는 Node의 현재 등록 key 검증 책임이다. SQL setting/audit 검사는 독립 암호검증이 아니다.
