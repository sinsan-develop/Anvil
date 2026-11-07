CREATE TABLE anvil.conversations (
 id uuid PRIMARY KEY,project_id uuid NOT NULL REFERENCES anvil.projects(id) ON DELETE RESTRICT,target_role_ref jsonb,
 head_sequence bigint NOT NULL CHECK(head_sequence>0),created_by uuid NOT NULL REFERENCES anvil.users(id) ON DELETE RESTRICT,
 last_client_id uuid NOT NULL,last_command_id uuid NOT NULL UNIQUE REFERENCES anvil.commands(id) ON DELETE RESTRICT,
 created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now(),UNIQUE(project_id,id)
);
CREATE TABLE anvil.conversation_messages (
 project_id uuid NOT NULL,conversation_id uuid NOT NULL,sequence bigint NOT NULL CHECK(sequence>0),id uuid NOT NULL UNIQUE,
 author_ref jsonb NOT NULL,kind text NOT NULL CHECK(kind IN ('USER_INSTRUCTION','USER_MESSAGE','AGENT_OUTPUT','TOOL_FACT')),
 body_artifact_id uuid NOT NULL,source_refs jsonb NOT NULL,reply_to uuid,supersedes_instruction_id uuid,effective_scope jsonb NOT NULL,
 message_json jsonb NOT NULL,content_hash text NOT NULL CHECK(content_hash ~ '^[0-9a-f]{64}$'),redaction_state text NOT NULL CHECK(redaction_state IN ('NOT_REDACTED','QUARANTINED')),
 client_id uuid NOT NULL,command_id uuid NOT NULL UNIQUE REFERENCES anvil.commands(id) ON DELETE RESTRICT,recorded_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(project_id,conversation_id,sequence),UNIQUE(project_id,conversation_id,id),UNIQUE(project_id,id),
 FOREIGN KEY(project_id,conversation_id) REFERENCES anvil.conversations(project_id,id) ON DELETE RESTRICT,
 FOREIGN KEY(project_id,body_artifact_id) REFERENCES anvil.artifacts(project_id,id) ON DELETE RESTRICT,
 FOREIGN KEY(project_id,conversation_id,reply_to) REFERENCES anvil.conversation_messages(project_id,conversation_id,id) ON DELETE RESTRICT,
 FOREIGN KEY(project_id,conversation_id,supersedes_instruction_id) REFERENCES anvil.conversation_messages(project_id,conversation_id,id) ON DELETE RESTRICT
);
CREATE FUNCTION anvil.guard_human_conversation_write() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE cmd anvil.commands%ROWTYPE;snapshot jsonb;pid uuid;cid uuid;seq bigint;command uuid;client uuid;
BEGIN
 IF current_user<>'anvil_v3_app' THEN RETURN NEW;END IF;
 pid=NEW.project_id;
 IF TG_TABLE_NAME='conversations' THEN cid=NEW.id;seq=NEW.head_sequence;command=NEW.last_command_id;client=NEW.last_client_id;
 ELSE cid=NEW.conversation_id;seq=NEW.sequence;command=NEW.command_id;client=NEW.client_id;END IF;
 SELECT c.* INTO cmd FROM anvil.commands c
 JOIN anvil.authorization_receipts r ON r.id=c.authorization_receipt_id AND r.command_id=c.id AND r.policy_ref=c.policy_ref
 JOIN anvil.project_control pc ON pc.project_id=c.project_id AND pc.actor_id=c.actor_id AND pc.client_id=c.client_id AND pc.generation=c.control_generation AND pc.revoked_at IS NULL
 JOIN anvil.project_members m ON m.project_id=c.project_id AND m.user_id=c.actor_id AND m.participation='OWNER' AND m.revoked_at IS NULL
 JOIN anvil.permission_policies p ON p.project_id=c.project_id AND p.id::text=c.policy_ref->>'id' AND p.head_version=(c.policy_ref->>'version')::bigint
 WHERE c.id=command AND c.id::text=current_setting('anvil.command_id',true) AND c.project_id=pid
 AND c.actor_id::text=current_setting('anvil.actor_id',true) AND c.client_id::text=current_setting('anvil.client_id',true) AND c.client_id=client
 AND c.operation='appendConversation' AND c.state='APPLIED' AND c.expected_version=seq-1
 AND c.result_ref->'data'->>'status'='CONVERSATION_STORED' AND c.result_ref->'data'->>'deliveryState'='STORED'
 AND c.result_ref->'data'->>'conversationId'=cid::text AND (c.result_ref->'data'->>'serverSequence')::bigint=seq;
 IF cmd.id IS NULL THEN RAISE EXCEPTION 'CONVERSATION_CURRENT_AUTHORIZATION_REQUIRED' USING ERRCODE='42501';END IF;
 snapshot=cmd.result_ref->'data'->'message';
 IF TG_TABLE_NAME='conversations' THEN
  IF NEW.target_role_ref IS NOT NULL THEN RAISE EXCEPTION 'CONVERSATION_UNBOUND_ONLY' USING ERRCODE='42501';END IF;
  IF TG_OP='INSERT' THEN
   IF NEW.head_sequence<>1 OR NEW.created_by<>cmd.actor_id THEN RAISE EXCEPTION 'CONVERSATION_HUMAN_ONLY' USING ERRCODE='42501';END IF;
  ELSIF NEW.head_sequence<>OLD.head_sequence+1 OR (to_jsonb(NEW)-ARRAY['head_sequence','last_command_id','last_client_id','updated_at']) IS DISTINCT FROM (to_jsonb(OLD)-ARRAY['head_sequence','last_command_id','last_client_id','updated_at']) THEN RAISE EXCEPTION 'CONVERSATION_HISTORY_PRESERVE' USING ERRCODE='42501';END IF;
 ELSE
  IF NEW.message_json IS DISTINCT FROM snapshot OR snapshot->>'conversationId' IS DISTINCT FROM cid::text OR (snapshot->>'serverSequence')::bigint IS DISTINCT FROM seq
   OR NEW.author_ref IS DISTINCT FROM jsonb_build_object('kind','HUMAN','userId',cmd.actor_id) OR snapshot->'authorRef' IS DISTINCT FROM NEW.author_ref
   OR NEW.kind NOT IN ('USER_INSTRUCTION','USER_MESSAGE') OR NEW.kind IS DISTINCT FROM snapshot->'message'->>'kind'
   OR NEW.body_artifact_id::text IS DISTINCT FROM snapshot->'message'->'bodyRef'->>'artifactId'
   OR NEW.content_hash IS DISTINCT FROM cmd.result_ref->'data'->'sourceRef'->>'contentHash' OR NEW.id::text IS DISTINCT FROM cmd.result_ref->'data'->'sourceRef'->>'id'
   OR NEW.reply_to::text IS DISTINCT FROM snapshot->'message'->'replyTo'->>'id' OR NEW.supersedes_instruction_id::text IS DISTINCT FROM snapshot->'message'->'supersedesInstructionRef'->>'id'
   OR NEW.effective_scope IS DISTINCT FROM snapshot->'message'->'effectiveScope' OR NEW.source_refs IS DISTINCT FROM snapshot->'sourceRefs' OR NEW.redaction_state<>'NOT_REDACTED'
   OR NOT EXISTS(SELECT 1 FROM anvil.conversations cv WHERE cv.project_id=pid AND cv.id=cid AND cv.head_sequence=seq)
   OR NOT EXISTS(SELECT 1 FROM anvil.artifacts a WHERE a.project_id=pid AND a.id=NEW.body_artifact_id AND a.state='READY' AND a.content_hash=snapshot->'message'->'bodyRef'->>'contentHash' AND a.bytes=(snapshot->'message'->'bodyRef'->>'bytes')::bigint AND a.media_type=snapshot->'message'->'bodyRef'->>'mediaType') THEN RAISE EXCEPTION 'CONVERSATION_EXACT_SOURCE_RECEIPT_REQUIRED' USING ERRCODE='42501';END IF;
 END IF;
 RETURN NEW;
END;
$$;
CREATE TRIGGER conversation_head_guard BEFORE INSERT OR UPDATE ON anvil.conversations FOR EACH ROW EXECUTE FUNCTION anvil.guard_human_conversation_write();
CREATE TRIGGER conversation_message_guard BEFORE INSERT ON anvil.conversation_messages FOR EACH ROW EXECUTE FUNCTION anvil.guard_human_conversation_write();
REVOKE ALL ON anvil.conversations,anvil.conversation_messages FROM anvil_v3_app;
GRANT SELECT,INSERT ON anvil.conversations,anvil.conversation_messages TO anvil_v3_app;
GRANT UPDATE(head_sequence,last_client_id,last_command_id,updated_at) ON anvil.conversations TO anvil_v3_app;
