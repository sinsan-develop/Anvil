# F-20/U-01 필터 계약 검토 WorkInstruction 초안

상태: `DRAFT / NON-PRODUCT / NO LEASE`. 근거: `docs/04_test_reports/F-20_U01_SCOPED_FILTER_CONTRACT_DRAFT.md`, 설계 §26.1·§29.2, 작업계획 U-01. 이 문서는 PMO 검토용이며 Developer 제품 작업지시·승인 binding·R49 발행이 아니다.

## 수행 범위와 순서

1. Main은 위 계약 초안의 각 사실을 정본 설계·현 OIDC host/인가/Operations port·DB migration과 재대조한다. 검증되지 않은 다중 scope 쌍, 기간 원본 또는 카드 수치를 만들지 않는다.
2. PMO는 A/B/C 대안과 권장 B의 공개 API·권한·지속 데이터 영향을 검토하고, 신산님 별도 승인이 필요한 정확한 계약 차이를 지정한다. 미정 값은 결정 전까지 `UNRESOLVED`로 유지한다.
3. 계약이 확정되고 필요한 승인 binding이 생긴 후에만 Main이 구현 계획·정확 파일 목록·단일 writer dual lease·RED→GREEN·로컬→private Git→WSL-server exact-SHA QA를 별도 WorkInstruction으로 발행한다.

## 검토 체크와 금지

- 체크: 허용된 Project–Environment **쌍**의 서버 권위 원본; 목록이 principal과 교집합으로 제한되는지; 권한 철회·쌍 부재 시 fail-closed; 기간의 IANA timezone·UTC `[start,end)`·7/30일 의미; 각 카드 owner·scope·시점·완전성·UNAVAILABLE 기준; 기존 Dashboard/Alerts/Audit GET 및 ACK 호환성; 회귀·WSL browser/Network/DB 검증·rollback.
- 금지: 새 제품/API/권한/DB schema·migration·Event·lease write, 기존 공개 응답의 암묵 변경, 미확인 수치를 0으로 표시, 새 R 번호·branch·main 병합, WSL-server/ysna-server/Production 작업. 본 계약 문서·작업현황 기록만 허용한다.
- 완료 증거: 근거 파일/행, 열린 결정 목록, PMO 전달 내용과 결과, 문서 diff·Git 상태·G-05 결과. 이것은 문서 검토 완료이지 U-01/F-20 제품 완료나 browser/PG 검증 PASS가 아니다.
