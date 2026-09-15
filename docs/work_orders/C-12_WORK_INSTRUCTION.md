# C-12 WorkInstruction — Failure lineage·fingerprint·유효 횟수 집계 R2

## 1. 식별과 권위

- Artifact ID: `WI-C-12-20260915-001`
- Work Package: `C-12`
- 담당자: `developer-primary-c12-r1`
- 기준 branch: `codex/c09-execution-backends-r1`
- 기준 commit: `c4335de145631804b7b7eb6e7c0689f66e2964d7`
- 상위 승인: `APPROVAL-20260814-WORKPLAN-V16-001`
- PMO direction: `PMO-C12-CONTINUE-20260915`, source task `01a054f5-c2b4-7af0-b31a-c8148ef74642`
- 설계서 SHA-256: `DC7509CB76A4BF08A0AE4D6F802FFB747B670FAB93426D5636B14575F7BEF9A3`
- 작업계획서 SHA-256: `00F4B03E5C6A82D50268025A87EB86FAC52815D675B54216D7B69B5BD220DD18`
- 통합검증매트릭스 SHA-256: `289933C795F689AF3AF3E44F48B563580EF1B5D9E266AD5583490EDBCABC3DB5`
- 테스트계획서 SHA-256: `9C288947F6F77AADDF73ED150EC449B71BE7D1981358A71EA211687B6A75D644`
- 운영규칙 SHA-256: `4AA7B81629924DC47519353CF396A7FF85BAC8FB50F7A1B63D9F1337E8F6216E`

## 2. 목표

C-06의 정식 `FAILURE_REPORT` 판정과 C-07의 canonical outcome 전이를 연결하는 결정론적 failure ledger를 현재 기준선에 재결박한다. 같은 `(step_lineage_id, failure_fingerprint)`의 서로 다른 유효 attempt만 1·2·3회로 누적하고, 무효 보고·환경/권한/quota 오류·중복/충돌 replay·다른 failure key를 정확히 분리한다. 세 번째 유효 보고에서는 C-13이 소비할 `takeover_required` 후보만 만들며 실제 Developer 중지, lease/tool 회수, TakeoverPacket 생성은 하지 않는다.

과거 `4594e5d`에서 들어온 원장과 테스트는 조사 입력일 뿐 현재 완료 증거가 아니다. 현재 C-06/C-07/C-11 계약과 적대 입력을 대조하여 기존 동작의 실제 결함 또는 미보호 경계를 먼저 RED로 증명하고 최소 수정한다. 의미 있는 RED가 나오지 않으면 제품 코드를 억지로 바꾸지 말고 현재 계약 충족 여부와 추가 검증 증거를 보고한다.

## 3. 허용 쓰기 경로

- `packages/orchestration/failure_ledger.py`
- `packages/orchestration/outcome_resolver.py`
- `packages/orchestration/__init__.py`
- `tests/orchestration/test_failure_ledger_c12.py`
- `tests/orchestration/test_outcome_resolver_c07.py`
- `docs/04_test_reports/C-12_COMPLETION_REPORT.md`

이 목록 밖의 제품·테스트 파일과 모든 progress/event/HANDOFF/manifest/checker 파일은 Developer write lease 밖이다. Main Agent만 C-12 시작·완료 통제 파일을 쓴다.

## 4. 금지 범위

- `packages/orchestration/takeover.py` 및 C-13 제품·테스트 변경
- 실제 Developer 중지, lease/tool 회수, TakeoverPacket 생성
- DB/API/browser/Provider/network/Secret/WSL/Docker/deployment 실행 또는 구현
- 기존 dirty/untracked 삭제, reset, stash, checkout, overwrite
- stage, commit, push, merge, branch/worktree 생성·정리
- 현재 승인된 공개 API·데이터 계약·보안·운영 범위 변경

## 5. 필수 동작 계약

1. C-06 validator를 통과한 `FAILURE_REPORT`만 집계한다.
2. canonical key는 `step_lineage_id + failure_fingerprint`이며 `issue_id`는 key가 아니다.
3. 동일 result의 동일 payload replay는 idempotent receipt를 반환하고 증가하지 않는다.
4. 동일 result/attempt identity의 다른 payload 또는 identity 회전은 fail-closed이며 원장을 변경하지 않는다.
5. lineage 또는 fingerprint가 다르면 별도 counter로 집계한다.
6. 유효 count는 1·2·3 경계를 결정적으로 표현하고 세 번째에만 takeover 후보가 된다.
7. C-07 resolver가 소비하는 receipt의 result hash, key, count, takeover flag가 위조·오래된 상태이면 거부한다.
8. report 순서와 replay를 반복해도 같은 canonical projection과 receipt 결과를 재현한다.
9. mutation·예외 도중 partial count/entry가 남지 않는다.

## 6. TDD와 검증

- 먼저 현실적인 production mutation을 잡는 신규 테스트를 작성하고 예상 원인으로 실패하는지 확인한다.
- 최소 구현 후 신규 테스트, C-12 focused, C-06/C-07 관련 회귀, 전체 `tests/orchestration`을 실행한다.
- `python -B -m compileall -q packages/orchestration tests/orchestration`과 `git diff --check`를 실행한다.
- 기본 pytest 임시 경로 ACL 문제가 있으면 `D:\Project\Anvil\.tmp_subagent_review\c12-<unique>`를 `--basetemp`로 사용하고 자신이 만든 정확한 임시 경로만 정리한다.

## 7. 완료보고 계약

결과 상태는 `COMPLETED | FAILURE_REPORT | INCOMPLETE | BLOCKED | CANCELLED` 중 하나로 보고한다. 보고에는 기준 commit/문서 hash, 시작 dirty 상태, RED→GREEN 명령·exit·실제 결과, 변경 경로와 diff 요약, 기존 C-06/C-07/C-11 계약 유지, 미검증 범위, rollback, 오류 횟수와 다음 조치를 포함한다. 제품 변경과 commit/push는 Main Agent가 독립 검토 뒤 판단한다.
