# F-18 R35 OIDC HTTP adapter writer 회수 계획

- 기준: R35 canonical seq1606 active worker/write lease, 제품 exact SHA `eb0af553c36f191e0bd80949741e95ff4bc3012a`, 로컬 관련 128 PASS, 독립 review Critical0/Important0/Minor0, 같은 제품 SHA의 WSL-server clean detached 6파일 128 PASS/exit0, QA checkout 잔류0과 기존 서비스 불변이다. report-only commit은 제품 SHA를 바꾸지 않는다.
- Main은 clean·원격 일치 control QA commit을 만든 뒤 seq1607 `WRITE_LEASE_REVOKED`, seq1608 `WORKER_LEASE_REVOKED`를 이 순서로 append한다. epoch19 두 fencing token을 회수하고 `product_write_scope=[]`, `active_agent=main-agent-eoul`, F-18 `accepted=false`, F-19 차단, Production `NOT_EXECUTED`를 유지한다.
- `next_safe_action=PREPARE_F18_OIDC_RUNTIME_BINDING_STAGE`: 실제 issuer/DB/session service를 runtime에 안전하게 결선하는 후속 Stage를 같은 branch에서 준비한다. Web callback·브라우저·PostgreSQL·정식 WSL 통합은 현재 PASS가 아니며 별도 후속 검증이 필요하다. 전체 pytest의 기존 13 collection ERROR도 non-green으로 보존한다.
- Main은 G-05 seq1608, close control tests, branch clean/remote HEAD 일치 및 WSL QA 자원 잔류0을 확인한다. 새 branch·PR·main 병합은 F-18 Stage가 끝나기 전에 하지 않는다. Rollback은 R35 제품 세 commit의 정상 revert이며 DB downgrade는 하지 않는다.
