ALTER TABLE anvil.knowledge_events ADD COLUMN base_ref jsonb;
ALTER TABLE anvil.knowledge_events ADD COLUMN change_sources jsonb;
CREATE UNIQUE INDEX knowledge_one_exclusion ON anvil.knowledge_events(project_id,entry_id,version) WHERE kind='EXCLUDED';
CREATE OR REPLACE FUNCTION anvil.guard_knowledge_draft_write() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE snapshot jsonb;pid uuid;kid uuid;v bigint;cmd anvil.commands%ROWTYPE;event_kind text;
BEGIN
 IF current_user<>'anvil_v3_app' THEN RETURN NEW;END IF;
 pid=NEW.project_id;
 IF TG_TABLE_NAME='knowledge_entries' THEN kid=NEW.id;v=NEW.head_version;ELSE kid=NEW.entry_id;v=NEW.version;END IF;
 SELECT c.* INTO cmd FROM anvil.commands c
 JOIN anvil.authorization_receipts r ON r.id=c.authorization_receipt_id AND r.command_id=c.id AND r.policy_ref=c.policy_ref
 JOIN anvil.project_control pc ON pc.project_id=c.project_id AND pc.actor_id=c.actor_id AND pc.client_id=c.client_id AND pc.generation=c.control_generation AND pc.revoked_at IS NULL
 JOIN anvil.project_members m ON m.project_id=c.project_id AND m.user_id=c.actor_id AND m.participation='OWNER' AND m.revoked_at IS NULL
 JOIN anvil.permission_policies p ON p.project_id=c.project_id AND p.id::text=c.policy_ref->>'id' AND p.head_version=(c.policy_ref->>'version')::bigint
 WHERE c.id::text=current_setting('anvil.command_id',true) AND c.project_id=pid
 AND c.actor_id::text=current_setting('anvil.actor_id',true) AND c.client_id::text=current_setting('anvil.client_id',true)
 AND c.state='APPLIED' AND c.operation IN ('saveKnowledge','correctKnowledge','excludeKnowledge')
 AND c.result_ref->'data'->'ref'->>'id'=kid::text AND (c.result_ref->'data'->'ref'->>'version')::bigint=v;
 IF cmd.id IS NULL THEN RAISE EXCEPTION 'KNOWLEDGE_CURRENT_AUTHORIZATION_REQUIRED' USING ERRCODE='42501';END IF;
 IF cmd.operation='excludeKnowledge' THEN
  IF TG_TABLE_NAME<>'knowledge_events' THEN RAISE EXCEPTION 'KNOWLEDGE_EXCLUSION_EVENT_ONLY' USING ERRCODE='42501';END IF;
  IF cmd.expected_version<>v OR cmd.result_ref->'data'->>'status' IS DISTINCT FROM 'EXCLUDED' OR NEW.kind<>'EXCLUDED'
   OR NEW.id::text IS DISTINCT FROM cmd.result_ref->'data'->>'eventId' OR NEW.reason IS DISTINCT FROM cmd.result_ref->'data'->>'reason'
   OR NEW.command_id<>cmd.id OR NEW.client_id<>cmd.client_id OR NEW.actor_ref IS DISTINCT FROM jsonb_build_object('kind','HUMAN','userId',cmd.actor_id)
   OR NEW.base_ref IS NOT NULL OR NEW.change_sources IS NOT NULL OR NEW.approval_ref IS NOT NULL OR NEW.target_refs IS NOT NULL
   OR NOT EXISTS(SELECT 1 FROM anvil.knowledge_versions k WHERE k.project_id=pid AND k.entry_id=kid AND k.version=v AND k.content_hash=cmd.result_ref->'data'->'ref'->>'contentHash') THEN RAISE EXCEPTION 'KNOWLEDGE_EXACT_EXCLUSION_REQUIRED' USING ERRCODE='42501';END IF;
  RETURN NEW;
 END IF;
 IF cmd.expected_version<>v-1 OR cmd.result_ref->'data'->>'status' IS DISTINCT FROM 'PROPOSED' OR cmd.operation='saveKnowledge' AND v<>1 OR cmd.operation='correctKnowledge' AND v<2 THEN RAISE EXCEPTION 'KNOWLEDGE_PROPOSAL_ONLY' USING ERRCODE='42501';END IF;
 snapshot=cmd.result_ref->'data'->'entry';event_kind=CASE WHEN cmd.operation='saveKnowledge' THEN 'PROPOSED' ELSE 'CORRECTED' END;
 IF cmd.operation='correctKnowledge' AND (cmd.result_ref->'data'->'baseRef'->>'id' IS DISTINCT FROM kid::text OR (cmd.result_ref->'data'->'baseRef'->>'version')::bigint IS DISTINCT FROM v-1
  OR NOT EXISTS(SELECT 1 FROM anvil.knowledge_versions k WHERE k.project_id=pid AND k.entry_id=kid AND k.version=v-1 AND k.content_hash=cmd.result_ref->'data'->'baseRef'->>'contentHash')
  OR EXISTS(SELECT 1 FROM anvil.knowledge_events e WHERE e.project_id=pid AND e.entry_id=kid AND e.version=v-1 AND e.kind='EXCLUDED')) THEN RAISE EXCEPTION 'KNOWLEDGE_EXACT_BASE_REQUIRED' USING ERRCODE='42501';END IF;
 IF TG_TABLE_NAME='knowledge_entries' THEN
  IF NEW.kind IS DISTINCT FROM snapshot->>'kind' THEN RAISE EXCEPTION 'KNOWLEDGE_KIND_PRESERVE' USING ERRCODE='42501';END IF;
  IF TG_OP='INSERT' THEN
   IF cmd.operation<>'saveKnowledge' OR NEW.created_by<>cmd.actor_id OR NEW.client_id<>cmd.client_id OR NEW.command_id<>cmd.id THEN RAISE EXCEPTION 'KNOWLEDGE_PROPOSAL_ONLY' USING ERRCODE='42501';END IF;
  ELSIF cmd.operation<>'correctKnowledge' OR NEW.head_version<>OLD.head_version+1 OR (to_jsonb(NEW)-'head_version') IS DISTINCT FROM (to_jsonb(OLD)-'head_version') THEN RAISE EXCEPTION 'KNOWLEDGE_HISTORY_PRESERVE' USING ERRCODE='42501';END IF;
 ELSIF TG_TABLE_NAME='knowledge_versions' THEN
  IF NEW.created_by<>cmd.actor_id OR NEW.client_id<>cmd.client_id OR NEW.command_id<>cmd.id OR NEW.entry_json IS DISTINCT FROM snapshot
   OR NEW.supersedes_version IS DISTINCT FROM (CASE WHEN cmd.operation='correctKnowledge' THEN v-1 ELSE NULL::bigint END)
   OR NEW.content_hash IS DISTINCT FROM cmd.result_ref->'data'->'ref'->>'contentHash' OR NEW.content_artifact_id::text IS DISTINCT FROM snapshot->'contentRef'->>'artifactId'
   OR NEW.title IS DISTINCT FROM snapshot->>'title' OR NEW.reason IS DISTINCT FROM snapshot->>'reason'
   OR NEW.source_refs IS DISTINCT FROM snapshot->'sourceRefs' OR NEW.scope_json IS DISTINCT FROM snapshot->'scope' OR NEW.related_refs IS DISTINCT FROM snapshot->'relatedRefs'
   OR NOT EXISTS(SELECT 1 FROM anvil.knowledge_entries k WHERE k.project_id=pid AND k.id=kid AND k.head_version=v AND k.kind=snapshot->>'kind')
   OR NOT EXISTS(SELECT 1 FROM anvil.artifacts a WHERE a.project_id=pid AND a.id=NEW.content_artifact_id AND a.state='READY' AND a.content_hash=snapshot->'contentRef'->>'contentHash' AND a.bytes=(snapshot->'contentRef'->>'bytes')::bigint AND a.media_type=snapshot->'contentRef'->>'mediaType') THEN RAISE EXCEPTION 'KNOWLEDGE_EXACT_SOURCE_RECEIPT_REQUIRED' USING ERRCODE='42501';END IF;
 ELSE
  IF NEW.kind<>event_kind OR NEW.command_id<>cmd.id OR NEW.client_id<>cmd.client_id OR NEW.actor_ref IS DISTINCT FROM jsonb_build_object('kind','HUMAN','userId',cmd.actor_id) OR NEW.approval_ref IS NOT NULL OR NEW.target_refs IS NOT NULL THEN RAISE EXCEPTION 'KNOWLEDGE_PROPOSAL_ONLY' USING ERRCODE='42501';END IF;
  IF cmd.operation='saveKnowledge' THEN
   IF NEW.reason IS DISTINCT FROM snapshot->>'reason' OR NEW.base_ref IS NOT NULL OR NEW.change_sources IS NOT NULL THEN RAISE EXCEPTION 'KNOWLEDGE_PROPOSAL_ONLY' USING ERRCODE='42501';END IF;
  ELSIF NEW.id::text IS DISTINCT FROM cmd.result_ref->'data'->>'eventId' OR NEW.reason IS DISTINCT FROM cmd.result_ref->'data'->>'reason' OR NEW.base_ref IS DISTINCT FROM cmd.result_ref->'data'->'baseRef' OR NEW.change_sources IS DISTINCT FROM cmd.result_ref->'data'->'changeSources' THEN RAISE EXCEPTION 'KNOWLEDGE_EXACT_CORRECTION_REQUIRED' USING ERRCODE='42501';END IF;
 END IF;
 RETURN NEW;
END;
$$;
CREATE TRIGGER knowledge_head_update_guard BEFORE UPDATE ON anvil.knowledge_entries FOR EACH ROW EXECUTE FUNCTION anvil.guard_knowledge_draft_write();
GRANT UPDATE(head_version) ON anvil.knowledge_entries TO anvil_v3_app;
