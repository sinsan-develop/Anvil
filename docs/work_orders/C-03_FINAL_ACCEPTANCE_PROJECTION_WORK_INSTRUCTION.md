# C-03 Final Acceptance Projection WorkInstruction

## 권위와 범위

- Work Package: `C-03`
- Authority ID: `WI-C-03-FINAL-ACCEPTANCE-PROJECTION-20260912-001`
- Parent human approval: `APPROVAL-20260814-WORKPLAN-V16-001`
- Active product WorkInstruction: `WI-C-03-DEVELOPER-LIFECYCLE-R2-20260912-001`
- Product commit: `219eedd7adf287c55818eab930d6a665a2fc0980`
- R2 control commit: `e778a0c0d4152a7e164e2f016994595dee4b7274`
- Start control commit: `2dcd4da89e92425be52b570ae2110f60dfcc29de`
- Development main base: `1c3948ff1a741832a2f012f464f1a301490356c1`
- Acceptance binding: `AV-AGT-004` / `L3` / `AI` / `E-GIT,E-ART`

## 목표

검토가 끝난 immutable product exact4와 Main·독립 검증 증거를 append-only canonical projection으로 결박한다. worker/write lease를 종료하고 C-03을 `ACCEPTED`, C-04를 `READY_FOR_WORK_INSTRUCTION`으로 전환한다.

## 허용 경로

현재 manifest의 exact15 governance 경로만 수정한다. `packages/**`, `tests/orchestration/**`, `tests/e2e/**` 제품·제품 테스트 파일은 수정하지 않는다.

## 필수 증거

1. 제품 exact4와 product/control/start/base의 direct ancestor chain 및 각 commit을 결박한다.
2. Main postcommit full `tests/orchestration tests/e2e` 241 PASS와 focused C-03+C-04 78 PASS를 실제 명령 문자열과 함께 기록한다.
3. 독립 acceptance 23 nodes/66 cases PASS, external IO 0을 기록한다.
4. R2 control review PASS C0/I0/M0, product initial I4/M1, round1 addressed, round2 두 신규 finding addressed 및 최종 C0/I0/M0를 손실 없이 보존한다.
5. actual external Developer backend, Provider, Telegram, Secret, DB, API, browser, WSL, deploy, network는 `NOT_EXECUTED`로 유지한다.
6. seq1~743 raw event object bytes와 historical evidence blob을 변경하지 않고 canonical event 다섯 개만 append한다.
7. final state는 C-03 `ACCEPTED`, C-04 `READY_FOR_WORK_INSTRUCTION`, DIR-2 `NOT_REACHED`, active worker/write lease null, next `ISSUE_C04_WORK_INSTRUCTION`이다.
8. Git predicate는 product HEAD exact15 staged, exact branch sole direct-child, ordered two-parent reviewed merge `[development/main base, completion]` with identical tree, detached merged development/main만 fail-closed로 허용한다.

## 금지와 rollback

- 제품 코드, 외부 시스템, C-04 구현, full monolithic tooling, commit, push, PR, merge 실행 금지
- fixture/mock/test PASS를 외부 운영 PASS로 승격 금지
- rollback: commit 전 exact15 stage를 해제하고 product commit의 tracked 파일을 복원하며 신규 exact15 산출물만 제거한다. seq1~743은 변경하지 않는다.
