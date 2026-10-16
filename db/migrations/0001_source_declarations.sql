-- 선언은 관측/권한/기준선이 아니다. 기존 원문·초안/프로젝트를 삭제하거나 재분류하지 않는다.
CREATE TABLE anvil.source_declarations(
 id uuid NOT NULL,version bigint NOT NULL CHECK(version>0),draft_id uuid NOT NULL REFERENCES anvil.project_drafts(id),draft_version bigint NOT NULL,
 declared_by uuid NOT NULL,client_id uuid NOT NULL,content_hash text NOT NULL CHECK(content_hash ~ '^[0-9a-f]{64}$'),
 declaration_json jsonb NOT NULL CHECK(jsonb_typeof(declaration_json)='object'),authority text NOT NULL DEFAULT 'USER_DECLARED' CHECK(authority='USER_DECLARED'),readiness text NOT NULL DEFAULT 'UNVERIFIED' CHECK(readiness='UNVERIFIED'),
 command_id uuid NOT NULL UNIQUE REFERENCES anvil.commands(id),created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(id,version),UNIQUE(draft_id,draft_version),CHECK(id=draft_id AND version=draft_version),
 FOREIGN KEY(declared_by,client_id) REFERENCES anvil.clients(user_id,id)
);
CREATE TABLE anvil.project_source_declarations(
 project_id uuid PRIMARY KEY REFERENCES anvil.projects(id),declaration_id uuid NOT NULL,declaration_version bigint NOT NULL,
 created_by uuid NOT NULL,client_id uuid NOT NULL,command_id uuid NOT NULL UNIQUE REFERENCES anvil.commands(id),created_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(declaration_id,declaration_version) REFERENCES anvil.source_declarations(id,version),
 FOREIGN KEY(created_by,client_id) REFERENCES anvil.clients(user_id,id)
);
GRANT SELECT,INSERT ON anvil.source_declarations,anvil.project_source_declarations TO anvil_v3_app;
REVOKE UPDATE,DELETE ON anvil.source_declarations,anvil.project_source_declarations FROM anvil_v3_app;
CREATE FUNCTION anvil.guard_source_declaration() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF current_user<>'anvil_v3_app' THEN RETURN NEW;END IF;
 IF NOT EXISTS(SELECT 1 FROM anvil.project_drafts d
 JOIN anvil.commands c ON c.draft_id=d.id AND c.actor_id=d.owner_user_id AND c.client_id=d.client_id
 JOIN anvil.authorization_receipts r ON r.id=c.authorization_receipt_id AND r.command_id=c.id AND r.scope_kind='DRAFT' AND r.scope_id=d.id
 WHERE d.id=NEW.draft_id AND d.owner_user_id=NEW.declared_by AND d.client_id=NEW.client_id AND d.version=NEW.version AND d.consumed_project_id IS NULL
 AND d.input_json->>'sourceMode'='EXISTING' AND d.input_json->'sourceDeclaration'=NEW.declaration_json
 AND c.id=NEW.command_id AND c.id::text=current_setting('anvil.source_declaration_command_id',true)
 AND c.actor_id::text=current_setting('anvil.actor_id',true) AND c.client_id::text=current_setting('anvil.client_id',true)
 AND c.operation IN('createProjectDraft','saveProjectDraft') AND c.state='APPLIED' AND c.expected_version=NEW.version-1
 AND c.result_ref->>'draftId'=NEW.draft_id::text AND c.result_ref->'version'=to_jsonb(NEW.version)
 AND c.result_ref->'input'=d.input_json
 AND c.result_ref->'sourceDeclaration'=jsonb_build_object('ref',jsonb_build_object('id',NEW.id,'version',NEW.version,'contentHash',NEW.content_hash),'authority','USER_DECLARED','readiness','UNVERIFIED','declaration',NEW.declaration_json))
 THEN RAISE EXCEPTION 'SOURCE_DECLARATION_EXACT_OWNED_DRAFT_REQUIRED' USING ERRCODE='42501';END IF;
 RETURN NEW;
END;
$$;
CREATE TRIGGER source_declaration_guard BEFORE INSERT ON anvil.source_declarations FOR EACH ROW EXECUTE FUNCTION anvil.guard_source_declaration();
CREATE FUNCTION anvil.guard_project_source_declaration() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF current_user<>'anvil_v3_app' THEN RETURN NEW;END IF;
 IF NOT EXISTS(SELECT 1 FROM anvil.project_drafts d
 JOIN anvil.source_declarations s ON s.draft_id=d.id AND s.draft_version=d.version AND s.id=NEW.declaration_id AND s.version=NEW.declaration_version AND s.declared_by=d.owner_user_id AND s.client_id=d.client_id
 JOIN anvil.commands c ON c.project_id=NEW.project_id AND c.actor_id=d.owner_user_id AND c.client_id=d.client_id
 JOIN anvil.authorization_receipts r ON r.id=c.authorization_receipt_id AND r.command_id=c.id AND r.scope_kind='PROJECT' AND r.scope_id=NEW.project_id
 JOIN anvil.project_members m ON m.project_id=NEW.project_id AND m.user_id=c.actor_id AND m.participation='OWNER' AND m.revoked_at IS NULL
 JOIN anvil.project_control pc ON pc.project_id=NEW.project_id AND pc.actor_id=c.actor_id AND pc.client_id=c.client_id AND pc.generation=1 AND pc.revoked_at IS NULL
 WHERE d.id::text=current_setting('anvil.creation_draft_id',true) AND d.consumed_project_id=NEW.project_id
 AND c.id=NEW.command_id AND c.operation='createProject' AND c.state='APPLIED' AND c.expected_version=0 AND c.control_generation=1
 AND d.input_json->>'sourceMode'='EXISTING' AND d.input_json->'sourceDeclaration'=s.declaration_json
 AND NEW.created_by=c.actor_id AND NEW.created_by::text=current_setting('anvil.actor_id',true) AND NEW.client_id=c.client_id)
 THEN RAISE EXCEPTION 'SOURCE_DECLARATION_EXACT_PROJECT_CREATION_REQUIRED' USING ERRCODE='42501';END IF;
 RETURN NEW;
END;
$$;
CREATE TRIGGER project_source_declaration_guard BEFORE INSERT ON anvil.project_source_declarations FOR EACH ROW EXECUTE FUNCTION anvil.guard_project_source_declaration();
