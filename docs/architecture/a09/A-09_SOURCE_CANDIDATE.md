# A-09 Learning Source · Candidate

`STATIC_ONLY`; `AV-LRN-018`, `AV-LRN-024`의 실제 검증 owner는 `D-12`이며 `RUNTIME_DEFERRED / NOT_EXECUTED`다. Skill activation NOT_EXECUTED, Hook activation NOT_EXECUTED.

Source 화면은 locator, content hash, provenance, license, confidentiality, exclusions, security scan, revoke 상태를 표시한다. revoked/unverified source는 positive exemplar와 신규 파생 사용을 차단하고 affected actual Run을 격리·보고한다.

Candidate 화면은 source refs, diff, reason, scope, risk, evaluation, approval, trust, no-change reason을 분리한다. Candidate, evaluated, approved, active, applied는 같은 상태가 아니다. 오류는 stable reason과 `next_action`을 함께 표시한다.
