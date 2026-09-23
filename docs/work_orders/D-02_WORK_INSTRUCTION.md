# D-02 WorkInstruction — Session/Task/Run immutable LearningSnapshot

## 1. 식별·권위

- Work Package: `D-02`
- 선행: `D-01 ACCEPTED`
- 기준 문서: `Anvil_설계서_v2.md` 36.4~36.4.1, 47.12, 48~49장
- 작업계획: `Anvil_작업계획서_v1.md` D-02
- 검증 ID: `AV-LRN-002`, `AV-LRN-003`
- 구현자: `developer-primary-d02-r1`

## 2. 목표

세션 공통 SOUL/USER/MEMORY·project instruction·Skill catalog source를 immutable
`SessionMemorySnapshot`으로 고정하고, 같은 Session이어도 모든 새 Task/Run에 별도
`TaskLearningSnapshot`을 생성한다. 생성 뒤 승인·학습·catalog 변화는 실행 중 snapshot에 조용히 섞지 않고
다음 Task/Run부터만 반영하며, resume는 원래 snapshot hash를 유지한다.

## 3. product exact write scope

- `packages/knowledge/__init__.py`
- `packages/knowledge/snapshots.py`
- `packages/api/learning_snapshots.py`
- `tests/knowledge/test_snapshots_d02.py`
- `tests/api/test_learning_snapshots_d02.py`
- `docs/04_test_reports/D-02_COMPLETION_REPORT.md`

위 6개 경로만 제품 writer가 수정한다. Main 소유 progress/HANDOFF/events/checker/tooling과 D-01 memory 구현은
수정하지 않는다.

## 4. 필수 계약

1. Session snapshot은 session ID, SOUL/USER/MEMORY source version/hash, project instruction versions,
   Skill catalog metadata version/hash, source hashes, created_at, content hash를 가진 immutable projection이다.
2. 같은 session의 새 Task 또는 새 Run도 각각 새 `TaskLearningSnapshot` ID/hash를 만든다. task_id/run_id,
   session snapshot hash, source entry/version/hash, activation ID/actor/activated_at, instruction version을 고정한다.
3. 입력 순서와 mutable input/output alias가 정본 hash를 바꾸지 않는다. 같은 snapshot을 조회·resume할 때 항상
   원래 byte-equivalent projection/hash를 반환한다.
4. snapshot 생성 이후 catalog에 새 승인 학습을 추가해도 기존 Task/Run snapshot은 바뀌지 않는다. 새 항목은
   activation 시각 이후 생성되는 다음 Task/Run snapshot부터만 포함한다.
5. `PENDING`, 미승인, activation 미래, `REVOKED`, `QUARANTINED`, source revoked/quarantined 항목은 신규
   snapshot에 포함하지 않는다. 차단 항목을 조용히 제외하지 말고 구조화 reason/evidence를 반환한다.
6. 동일 task_id/run_id의 resume는 기존 snapshot을 재사용한다. 다른 current catalog로 snapshot을 갈아끼우거나
   다른 hash를 제시하면 `LEARNING_SNAPSHOT_MISMATCH`로 거부한다.
7. 같은 Task를 새 학습으로 다시 계획하는 것은 새 task revision ID와 명시적 host authorization이 있을 때만 새
   snapshot을 만든다. payload가 authorization을 자가 부여할 수 없다.
8. source record는 stable ID, kind(MEMORY/SKILL/HOOK/PROMPT/CODE_PATTERN), version, content hash,
   scope/user/project, status, source status, activation metadata를 가진다. secret-like·잘못된 enum/scope/hash/time,
   중복 identity/version/hash 충돌은 fail-closed다.
9. in-memory service는 create-session, get-session, create-task-run, get/resume-task-run projection을 제공한다.
   request replay는 repository+scope 단위로 직렬화하며 실패 요청은 receipt를 소모하지 않는다.
10. 긴급 safety Hook revision, 실제 승인 workflow, LearningSource scanner/revocation impact 전파, DB/HTTP/파일
    persistence는 각각 후속 D-03/D-06 범위다. D-02는 host가 전달한 activation/source 상태를 검증한다.

## 5. TDD·적대 검증

- 같은 Session의 Task A/B와 Run A/B가 서로 다른 snapshot을 받고 source cutoff가 정확히 반영됨
- snapshot 생성 뒤 input/catalog/반환 projection 강제 mutation에도 기존 hash·내용 불변
- pending/future/revoked/quarantined source의 신규 snapshot 차단과 값 비노출 오류
- 같은 task/run resume 동일 hash, 교체 hash·catalog 주입·다른 scope 거부
- source order 결정성, duplicate/version/hash conflict, naive time, invalid scope/status/hash, secret-like 거부
- 동시 create/replay에서 하나의 정본만 생성되고 conflicting request는 fail-closed
- API payload가 activation actor·revision authorization·scope capability를 자가 부여하지 못함

## 6. 검증·보고

- focused tests: 위 두 D-02 test 파일
- 관련 `tests/knowledge tests/api` 회귀
- `python -B -m compileall -q packages/knowledge packages/api tests/knowledge tests/api`
- `git diff --check`
- 완료보고에는 정확한 명령·exit·변경 파일·미검증·rollback을 기록한다.
- 실제 DB/HTTP/browser/Provider/network/WSL/Docker/deployment를 실행하거나 PASS로 표시하지 않는다.

## 7. 완료 후

Developer는 `COMPLETED | FAILURE_REPORT | INCOMPLETE | BLOCKED | CANCELLED`로 보고한다.
Main 독립 검토 전 D-02는 ACCEPTED가 아니며 D-03을 시작하지 않는다.
