# A-09 Activation · Applied · Rollback

`STATIC_ONLY`; `AV-LRN-018`, `AV-LRN-024`, owner `D-12`, `RUNTIME_DEFERRED / NOT_EXECUTED`. Skill activation NOT_EXECUTED, Hook activation NOT_EXECUTED.

Activation은 candidate, version, content hash, approval, applies-from snapshot을 결박한다. 이미 시작된 current actual Run snapshot은 불변이며 활성화는 다음 snapshot부터 적용한다. Applied는 activation과 별도이며 실제 사용 Run lineage를 요구한다.

Rollback/revoke는 파생 Skill·Hook·Memory의 신규 사용을 차단하고 affected actual Run, 이전 version, reason, approval, evidence, `next_action`을 보존한다.
