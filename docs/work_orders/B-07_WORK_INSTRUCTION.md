# B-07 WorkInstruction — Checkpoint, Artifact Store, and EvidenceManifest

- artifact_id: `WI-B-07-20260815-001`
- revision: `R1 / PLAN_ALIGNED_INITIAL`
- package/status: `B-07 / ACTIVE`
- executor: `developer-primary-b07`
- baseline_git_commit: `1a9c25b7ce2c257d40aaa10fcf3a0478f654db93`
- source_design_sha256: `246D0487789A18AF17C7C9D5CF772442ACA2182339D33D4C989D209BAA3DA9A5`
- source_plan_sha256: `E6ECCB6AD15F81E97A6D2AA663A0C3621BC7B8BB735666F60E2C424CE8763E0D`
- source_matrix_sha256: `289933C795F689AF3AF3E44F48B563580EF1B5D9E266AD5583490EDBCABC3DB5`
- source_test_plan_sha256: `9C288947F6F77AADDF73ED150EC449B71BE7D1981358A71EA211687B6A75D644`
- source_operating_rules_sha256: `4AA7B81629924DC47519353CF396A7FF85BAC8FB50F7A1B63D9F1337E8F6216E`
- developer_agent_definition_sha256: `DBA19287719B527112F1D4A1505D616259D4D013115ACD0CF7B4A647EE93FE77`
- predecessor_b06_acceptance_manifest_sha256: `D81F942EE5BFEEC13E5BE7452CAF544A3D6EDBF4CA5F7D36F495478909502880`
- assigned: `AV-STAT-010`
- predecessors: `B-01~B-06 ACCEPTED`, `A Gate ACCEPTED`, `DIR-1 CLEARED`
- environment: `ENV-LOCAL + ENV-WSL-STAGING isolated Anvil PostgreSQL only when implementation validation requires it`

## 목적과 완료 조건

Foundation 1의 immutable content-addressed Artifact Store, Event sequence에 결박된 Checkpoint, 검증 대상과 실행환경을 함께 고정하는 EvidenceManifest를 구현한다. 대형 log·diff·report·screenshot·package의 본문은 Artifact Store에 저장하고 DB에는 artifact ID, hash, byte size, storage ref와 계보 메타데이터만 둔다. EvidenceManifest는 target hash와 Git·image·migration·config·policy·routing·environment·actor·acquisition mode·raw checksum을 결박하며 다른 target 또는 실행환경의 PASS 재사용을 허용하지 않는다.

## 구현 계약

- 초기 Artifact Store는 설계 D7에 따라 filesystem adapter로 구현하되 adapter port와 domain model을 분리해 운영 object storage 교체 가능성을 유지한다.
- artifact content는 canonical SHA-256과 byte size로 검증하고 immutable하게 저장한다. 동일 content의 재저장은 안전하게 deduplicate하며 동일 ref/hash의 다른 bytes, path traversal, root 이탈, symlink 이탈은 fail-closed 한다.
- DB schema에는 artifact 본문이나 대형 log payload를 넣지 않는다. artifact metadata는 `artifact_id`, type, content hash, byte size, media type, storage ref, project/run/step, actor, created time과 필요한 계보만 가진다.
- Checkpoint는 `checkpoint_id`, run/thread, graph/state schema version, source Event sequence, next nodes, pending writes, state artifact ref/hash, binding hashes, actor와 created time을 보존한다.
- Checkpoint 생성은 이미 저장·검증된 state artifact만 참조하며 source Event sequence 후퇴, artifact hash 불일치, 다른 Run의 artifact 재사용을 거부한다. replay/fork/runtime orchestration은 B-07 범위가 아니다.
- EvidenceManifest model은 설계서 §49.10의 design/work plan/WorkInstruction/Git status·delivered target/container image/DB migration/config/policy/provider routing/environment/toolchain/commands/time/actor/acquisition/raw checksum/skipped·unverified 필드를 검증한다.
- manifest의 target/delivered hash 불일치, raw checksum 중복·누락·self-reference, 잘못된 SHA-256, 빈 actor/environment, 서로 다른 target/environment evidence 결합은 거부한다. Release 연결·HTTP 오류 매핑은 후속 Package 책임이다.
- B-06 Event Store는 read-only predecessor로 소비하며 수정하지 않는다. B-08 progress/HANDOFF atomic outbox/export, B-11 FastAPI route/BFF/UI는 구현하지 않는다.
- migration/constraint 검증은 local isolated PostgreSQL 또는 WSL의 Anvil 전용 격리 DB·container·network만 허용한다. 기존 DB/role/schema/data, ysna/shared-db/production을 변경하지 않는다.
- 제품 API/UI/browser/provider/ysna/shared-db/public production/deployment는 금지하며 미실행을 PASS로 승격하지 않는다.

## Developer exact file-level write allowlist

- `packages/artifacts/__init__.py`
- `packages/artifacts/models.py`
- `packages/artifacts/store.py`
- `packages/artifacts/evidence.py`
- `packages/checkpoints/__init__.py`
- `packages/checkpoints/models.py`
- `packages/checkpoints/service.py`
- `packages/persistence/artifact_checkpoint_repository.py`
- `migrations/versions/0006_checkpoint_artifacts.py`
- `tests/artifacts/test_artifact_store.py`
- `tests/artifacts/test_evidence_manifest.py`
- `tests/checkpoints/test_checkpoint_service.py`
- `docs/validation/B-07_CHECKPOINT_ARTIFACT_VALIDATION.md`
- `docs/evidence/manifests/B-07_EVIDENCE_MANIFEST.json`
- `docs/completion_reports/B-07_COMPLETION_REPORT.md`

그 밖의 authority, progress/HANDOFF, B-01~B-06 산출물, 기존 migration/source/test, dependency/config, 다른 package/app, Git refs/index는 Developer 수정 금지다.

## TDD·검증·보고

1. baseline·authority·B-01~B-06 acceptance, epoch-1 worker/write fencing token과 exact 15-path allowlist를 먼저 검증한다.
2. 대형 content의 DB 유입, hash/size 불일치, path·symlink root 이탈, immutable collision, Checkpoint sequence 후퇴·다른 Run artifact, manifest target/environment/raw checksum/self-reference 위반을 먼저 RED test로 고정한다.
3. 최소 구현 후 artifacts/checkpoints focused tests와 기존 domain/design/planning/persistence/execution/events/tooling 회귀를 실행한다.
4. DB constraint가 포함되므로 가능하면 WSL Anvil 전용 격리 PostgreSQL에서 revision `0006` upgrade/downgrade와 metadata-only·hash/ref·foreign key hostile constraint를 실제 검증한다. 불가능하면 `BLOCKED`/`NOT_EXECUTED`로 기록한다.
5. EvidenceManifest는 exact 15 paths, raw checksum, target hash, self-reference false를 고정한다.
6. CompletionReport에 변경 파일·diff·명령/exit code·실제/미실행 범위·잔여 위험·rollback을 기록한다.
7. 결과는 `COMPLETED | FAILURE_REPORT | INCOMPLETE | BLOCKED | CANCELLED` 중 하나로 보고한다. commit/push와 progress/HANDOFF 수정은 하지 않는다.

B-07 acceptance, B-08 시작, progress/HANDOFF outbox/export, FastAPI/BFF/UI, replay/fork orchestration, provider, ysna/shared-db/production/deploy는 이 WorkInstruction 범위가 아니다.
