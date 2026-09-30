# F-20/U-01 R20 이후 Dashboard 범위 점검

## 판정

`U01_PARTIAL_INTERNAL_QA_ONLY`. R20 Next Actions의 실제 WSL-server PG15/OIDC/Chromium 경로는 통과했지만 U-01 인수·F-20 정식 검증·main 병합 조건은 충족되지 않았다. C30 원장 원문 이력 사건은 `OPEN_BLOCKING`, ReleaseDecision은 `DEFER`다. 이 점검은 제품·공개 API·DB·인증·운영 상태를 변경하지 않는다.

## 현재 근거

- 기준: 기존 단일 branch `codex/f18-wsl-ops`, 점검 시작 clean HEAD `cb057855b502cbfb5701b22f26f2c1f147bb8186`, canonical seq1920, worker/write lease 없음. `scripts/check_project_progress.py`는 `PASS sequence=1920 reporting=AUTO_CONTINUE`(exit0)였다.
- `apps/web`의 `node --import tsx --test tests/f15-console.test.mjs`는 44 PASS/0 FAIL(exit0). 이 범위는 정적·컴포넌트·mock 응답 회귀이지 실제 메뉴 전체 인수가 아니다.
- R20 보고서의 WSL-server opt-in은 3 PASS, 저장 Alert→Dashboard Next Actions와 권한 철회·same-origin을 확인했다. E-SHOT/full E-NET 전체 및 모든 U-01 상태를 확인한 증거는 아니다.
- 설계서 §29.2, 작업계획서 U-01, 매트릭스 §6.11 및 테스트계획서 §10.8은 Project/Environment/기간 필터, 실제 read model과 일치하는 운영 상태, loading/empty/error/blocked/quota/cancel/reconnect, 키보드·접근성, 실제 클릭→API→저장→재표시 및 독립 Tester 증거를 요구한다.

## 확인된 미충족

| 항목 | 현재 코드·증거 | 판정 |
|---|---|---|
| 운영 상태 행 | `apps/web/src/console/App.tsx`의 `operations-heading`은 실행·승인·비용 read model 미연결을 명시한다. `packages/observability/service.py`의 `run_summary()`는 내부 메서드이고 `packages/api/operations.py`의 공개 Dashboard 응답 필드에는 없다. | 미구현. 내부 요약의 존재를 공개 화면 PASS로 계산하지 않는다. |
| 범위·기간 필터와 새로고침 | 현재 Dashboard 머리말은 `Environment · NOT CONNECTED`이고 Project/Environment/기간 선택·새로고침 동작의 실증은 없다. | 미구현·미검증. |
| Next Actions의 경과시간·목적지 | 기존 공개 응답의 5필드와 화면 행은 검증됐다. 경과시간은 응답에 없고 미구현 deep link는 안전하게 텍스트 처리한다. | 부분 구현. 링크 차단은 안전 증거이지 이동 흐름 PASS가 아니다. |
| 공통 7상태·접근성 | 현재 44개 console 테스트는 일부 empty/error/blocked 및 안전한 렌더를 검증한다. U-01 전체 카드·실제 브라우저에서 quota/cancel/reconnect·키보드 전 경로의 독립 증거는 없다. | 미검증. |
| 공식 Gate | 매트릭스가 요구하는 AV-UI 공통·U-01 추가 ID의 독립 Tester E-SHOT/E-NET/E-API/E-EVT 전량 판정이 없다. C30도 열려 있다. | `ACCEPTED` 금지. |

## 다음 안전 작업과 경계

1. 기존 공개 계약을 변경하지 않는 U-01 상태·접근성·브라우저 증거 범위를 세분화해 기존 branch에서 순차 검증한다. 각 검증의 실제 저장·요청·화면·Network 범위를 별도로 기록하고 mock 결과를 실제 연결 PASS로 승격하지 않는다.
2. 운영 상태 행의 Run/승인/비용 수치를 공개 Dashboard 응답에 연결하는 작업은 공개 API·데이터 계약 변경에 해당한다. 현재 점검에서 임의 구현하지 않는다. 기존 설계 범위와 정확한 필드·실패 의미·권한·호환 영향이 확정될 때만 그 승인 경계를 처리한다.
3. C30 원문 사건은 이 점검에서 수정하거나 정상화하지 않는다. F-20 정식 검증은 U-11 acceptance 뒤에만 실행한다. 새 branch, main 병합, ysna/Production 작업은 하지 않는다.

Rollback: 이 보고서와 대응 WORK_STATUS 점검 기록만 제거하면 제품·DB·원장 상태에 영향이 없다.
