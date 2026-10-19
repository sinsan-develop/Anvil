-- 초기 queue 저장 모델만 검사한다. INSERT guard 미구현을 실제 queue 성공으로 표시하지 않는다.
DO $$
DECLARE n integer;
BEGIN
 SELECT count(*) INTO n FROM pg_class c JOIN pg_namespace s ON s.oid=c.relnamespace
 WHERE s.nspname='anvil' AND c.relkind='r' AND c.relname=ANY(ARRAY['executions','execution_grants','writer_claims','execution_commands']);
 IF n<>4 THEN RAISE EXCEPTION 'QUEUE_MODEL_TABLES_MISSING'; END IF;
 SELECT count(*) INTO n FROM pg_constraint k JOIN pg_class c ON c.oid=k.conrelid JOIN pg_namespace s ON s.oid=c.relnamespace
 WHERE s.nspname='anvil' AND c.relname=ANY(ARRAY['executions','execution_grants','writer_claims','execution_commands']) AND k.contype='f' AND k.convalidated;
 IF n<>10 THEN RAISE EXCEPTION 'QUEUE_MODEL_EXACT_FK_MISSING'; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_indexes WHERE schemaname='anvil' AND tablename='writer_claims' AND indexname='execution_single_unreclaimed_writer' AND indexdef LIKE '%UNIQUE%' AND indexdef LIKE '%reclaimed_at IS NULL%') THEN RAISE EXCEPTION 'QUEUE_WRITER_BOUND_MISSING'; END IF;
END;
$$;
SELECT 'C2_QUEUE_MODEL_FOUR_TABLES_TEN_FKS';
SET ROLE anvil_v3_app;
DO $$
DECLARE t text;
BEGIN
 FOREACH t IN ARRAY ARRAY['executions','execution_grants','writer_claims','execution_commands','usage_reservations'] LOOP
  IF NOT has_table_privilege(current_user,'anvil.'||t,'SELECT') THEN RAISE EXCEPTION 'QUEUE_READ_MISSING'; END IF;
  BEGIN EXECUTE format('INSERT INTO anvil.%I DEFAULT VALUES',t);RAISE EXCEPTION 'QUEUE_INSERT_OPEN';EXCEPTION WHEN insufficient_privilege THEN NULL;END;
  BEGIN EXECUTE format('UPDATE anvil.%I SET project_id=project_id WHERE false',t);RAISE EXCEPTION 'QUEUE_UPDATE_OPEN';EXCEPTION WHEN insufficient_privilege THEN NULL;END;
  BEGIN EXECUTE format('DELETE FROM anvil.%I WHERE false',t);RAISE EXCEPTION 'QUEUE_DELETE_OPEN';EXCEPTION WHEN insufficient_privilege THEN NULL;END;
 END LOOP;
END;
$$;
SELECT 'C2_QUEUE_MODEL_APP_FIFTEEN_MUTATIONS_DENIED';
RESET ROLE;
