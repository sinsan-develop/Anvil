-- 요청·초기 기계 영향만 보관한다. 현재 설계/계획 기준·실행·사용자 정책은 변경하지 않는다.
CREATE TABLE anvil.design_changes(
 id uuid PRIMARY KEY,project_id uuid NOT NULL,version bigint NOT NULL CHECK(version=1),before_id uuid NOT NULL,before_version bigint NOT NULL,before_hash text NOT NULL,proposal_id uuid NOT NULL,
 content_hash text NOT NULL CHECK(content_hash ~ '^[0-9a-f]{64}$'),change_json jsonb NOT NULL CHECK(jsonb_typeof(change_json)='object'),
 created_by uuid NOT NULL,client_id uuid NOT NULL,command_id uuid NOT NULL UNIQUE REFERENCES anvil.commands(id),created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(project_id,id),UNIQUE(project_id,id,content_hash),UNIQUE(project_id,proposal_id),
 FOREIGN KEY(project_id,before_id,before_version,before_hash) REFERENCES anvil.document_versions(project_id,document_id,version,content_hash),
 FOREIGN KEY(project_id,proposal_id) REFERENCES anvil.document_proposals(project_id,id),FOREIGN KEY(created_by,client_id) REFERENCES anvil.clients(user_id,id)
);
CREATE TABLE anvil.design_change_impacts(
 id uuid NOT NULL,project_id uuid NOT NULL,version bigint NOT NULL CHECK(version=1),change_id uuid NOT NULL,change_hash text NOT NULL,
 source_kind text NOT NULL CHECK(source_kind='MECHANICAL_TRACE'),content_hash text NOT NULL CHECK(content_hash ~ '^[0-9a-f]{64}$'),impact_json jsonb NOT NULL CHECK(jsonb_typeof(impact_json)='object'),
 created_by uuid NOT NULL,client_id uuid NOT NULL,command_id uuid NOT NULL UNIQUE REFERENCES anvil.commands(id),created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(project_id,id,version),UNIQUE(project_id,change_id,version),
 FOREIGN KEY(project_id,change_id,change_hash) REFERENCES anvil.design_changes(project_id,id,content_hash),FOREIGN KEY(created_by,client_id) REFERENCES anvil.clients(user_id,id)
);
REVOKE ALL ON anvil.design_changes,anvil.design_change_impacts FROM anvil_v3_app;
GRANT SELECT,INSERT ON anvil.design_changes,anvil.design_change_impacts TO anvil_v3_app;
CREATE FUNCTION anvil.design_change_command_authorized(pid uuid) RETURNS boolean LANGUAGE sql STABLE AS $$
 SELECT EXISTS(SELECT 1 FROM anvil.commands c
 JOIN anvil.authorization_receipts r ON r.id=c.authorization_receipt_id AND r.command_id=c.id AND r.policy_ref=c.policy_ref
 JOIN anvil.project_control pc ON pc.project_id=c.project_id AND pc.actor_id=c.actor_id AND pc.client_id=c.client_id AND pc.generation=c.control_generation AND pc.revoked_at IS NULL
 JOIN anvil.project_members m ON m.project_id=c.project_id AND m.user_id=c.actor_id AND m.participation='OWNER' AND m.revoked_at IS NULL
 JOIN anvil.permission_policies p ON p.project_id=c.project_id AND p.id::text=c.policy_ref->>'id' AND p.head_version=(c.policy_ref->>'version')::bigint
 WHERE c.id::text=current_setting('anvil.command_id',true) AND c.project_id=pid
 AND c.actor_id::text=current_setting('anvil.actor_id',true) AND c.client_id::text=current_setting('anvil.client_id',true)
 AND c.operation='proposeDesignChange' AND c.expected_version=0 AND c.state='APPLIED' AND c.result_ref->'data'->>'status'='DESIGN_CHANGE_PROPOSED' AND c.result_ref->'data'->>'activatedAsBaseline'='false');
$$;
CREATE FUNCTION anvil.guard_design_change_proposal() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE result jsonb;ref jsonb;snapshot jsonb;
BEGIN
 IF current_user<>'anvil_v3_app' THEN RETURN NEW;END IF;
 IF NOT anvil.design_change_command_authorized(NEW.project_id) OR NEW.command_id::text IS DISTINCT FROM current_setting('anvil.command_id',true) OR NEW.created_by::text IS DISTINCT FROM current_setting('anvil.actor_id',true) OR NEW.client_id::text IS DISTINCT FROM current_setting('anvil.client_id',true) THEN RAISE EXCEPTION 'DESIGN_CHANGE_CURRENT_AUTHORIZATION_REQUIRED' USING ERRCODE='42501';END IF;
 SELECT c.result_ref->'data' INTO result FROM anvil.commands c WHERE c.id=NEW.command_id;ref=result->'ref';snapshot=result->'change';
 IF result IS NULL OR ref IS NULL OR snapshot IS NULL OR NEW.version<>1 OR NEW.change_json IS DISTINCT FROM snapshot OR ref IS DISTINCT FROM jsonb_build_object('id',NEW.id,'version',1,'contentHash',NEW.content_hash)
 OR snapshot->'ref' IS DISTINCT FROM ref OR snapshot->>'status' IS DISTINCT FROM 'PROPOSED' OR snapshot->'beforeRef' IS DISTINCT FROM jsonb_build_object('id',NEW.before_id,'version',NEW.before_version,'contentHash',NEW.before_hash)
 OR snapshot->>'afterProposalRef' IS DISTINCT FROM NEW.proposal_id::text OR snapshot->'sourceRefs' IS DISTINCT FROM '[]'::jsonb OR snapshot->'requestedBy' IS DISTINCT FROM jsonb_build_object('kind','HUMAN','userId',NEW.created_by)
 OR NOT EXISTS(SELECT 1 FROM anvil.documents d JOIN anvil.document_versions v ON v.project_id=d.project_id AND v.document_id=d.id AND v.version=d.head_version JOIN anvil.form_versions f ON f.definition_id=v.form_definition_id AND f.version=v.form_version AND f.content_hash=v.form_hash
 JOIN anvil.document_proposals p ON p.project_id=d.project_id AND p.document_id=d.id AND p.base_version=v.version AND p.base_hash=v.content_hash AND p.id=NEW.proposal_id
 WHERE d.project_id=NEW.project_id AND d.id=NEW.before_id AND d.head_version=NEW.before_version AND d.confirmed_version=d.head_version AND v.content_hash=NEW.before_hash AND f.definition_json->>'formCode'='AF02'
 AND NOT EXISTS(SELECT 1 FROM anvil.document_proposal_selections s WHERE s.project_id=d.project_id AND s.proposal_id=p.id)
 AND (SELECT r.outcome FROM anvil.content_reviews r JOIN anvil.audit_events a ON a.project_id=r.project_id AND a.command_id=r.command_id WHERE r.project_id=d.project_id AND r.scope_kind='PROJECT' AND r.target_kind='DOCUMENT' AND r.target_id=d.id AND r.target_version=d.head_version AND r.target_hash=v.content_hash AND r.criteria_version=1 AND r.source_kind='HUMAN_REVIEW' ORDER BY a.server_sequence DESC LIMIT 1)='ACCEPTED')
 THEN RAISE EXCEPTION 'DESIGN_CHANGE_EXACT_BASE_PROPOSAL_REQUIRED' USING ERRCODE='42501';END IF;
 RETURN NEW;
END;
$$;
CREATE TRIGGER design_change_proposal_guard BEFORE INSERT ON anvil.design_changes FOR EACH ROW EXECUTE FUNCTION anvil.guard_design_change_proposal();
CREATE FUNCTION anvil.guard_design_change_initial_impact() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE result jsonb;snapshot jsonb;
BEGIN
 IF current_user<>'anvil_v3_app' THEN RETURN NEW;END IF;
 IF NOT anvil.design_change_command_authorized(NEW.project_id) OR NEW.command_id::text IS DISTINCT FROM current_setting('anvil.command_id',true) OR NEW.created_by::text IS DISTINCT FROM current_setting('anvil.actor_id',true) OR NEW.client_id::text IS DISTINCT FROM current_setting('anvil.client_id',true) THEN RAISE EXCEPTION 'DESIGN_IMPACT_CURRENT_AUTHORIZATION_REQUIRED' USING ERRCODE='42501';END IF;
 SELECT c.result_ref->'data' INTO result FROM anvil.commands c WHERE c.id=NEW.command_id;snapshot=result->'impact';
 IF result IS NULL OR snapshot IS NULL OR NEW.version<>1 OR NEW.source_kind<>'MECHANICAL_TRACE' OR NEW.impact_json IS DISTINCT FROM snapshot
 OR snapshot->'ref' IS DISTINCT FROM jsonb_build_object('id',NEW.id,'version',1,'contentHash',NEW.content_hash)
 OR snapshot->'changeRef' IS DISTINCT FROM result->'ref' OR snapshot->>'sourceKind' IS DISTINCT FROM 'MECHANICAL_TRACE' OR snapshot->>'requiresReview' IS DISTINCT FROM 'true'
 OR snapshot->'beforeRef' IS DISTINCT FROM result->'change'->'beforeRef' OR jsonb_typeof(snapshot->'items') IS DISTINCT FROM 'array' OR jsonb_array_length(snapshot->'items')>2000
 OR jsonb_typeof(snapshot->'coverageGaps') IS DISTINCT FROM 'array' OR NOT(snapshot->'coverageGaps' @> '[{"code":"EXECUTION_SOURCE_NOT_CONNECTED"},{"code":"TEST_EVIDENCE_SOURCE_NOT_CONNECTED"}]'::jsonb)
 OR EXISTS(SELECT 1 FROM jsonb_array_elements(snapshot->'items') item WHERE item->>'state' NOT IN('AFFECTED','UNKNOWN') OR item->>'state' IS NULL OR item->'evidenceRefs' IS DISTINCT FROM '[]'::jsonb)
 OR NOT EXISTS(SELECT 1 FROM anvil.design_changes d WHERE d.project_id=NEW.project_id AND d.id=NEW.change_id AND d.content_hash=NEW.change_hash AND d.command_id=NEW.command_id AND result->'ref'=jsonb_build_object('id',d.id,'version',d.version,'contentHash',d.content_hash))
 THEN RAISE EXCEPTION 'DESIGN_IMPACT_EXACT_MECHANICAL_RECEIPT_REQUIRED' USING ERRCODE='42501';END IF;
 RETURN NEW;
END;
$$;
CREATE TRIGGER design_change_initial_impact_guard BEFORE INSERT ON anvil.design_change_impacts FOR EACH ROW EXECUTE FUNCTION anvil.guard_design_change_initial_impact();
