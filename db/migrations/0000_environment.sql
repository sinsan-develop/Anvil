CREATE TABLE anvil.schema_migrations (
  id text PRIMARY KEY,
  checksum text NOT NULL CHECK (checksum ~ '^[0-9a-f]{64}$'),
  applied_at timestamptz NOT NULL DEFAULT now()
);

-- P03 시험 자료이며 제품 사용자/프로젝트 저장소가 아니다.
CREATE TABLE anvil_qa.fixtures (
  name text PRIMARY KEY,
  payload jsonb NOT NULL
);
