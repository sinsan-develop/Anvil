# F-18 R36 OIDC runtime binding writer 회수 계획

- 기준: R36 canonical seq1611 active worker/write lease, 제품 exact SHA `5f1b57a21b1b874d3e6af9c6f92605bce9c11c13`, 로컬 관련 139 PASS, 독립 review Critical0/Important0/Minor1, 같은 제품 SHA의 WSL-server clean detached 6파일 139 PASS/exit0, QA checkout 잔류0과 기존 서비스 불변이다. 보고서-only commit은 제품 SHA를 바꾸지 않는다.
- Main은 clean·원격 일치 control QA commit을 만든 뒤 seq1612 `WRITE_LEASE_REVOKED`, seq1613 `WORKER_LEASE_REVOKED`를 이 순서로 append한다. epoch20 두 fencing token을 회수하고 `product_write_scope=[]`, `active_agent=main-agent-eoul`, F-18 `accepted=false`, F-19 차단, Production `NOT_EXECUTED`를 유지한다.
- `next_safe_action=PREPARE_F18_OIDC_ISSUER_COMPOSITION_STAGE`: 실제 issuer/JWKS/client 설정과 R30~R36 서버 컴포넌트를 신뢰된 ASGI runtime에 결선하는 후속 Stage를 같은 branch에서 준비한다. Web callback·브라우저·PostgreSQL 실제 coordinator·정식 WSL 통합은 현재 PASS가 아니며 별도 후속 검증이 필요하다. 전체 pytest의 기존 13 collection ERROR도 non-green으로 보존한다.
- Main은 G-05 seq1613, close control tests, branch clean/remote HEAD 일치 및 WSL QA 자원 잔류0을 확인한다. 새 branch·PR·main 병합은 F-18 Stage가 끝나기 전에 하지 않는다. Rollback은 R36 제품 commit의 정상 revert이며 DB downgrade는 하지 않는다.
