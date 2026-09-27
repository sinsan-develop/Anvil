# F-18 R11 Mixed-Use JWKS Writer Closeout Plan

- 목적: WSL-server의 게시 제품 exact SHA `8bcb630cdd913ed0a4dc9fa456b814c0d71f1424`가 잠긴 관련 151 PASS와 격리 Keycloak ordinary code-flow 및 잘못된 PKCE verifier 거부를 확인한 뒤, epoch9 제품 writer를 순서대로 종료한다.
- 선행: canonical seq1556/G-05 PASS, 현재 branch clean·게시, R11 product exact3 diff와 QA 결과·임시 자원 잔류0 확인. 기존 F-18 accepted=false, F-19 차단, Production NOT_EXECUTED는 변경하지 않는다.
- TDD: 게시 제품 progress와 writer/write scope가 일치할 때만 closeout하고 변조·잔류 lease·인수 상태 승격을 거부하는 테스트를 먼저 RED로 둔다.
- Main control code는 seq1557 `WRITE_LEASE_REVOKED` → seq1558 `WORKER_LEASE_REVOKED`만 materialize한다. 신규 제품 write 없음. evidence는 기존 branch의 control code SHA WSL-server 격리 QA 후에만 발급한다.
- WSL control QA 자원은 신규 exact `/srv/anvil-wsl/f18-ops-r11-close-control-qa` clean detached checkout 하나다. 생성 전 경로 부재·기존 서비스 상태를 확인하고 게시 control SHA, `daon:daon`/0700, 내부 `.uv-cache`·`.venv`의 잠긴 Python3.12 통제 회귀를 실행한다. DB·Docker·기존 서비스·Secret·browser·listener는 변경하지 않는다. 종료 전 exact boundary/owner/HEAD/tracked clean/ignored 범위 확인 후 해당 checkout만 제거해 잔류0을 확인한다.
- 롤백: 본 control 증거 commit만 revert해 seq1556 상태로 되돌린다. 제품 R11 코드는 이 종료 통제로 변경되지 않는다.
