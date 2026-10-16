-- 기존 초기 요청/기계 영향/확정 원문은 보존하고 사람 검토를 새 불변 버전으로만 추가한다.
ALTER TABLE anvil.design_change_impacts DROP CONSTRAINT design_change_impacts_version_check;
ALTER TABLE anvil.design_change_impacts DROP CONSTRAINT design_change_impacts_source_kind_check;
ALTER TABLE anvil.design_change_impacts ADD CONSTRAINT design_impact_version_positive CHECK(version>0);
ALTER TABLE anvil.design_change_impacts ADD CONSTRAINT design_impact_source_supported CHECK(source_kind IN('MECHANICAL_TRACE','HUMAN_REVIEW'));
ALTER TABLE anvil.design_change_impacts ADD COLUMN base_version bigint;
ALTER TABLE anvil.design_change_impacts ADD COLUMN base_hash text;
ALTER TABLE anvil.design_change_impacts ADD CONSTRAINT design_impact_parent_shape CHECK(
 (source_kind='MECHANICAL_TRACE' AND version=1 AND base_version IS NULL AND base_hash IS NULL)
 OR (source_kind='HUMAN_REVIEW' AND version>1 AND base_version IS NOT NULL AND base_version=version-1 AND base_hash IS NOT NULL AND base_hash ~ '^[0-9a-f]{64}$'));
ALTER TABLE anvil.design_change_impacts ADD CONSTRAINT design_impact_exact_ref UNIQUE(project_id,id,version,content_hash);
ALTER TABLE anvil.design_change_impacts ADD CONSTRAINT design_impact_parent_ref FOREIGN KEY(project_id,id,base_version,base_hash) REFERENCES anvil.design_change_impacts(project_id,id,version,content_hash) DEFERRABLE INITIALLY DEFERRED;
DROP TRIGGER design_change_initial_impact_guard ON anvil.design_change_impacts;
CREATE TRIGGER design_change_initial_impact_guard BEFORE INSERT ON anvil.design_change_impacts FOR EACH ROW WHEN(NEW.source_kind='MECHANICAL_TRACE') EXECUTE FUNCTION anvil.guard_design_change_initial_impact();
CREATE FUNCTION anvil.guard_human_design_impact_review() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE cmd anvil.commands%ROWTYPE;prior anvil.design_change_impacts%ROWTYPE;snapshot jsonb;
BEGIN
 IF current_user<>'anvil_v3_app' THEN RETURN NEW;END IF;
 SELECT c.* INTO cmd FROM anvil.commands c
 JOIN anvil.authorization_receipts r ON r.id=c.authorization_receipt_id AND r.command_id=c.id AND r.policy_ref=c.policy_ref
 JOIN anvil.project_control pc ON pc.project_id=c.project_id AND pc.actor_id=c.actor_id AND pc.client_id=c.client_id AND pc.generation=c.control_generation AND pc.revoked_at IS NULL
 JOIN anvil.project_members m ON m.project_id=c.project_id AND m.user_id=c.actor_id AND m.participation='OWNER' AND m.revoked_at IS NULL
 JOIN anvil.permission_policies p ON p.project_id=c.project_id AND p.id::text=c.policy_ref->>'id' AND p.head_version=(c.policy_ref->>'version')::bigint
 WHERE c.id=NEW.command_id AND c.project_id=NEW.project_id AND c.id::text=current_setting('anvil.command_id',true)
 AND c.actor_id=NEW.created_by AND c.actor_id::text=current_setting('anvil.actor_id',true) AND c.client_id=NEW.client_id AND c.client_id::text=current_setting('anvil.client_id',true)
 AND c.operation='reviewChangeImpact' AND c.state='APPLIED' AND c.expected_version=NEW.version-1
 AND c.result_ref->'data'->>'status'='DESIGN_IMPACT_REVIEWED' AND c.result_ref->'data'->>'activatedAsBaseline'='false';
 SELECT * INTO prior FROM anvil.design_change_impacts WHERE project_id=NEW.project_id AND id=NEW.id AND version=NEW.base_version AND content_hash=NEW.base_hash AND change_id=NEW.change_id AND change_hash=NEW.change_hash;
 snapshot=cmd.result_ref->'data'->'impact';
 IF cmd.id IS NULL OR prior.id IS NULL OR snapshot IS NULL OR NEW.source_kind<>'HUMAN_REVIEW' OR NEW.version<>NEW.base_version+1
 OR NEW.base_version<>(SELECT MAX(version) FROM anvil.design_change_impacts WHERE project_id=NEW.project_id AND change_id=NEW.change_id)
 OR NEW.impact_json IS DISTINCT FROM snapshot OR cmd.result_ref->'data'->'ref' IS DISTINCT FROM jsonb_build_object('id',NEW.id,'version',NEW.version,'contentHash',NEW.content_hash)
 OR snapshot->'ref' IS DISTINCT FROM cmd.result_ref->'data'->'ref' OR snapshot->'changeRef' IS DISTINCT FROM prior.impact_json->'changeRef'
 OR snapshot->'baseImpactRef' IS DISTINCT FROM jsonb_build_object('id',prior.id,'version',prior.version,'contentHash',prior.content_hash)
 OR snapshot->'beforeRef' IS DISTINCT FROM prior.impact_json->'beforeRef' OR snapshot->'inputs' IS DISTINCT FROM prior.impact_json->'inputs'
 OR snapshot->>'sourceKind' IS DISTINCT FROM 'HUMAN_REVIEW' OR snapshot->'reviewer' IS DISTINCT FROM jsonb_build_object('kind','HUMAN','userId',NEW.created_by)
 OR snapshot->>'requiresReview' IS DISTINCT FROM 'true' OR length(trim(COALESCE(snapshot->>'reason','')))=0
 OR jsonb_typeof(snapshot->'items') IS DISTINCT FROM 'array' OR jsonb_array_length(snapshot->'items')<>jsonb_array_length(prior.impact_json->'items') OR jsonb_array_length(snapshot->'items')>2000
 OR jsonb_typeof(snapshot->'coverageGaps') IS DISTINCT FROM 'array' OR NOT(snapshot->'coverageGaps' @> prior.impact_json->'coverageGaps')
 THEN RAISE EXCEPTION 'HUMAN_IMPACT_CURRENT_EXACT_AUTHORIZATION_REQUIRED' USING ERRCODE='42501';END IF;
 IF (SELECT count(DISTINCT item->'targetRef') FROM jsonb_array_elements(snapshot->'items') item)<>jsonb_array_length(snapshot->'items')
 OR EXISTS(SELECT 1 FROM jsonb_array_elements(prior.impact_json->'items') old_item WHERE NOT EXISTS(SELECT 1 FROM jsonb_array_elements(snapshot->'items') item WHERE item->'targetRef'=old_item->'targetRef'))
 OR EXISTS(SELECT 1 FROM jsonb_array_elements(snapshot->'items') item WHERE item->>'state' IS NULL OR item->>'state' NOT IN('AFFECTED','UNAFFECTED','UNKNOWN') OR length(trim(COALESCE(item->>'reason','')))=0 OR jsonb_typeof(item->'evidenceRefs') IS DISTINCT FROM 'array'
 OR (item->>'state'='UNAFFECTED' AND jsonb_array_length(item->'evidenceRefs')=0))
 THEN RAISE EXCEPTION 'HUMAN_IMPACT_TARGETS_EVIDENCE_REQUIRED' USING ERRCODE='42501';END IF;
 IF EXISTS(SELECT 1 FROM jsonb_array_elements(snapshot->'items') item CROSS JOIN LATERAL jsonb_array_elements(item->'evidenceRefs') evidence WHERE NOT EXISTS(
 SELECT 1 FROM anvil.document_versions v WHERE v.project_id=NEW.project_id AND v.document_id::text=evidence->>'id' AND v.version=(evidence->'versionRef'->>'version')::bigint AND v.content_hash=evidence->'versionRef'->>'contentHash'
 AND evidence=jsonb_build_object('kind','DOCUMENT_VERSION','id',v.document_id,'versionRef',jsonb_build_object('id',v.document_id,'version',v.version,'contentHash',v.content_hash))))
 THEN RAISE EXCEPTION 'HUMAN_IMPACT_SAME_PROJECT_DOCUMENT_EVIDENCE_REQUIRED' USING ERRCODE='42501';END IF;
 RETURN NEW;
END;
$$;
CREATE TRIGGER human_design_impact_review_guard BEFORE INSERT ON anvil.design_change_impacts FOR EACH ROW WHEN(NEW.source_kind='HUMAN_REVIEW') EXECUTE FUNCTION anvil.guard_human_design_impact_review();
-- app의 UPDATE/DELETE 권한은 추가하지 않는다. 버전 추가는 현재 명령·별도 정책·원문 근거와 결박된다.
