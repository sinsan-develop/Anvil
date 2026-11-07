-- 승인된 출처 검사에서 변수/열 이름의 모호성만 해소한다. 조건·권한·자료는 변경하지 않는다.
CREATE OR REPLACE FUNCTION anvil.design_change_sources_valid(pid uuid,sources jsonb) RETURNS boolean LANGUAGE plpgsql STABLE AS $$
DECLARE r jsonb;source_kind_value text;rid uuid;
BEGIN
 IF jsonb_typeof(sources) IS DISTINCT FROM 'array' THEN RETURN false;END IF;
 IF jsonb_array_length(sources)>200 OR (SELECT count(DISTINCT value) FROM jsonb_array_elements(sources))<>jsonb_array_length(sources) THEN RETURN false;END IF;
 FOR r IN SELECT value FROM jsonb_array_elements(sources) LOOP
  IF jsonb_typeof(r) IS DISTINCT FROM 'object' OR jsonb_typeof(r->'kind') IS DISTINCT FROM 'string' OR jsonb_typeof(r->'id') IS DISTINCT FROM 'string' OR jsonb_typeof(r->'contentHash') IS DISTINCT FROM 'string' THEN RETURN false;END IF;
  source_kind_value=r->>'kind';
  IF source_kind_value NOT IN('DOCUMENT_VERSION','ARTIFACT','CONVERSATION','USER_INSTRUCTION') OR (r->>'id') !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' OR (r->>'contentHash') !~ '^[0-9a-f]{64}$' THEN RETURN false;END IF;
  rid=(r->>'id')::uuid;
  IF source_kind_value='DOCUMENT_VERSION' THEN
   IF NOT (r ?& ARRAY['kind','id','version','contentHash']) OR (r-ARRAY['kind','id','version','contentHash'])<>'{}'::jsonb OR jsonb_typeof(r->'version') IS DISTINCT FROM 'number' OR (r->>'version') !~ '^[1-9][0-9]{0,15}$' THEN RETURN false;END IF;
   IF (r->>'version')::bigint>9007199254740991 THEN RETURN false;END IF;
   IF NOT EXISTS(SELECT 1 FROM anvil.document_versions v WHERE v.project_id=pid AND v.document_id=rid AND v.version=(r->>'version')::bigint AND v.content_hash=r->>'contentHash') THEN RETURN false;END IF;
  ELSE
   IF NOT (r ?& ARRAY['kind','id','contentHash']) OR (r-ARRAY['kind','id','contentHash'])<>'{}'::jsonb THEN RETURN false;END IF;
   IF source_kind_value='ARTIFACT' THEN
    IF NOT EXISTS(SELECT 1 FROM anvil.artifacts a WHERE a.project_id=pid AND a.id=rid AND a.content_hash=r->>'contentHash' AND a.state='READY' AND a.bytes<=2097152 AND a.media_type IN('text/plain;charset=utf-8','text/markdown;charset=utf-8')) THEN RETURN false;END IF;
   ELSE
    IF NOT EXISTS(SELECT 1 FROM anvil.conversation_messages m WHERE m.project_id=pid AND m.id=rid AND m.content_hash=r->>'contentHash' AND (source_kind_value<>'USER_INSTRUCTION' OR m.kind='USER_INSTRUCTION')) THEN RETURN false;END IF;
   END IF;
  END IF;
 END LOOP;
 RETURN true;
END;
$$;
