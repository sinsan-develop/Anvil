# C-12 완료보고서 — Failure lineage·fingerprint 유효 횟수 원장

## 판정

`COMPLETED` — C-12 WorkInstruction의 in-memory deterministic failure ledger와
replay 검증을 완료했다.

## 판단 이유

- 기준 WorkInstruction: `docs/work_orders/C-12_WORK_INSTRUCTION.md`
- 시작 기준 branch: `codex/c12-failure-ledger`
- 구현은 C-06 `validate_failure_report`를 통과한 `FAILURE_REPORT`만
  `(step_lineage_id, failure_fingerprint)` key로 집계한다.
- 동일 `result_id`와 canonical payload replay는 duplicate receipt만 반환하고
  count를 증가시키지 않는다. 동일 id의 다른 payload는 conflicting replay로
  fail-closed 처리한다.
- 무효 보고·quota·permission·environment·불완전 증거는 valid count에 포함하지
  않는다.
- 세 번째 유효 보고에서 `takeover_required=True` 후보 신호만 생성하며 lease,
  tool 또는 실제 Developer 회수는 수행하지 않는다(C-13 범위).

## 변경 파일 및 영향 범위

- `packages/orchestration/failure_ledger.py`
  - 불변 entry/projection/receipt와 thread-safe in-memory 원장
- `packages/orchestration/__init__.py`
  - C-12 공개 타입 export
- `tests/orchestration/test_failure_ledger_c12.py`
  - 1·2·3회 집계, key 분리, replay, conflicting replay, 무효/환경성 실패,
    malformed 입력 검증

허용 경로 밖의 제품·DB/API/browser/provider/deployment 파일은 변경하지 않았다.

## 검증

| 명령 | 결과 |
|---|---|
| `C:\Users\cyhuh\anaconda3\python.exe -m pytest tests/orchestration/test_failure_ledger_c12.py -q` | `5 passed` |
| `C:\Users\cyhuh\anaconda3\python.exe -m pytest tests/orchestration -q` | `52 passed` |
| `C:\Users\cyhuh\anaconda3\python.exe -m compileall -q packages` | PASS |
| `git diff --check` | PASS |

## 미검증·범위 외

- PostgreSQL persistence/transaction/outbox
- 실제 lease·tool 회수와 Main takeover projection(C-13)
- 외부 Provider, API, browser, WSL/production deployment
- historical progress/event/hash 변경 및 연동

위 항목은 C-12 범위가 아니며 실행하지 않았다.

## Rollback

이 커밋의 C-12 변경 파일 3개를 되돌리면 된다. 기존 C-06/C-07 계약과
historical progress/event/hash는 rollback 대상이 아니다.

## 조치

부모 Main Agent가 diff와 증거를 독립 검토한 뒤 커밋·main 병합·push 순서를
진행한다.
