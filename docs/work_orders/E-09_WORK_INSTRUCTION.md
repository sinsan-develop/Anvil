# WI-E-09-R1-20260917-001

## 목적

승인된 E-09 범위에서 G4 Integration, G5 production Build, G6 Functional/API·UI contract projection, G7 Regression과 ProductValidation·Defect·ReleaseDecision Gate를 하나의 검증 대상 hash에 결박한다.

## 기준선과 선행조건

- branch: `codex/c09-execution-backends-r1`
- dispatch/base HEAD: `593311d87de760bdc6bb5485b89a17014e81976a`
- canonical progress: E-08 `ACCEPTED`, sequence 1147, E-09 `READY_FOR_WORK_INSTRUCTION`
- 권위: 설계서 §32.5~32.8, §49.1~49.2, §49.10; 작업계획서 E-09; 테스트계획서; 통합검증매트릭스 E-09 역색인

## 제품 write scope exact5

1. `packages/verification/__init__.py`
2. `packages/verification/gates.py`
3. `packages/verification/release_gates.py`
4. `tests/verification/test_gates_e09.py`
5. `docs/04_test_reports/E-09_COMPLETION_REPORT.md`

위 5개 이외 제품·schema·migration·API route·UI·배포 파일을 수정하지 않는다. Main 소유 progress/event/HANDOFF/checker/tooling/WI/prompt/evidence 파일은 수정하지 않는다.

## 구현 계약

### G4 Integration

- 변경 영향 선언에 따라 API(OpenAPI diff+route), DB(migration up/down 또는 승인 rollback), Browser(BFF route+Network URL), Module(caller test+import), External(sandbox/mock와 허용된 실제 환경 분리) adapter를 선택한다.
- 영향 있는 adapter 누락, runner/환경 부재, 단순 signature AST만 있는 증거는 `BLOCKED` 또는 `FAIL`이며 PASS가 아니다.
- adapter evidence는 target hash·환경·acquisition mode·명령/관측·evidence ref를 보존한다.

### G5 Build

- production configuration build만 PASS 후보이며 dev server start는 대체하지 못한다.
- build artifact hash와 dependency snapshot hash를 동일 target에 결박한다.
- 도구/서비스/환경 부재는 `BLOCKED`; 실행하지 않은 build를 PASS로 만들지 않는다.

### G6 Functional/API·UI contract projection

- 각 scenario는 사전조건, 행동/API 입력, 기대, 실제, 증거, 판정의 6필드를 모두 가진다.
- UI 관련 PASS는 실제 클릭·same-origin BFF/Network·저장/API 결과·최종 화면 상태의 real evidence를 모두 요구한다.
- E-09는 실제 메뉴 UI 구현이 아니라 contract projection을 소유한다. 브라우저·계정·서비스가 없으면 `BLOCKED/SKIPPED`로 남기며 fixture/mock/static을 실제 기능 PASS로 승격하지 않는다.

### G7 Regression

- Impact Map 관련 기능, 핵심 smoke set, 공통 helper 소비자, 인증·설정·라우팅 공유 경계 4종을 모두 선택·기록한다.
- 전체 테스트를 실행하지 않았으면 executed scope와 unverified scope를 명시한다. 빈 미검증 범위로 위조하지 않는다.

### EvidenceManifest·ProductValidation·Defect·ReleaseDecision

- G0~G7 결과와 design/work plan/work instruction, Git commit, delivered hash, image digest, DB migration head, config/policy/provider routing snapshot, environment/toolchain/actor/acquisition/raw checksums/skipped/unverified를 하나의 release subject에 결박한다.
- 어느 target/delivered/commit/image/migration/config/policy/routing hash가 달라도 `EVIDENCE_TARGET_MISMATCH`로 차단한다.
- 필수 Gate가 PASS가 아니거나 실제 DB/service/browser/account 등 required boundary가 없으면 release-ready가 아니다.
- ProductValidation은 criterion별 target/delivered/environment/procedure/expected/observed/evidence/verdict/actor/time을 요구한다. `BLOCKED`, `UNSUITABLE`, 미판정, target mismatch는 Release 차단이다.
- 자동 테스트 전부 PASS여도 ProductValidation 미충족은 자동 승인하지 않는다.
- blocking CRITICAL/MAJOR defect가 열려 있으면 Release/Apply/Deploy를 차단한다. Developer 보고만으로 CLOSED 금지, 동일 target 독립 retest evidence를 요구한다.
- `RELEASE | REWORK | DEFER | REJECT` 최종 결정은 인증된 HUMAN actor만 가능하다. Agent/Tester는 proposal만 생성한다.
- ReleaseDecision과 ProductValidation을 다른 target/delivered hash에 재사용하면 `RELEASE_SUBJECT_HASH_MISMATCH`로 거부한다.
- E-09는 외부 Apply/Deploy를 실행하지 않는다. 승인 receipt/admission contract만 검증한다.

## TDD·검증

- RED를 먼저 고정하고 최소 구현 후 GREEN.
- E-09 focused, 기존 `tests/verification/test_gates_c14.py`, 관련 verification/orchestration 회귀, builtin compile, `git diff --check`, canonical progress checker를 실행한다.
- hostile callback/alias/replay/target swap/manifest forgery/actor forgery/fixture-to-real 승격/환경 부재/부분 scenario/전체 회귀 미실행을 적대적으로 검증한다.
- PostgreSQL/browser/Docker/account/Provider가 실제로 없으면 PASS가 아닌 정확한 SKIP/BLOCKED와 미검증 범위로 보고한다.

## 완료보고

- 기준 HEAD/branch/status, exact5 diff/hash
- RED→GREEN과 정확한 명령/exit/result
- validation ID 전량: AV-GATE-004, 016~019, 023~025; AV-STAT-023; AV-UI-013~014; AV-FLOW-014~015, 024~025
- 실제/fixture/mock/static 경계와 미검증 범위
- 기존 기능 유지, 잔여 위험, rollback
- stage/commit/push는 Main만 수행

