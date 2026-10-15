-- 기존 v1 본문/검토/적용본을 수정하지 않고 배포 기본본의 head만 v2로 이동한다.
-- v2 본문은 같은 migration transaction의 검증된 seed가 삽입하며 deferred FK가 부분 반영을 막는다.
DO $correction$
DECLARE item record; current_head bigint; prior_hash text;
BEGIN
  FOR item IN SELECT * FROM (VALUES
    ('a6f20000-0000-4000-8000-000000000001'::uuid,'320f57b45ad2a1ff5d5befa75131d4a7055406901f8f61cddb741bf29111afa6'),
    ('a6f20000-0000-4000-8000-000000000002'::uuid,'36e80925407e23332b814c00d4745ba8e28868cbf6832744c6d0541709e76f3f'),
    ('a6f20000-0000-4000-8000-000000000003'::uuid,'e377320eeb6cd8f0d04d05552f7808df6f829ab478dcaa71581a27c87aa0a885')
  ) AS approved_predecessor(id,content_hash)
  LOOP
    SELECT d.head_version,v.content_hash INTO current_head,prior_hash
      FROM anvil.methodology_definitions d JOIN anvil.methodology_versions v ON v.definition_id=d.id AND v.version=d.head_version
      WHERE d.id=item.id AND d.scope='SYSTEM' FOR UPDATE OF d;
    IF NOT FOUND THEN CONTINUE; END IF;
    IF current_head=1 THEN
      IF prior_hash IS DISTINCT FROM item.content_hash THEN RAISE EXCEPTION 'BUILTIN_PREDECESSOR_CHANGED'; END IF;
      IF EXISTS(SELECT 1 FROM anvil.project_methodologies WHERE source_definition_id=item.id AND source_version=1)
        OR EXISTS(SELECT 1 FROM anvil.methodology_reviews WHERE definition_id=item.id AND version=1 AND decision='CONFIRMED') THEN
        RAISE EXCEPTION 'BUILTIN_V1_IN_USE_REQUIRES_IMPACT_REVIEW';
      END IF;
      UPDATE anvil.methodology_definitions SET head_version=2 WHERE id=item.id AND head_version=1;
    ELSIF current_head<>2 THEN RAISE EXCEPTION 'BUILTIN_HEAD_UNEXPECTED';
    END IF;
  END LOOP;
END;
$correction$;
