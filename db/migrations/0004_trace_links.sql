CREATE TABLE anvil.trace_edges (
 id uuid PRIMARY KEY,project_id uuid NOT NULL REFERENCES anvil.projects(id) ON DELETE RESTRICT,
 from_kind text NOT NULL,from_id uuid NOT NULL,from_version bigint NOT NULL CHECK(from_version>0),from_code text NOT NULL,
 to_kind text NOT NULL,to_id uuid NOT NULL,to_version bigint NOT NULL CHECK(to_version>0),to_code text NOT NULL,
 relation text NOT NULL CHECK(relation IN ('REFINES','IMPLEMENTS','VERIFIES','DEPENDS_ON')),
 design_refs jsonb NOT NULL CHECK(jsonb_typeof(design_refs)='array' AND jsonb_array_length(design_refs)>0),
 edge_json jsonb NOT NULL,edge_hash text NOT NULL CHECK(edge_hash ~ '^[0-9a-f]{64}$'),reason text NOT NULL CHECK(length(trim(reason))>0 AND length(reason)<=20000),
 created_by uuid NOT NULL REFERENCES anvil.users(id) ON DELETE RESTRICT,client_id uuid NOT NULL,
 command_id uuid NOT NULL UNIQUE REFERENCES anvil.commands(id) ON DELETE RESTRICT,created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(project_id,id),UNIQUE(project_id,from_kind,from_id,from_version,from_code,to_kind,to_id,to_version,to_code,relation),
 FOREIGN KEY(created_by,client_id) REFERENCES anvil.clients(user_id,id) ON DELETE RESTRICT,
 CHECK(from_kind IN ('DESIGN_ITEM','SCREEN_REGION','PLAN_TASK','DOCUMENT_VERSION')),
 CHECK(to_kind IN ('DESIGN_ITEM','SCREEN_REGION','PLAN_TASK','DOCUMENT_VERSION')),
 CHECK((from_kind,from_id,from_version,from_code)<>(to_kind,to_id,to_version,to_code))
);
CREATE FUNCTION anvil.guard_trace_link_write() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE snapshot jsonb;
BEGIN
 IF current_user<>'anvil_v3_app' THEN RETURN NEW;END IF;
 IF NEW.created_by::text IS DISTINCT FROM current_setting('anvil.actor_id',true) OR NEW.client_id::text IS DISTINCT FROM current_setting('anvil.client_id',true) OR NEW.command_id::text IS DISTINCT FROM current_setting('anvil.command_id',true) THEN RAISE EXCEPTION 'TRACE_CURRENT_COMMAND_REQUIRED' USING ERRCODE='42501';END IF;
 SELECT c.result_ref->'data'->'edge' INTO snapshot FROM anvil.commands c
 JOIN anvil.authorization_receipts r ON r.id=c.authorization_receipt_id AND r.command_id=c.id AND r.policy_ref=c.policy_ref
 JOIN anvil.project_control pc ON pc.project_id=c.project_id AND pc.actor_id=c.actor_id AND pc.client_id=c.client_id AND pc.generation=c.control_generation AND pc.revoked_at IS NULL
 JOIN anvil.project_members m ON m.project_id=c.project_id AND m.user_id=c.actor_id AND m.participation='OWNER' AND m.revoked_at IS NULL
 JOIN anvil.permission_policies p ON p.project_id=c.project_id AND p.id::text=c.policy_ref->>'id' AND p.head_version=(c.policy_ref->>'version')::bigint
 WHERE c.id=NEW.command_id AND c.project_id=NEW.project_id AND c.actor_id=NEW.created_by AND c.client_id=NEW.client_id AND c.operation='linkTrace' AND c.state='APPLIED' AND c.expected_version=0
 AND c.result_ref->'data'->>'status'='TRACE_LINKED' AND c.result_ref->'data'->'ref'=jsonb_build_object('id',NEW.id,'version',1,'contentHash',NEW.edge_hash);
 IF snapshot IS NULL OR NEW.edge_json IS DISTINCT FROM snapshot OR snapshot->>'id' IS DISTINCT FROM NEW.id::text OR snapshot->>'edgeHash' IS DISTINCT FROM NEW.edge_hash OR snapshot->>'relation' IS DISTINCT FROM NEW.relation OR snapshot->>'reason' IS DISTINCT FROM NEW.reason OR snapshot->'designRefs' IS DISTINCT FROM NEW.design_refs
 OR snapshot->'from'->>'kind' IS DISTINCT FROM NEW.from_kind OR snapshot->'from'->>'id' IS DISTINCT FROM NEW.from_id::text OR (snapshot->'from'->'versionRef'->>'version')::bigint IS DISTINCT FROM NEW.from_version OR COALESCE(snapshot->'from'->>'localCode','') IS DISTINCT FROM NEW.from_code
 OR snapshot->'to'->>'kind' IS DISTINCT FROM NEW.to_kind OR snapshot->'to'->>'id' IS DISTINCT FROM NEW.to_id::text OR (snapshot->'to'->'versionRef'->>'version')::bigint IS DISTINCT FROM NEW.to_version OR COALESCE(snapshot->'to'->>'localCode','') IS DISTINCT FROM NEW.to_code THEN RAISE EXCEPTION 'TRACE_EXACT_SOURCE_RECEIPT_REQUIRED' USING ERRCODE='42501';END IF;
 RETURN NEW;
END;
$$;
CREATE TRIGGER trace_link_guard BEFORE INSERT ON anvil.trace_edges FOR EACH ROW EXECUTE FUNCTION anvil.guard_trace_link_write();
REVOKE ALL ON anvil.trace_edges FROM anvil_v3_app;
GRANT SELECT,INSERT ON anvil.trace_edges TO anvil_v3_app;
