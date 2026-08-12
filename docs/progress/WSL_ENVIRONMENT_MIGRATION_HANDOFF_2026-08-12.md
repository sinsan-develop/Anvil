# Anvil WSL 작업환경 전환 인계

- 작성일: `2026-08-12` (Asia/Seoul)
- 목적: Windows Codex 작업환경을 WSL 기반 작업환경으로 전환한 뒤, 기존 검증 경계와 진행 상태를 훼손하지 않고 재개하기 위한 인계 기록
- 이 문서는 환경 전환 기록이다. A-14 acceptance 또는 A-15 시작 승인이 아니다.

## 1. 현재 Git 기준선

- Windows 저장소: `C:\Users\cyhuh\Desktop\D Driver\Project\Anvil`
- branch: `main`
- `HEAD`: `4d6b813af82047df40d1487ac011f6a542513713`
- `origin/main`: `4d6b813af82047df40d1487ac011f6a542513713`
- remote: `https://github.com/cyhuh7950/anvil.git`
- 작업트리: clean (`git status --short` 출력 없음)
- 최신 commit: `4d6b813 feat(a14): add secure fixture workbench prototype`
- 실행 중 Agent: 없음

WSL에서는 가능하면 `/mnt/c/...`의 Windows checkout을 그대로 사용하지 말고 WSL native filesystem에 새로 clone한다. Windows NTFS ACL·mtime·line-ending 영향을 분리하기 위한 권고이며, 임의로 기존 Windows checkout을 이동하거나 삭제하지 않는다.

## 2. canonical 진행 상태

- `docs/progress/build-progress.json` sequence: `161`
- current package: `A-14`
- status: `TEST_REVIEW`
- active agent: `null`
- worker lease: `null`
- write lease: `null`
- A-14 accepted: `false`
- independent Tester field: `R2_PENDING`
- A-15: `BLOCKED_PENDING_A14_ACCEPTANCE`
- DIR: `NOT_REACHED`

주의: R2 독립 Tester 보고서는 이미 존재하지만 progress/HANDOFF의 `R2_PENDING` 및 `next_safe_action`은 아직 그 결과를 반영하지 않았다. WSL 재개 시 이 불일치를 먼저 `RECONCILE_REQUIRED` 대상으로 확인한다. 과거 Event를 소급 수정하지 말고, Main이 canonical 후속 Event/projection으로 처리해야 한다.

## 3. A-14 구현·검증 결과

### 통과한 범위

- A-14 Node runtime/unit: `6/6 PASS`
- A-13+A-14 targeted Python: `26/26 PASS`
- full tooling: `268/268 PASS`
- A-14 checker: `PASS`, exact product paths `17`, self-reference `false`
- A-13 checker: fixtures `8`, zero-delta `8`, hostile `15`
- project progress, G-06, G-07, Phase G checker: `PASS`
- fixture/A-13 protected paths: no-write 검증 `PASS`
- `BLK-A14-002` clean-checkout successor evidence mismatch: `CLOSED`

### 핵심 증거

- Developer R2 manifest: `docs/evidence/manifests/A-14_EVIDENCE_MANIFEST_R2.json`
  - SHA-256: `67AD9BD4AC3203900B97074B233DA751DC4FD75F7C772F955CA00BB2665EE58D`
- Main R2 completion manifest: `docs/evidence/manifests/A-14_COMPLETION_PROGRESS_MANIFEST_R2.json`
  - SHA-256: `978F63CD470F92288214A4E1CC42E5BA04E94DDB504C6E206047257AE16CDFDC`
  - target: `sha256:EDB80314FB96B215BBD59CB29E15CB0BEEEDCBBD28E37BBAA55367E3152A93A9`
- Independent Tester R2 report: `docs/test_reports/A-14_RETEST_REPORT_R2.md`
  - SHA-256: `7463DD68DDB3F5B1EF19094B58A671936B973FE9C0CE4BDC0C67A09AAFC49D74`
  - verdict: `BLOCKED / NOT_READY_FOR_MAIN_ACCEPTANCE`

## 4. 열린 차단: BLK-A14-001

현재 유일한 acceptance blocker는 Anvil 제품 오류가 아니라 Windows Codex in-app browser bootstrap 환경 오류다.

```text
windows sandbox failed: helper_unknown_error: apply deny-read ACLs
```

- 페이지 navigation 전에 browser-control kernel이 종료됨
- Windows에서 Main·Developer·Independent Tester가 반복 재현
- Codex 설정의 sandbox를 `전체 액세스`로 변경한 뒤 현재 작업에서 다시 시도했으나 동일 오류 재현
- 마지막 재시도 kernel PID: `36920`, exit code `1`
- 일반 shell은 ACL 적용 실패 뒤 승인된 비샌드박스 실행으로 계속된 사례가 있었지만, in-app browser에는 같은 fallback이 없어 치명적 차단이 됨
- WSL 전환이 이 오류를 해결한다고 아직 확인하지 않았다. WSL에서 반드시 새로 재현 여부를 판정한다.

따라서 아래 실제 증거는 계속 `NOT_EXECUTED`다.

- 1920×1080 실제 browser click flow
- screenshot 및 상태별 UI 판정
- browser console/storage/source 검사
- 전체 Network URL/method/status 캡처
- `AV-UI-004` L7, `AV-UI-010` E-NET, `AV-GATE-005` E-SHOT 최종 판정

다른 브라우저나 standalone HTTP 검사 결과를 위 항목의 PASS로 대체하지 않는다.

## 5. WSL 재개 절차

1. WSL native filesystem에 저장소를 clone하고 `main`을 checkout한다.
2. `HEAD`와 `origin/main`이 이 인계 기준 `4d6b813af82047df40d1487ac011f6a542513713`인지 확인한다. 다르면 최신 canonical progress와 commit lineage를 먼저 재검토한다.
3. `git status --short`가 비어 있는지 확인한다.
4. 다음 순서로 권위 문서를 읽는다: `AGENTS.md` → 설계서 → 작업계획서 → 검증매트릭스 → 테스트계획서 → 운영규칙 → progress → BUILD_HANDOFF → A-14 R2 WorkInstruction/Tester report.
5. `build-progress.json`의 seq161, lease null, A-14 TEST_REVIEW와 Tester R2 report 존재 간 불일치를 먼저 reconciliation한다.
6. Python/Node 버전과 line-ending 설정을 기록한다. 기존 evidence hash를 맞추기 위해 임의로 `core.autocrlf`, 파일 내용 또는 manifest를 변경하지 않는다.
7. 아래 회귀 검증을 fresh 실행한다.

```bash
python -m unittest discover -s tests/tooling -p 'test_*.py' -v
node --test apps/web/tests/workbench.test.mjs tests/browser/a14/workbench-runtime.test.mjs
python scripts/check_a14_workbench_prototype.py --root .
python scripts/check_project_progress.py --root .
python scripts/check_g07_baseline.py --root .
python scripts/check_phase_g_gate.py --root .
git diff --check
```

8. in-app browser 연결 자체를 먼저 시험한다. 연결이 성공할 때만 A-14 fixture Workbench 서버를 기동해 실제 클릭·Network·screenshot 검증을 수행한다.
9. 브라우저 검증 PASS와 독립 Tester 판정이 확보되기 전에는 A-14를 accept하거나 A-15를 시작하지 않는다.
10. A-15가 최종 완료되면 `DIR-1`이므로 Gate 진행 전에 반드시 신산님께 보고하고 정지한다.

## 6. WSL에서도 유지할 비범위

아래 항목은 현재까지 실행하지 않았고 환경 전환만으로 PASS가 되지 않는다.

- production API/DB/SSE
- 실제 Provider/Secret/Egress
- 실제 사용자 repository
- ysna production 배포
- 실제 운영 Docker 검증
- DIR 판정

## 7. 금지 사항

- Windows checkout 삭제·reset·ACL 전체 초기화 금지
- accepted A-01~A-13 evidence와 authority 문서 수정 금지
- evidence hash 불일치를 맞추기 위한 line-ending 강제 재작성 금지
- A-14 browser 증거 없이 fixture/static 결과를 실제 PASS로 승격 금지
- A-14 Main acceptance 전 A-15 lease·구현 시작 금지
- 진행 상태 불일치를 과거 Event 수정으로 덮어쓰기 금지

## 8. 첫 재개 판정 형식

WSL 첫 검증 결과는 다음 형식으로 기록한다.

```text
판정 -> 판단 이유 -> 조치

판정: RESUME_READY | RECONCILE_REQUIRED | ENVIRONMENT_BLOCKED
판단 이유: HEAD/status/hash/test/browser bootstrap의 실제 결과
조치: A-14 browser retest 또는 progress reconciliation. A-15는 계속 차단
```
