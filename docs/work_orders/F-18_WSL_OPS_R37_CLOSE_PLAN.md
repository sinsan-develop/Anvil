# F-18 R37 OIDC trusted composition writer 회수 계획

- 기준: canonical seq1616 epoch21 worker/write lease, 제품 exact SHA `47ef331146825d05e88ae96b9ab49baf98ff0edb`, 로컬 11파일 327 PASS, 독립 리뷰 Critical0/Important0/Minor0, 같은 제품 SHA의 WSL-server clean detached 11파일 327 PASS/exit0, QA checkout 잔류0과 기존 서비스 불변이다. 보고서-only commit `576fbc126928241f50910e8d3609a0ab2f72e2b5`는 제품 SHA를 바꾸지 않는다.
- Main은 clean·원격 일치 control QA commit을 만든 뒤 seq1617 `WRITE_LEASE_REVOKED`, seq1618 `WORKER_LEASE_REVOKED`를 이 순서로 append한다. epoch21 두 fencing token을 회수하고 `product_write_scope=[]`, `active_agent=main-agent-eoul`, F-18 `accepted=false`, F-19 차단, Production `NOT_EXECUTED`를 유지한다.
- `next_safe_action=PREPARE_F18_OIDC_HOST_BINDING_STAGE`: 신뢰된 host 설정·Secret 참조와 R37 factory를 기존 OIDC ASGI 경계에 결선하는 후속 Stage를 같은 branch에서 준비한다. 실제 issuer/JWKS·PostgreSQL 18 coordinator·Web callback·브라우저 Network·정식 WSL 통합은 현재 PASS가 아니며 별도 후속 검증이 필요하다. 전체 pytest의 기존 13 collection ERROR도 non-green으로 보존한다.
- Main은 G-05 seq1618, close control tests, branch clean/remote HEAD 일치 및 WSL QA 자원 잔류0을 확인한다. 새 branch·PR·main 병합은 F-18 Stage가 끝나기 전에 하지 않는다. Rollback은 R37 제품 commit의 정상 revert이며 DB downgrade는 하지 않는다.
