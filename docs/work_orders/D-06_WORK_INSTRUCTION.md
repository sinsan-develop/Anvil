# D-06 WorkInstruction — learning candidate lifecycle·activation·rollback·quarantine

## 1. 식별·권위

- Work Package: `D-06`
- 선행: `D-05 ACCEPTED`
- 기준 문서: `Anvil_설계서_v2.md` 36.11~36.12, 48.8~48.9, 49.9
- 작업계획: `Anvil_작업계획서_v1.md` D-06
- 검증 ID: `AV-LRN-012`, `AV-LRN-014`, `AV-LRN-027`
- 구현자: `developer-primary-d06-r1`

## 2. 목표

D-05 LearningReview의 candidate action descriptor를 immutable 학습 후보로 등록하고, 평가·사람 승인·versioned activation,
다음 Task/Run 적용, rollback·quarantine과 source revoke 영향을 끝까지 추적한다. 행동을 바꾸는 activation은 현재 Run에
조용히 섞지 않고 사람 권위와 exact evidence에 결박한다.

## 3. product exact write scope

- `packages/knowledge/__init__.py`
- `packages/knowledge/candidates.py`
- `packages/api/learning_candidates.py`
- `tests/knowledge/test_candidates_d06.py`
- `tests/api/test_learning_candidates_d06.py`
- `docs/04_test_reports/D-06_COMPLETION_REPORT.md`

위 6개 경로만 제품 writer가 수정한다. Main 통제 파일과 D-01~D-05 구현은 수정하지 않는다.

## 4. 필수 계약

1. 후보는 D-05 exact review ID/version/hash, candidate action index/hash, terminal subject/result, target hash, evidence digest와
   D-01~D-04 provenance를 고정한다. payload가 source/review/evidence/actor/approval을 자가 부여할 수 없다.
2. 후보 종류는 `USER | MEMORY | CODE_PATTERN | ANTI_PATTERN | SKILL | HOOK | PROMPT | BENCHMARK | ROUTING`을 구분하고,
   create/patch/split/merge/archive 등 의도와 target scope, confidence, expiry, risk/capability delta를 가진다.
3. lifecycle은 `PROPOSED → EVALUATED → AWAITING_APPROVAL → APPROVED → ACTIVE`의 순서를 지키며
   `REJECTED | ROLLED_BACK | QUARANTINED` terminal/containment 상태를 지원한다. stale version, gap, rollback, alias 재결박은 차단한다.
4. evaluation은 static/security/license/permission, replay, sandbox pilot, baseline 품질·비용·trigger 정확도와 FAIL/SKIPPED/
   BLOCKED/ERROR를 분리한다. 필수 항목은 PASS만 합격이며 evidence target hash가 exact candidate version과 일치해야 한다.
5. activation은 authenticated human approval의 actor, decision, candidate hash/version, scope, risk/capability delta, expiry를
   host attestation으로 결박한다. 요청 payload의 approval/trusted_auto/actor/permission 자가부여는 금지한다.
6. 신규 항목, scope/implicit trigger/tool/write/network/secret capability 확대, script/program, Hook/policy 변경, benchmark 회귀,
   evidence 부족은 항상 사람 사전 승인이 필요하다. D-08/D-10 이전에는 trusted_auto activation을 제공하지 않는다.
7. activation은 immutable ID/version/hash와 previous activation을 가지며 `applies_from=NEXT_TASK_OR_RUN`이다. 현재 Run의
   LearningSnapshot은 불변이고, 다음 D-02 snapshot이 exact activation을 선택하기 전에는 실제 행동을 바꾸지 않는다.
8. register-use는 activation→snapshot→Task/Run과 candidate→review→source 계보를 남긴다. 다른 hash/version/scope의
   activation이나 snapshot으로 재결박할 수 없다.
9. rollback은 이전 safe activation 또는 baseline을 가리키고, 해당 version을 사용한 Run·영향 범위와 rollback 원인/evidence를
   보존한다. rollback된 version의 신규 사용은 차단한다.
10. quarantine은 secret/license/security/evidence 이상 및 source revoke 영향으로 즉시 신규 사용을 차단하고 진행 Run은
    immutable하게 유지하되 영향 대상으로 격리·보고한다. 과거 provenance와 audit은 삭제하지 않는다.
11. D-03 source revoke/license 변경/secret finding이 candidate/activation 계보 전체에 전파되어 파생 MEMORY/SKILL/HOOK 등의
    신규 사용을 fail-closed한다. alias·cached object·과거 approval로 우회할 수 없다.
12. replay/concurrency에서 같은 review action은 하나의 canonical candidate, 같은 approval은 하나의 activation으로 수렴한다.
    API는 create/evaluate/request-approval/approve/activate/use/rollback/quarantine/query의 host-context adapter만 제공한다.
13. 실제 Skill/Hook runtime, prompt/model routing, DB/HTTP/queue, 외부 replay·sandbox 실행은 후속 D-07~D-11/통합 범위다.

## 5. TDD·적대 검증

- review action→candidate→evaluation→human approval→next-run activation→use lineage
- approval 없는 activation, payload self-approval, trusted_auto, capability/scope 확대 우회 차단
- FAIL/SKIPPED/BLOCKED/ERROR·다른 target hash evidence를 PASS로 집계하지 않음
- current Run 적용 차단과 next snapshot exact activation 결박
- rollback 후 신규 사용 차단, affected Run lineage와 이전 safe version 복원
- source revoke/license/secret finding 후 파생 candidate·activation 신규 사용 차단과 진행 Run 영향 보고
- stale/replay/concurrent candidate·approval·activation·use, cross-actor/context/scope 재결박 차단
- API 오류에 raw evidence·secret·authority 세부가 노출되지 않음

## 6. 검증·보고

- focused: D-06 두 test 파일
- 관련 `tests/knowledge tests/api` 회귀
- `python -B -m compileall -q packages/knowledge packages/api tests/knowledge tests/api`
- `git diff --check`
- 실제 Skill/Hook runtime, DB/HTTP/queue/browser/Provider/network/WSL/Docker/deployment는 실행하거나 PASS로 표시하지 않는다.

## 7. 완료 후

Developer는 구조화 결과 계약으로 보고한다. Main 독립 검토 전 D-06은 ACCEPTED가 아니며 D-Learning Gate를 판정하지 않는다.
