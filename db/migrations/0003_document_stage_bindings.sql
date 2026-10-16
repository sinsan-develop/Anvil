-- FN03 직접 승인: 원본/과거 확정 이력은 보존하고 새 문서 버전의 고정 단계 참조만 보호한다.
ALTER TABLE anvil.document_versions ADD CONSTRAINT document_stage_ref_shape CHECK(stage_ref_json IS NULL OR
 (jsonb_typeof(stage_ref_json)='object' AND stage_ref_json ?& ARRAY['applicationId','nodeId'] AND (stage_ref_json-'applicationId'-'nodeId')='{}'::jsonb
 AND jsonb_typeof(stage_ref_json->'applicationId')='string' AND jsonb_typeof(stage_ref_json->'nodeId')='string'
 AND stage_ref_json->>'applicationId' ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
 AND length(trim(stage_ref_json->>'nodeId')) BETWEEN 1 AND 200));
ALTER TABLE anvil.document_versions ADD COLUMN stage_application_id uuid GENERATED ALWAYS AS((stage_ref_json->>'applicationId')::uuid) STORED;
ALTER TABLE anvil.document_versions ADD CONSTRAINT document_stage_application_fk FOREIGN KEY(project_id,stage_application_id) REFERENCES anvil.project_methodologies(project_id,id) ON DELETE RESTRICT;
CREATE FUNCTION anvil.guard_document_stage_binding() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE app anvil.project_methodologies%ROWTYPE;cmd anvil.commands%ROWTYPE;form_ref jsonb;node jsonb;
BEGIN
 IF current_user<>'anvil_v3_app' OR NEW.stage_ref_json IS NULL THEN RETURN NEW;END IF;
 SELECT * INTO cmd FROM anvil.commands WHERE id=NEW.command_id AND id::text=current_setting('anvil.command_id',true);
 IF cmd.project_id IS DISTINCT FROM NEW.project_id OR cmd.operation IS DISTINCT FROM 'saveDocumentDraft' OR cmd.state IS DISTINCT FROM 'APPLIED' OR cmd.expected_version<>NEW.version-1
 OR cmd.result_ref->'data'->'stageNodeRef' IS DISTINCT FROM NEW.stage_ref_json OR cmd.result_ref->'data'->'ref' IS DISTINCT FROM jsonb_build_object('id',NEW.document_id,'version',NEW.version,'contentHash',NEW.content_hash) THEN RAISE EXCEPTION 'DOCUMENT_STAGE_COMMAND_REQUIRED' USING ERRCODE='42501';END IF;
 SELECT * INTO app FROM anvil.project_methodologies WHERE project_id=NEW.project_id AND id=(NEW.stage_ref_json->>'applicationId')::uuid;
 IF app.id IS NULL OR app.application_version IS DISTINCT FROM (SELECT max(application_version) FROM anvil.project_methodologies WHERE project_id=NEW.project_id) THEN RAISE EXCEPTION 'DOCUMENT_CURRENT_APPLICATION_REQUIRED' USING ERRCODE='42501';END IF;
 SELECT item INTO node FROM jsonb_array_elements(app.snapshot_json->'graph'->'nodes') item WHERE item->>'nodeId'=NEW.stage_ref_json->>'nodeId';
 form_ref=jsonb_build_object('id',NEW.form_definition_id,'version',NEW.form_version,'contentHash',NEW.form_hash);
 IF node IS NULL OR NOT EXISTS(SELECT 1 FROM jsonb_array_elements((node->'inputs')||(node->'outputs')) item WHERE item->'formRef'=form_ref)
 OR cmd.result_ref->'data'->'stageBinding'->'applicationRef' IS DISTINCT FROM jsonb_build_object('id',app.id,'version',app.application_version,'contentHash',app.snapshot_hash)
 OR cmd.result_ref->'data'->'stageBinding'->>'nodeId' IS DISTINCT FROM node->>'nodeId' THEN RAISE EXCEPTION 'DOCUMENT_STAGE_FORM_REQUIRED' USING ERRCODE='42501';END IF;
 RETURN NEW;
END;
$$;
CREATE TRIGGER document_stage_binding_guard BEFORE INSERT ON anvil.document_versions FOR EACH ROW EXECUTE FUNCTION anvil.guard_document_stage_binding();
-- 기존 document_version_guard·원문/검토/확정 보호·UPDATE/DELETE 회수는 그대로 유지한다.
