CREATE TABLE anvil.design_items (
  id uuid PRIMARY KEY, project_id uuid NOT NULL, design_document_id uuid NOT NULL, document_version bigint NOT NULL, document_hash text NOT NULL,
  local_code text NOT NULL, title text NOT NULL, anchor text NOT NULL, item_hash text NOT NULL CHECK(item_hash ~ '^[0-9a-f]{64}$'), item_json jsonb NOT NULL,
  created_by uuid NOT NULL REFERENCES anvil.users(id) ON DELETE RESTRICT, client_id uuid NOT NULL,
  command_id uuid NOT NULL REFERENCES anvil.commands(id) ON DELETE RESTRICT, created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(project_id,id), UNIQUE(project_id,design_document_id,document_version,local_code),
  FOREIGN KEY(project_id,design_document_id,document_version,document_hash) REFERENCES anvil.document_versions(project_id,document_id,version,content_hash) ON DELETE RESTRICT,
  FOREIGN KEY(created_by,client_id) REFERENCES anvil.clients(user_id,id) ON DELETE RESTRICT,
  CHECK(local_code ~ '^[A-Za-z][A-Za-z0-9_-]{0,63}$'), CHECK(length(trim(title))>0 AND length(title)<=200), CHECK(anchor ~ '^line:[1-9][0-9]{0,7}$')
);
CREATE TABLE anvil.screen_regions (
  id uuid PRIMARY KEY, project_id uuid NOT NULL, design_item_id uuid NOT NULL, screen_code text NOT NULL,
  source_document_id uuid NOT NULL, source_version bigint NOT NULL, source_hash text NOT NULL, artifact_id uuid NOT NULL,
  anchor text NOT NULL, region_hash text NOT NULL CHECK(region_hash ~ '^[0-9a-f]{64}$'), region_json jsonb NOT NULL,
  created_by uuid NOT NULL REFERENCES anvil.users(id) ON DELETE RESTRICT, client_id uuid NOT NULL,
  command_id uuid NOT NULL REFERENCES anvil.commands(id) ON DELETE RESTRICT, created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(project_id,id), UNIQUE(project_id,design_item_id,screen_code,anchor),
  FOREIGN KEY(project_id,design_item_id) REFERENCES anvil.design_items(project_id,id) ON DELETE RESTRICT,
  FOREIGN KEY(project_id,source_document_id,source_version,source_hash) REFERENCES anvil.document_versions(project_id,document_id,version,content_hash) ON DELETE RESTRICT,
  FOREIGN KEY(project_id,artifact_id) REFERENCES anvil.artifacts(project_id,id) ON DELETE RESTRICT,
  FOREIGN KEY(created_by,client_id) REFERENCES anvil.clients(user_id,id) ON DELETE RESTRICT,
  CHECK(screen_code ~ '^[A-Za-z][A-Za-z0-9_-]{0,63}$'), CHECK(anchor ~ '^line:[1-9][0-9]{0,7}$')
);
CREATE FUNCTION anvil.guard_design_index_write() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE d anvil.design_items%ROWTYPE;
BEGIN
  IF current_user<>'anvil_v3_app' THEN RETURN NEW; END IF;
  IF NEW.created_by::text IS DISTINCT FROM current_setting('anvil.actor_id',true)
    OR NEW.client_id::text IS DISTINCT FROM current_setting('anvil.client_id',true)
    OR NEW.command_id::text IS DISTINCT FROM current_setting('anvil.command_id',true) THEN
    RAISE EXCEPTION 'DESIGN_INDEX_CURRENT_COMMAND_REQUIRED' USING ERRCODE='42501';
  END IF;
  IF TG_TABLE_NAME='design_items' THEN
    IF NOT anvil.document_command_authorized(NEW.project_id,NEW.design_document_id,NEW.document_version,'indexDesignDocument')
      OR NEW.item_json IS DISTINCT FROM jsonb_build_object('id',NEW.id,'documentRef',jsonb_build_object('id',NEW.design_document_id,'version',NEW.document_version,'contentHash',NEW.document_hash),'localCode',NEW.local_code,'title',NEW.title,'anchor',NEW.anchor,'itemHash',NEW.item_hash)
      OR NOT EXISTS(SELECT 1 FROM anvil.commands c JOIN anvil.documents h ON h.project_id=NEW.project_id AND h.id=NEW.design_document_id
        JOIN anvil.document_versions v ON v.project_id=h.project_id AND v.document_id=h.id AND v.version=NEW.document_version
        JOIN anvil.form_versions f ON f.definition_id=v.form_definition_id AND f.version=v.form_version AND f.content_hash=v.form_hash
        WHERE c.id=NEW.command_id AND h.head_version=NEW.document_version AND f.definition_json->>'formCode'='AF02'
          AND c.result_ref->'data'->>'status'='DESIGN_INDEXED' AND c.result_ref->'data'->'designItems' @> jsonb_build_array(NEW.item_json)) THEN
      RAISE EXCEPTION 'DESIGN_INDEX_EXACT_SOURCE_RECEIPT_REQUIRED' USING ERRCODE='42501';
    END IF;
  ELSE
    SELECT * INTO d FROM anvil.design_items WHERE project_id=NEW.project_id AND id=NEW.design_item_id;
    IF d.id IS NULL OR d.command_id IS DISTINCT FROM NEW.command_id
      OR NOT anvil.document_command_authorized(NEW.project_id,d.design_document_id,d.document_version,'indexDesignDocument')
      OR NOT EXISTS(SELECT 1 FROM anvil.commands c JOIN anvil.document_versions v ON v.project_id=NEW.project_id AND v.document_id=NEW.source_document_id AND v.version=NEW.source_version AND v.content_hash=NEW.source_hash AND v.body_artifact_id=NEW.artifact_id
        JOIN anvil.form_versions f ON f.definition_id=v.form_definition_id AND f.version=v.form_version AND f.content_hash=v.form_hash
        JOIN anvil.artifacts a ON a.project_id=v.project_id AND a.id=v.body_artifact_id AND a.state='READY'
        WHERE c.id=NEW.command_id AND f.definition_json->>'formCode'='AF03' AND c.result_ref->'data'->>'status'='DESIGN_INDEXED'
          AND NEW.region_json=jsonb_build_object('id',NEW.id,'designItemId',NEW.design_item_id,'screenCode',NEW.screen_code,'documentRef',jsonb_build_object('id',NEW.source_document_id,'version',NEW.source_version,'contentHash',NEW.source_hash),'artifactRef',jsonb_build_object('artifactId',a.id,'bytes',a.bytes,'contentHash',a.content_hash,'mediaType',a.media_type),'anchor',NEW.anchor,'regionHash',NEW.region_hash)
          AND c.result_ref->'data'->'screenRegions' @> jsonb_build_array(NEW.region_json)) THEN
      RAISE EXCEPTION 'SCREEN_REGION_EXACT_SOURCE_RECEIPT_REQUIRED' USING ERRCODE='42501';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER design_item_guard BEFORE INSERT ON anvil.design_items FOR EACH ROW EXECUTE FUNCTION anvil.guard_design_index_write();
CREATE TRIGGER screen_region_guard BEFORE INSERT ON anvil.screen_regions FOR EACH ROW EXECUTE FUNCTION anvil.guard_design_index_write();
REVOKE ALL ON anvil.design_items,anvil.screen_regions FROM anvil_v3_app;
GRANT SELECT,INSERT ON anvil.design_items,anvil.screen_regions TO anvil_v3_app;
