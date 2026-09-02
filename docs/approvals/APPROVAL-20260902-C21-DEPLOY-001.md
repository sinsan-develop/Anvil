# C-21 DeployApproval

- 승인자: 신산님
- 승인일: 2026-09-02 (Asia/Seoul)
- 대상 커밋: `fda94392b03f69d1a21b1030b5425f14ee8a4d95`
- 대상 환경: `ysna-server` / `anvil.sinsan.kr`
- 승인 범위: `deploy/ysna/deploy.sh` 표준 절차에 따른 C-21 배포와 health/OpenAPI/Host 진단 검증
- 금지 범위: 추가 Telegram POST, NPM restart/config 변경, 비승인 DB 변경, secret 출력
- 롤백: `deploy/ysna/rollback.sh` 및 배포 전 `previous.sha` 사용

신산님은 “C-21 커밋 `fda9439`의 DeployApproval binding 생성과 표준 `deploy.sh` 배포를 승인한다.”고 명시했다. 이 문서는 해당 승인과 대상 hash를 결박한 DeployApproval 기록이다.
