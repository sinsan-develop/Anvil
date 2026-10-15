-- FN03 catalog 선행. 이후 본문/파일/제안 저장은 새 migration으로 확장한다.
CREATE TABLE anvil.authoring_standard_versions (
  id uuid NOT NULL, version bigint NOT NULL CHECK(version>0),
  content_hash text NOT NULL CHECK(content_hash ~ '^[0-9a-f]{64}$'),
  body_utf8 bytea NOT NULL CHECK(octet_length(body_utf8)>0 AND octet_length(body_utf8)<=2097152),
  source_approval_json jsonb NOT NULL CHECK(jsonb_typeof(source_approval_json)='object'),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(id,version), UNIQUE(id,version,content_hash)
);
CREATE TABLE anvil.form_definitions (
  id uuid PRIMARY KEY, scope text NOT NULL CHECK(scope IN ('SYSTEM','USER_COMMON','PROJECT')),
  owner_user_id uuid REFERENCES anvil.users(id) ON DELETE RESTRICT,
  project_id uuid REFERENCES anvil.projects(id) ON DELETE RESTRICT,
  form_code text NOT NULL CHECK(length(trim(form_code))>0), name text NOT NULL CHECK(length(trim(name))>0),
  head_version bigint NOT NULL CHECK(head_version>0), created_at timestamptz NOT NULL DEFAULT now(),
  CHECK((scope='SYSTEM' AND owner_user_id IS NULL AND project_id IS NULL)
    OR (scope='USER_COMMON' AND owner_user_id IS NOT NULL AND project_id IS NULL)
    OR (scope='PROJECT' AND owner_user_id IS NULL AND project_id IS NOT NULL)),
  CHECK(scope<>'SYSTEM' OR (form_code,name) IN (
    ('AF01','요구사항정의서'),('AF02','설계서'),('AF03','화면시안'),('AF04','작업계획서'),
    ('AF05','테스트계획서'),('AF06','테스트 결과서'),('AF07','작업진행상황'),('AF08','개발환경 정의서')))
);
CREATE UNIQUE INDEX system_form_code ON anvil.form_definitions(form_code) WHERE scope='SYSTEM';
CREATE INDEX form_owner_list ON anvil.form_definitions(owner_user_id,form_code,id) WHERE scope='USER_COMMON';
CREATE TABLE anvil.form_versions (
  definition_id uuid NOT NULL REFERENCES anvil.form_definitions(id) ON DELETE RESTRICT,
  version bigint NOT NULL CHECK(version>0),
  definition_json jsonb NOT NULL CHECK(jsonb_typeof(definition_json)='object'),
  content_hash text NOT NULL CHECK(content_hash ~ '^[0-9a-f]{64}$'),
  authoring_standard_id uuid NOT NULL, authoring_standard_version bigint NOT NULL, authoring_standard_hash text NOT NULL,
  authoring_standard_ref jsonb NOT NULL,
  origin_ref_json jsonb, created_by uuid REFERENCES anvil.users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(definition_id,version),
  UNIQUE(definition_id,version,content_hash),
  FOREIGN KEY(authoring_standard_id,authoring_standard_version,authoring_standard_hash)
    REFERENCES anvil.authoring_standard_versions(id,version,content_hash) ON DELETE RESTRICT,
  CHECK(COALESCE(definition_json->'authoringStandardRef'=authoring_standard_ref,false)),
  CHECK(COALESCE(authoring_standard_ref=jsonb_build_object('id',authoring_standard_id,'version',authoring_standard_version,'contentHash',authoring_standard_hash),false))
);
ALTER TABLE anvil.form_definitions ADD CONSTRAINT form_head_version_fk
  FOREIGN KEY(id,head_version) REFERENCES anvil.form_versions(definition_id,version) DEFERRABLE INITIALLY DEFERRED;
-- SYSTEM seed와 사용자 작성 API를 혼동하지 않는다. 후속 사용자 양식 writer는 별도 scope 집행을 구현한 뒤 개방한다.
REVOKE INSERT,UPDATE,DELETE ON anvil.authoring_standard_versions,anvil.form_definitions,anvil.form_versions FROM anvil_v3_app;
