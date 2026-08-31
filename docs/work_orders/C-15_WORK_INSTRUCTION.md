# C-15 WorkInstruction — Single Developer backend/API E2E fixture

## 범위

승인된 작은 fixture 기능을 대상으로 C-01~C-14 계약을 연결하는 결정적 backend/API E2E harness를 구현한다. 정상·중단·재개·거부·3회 인수와 요청→기술검증→ProductValidation→DefectAssessment→사람 ReleaseDecision→적용/폐기를 API/projection으로 재현한다. 실제 메뉴 UI는 구현하지 않는다.

허용 경로: `packages/e2e/**`, `tests/e2e/**`, `docs/04_test_reports/C-15_COMPLETION_REPORT.md`.

실제 Provider/DB/browser/deployment/외부 네트워크 호출과 historical progress/event/hash 변경은 금지한다. fixture 데이터는 명시적으로 synthetic임을 보고서에 표시한다.

## 완료 조건

1. 정상·중단·재개·거부·3회 takeover 경로가 하나의 재현 가능한 harness에서 검증된다.
2. API/projection 결과가 기술검증·ProductValidation·DefectAssessment·사람 ReleaseDecision·apply/discard를 모두 포함한다.
3. stale hash/token, 미완료 validation, blocking defect, duplicate replay가 차단된다.
4. 독립 Tester PASS와 EvidenceManifest 수준의 증거가 남는다.
5. 신규·관련 테스트, compileall, diff-check 및 실제 운영 미검증 경계를 보고한다.
