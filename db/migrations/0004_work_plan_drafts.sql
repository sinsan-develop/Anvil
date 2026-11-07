-- 기존 적용 SQL/원문/확정본은 보존한다. 이 migration은 초안 저장만 허가한다.
CREATE TABLE anvil.work_plans (
  id uuid PRIMARY KEY, project_id uuid NOT NULL REFERENCES anvil.projects(id) ON DELETE RESTRICT,
  head_version bigint NOT NULL CHECK(head_version>0), confirmed_version bigint CHECK(confirmed_version>0),
  created_by uuid NOT NULL REFERENCES anvil.users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now(),UNIQUE(project_id,id)
);
CREATE TABLE anvil.work_plan_versions (
  project_id uuid NOT NULL,plan_id uuid NOT NULL,version bigint NOT NULL CHECK(version>0),
  document_id uuid NOT NULL,document_version bigint NOT NULL,document_hash text NOT NULL,
  design_id uuid NOT NULL,design_version bigint NOT NULL,design_hash text NOT NULL,
  screen_review_refs jsonb NOT NULL CHECK(jsonb_typeof(screen_review_refs)='array'),
  content_hash text NOT NULL CHECK(content_hash ~ '^[0-9a-f]{64}$'),version_json jsonb NOT NULL,
  created_by uuid NOT NULL REFERENCES anvil.users(id) ON DELETE RESTRICT,client_id uuid NOT NULL,
  command_id uuid NOT NULL UNIQUE REFERENCES anvil.commands(id) ON DELETE RESTRICT,created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(project_id,plan_id,version),UNIQUE(project_id,plan_id,version,content_hash),
  FOREIGN KEY(project_id,plan_id) REFERENCES anvil.work_plans(project_id,id) ON DELETE RESTRICT,
  FOREIGN KEY(project_id,document_id,document_version,document_hash) REFERENCES anvil.document_versions(project_id,document_id,version,content_hash) ON DELETE RESTRICT,
  FOREIGN KEY(project_id,design_id,design_version,design_hash) REFERENCES anvil.document_versions(project_id,document_id,version,content_hash) ON DELETE RESTRICT,
  FOREIGN KEY(created_by,client_id) REFERENCES anvil.clients(user_id,id) ON DELETE RESTRICT
);
ALTER TABLE anvil.work_plans ADD CONSTRAINT work_plan_head_fk FOREIGN KEY(project_id,id,head_version) REFERENCES anvil.work_plan_versions(project_id,plan_id,version) DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE anvil.work_plans ADD CONSTRAINT work_plan_confirmed_fk FOREIGN KEY(project_id,id,confirmed_version) REFERENCES anvil.work_plan_versions(project_id,plan_id,version) DEFERRABLE INITIALLY DEFERRED;
CREATE TABLE anvil.plan_tasks (
  project_id uuid NOT NULL,plan_id uuid NOT NULL,plan_version bigint NOT NULL,task_code text NOT NULL,
  task_type text NOT NULL CHECK(task_type IN ('SCREEN','FUNCTION','INTEGRATION','PREPARATION')),
  card_json jsonb NOT NULL,card_hash text NOT NULL CHECK(card_hash ~ '^[0-9a-f]{64}$'),owner_role text NOT NULL,
  PRIMARY KEY(project_id,plan_id,plan_version,task_code),
  FOREIGN KEY(project_id,plan_id,plan_version) REFERENCES anvil.work_plan_versions(project_id,plan_id,version) ON DELETE RESTRICT
);
CREATE TABLE anvil.plan_dependencies (
  project_id uuid NOT NULL,plan_id uuid NOT NULL,plan_version bigint NOT NULL,task_code text NOT NULL,dependency_task_code text NOT NULL,
  phase text NOT NULL CHECK(phase IN ('START','ACCEPTANCE')),
  PRIMARY KEY(project_id,plan_id,plan_version,task_code,dependency_task_code,phase),CHECK(task_code<>dependency_task_code),
  FOREIGN KEY(project_id,plan_id,plan_version,task_code) REFERENCES anvil.plan_tasks(project_id,plan_id,plan_version,task_code) ON DELETE RESTRICT,
  FOREIGN KEY(project_id,plan_id,plan_version,dependency_task_code) REFERENCES anvil.plan_tasks(project_id,plan_id,plan_version,task_code) ON DELETE RESTRICT
);
CREATE FUNCTION anvil.work_plan_command_authorized(pid uuid,wid uuid,v bigint) RETURNS boolean LANGUAGE sql STABLE AS $$
 SELECT EXISTS(SELECT 1 FROM anvil.commands c
 JOIN anvil.authorization_receipts r ON r.id=c.authorization_receipt_id AND r.command_id=c.id AND r.policy_ref=c.policy_ref
 JOIN anvil.project_control pc ON pc.project_id=c.project_id AND pc.actor_id=c.actor_id AND pc.client_id=c.client_id AND pc.generation=c.control_generation AND pc.revoked_at IS NULL
 JOIN anvil.project_members m ON m.project_id=c.project_id AND m.user_id=c.actor_id AND m.participation='OWNER' AND m.revoked_at IS NULL
 JOIN anvil.permission_policies p ON p.project_id=c.project_id AND p.id::text=c.policy_ref->>'id' AND p.head_version=(c.policy_ref->>'version')::bigint
 WHERE c.id::text=current_setting('anvil.command_id',true) AND c.project_id=pid
 AND c.actor_id::text=current_setting('anvil.actor_id',true) AND c.client_id::text=current_setting('anvil.client_id',true)
 AND c.state='APPLIED' AND c.operation='saveWorkPlanDraft' AND c.expected_version=v-1
 AND c.result_ref->'data'->>'status'='WORK_PLAN_DRAFT_SAVED'
 AND c.result_ref->'data'->'ref'->>'id'=wid::text AND (c.result_ref->'data'->'ref'->>'version')::bigint=v);
$$;
CREATE FUNCTION anvil.guard_work_plan_write() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE pid uuid;wid uuid;v bigint;snapshot jsonb;
BEGIN
 IF current_user<>'anvil_v3_app' THEN RETURN NEW;END IF;
 pid=NEW.project_id;
 IF TG_TABLE_NAME='work_plans' THEN wid=NEW.id;v=NEW.head_version;
 ELSE wid=NEW.plan_id;IF TG_TABLE_NAME='work_plan_versions' THEN v=NEW.version;ELSE v=NEW.plan_version;END IF;END IF;
 IF NOT anvil.work_plan_command_authorized(pid,wid,v) THEN RAISE EXCEPTION 'WORK_PLAN_CURRENT_AUTHORIZATION_REQUIRED' USING ERRCODE='42501';END IF;
 SELECT c.result_ref->'data'->'workPlan' INTO snapshot FROM anvil.commands c WHERE c.id::text=current_setting('anvil.command_id',true);
 IF snapshot->>'status' IS DISTINCT FROM 'DRAFT' THEN RAISE EXCEPTION 'WORK_PLAN_DRAFT_ONLY' USING ERRCODE='42501';END IF;
 IF TG_TABLE_NAME='work_plans' THEN
  IF TG_OP='INSERT' THEN
   IF NEW.head_version<>1 OR NEW.confirmed_version IS NOT NULL OR NEW.created_by::text IS DISTINCT FROM current_setting('anvil.actor_id',true) THEN RAISE EXCEPTION 'WORK_PLAN_DRAFT_ONLY' USING ERRCODE='42501';END IF;
  ELSE
   IF NEW.head_version<>OLD.head_version+1 OR (to_jsonb(NEW)-ARRAY['head_version','updated_at']) IS DISTINCT FROM (to_jsonb(OLD)-ARRAY['head_version','updated_at']) THEN RAISE EXCEPTION 'WORK_PLAN_HISTORY_PRESERVE' USING ERRCODE='42501';END IF;
  END IF;
 ELSIF TG_TABLE_NAME='work_plan_versions' THEN
  IF NEW.created_by::text IS DISTINCT FROM current_setting('anvil.actor_id',true) OR NEW.client_id::text IS DISTINCT FROM current_setting('anvil.client_id',true) OR NEW.command_id::text IS DISTINCT FROM current_setting('anvil.command_id',true)
   OR NEW.version_json IS DISTINCT FROM snapshot OR snapshot->'ref' IS DISTINCT FROM jsonb_build_object('id',wid,'version',v,'contentHash',NEW.content_hash)
   OR snapshot->'documentRef' IS DISTINCT FROM jsonb_build_object('id',NEW.document_id,'version',NEW.document_version,'contentHash',NEW.document_hash)
   OR snapshot->'designRef' IS DISTINCT FROM jsonb_build_object('id',NEW.design_id,'version',NEW.design_version,'contentHash',NEW.design_hash)
   OR snapshot->'screenReviewRefs' IS DISTINCT FROM NEW.screen_review_refs
   OR NOT EXISTS(SELECT 1 FROM anvil.work_plans w WHERE w.project_id=pid AND w.id=wid AND w.head_version=v)
   OR NOT EXISTS(SELECT 1 FROM anvil.document_versions d JOIN anvil.form_versions f ON f.definition_id=d.form_definition_id AND f.version=d.form_version AND f.content_hash=d.form_hash JOIN anvil.documents h ON h.project_id=d.project_id AND h.id=d.document_id AND h.head_version=d.version WHERE d.project_id=pid AND d.document_id=NEW.document_id AND d.version=NEW.document_version AND d.content_hash=NEW.document_hash AND f.definition_json->>'formCode'='AF04')
   OR NOT EXISTS(SELECT 1 FROM anvil.document_versions d JOIN anvil.form_versions f ON f.definition_id=d.form_definition_id AND f.version=d.form_version AND f.content_hash=d.form_hash WHERE d.project_id=pid AND d.document_id=NEW.design_id AND d.version=NEW.design_version AND d.content_hash=NEW.design_hash AND f.definition_json->>'formCode'='AF02') THEN RAISE EXCEPTION 'WORK_PLAN_EXACT_SOURCE_RECEIPT_REQUIRED' USING ERRCODE='42501';END IF;
 ELSE
  IF NOT EXISTS(SELECT 1 FROM anvil.work_plan_versions p WHERE p.project_id=pid AND p.plan_id=wid AND p.version=v AND p.command_id::text=current_setting('anvil.command_id',true) AND p.version_json=snapshot AND p.version_json->>'relationalProjection'='STORED') THEN RAISE EXCEPTION 'WORK_PLAN_VERSION_REQUIRED' USING ERRCODE='42501';END IF;
  IF TG_TABLE_NAME='plan_tasks' THEN
   IF NEW.card_json->>'taskCode' IS DISTINCT FROM NEW.task_code OR NEW.card_json->>'type' IS DISTINCT FROM NEW.task_type OR NEW.card_json->>'ownerRole' IS DISTINCT FROM NEW.owner_role OR NOT (snapshot->'tasks' @> jsonb_build_array(NEW.card_json)) THEN RAISE EXCEPTION 'WORK_PLAN_EXACT_CARD_REQUIRED' USING ERRCODE='42501';END IF;
  ELSE
   IF NOT(snapshot->'dependencies' @> jsonb_build_array(jsonb_build_object('taskCode',NEW.task_code,'dependencyTaskCode',NEW.dependency_task_code,'phase',NEW.phase))) THEN RAISE EXCEPTION 'WORK_PLAN_EXACT_DEPENDENCY_REQUIRED' USING ERRCODE='42501';END IF;
  END IF;
 END IF;
 RETURN NEW;
END;
$$;
CREATE TRIGGER work_plan_head_guard BEFORE INSERT OR UPDATE ON anvil.work_plans FOR EACH ROW EXECUTE FUNCTION anvil.guard_work_plan_write();
CREATE TRIGGER work_plan_version_guard BEFORE INSERT ON anvil.work_plan_versions FOR EACH ROW EXECUTE FUNCTION anvil.guard_work_plan_write();
CREATE TRIGGER plan_task_guard BEFORE INSERT ON anvil.plan_tasks FOR EACH ROW EXECUTE FUNCTION anvil.guard_work_plan_write();
CREATE TRIGGER plan_dependency_guard BEFORE INSERT ON anvil.plan_dependencies FOR EACH ROW EXECUTE FUNCTION anvil.guard_work_plan_write();
REVOKE ALL ON anvil.work_plans,anvil.work_plan_versions,anvil.plan_tasks,anvil.plan_dependencies FROM anvil_v3_app;
GRANT SELECT,INSERT ON anvil.work_plans,anvil.work_plan_versions,anvil.plan_tasks,anvil.plan_dependencies TO anvil_v3_app;
GRANT UPDATE(head_version,updated_at) ON anvil.work_plans TO anvil_v3_app;
