# G-03 WorkInstruction — 저장소·디렉터리·의존 방향 scaffold

- work_instruction_id: `WI-G-03-20260810-004`
- revision: `4`
- supersedes_work_instruction_id: `WI-G-03-20260810-003`
- supersedes_work_instruction_sha256: `5CB06696378B7F3BC313FA28F849C5534E11835D6EDA5402B4E0296680D84820`
- package_id: `G-03`
- owner: `Main Agent 어울`
- executor: `developer-primary Subagent`
- design_baseline_id: `BASELINE-G-02-DERIVED-20260810-001`
- design_baseline_sha256: `E11EAB020485395FE68049EF8F335D65A25F93AB65837901204554E570E8916B`
- plan_revision: `v1.4`
- plan_sha256: `4DB8F5F5F85703CB4E1093550F6C8268D8666A50D2E84FDD70FC355014CF7475`
- validation_ids: `AV-SAFE-010`, `AV-CON-002`
- validation_method: `AN + E-GIT + E-DIFF`
- status: `REWORK_ACTIVE`

## Revision 4 사유와 실패 계보

- 독립 TestReport: `docs/test_reports/G-03_TEST_REPORT.md`
- TestReport SHA-256: `91BCFC383C8D4970355F7A3366924181096F0AB92691AB94E36EB26C3FF1107E`
- 유효 실패 횟수: 각 finding 최초 `1회`
- 차단 finding: `G03-DEF-001`, `G03-DEF-002`, `G03-DEF-003`, `G03-DEF-004`
- 본 revision은 기능 범위·요구사항·중요 위험을 변경하지 않는다. 승인된 §25.3 골격과 기존 의존 경계 계약을 정확히 충족하기 위한 비의미 정합성 수정이다.
- revision 2 독립 TestReport: `docs/test_reports/G-03_TEST_REPORT_R2.md`
- revision 2 TestReport SHA-256: `AE84877A644C9FDF2420318B52B716475235C97ED036DD0833A47AC7362016D1`
- 기존 `G03-DEF-001`~`004`의 원래 증상은 닫혔다. 새 차단 finding `G03-DEF-005`는 최초 1회이며, 동일 실패 3회 규칙의 Main Agent 인수 대상이 아니다.
- `G03-DEF-005`: `packages/domain/model.py`의 유효한 `from ..domain import events`를 checker가 domain 이탈로 오탐한다.
- revision 3 독립 TestReport: `docs/test_reports/G-03_TEST_REPORT_R3.md`
- revision 3 TestReport SHA-256: `F3EE86CD7636CF49A5F8BE510E60D310A558F1528F03CD5D0E60A75486CC20AD`
- `G03-DEF-005`와 기존 `001`~`004`의 지정 증상은 닫혔다. 새 차단 finding `G03-DEF-006`은 최초 1회다.
- `G03-DEF-006`: `from ....domain` 및 nested `from .....domain`처럼 패키지 루트를 초과하는 상대 import가 음수 slice로 `packages.domain`에 재진입한 것처럼 오인되어 허용된다. 실제 Python import는 `ImportError`다.

## 목표

제품 기능 구현 전에 Anvil 루트 저장소, 기본 브랜치, 디렉터리와 `apps → packages → domain` 단방향 의존 규칙을 재현 가능한 scaffold로 고정한다. 기존 문서·Backup·검토 artifact는 변경하거나 삭제하지 않는다.

## 선행조건

1. G-01·G-02가 `ACCEPTED`다.
2. 루트는 Git 미초기화 상태이며 기존 모든 파일은 보호 대상이다.
3. Developer는 본 WorkInstruction에 한해서만 write 가능하며 Main Agent는 Developer write 종료 전 동일 파일을 수정하지 않는다.

## 포함 범위

- 작업 시작 시 기존 파일 path·SHA-256·bytes를 `docs/baselines/G-03_PRE_SCAFFOLD_INVENTORY.json`에 기록
- `.gitignore`, `.gitattributes`, `.editorconfig`, `.env.example`, root `README.md`
- root `pyproject.toml`, `package.json`의 의존성 없는 workspace/tooling 최소 계약
- 설계서 §25.3의 `apps/web`, `apps/api`, `apps/worker`, `packages/*`, `migrations`, `deploy/local|wsl|production`, `data` 디렉터리 scaffold
- 설계서 §25.3의 누락 경로 `apps/api/anvil_api/main.py`, `apps/worker/anvil_worker/main.py`, `docs/architecture/`, `docker-compose.local.yml`을 실행 기능 없는 scaffold로 추가
- `DECISIONS.md`, `CODEX_WORK_LOG.md`
- 표준 라이브러리만 사용하는 의존 방향 검사기와 test-first 검증
- `git init -b main`; commit·remote·push는 Main Agent 최종 합격 뒤 별도 수행
- EvidenceManifest, CompletionReport, progress/HANDOFF 갱신

## TDD 계약

1. 먼저 `tests/tooling/test_dependency_boundaries.py`를 작성한다.
2. checker가 없는 상태에서 테스트가 예상 이유로 실패한 RED 증거를 남긴다.
3. `scripts/check_dependency_boundaries.py`를 최소 구현해 GREEN을 만든다.
4. 허용 경로, `packages → apps` 금지, `domain → packages/apps/외부 framework·ORM·LLM·Docker SDK` 금지를 실제 임시 fixture로 검증한다.
5. 테스트는 `unittest`, `ast`, `pathlib` 등 Python 표준 라이브러리만 사용한다.
6. revision 2에서는 먼저 canonical 9개 Provider SDK import와 domain 밖 상대 import 우회 테스트를 추가하고, 기존 checker에서 예상대로 실패하는 RED를 CompletionReport에 남긴 뒤 checker를 수정한다.
7. revision 3에서는 `from ..domain import events`가 실제 Python import 해석상 `packages.domain` 내부로 재진입함을 검증하는 테스트를 먼저 추가해 기존 checker의 RED를 관찰한다. 그 뒤 `node.level`뿐 아니라 `node.module`까지 합친 resolved target을 계산하도록 최소 수정하고 GREEN을 기록한다.
8. revision 4에서는 root를 초과하는 상대 import fixture를 먼저 추가해 기존 checker의 RED를 관찰한다. `level - 1`로 계산한 상승 단계가 현재 package depth 이상이면 slicing 전에 즉시 거부하는 최소 guard를 추가하고 GREEN을 기록한다.

## 의존 방향 계약

- `apps/*`는 `packages/*`와 domain을 사용할 수 있다.
- `packages/*`는 domain을 사용할 수 있지만 `apps/*`를 import할 수 없다.
- `packages/domain`은 다른 packages, apps, FastAPI, Pydantic, SQLAlchemy, Alembic, psycopg, LLM provider SDK, Docker SDK를 import할 수 없다.
- `packages/domain`의 절대 import 허용 목록은 Python 표준 라이브러리와 `packages.domain` 내부로 한정한다. 목록에 없는 모든 third-party root는 기본 거부한다.
- `packages/domain`의 상대 import는 실제 해석 대상이 `packages/domain` 내부에 머무를 때만 허용한다. `from ..policy import rules`, `from .. import policy`처럼 domain 밖으로 나가는 상대 import는 차단한다.
- `from ..domain import events`처럼 상위로 이동한 뒤 `domain` 모듈을 명시해 최종 resolved target이 다시 `packages.domain` 내부가 되는 상대 import는 허용한다. 단순 `level`만으로 허용·차단하지 않는다.
- 상대 import의 상승 단계가 현재 module package depth 이상이면 beyond-top-level로 거부한다. 음수 slice 결과를 유효 target으로 해석해서는 안 된다.
- canonical Provider SDK 차단 회귀에는 최소 `cerebras`, `groq`, `mistralai`, `openrouter`, `upstage`, `google`, `anthropic`, `openai`, `ollama` root를 모두 포함한다. 이 목록은 기본 거부 정책의 회귀 표본이며 allowlist 예외가 아니다.
- checker는 위반 파일·행·import를 보고하고 0이 아닌 exit code를 반환한다.
- scaffold 자체에 금지 의존을 넣지 않는다.

## 허용 파일·경로

- `.git/**` (`git init`으로 생성되는 metadata만)
- `.gitignore`, `.gitattributes`, `.editorconfig`, `.env.example`, `README.md`
- `docker-compose.local.yml` — `name`과 빈 `services: {}` 및 설명 주석만 허용하며 service/image/port/volume/network/secret/runtime 설정은 금지
- `pyproject.toml`, `package.json`, `DECISIONS.md`, `CODEX_WORK_LOG.md`
- `apps/**`, `packages/**`, `migrations/**`, `deploy/**`, `data/.gitkeep`
- `docs/architecture/README.md` — 향후 구조 문서 예약 목적과 G-03 구현 0 경계만 기록
- `scripts/check_dependency_boundaries.py`
- `tests/tooling/test_dependency_boundaries.py`
- `docs/baselines/G-03_PRE_SCAFFOLD_INVENTORY.json`
- `docs/evidence/manifests/G-03_EVIDENCE_MANIFEST.json`
- `docs/completion_reports/G-03_COMPLETION_REPORT.md`
- `docs/progress/build-progress.json`, `docs/progress/BUILD_HANDOFF.md`
- 독립 Tester 전용 `docs/test_reports/G-03_TEST_REPORT.md`
- 독립 Tester revision 2 전용 `docs/test_reports/G-03_TEST_REPORT_R2.md`
- 독립 Tester revision 3 전용 `docs/test_reports/G-03_TEST_REPORT_R3.md`
- 독립 Tester revision 4 전용 `docs/test_reports/G-03_TEST_REPORT_R4.md`
- 본 WorkInstruction과 짝 InvocationPrompt는 읽기 전용

## Revision 2 제한적 정리 권한

- Developer는 G-03 실행에서 생성된 아래 bytecode 두 개만 삭제할 수 있다.
  - `scripts/__pycache__/check_dependency_boundaries.cpython-313.pyc`
  - `tests/tooling/__pycache__/test_dependency_boundaries.cpython-313.pyc`
- 다른 파일·디렉터리의 삭제·이동은 금지한다.
- 이후 Python 검증은 `PYTHONDONTWRITEBYTECODE=1`을 사용하고, `py_compile`이 필요하면 `PYTHONPYCACHEPREFIX`를 workspace 밖 임시 디렉터리로 지정한다.
- inventory top-level 총계는 entry `file_count` 합계와 동일한 `3448`로 정정한다. 기존 entry별 path·bytes·SHA-256과 보호 tree digest는 변경하지 않는다.
- 수정된 delivery tree에 맞춰 inventory, EvidenceManifest, CompletionReport, progress/HANDOFF와 canonical target을 revision 2로 재생성한다. 최초 실패 TestReport는 수정하지 않는다.

## 금지·보호 범위

- `Backup/**`, `.anvil_review/**`, `.codex_qa/**`, `.tmp_subagent_review/**` 수정·삭제·이동
- 기존 설계·계획·검증·운영·승인·기준선·결정·이전 보고서 수정
- 제품 기능, API, UI, DB schema, migration, Docker service 구현
- dependency 설치, lockfile 생성, 외부 network, WSL/server/DB 접속
- secret 또는 실제 credential 기록
- commit, remote 추가, push, tag, 배포

## 완료조건

1. pre-scaffold inventory에 기록된 기존 파일이 100% 존재하고 hash·bytes 변경 0건이다. 단, 본 WorkInstruction이 허용한 progress/HANDOFF는 변경 전 hash를 별도 기록한다.
2. Git 기본 브랜치는 `main`, remote는 0개, commit은 0개다.
3. 설계서 §25.3의 scaffold 경로가 생성되고 각 계층 책임이 README 또는 root 문서에서 설명된다.
   - root 제외 명시 경로 `53/53`을 기계 대조한다.
4. TDD RED와 GREEN 명령·exit code·실제 출력이 CompletionReport에 있다.
5. 실제 scaffold 검사와 위반 fixture 검사가 통과한다.
6. `apps → packages → domain` 규칙과 금지 의존이 기계 검사로 재현된다.
7. EvidenceManifest의 target/delivered hash가 일치한다.
8. 독립 Tester PASS 전에는 `ACCEPTED`, commit, G-04 시작을 금지한다.
9. revision 2의 RED는 새 우회 테스트가 기존 checker에서 실패한 증거여야 하며, GREEN은 canonical Provider 9종, domain 밖 상대 import, 임의 third-party root, 허용 표준 라이브러리, domain 내부 절대·상대 import를 모두 검증한다.
10. 허용 밖 bytecode 두 개는 없어야 하며 보호 inventory 전체와 Git `main`·remote 0·commit 0·tracked/staged 0 계약을 유지한다.
11. revision 3 GREEN은 최소한 `from ..domain import events` 허용, `from ..policy import rules` 차단, `from .. import policy` 차단을 함께 검증해 오탐 수정이 기존 차단을 약화하지 않았음을 입증한다.
12. revision 4 GREEN은 root-level module과 nested module 모두에서 beyond-top-level 상대 import를 거부하고, 합법적인 nested `packages.domain` 재진입은 허용함을 함께 입증한다.

## 보고 계약

Developer는 `판정 → 판단 이유 → 조치` 형식으로 보고한다. 제품 테스트가 없음을 숨기지 않고, 실행한 tooling test와 구조 검사 범위만 PASS로 표시한다.
