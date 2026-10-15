CREATE TABLE anvil.methodology_definitions (
  id uuid PRIMARY KEY, scope text NOT NULL CHECK(scope IN ('SYSTEM','USER_COMMON','PROJECT')),
  owner_user_id uuid REFERENCES anvil.users(id) ON DELETE RESTRICT,
  project_id uuid REFERENCES anvil.projects(id) ON DELETE RESTRICT,
  system_code text CHECK(system_code IN ('SYS-M01','SYS-M02','SYS-M03')),
  name text NOT NULL CHECK(length(trim(name))>0), purpose text NOT NULL CHECK(length(trim(purpose))>0),
  head_version bigint NOT NULL CHECK(head_version>0), created_at timestamptz NOT NULL DEFAULT now(),
  CHECK((scope='SYSTEM' AND owner_user_id IS NULL AND project_id IS NULL AND system_code IS NOT NULL)
    OR (scope='USER_COMMON' AND owner_user_id IS NOT NULL AND project_id IS NULL AND system_code IS NULL)
    OR (scope='PROJECT' AND owner_user_id IS NULL AND project_id IS NOT NULL AND system_code IS NULL))
);
CREATE UNIQUE INDEX system_methodology_code ON anvil.methodology_definitions(system_code) WHERE scope='SYSTEM';
CREATE INDEX methodology_owner_list ON anvil.methodology_definitions(owner_user_id,id) WHERE scope='USER_COMMON';
CREATE TABLE anvil.methodology_versions (
  definition_id uuid NOT NULL REFERENCES anvil.methodology_definitions(id) ON DELETE RESTRICT,
  version bigint NOT NULL CHECK(version>0), name text NOT NULL, purpose text NOT NULL,
  graph_json jsonb NOT NULL CHECK(jsonb_typeof(graph_json)='object'),
  content_hash text NOT NULL CHECK(content_hash ~ '^[0-9a-f]{64}$'), origin_ref_json jsonb,
  reason text NOT NULL, created_by uuid REFERENCES anvil.users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(definition_id,version), UNIQUE(definition_id,version,content_hash)
);
ALTER TABLE anvil.methodology_definitions ADD CONSTRAINT methodology_head_version_fk
  FOREIGN KEY(id,head_version) REFERENCES anvil.methodology_versions(definition_id,version) DEFERRABLE INITIALLY DEFERRED;
CREATE TABLE anvil.methodology_reviews (
  id uuid PRIMARY KEY, definition_id uuid NOT NULL, version bigint NOT NULL, target_hash text NOT NULL,
  validation_json jsonb NOT NULL CHECK(jsonb_typeof(validation_json)='object'),
  review_refs jsonb NOT NULL CHECK(jsonb_typeof(review_refs)='array'),
  decision text NOT NULL CHECK(decision IN ('VALID','INVALID','CONFIRMED')),
  decided_by uuid NOT NULL REFERENCES anvil.users(id) ON DELETE RESTRICT, decided_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY(definition_id,version,target_hash) REFERENCES anvil.methodology_versions(definition_id,version,content_hash) ON DELETE RESTRICT
);
CREATE TABLE anvil.project_methodologies (
  id uuid PRIMARY KEY, project_id uuid NOT NULL REFERENCES anvil.projects(id) ON DELETE RESTRICT,
  application_version bigint NOT NULL CHECK(application_version>0),
  source_definition_id uuid NOT NULL, source_version bigint NOT NULL, source_hash text NOT NULL,
  snapshot_json jsonb NOT NULL CHECK(jsonb_typeof(snapshot_json)='object'),
  snapshot_hash text NOT NULL CHECK(snapshot_hash ~ '^[0-9a-f]{64}$'),
  created_by uuid NOT NULL REFERENCES anvil.users(id) ON DELETE RESTRICT, created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(project_id,id), UNIQUE(project_id,application_version),
  FOREIGN KEY(source_definition_id,source_version,source_hash) REFERENCES anvil.methodology_versions(definition_id,version,content_hash) ON DELETE RESTRICT
);
-- 초기 읽기 선행. 개정/확정/적용 writer는 범위·현재 제어를 구현하기 전에는 열지 않는다.
REVOKE INSERT,UPDATE,DELETE ON anvil.methodology_definitions,anvil.methodology_versions,anvil.methodology_reviews,anvil.project_methodologies FROM anvil_v3_app;
