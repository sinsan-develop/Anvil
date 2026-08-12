# A-14 WorkInstruction — Clickable Workbench Fixture Prototype

- artifact_id: `WI-A-14-20260812-001`
- package/status: `A-14 / READY`
- executor: `developer-primary-a14`
- baseline_git_commit: `38832955f475746c842c40433566309f989b4b64`
- source_design_sha256: `246D0487789A18AF17C7C9D5CF772442ACA2182339D33D4C989D209BAA3DA9A5`
- source_plan_sha256: `A1032FB587337A914F63A316972402BAC99760A92C7934670EF93979BABA396A`
- source_matrix_sha256: `982B4046A4764D74564E0291A82F0306DB9B06F5D0A3858D49876322FB93F90A`
- source_test_plan_sha256: `803868505616BE655B8D12FC216736DECB55E4812E7673DA242F2637BF7F40F8`
- assigned: `AV-UI-004`, `AV-UI-010`, `AV-GATE-005`
- environment: `ENV-LOCAL`
- result/runtime boundary: `FIXTURE_BROWSER_RUNTIME_ONLY / PRODUCTION_RUNTIME_NOT_EXECUTED`

## 목적

A-13에서 승인된 read-only repository adapter를 서버측에서만 호출하는 fixture 기반 클릭형 Project Workbench prototype을 구현한다. 운영자가 프로젝트 등록/fixture 선택 → 읽기 전용 scan → canonical 9 Provider 중 실행 모드 선택 → 상태·오류·권한·증거·다음 행동 확인을 화면만으로 따라갈 수 있어야 한다.

## 구현 계약

- 1920×1080, 기본 12px 화면 표준과 tooltip/popover 설명 인터페이스를 지킨다.
- 브라우저 코드는 `/api/...` same-origin 상대 경로만 사용한다. 내부 주소, `localhost`, `127.0.0.1`, 컨테이너 호스트/포트, `NEXT_PUBLIC_*` 내부 API 주소를 브라우저 source에 넣지 않는다.
- API boundary는 fixture 전용 로컬 BFF이며 A-13 adapter를 server-side로만 호출한다. 실제 Provider/network, user repository, DB, Git write, 배포를 호출하지 않는다.
- Provider 순서는 CEREBRAS, GROQ, MISTRAL, OPENROUTER, UPSTAGE, GEMINI, ANTHROPIC, OPENAI, OLLAMA로 고정한다.
- normal/loading/empty/error/blocked/quota/cancel/reconnect/permission-denied와 SKIPPED/NOT_EXECUTED를 구분하고 mock/fixture에 실제 PASS badge를 쓰지 않는다.
- mutation route에는 Origin/Host 검증, fixture/project/role allowlist, CSRF token을 적용한다. disabled action은 키보드나 직접 요청으로 우회할 수 없어야 한다. hostile input은 text로 렌더링하며 secret/raw stack/server path/provider raw error를 응답·화면에 노출하지 않는다.
- A-13 accepted code와 G-06 fixture, authority/progress/HANDOFF를 수정하지 않는다.

## Developer exact file-level write allowlist

- `apps/web/index.html`
- `apps/web/server.mjs`
- `apps/web/src/app/workbench.js`
- `apps/web/src/api/workbench-client.js`
- `apps/web/src/features/workbench/workbench-state.js`
- `apps/web/src/styles/workbench.css`
- `apps/web/tests/workbench.test.mjs`
- `tests/browser/a14/workbench-runtime.test.mjs`
- `tests/fixtures/a14/workbench-fixtures.json`
- `tests/fixtures/a14/hostile-inputs.json`
- `scripts/check_a14_workbench_prototype.py`
- `tests/tooling/test_a14_workbench_prototype.py`
- `docs/architecture/a14/A-14_WORKBENCH_PROTOTYPE.md`
- `docs/architecture/a14/A-14_WORKBENCH_CONTRACT.json`
- `docs/validation/A-14_WORKBENCH_PROTOTYPE_VALIDATION.md`
- `docs/evidence/manifests/A-14_EVIDENCE_MANIFEST.json`
- `docs/completion_reports/A-14_COMPLETION_REPORT.md`

기존 `.gitkeep`, root package/dependency/lock/config, `apps/api/**`, `packages/repository_intelligence/**`, Git refs/index, progress/HANDOFF, 관련 없는 파일은 변경 금지다. 새 dependency 설치나 network fetch도 금지다.

## TDD·검증·완료 계약

1. frontend/backend/security/TDD 지침과 권위 문서·lease token을 읽는다.
2. unit/contract/runtime tests를 먼저 작성하고 intended RED를 기록한 뒤 최소 구현으로 GREEN한다.
3. `node --test apps/web/tests/workbench.test.mjs tests/browser/a14/workbench-runtime.test.mjs`와 Python A-14 checker/tests, 전체 tooling 회귀, browser click/network 캡처를 실행한다.
4. browser Network의 API 요청은 same-origin `/api/...`만 허용하고 직접 내부주소 0건을 증명한다. 실제 브라우저를 실행할 수 없으면 PASS로 올리지 말고 `BLOCKED` 또는 `NOT_EXECUTED`로 기록한다.
5. EvidenceManifest는 exact paths/raw checksums/target hash/self-reference false를 고정한다. 완료보고에는 정확한 명령·exit code·변경 파일·미실행·회귀·rollback을 기록한다.
6. Developer는 commit/push와 progress/HANDOFF 수정을 하지 않는다. 결과는 `COMPLETED | FAILURE_REPORT | INCOMPLETE | BLOCKED | CANCELLED` 중 하나로 보고한다.

A-14 완료만으로 DIR에 도달하지 않는다. A-15 acceptance 후에만 DIR-1을 강제한다.