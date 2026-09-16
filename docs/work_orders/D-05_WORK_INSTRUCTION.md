# D-05 WorkInstruction — terminal Run LearningReview·Reflection

## 1. 식별·권위

- Work Package: `D-05`
- 선행: `D-01`~`D-04 ACCEPTED`
- 기준 문서: `Anvil_설계서_v2.md` 36.14~36.15, 47.12, 48.7~48.9, 49.9
- 작업계획: `Anvil_작업계획서_v1.md` D-05
- 검증 ID: `AV-LRN-010`, `AV-LRN-011`
- 구현자: `developer-primary-d05-r1`

## 2. 목표

모든 terminal Run을 immutable `LearningReview`와 `Reflection`으로 정리한다. 재사용 가능한 학습 후보가 있으면 근거와 함께
후속 D-06이 처리할 candidate action descriptor를 남기고, 없으면 근거가 결박된 구조화 `no-change reason`을 반드시 남긴다.

## 3. product exact write scope

- `packages/knowledge/__init__.py`
- `packages/knowledge/reviews.py`
- `packages/api/learning_reviews.py`
- `tests/knowledge/test_reviews_d05.py`
- `tests/api/test_learning_reviews_d05.py`
- `docs/04_test_reports/D-05_COMPLETION_REPORT.md`

위 6개 경로만 제품 writer가 수정한다. Main 통제 파일과 D-01~D-04 구현은 수정하지 않는다.

## 4. 필수 계약

1. terminal 상태 `SUCCEEDED | FINISHED_WITH_FAILURES | FAILED | CANCELLED | REJECTED | DISCARDED`의 exact Run과
   사용자가 종료 판정한 Iteration만 review 대상이다. 그 밖의 비종료 Run·Iteration은 fail-closed한다.
2. Review는 source run ID, terminal result, target hash, 주요 결정, 사용자 교정, 재사용 성공, 실패·복구, verification 요약,
   미해결 위험, candidate action descriptor, 다음 Task 영향 또는 구조화 no-change reason을 가진 immutable version이다.
3. candidate action이 하나 이상이면 no-change reason은 없어야 하고, candidate action이 없으면 code·message·evidence refs가
   있는 non-empty no-change reason이 반드시 있어야 한다. 빈 review 또는 자유문자열 사유만으로 완료할 수 없다.
4. verification은 `PASS | FAIL | SKIPPED | BLOCKED | ERROR`를 구분하며 `PASS`만 성공으로 집계한다. non-PASS를 성공이나
   positive exemplar로 승격하지 않는다.
5. host attestation이 run terminality, actor, target hash, terminal result, verification 결과와 evidence digest를 결박한다.
   요청 payload가 이 권한 필드를 자가 부여하거나 다른 Run/hash로 재결박할 수 없다.
6. D-01 memory, D-02 snapshot, D-03 source, D-04 pattern/reference/anti-pattern은 exact ID/version/hash provenance로만 참조한다.
   revoked/quarantined source 또는 scope·confidentiality·license가 불일치하는 참조는 신규 review 사용을 차단한다.
7. 사용자 교정, 실패 복구, 선택한 pattern과 제외한 대안, test/gate 결과를 서로 다른 구조화 항목으로 보존한다.
8. 동일 terminal Run에는 하나의 canonical review만 생성한다. request replay는 동일 결과를 반환하고 concurrent duplicate,
   stale expected version, identity/version 재결박, mutable alias 변경은 fail-closed하거나 동일 canonical 결과로 수렴한다.
9. Reflection은 review를 요약하되 원본 evidence·민감 body를 복제하지 않는다. scope를 확대하지 않고 deterministic projection만 반환한다.
10. API adapter는 authenticated host context에 결박된 create/get/list를 제공하고 raw evidence body, terminality, actor, approval,
    verification 결과를 payload로 받지 않는다.
11. background-job 경계는 deterministic enqueue/claim/complete 계약과 중복 실행 방지를 in-memory domain으로 표현한다.
    실제 queue worker, DB/HTTP persistence, Run orchestration 연결은 후속 통합 범위다.
12. D-05는 candidate action descriptor만 만든다. candidate 생성·평가·승인·활성·rollback·quarantine은 D-06 소유다.

## 5. TDD·적대 검증

- 각 terminal result에서 review 또는 evidence-backed no-change reason 생성
- candidate 있음/없음 상호배타와 빈 사유·근거 누락 차단
- non-terminal Run, forged terminality/actor/target hash/verification, cross-run attestation 재사용 차단
- PASS 외 상태의 성공 집계·positive candidate 승격 차단
- revoked/quarantined source, scope/license/confidentiality 확대, stale hash/version 차단
- replay/concurrency에서 terminal Run당 단일 canonical review
- deterministic Reflection과 raw evidence·민감값 projection 차단
- background job duplicate claim/complete, stale token, payload authority 자가부여 차단

## 6. 검증·보고

- focused: D-05 두 test 파일
- 관련 `tests/knowledge tests/api` 회귀
- `python -B -m compileall -q packages/knowledge packages/api tests/knowledge tests/api`
- `git diff --check`
- 실제 queue/DB/HTTP/browser/Provider/network/WSL/Docker/deployment는 실행하거나 PASS로 표시하지 않는다.

## 7. 완료 후

Developer는 구조화 결과 계약으로 보고한다. Main 독립 검토 전 D-05는 ACCEPTED가 아니며 D-06을 시작하지 않는다.
