# F-20/U-01 R28 이후 Dashboard 잔여 범위 점검

## 판정

`U01_PARTIAL_INTERNAL_QA_ONLY`. R28의 동일 SHA WSL-server PG15/OIDC/HTTPS/Chromium 단일 opt-in과 실제 화면·Network 검증은 PASS이고, epoch42 worker/write lease는 seq1967~1968에서 회수됐다. 이는 U-01 독립 인수나 F-20 정식 검증이 아니다. C30 원장 원문 이력 사건은 `OPEN_BLOCKING`, ReleaseDecision `DEFER`, Production `NOT_EXECUTED`다. 이번 점검은 읽기 전용이며 제품·공개 API·DB·인증·원장 이력을 변경하지 않는다.

## 기준과 확인된 잔여 항목

| 설계·계획 계약 | 현 코드·증거 | 판정 |
|---|---|---|
| 설계 §29.2 상단 Project/Environment/오늘·7일·30일 필터 | `apps/web/src/console/App.tsx` Dashboard header는 `Environment · NOT CONNECTED` 고정이며, 새로고침 버튼은 R27/R28에서 실제 GET·관측 시각·철회 차단을 검증했다. 현재 버튼이 필터 선택을 구현한 것은 아니다. | 필터 미구현·미검증 |
| 2행 실행 중/승인 대기/BLOCKED/Gate/예상 비용/baseline 충돌 | 같은 Dashboard `operations-heading`은 실행·승인·비용 read model 미연결을 명시한다. `OperationsService.run_summary()`는 내부 메서드지만 `OperationsPort._SNAPSHOT_FIELDS`/`GET /api/dashboard/operations` 응답에 노출되지 않는다. | 실제 운영 수치 UI 미구현 |
| Next Actions 우선순위·대상·이유·경과시간·이동 | 기존 응답의 exact 5필드와 UI는 우선순위·대상·이유·안전한 메뉴 링크를 표시한다. 응답/타입에 발생시각·경과시간 필드가 없어 경과시간 표시는 없다. 미구현 링크를 텍스트로 남기는 것은 안전 처리이지 이동 인수는 아니다. | 부분 구현 |
| Critical Alerts code/source/발생시각/담당자/확인 | 읽기·페이징·표시와 철회 차단은 확인됐다. UI에는 확인 버튼이 없고 `OperationsPort.query_ports()`는 Dashboard/alerts/audit GET만 등록한다. 내부 `OperationsService.acknowledge()` 존재만으로 실제 확인 흐름을 PASS 처리하지 않는다. | 확인 동작 미구현 |
| U-01 공통 상태·독립 Tester | R23~R28은 해당 slice의 loading/empty/error/blocked·키보드·수동 재조회·실제 브라우저/Network를 검증했다. 현재 Dashboard console/browser 테스트의 `quota`/429·cancel·reconnect 명시 검증은 이 점검에서 찾지 못했고, AV-UI 공통 및 AV-OPS-001~005의 독립 Tester 전량 판정도 없다. | 전체 인수 미검증 |

## 다음 안전 조치

1. 기존 브랜치에서 U-01 공통 상태 중 quota/cancel/reconnect의 현 동작과 실제 검증 누락을 좁혀, 제품 변경 없이 검증 가능한 범위부터 R29 내부 QA 계약으로 분리한다. `SKIPPED`나 mock을 실제 브라우저 PASS로 승격하지 않는다.
2. 필터·운영 수치·경과시간·alert 확인은 기존 공개 Dashboard 계약, 프로젝트/환경 권한, 저장/실패 의미에 영향이 있는지 경로별로 확정한다. 현재 GET 응답에 없는 값을 UI에서 추측하거나 더미로 만들지 않는다. 공개 API·권한·데이터 계약 변경이 필요하면 해당 변경 경계를 분리해 정식 통제 절차를 적용한다.
3. C30 원문 사건을 덮거나 역사 Event를 재작성하지 않는다. U-01 독립 acceptance와 C30 차단 해소 전에는 F-20 완료·main 병합·새 branch·Production 검증을 선언하지 않는다. 로컬 개발→private Git→WSL-server 동일 SHA 테스트 범위를 유지한다.

Rollback: 이 점검 보고서와 대응 WORK_STATUS 기록만 정상 Git revert한다. 제품·DB·운영 상태 영향은 없다.
