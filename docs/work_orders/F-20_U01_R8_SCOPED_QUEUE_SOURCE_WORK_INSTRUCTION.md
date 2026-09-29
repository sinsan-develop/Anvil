# F-20/U-01 R8 Scoped Queue Source WorkInstruction

- 발행자: Main 어울. **DRAFT — canonical WI Event와 새 worker/write dual lease·G-05 PASS 전 제품 수정 금지.**
- 상위 권위: 승인된 설계·작업계획·매트릭스·테스트계획 및 `docs/04_test_reports/F-20_U01_R8_SCOPED_QUEUE_SOURCE_PLAN.md`.
- 분류: 승인된 U-01 실제 read model의 내부 owner 계약. 공개 API·권한·DB schema·운영·비용·제품 범위 확장 없음.

## 정확한 제품 쓰기 범위

1. `packages/persistence/operations_queue_read.py`
2. `tests/persistence/test_f20_u01_r8_queue_read.py`
3. `docs/04_test_reports/F-20_U01_R8_QUEUE_READ_RESULT.md`

## 구현·완료 조건

- 사설 project/environment에 한정된 PostgreSQL read-only snapshot이 기존 Operations projection의 `queue.get`/`queue.quarantine`/ID 계약을 만족한다. `runs.environment_id IS NULL` legacy와 100건 초과는 완전한 0건으로 보이지 않게 명시한다.
- 타 scope·payload·fencing token 누출, GET성 읽기 중 queue/audit 쓰기, 비일관 snapshot을 음성 검증한다. DB 오류는 fail-closed다.
- 로컬 RED→GREEN·F-13 인접 회귀, Main 독립 리뷰, 사설 push 후 WSL-server 동일 SHA 격리 PG15 실측을 구분해 보고한다. 사용 자원은 Main이 사전 기록·정리한다.
- Developer는 exact3만 수정하고 commit/push/merge·공유 WSL 자원·정식 `/srv`·ysna/Production에 접근하지 않는다.
- host 주입·새 API/UI·Worker/Budget/Provider 상태·U-01/F-20 전체 acceptance·C30 사건 복구는 이 WI 범위 밖이다.
