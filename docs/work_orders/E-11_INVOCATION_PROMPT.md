# E-11 Invocation Prompt

`E-11_WORK_INSTRUCTION.md`를 exact scope와 두 fencing token 안에서 TDD로 수행한다. 제품 exact5 이외 파일과 Main control 파일을 수정하지 않는다. 먼저 large migration·bug hunt Single/parallel golden 비교, 실패 격리, 100회 conflict, stale fencing, hard-limit send0, E-09/E-10 신뢰사슬 mismatch를 RED로 고정한 뒤 최소 구현으로 GREEN을 만든다. 실제 Provider·DB·remote Git·PR·merge·network·UI·배포는 실행하지 않는다. 완료 시 `COMPLETED | FAILURE_REPORT | INCOMPLETE | BLOCKED | CANCELLED` 중 하나와 exact 명령·exit·결과·해시·미검증·rollback을 보고한다.
