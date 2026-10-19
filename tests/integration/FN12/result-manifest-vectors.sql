-- 신규 격리 DB의 순수 validator 교차 벡터다. 실제 제출/COMMIT/Agent 합격이 아니다.
DO $vectors$
DECLARE r jsonb=jsonb_build_object('id','00000001-1111-4111-8111-111111111111','version',1,'contentHash',repeat('a',64));m jsonb;bad jsonb;item jsonb;field text;
BEGIN
 m=jsonb_build_object('assignmentRef',r,'executionRef',r,'baselineRefs','[]'::jsonb,'submissionState','INCOMPLETE','changes','[]'::jsonb,'commandResults','[]'::jsonb,'testResults','[]'::jsonb,'artifactRefs','[]'::jsonb,'unexecuted','[]'::jsonb,'risks','[]'::jsonb,'rollback','원문 보존','checkpointRef',NULL);
 IF NOT anvil.result_manifest_valid(m) THEN RAISE EXCEPTION 'VALID_MINIMAL_MANIFEST_REJECTED';END IF;
 FOREACH field IN ARRAY ARRAY['assignmentRef','executionRef','baselineRefs','submissionState','changes','commandResults','testResults','artifactRefs','unexecuted','risks','rollback','checkpointRef'] LOOP
  IF anvil.result_manifest_valid(m-field) THEN RAISE EXCEPTION 'MISSING_FIELD_ACCEPTED:%',field;END IF;
 END LOOP;
 FOREACH field IN ARRAY ARRAY['submissionState','changes','commandResults','testResults','artifactRefs','unexecuted','risks','rollback'] LOOP
  IF anvil.result_manifest_valid(jsonb_set(m,ARRAY[field],'null')) THEN RAISE EXCEPTION 'NULL_FIELD_ACCEPTED:%',field;END IF;
 END LOOP;
 item=jsonb_build_object('path','src/main.ts','kind','MODIFIED','diffRef',NULL,'beforeHash',NULL,'afterHash',NULL);
 IF NOT anvil.result_manifest_valid(jsonb_set(m,'{changes}',jsonb_build_array(item))) THEN RAISE EXCEPTION 'VALID_CHANGE_REJECTED';END IF;
 IF anvil.result_manifest_valid(jsonb_set(m,'{changes}',jsonb_build_array(jsonb_set(item,'{kind}','null')))) THEN RAISE EXCEPTION 'NULL_CHANGE_KIND_ACCEPTED';END IF;
 bad=jsonb_set(m,'{changes}',jsonb_build_array(jsonb_set(item,'{path}',to_jsonb('../escape.ts'::text))));
 IF anvil.result_manifest_valid(bad) THEN RAISE EXCEPTION 'PARENT_PATH_ACCEPTED';END IF;
 IF anvil.result_manifest_valid(jsonb_set(m,'{rollback}',to_jsonb('Bearer '||repeat('z',24)))) THEN RAISE EXCEPTION 'SENSITIVE_TEXT_ACCEPTED';END IF;
 IF NOT anvil.result_text_valid(to_jsonb(repeat('가',20000)),20000) OR anvil.result_text_valid(to_jsonb(repeat('가',20001)),20000) OR NOT anvil.result_text_valid(to_jsonb(repeat('😀',10000)),20000) OR anvil.result_text_valid(to_jsonb(repeat('😀',10001)),20000) THEN RAISE EXCEPTION 'UTF16_LENGTH_MISMATCH';END IF;
 RAISE NOTICE 'RESULT_MANIFEST_VECTORS_PASS';
END;
$vectors$;
