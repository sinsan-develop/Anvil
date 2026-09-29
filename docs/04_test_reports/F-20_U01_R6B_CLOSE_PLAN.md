# F-20/U-01 R6B 범위 한정 종료 계획

## 판정과 목표

- R6B exact5의 로컬·WSL-server 격리 PG15/OIDC/Chromium 범위는 동일 SHA `d497ec15681b1097978fbd5e3cac6a069f141dcd`에서 통과했고, 결과와 증거는 `9ddbb65a251f9b9a07979d09b777d7ec2678db6c`에 보존됐다.
- 이는 R6B의 **범위 한정 결과**이며 U-01/F-20 `ACCEPTED`, C30 원장 사고 해소, 정식 WSL E-SHOT/E-NET 또는 Production 검증이 아니다.
- epoch19 R6B write lease를 먼저, worker lease를 다음에 회수한다. 이후 제품 write scope는 빈 배열이며 Main이 다음 U-01 미충족 항목의 WI·lease를 발급할 때까지 새 제품 변경을 하지 않는다.

## 정확한 변경·검증 경계

1. 현 branch `codex/f18-wsl-ops`의 clean HEAD·사설 원격 `9ddbb65a`와 seq1828·R6B dual lease ACTIVE·만료 전 상태를 확인한다.
2. 기존 Event JSON의 raw prefix를 재직렬화하지 않고 seq1829 `WRITE_LEASE_REVOKED`, seq1830 `WORKER_LEASE_REVOKED`만 append한다. 두 Event의 prior hash·token·scope·actor·근거를 G-05가 재계산해 검증한다.
3. progress/handoff/digest/manifest를 이 두 Event에서 결정적으로 투영한다. `F-20` current·미수락, C30 `OPEN_BLOCKING`, ReleaseDecision `DEFER`, Production `NOT_EXECUTED`를 유지한다.
4. 변경 허용 경로는 이 계획, 원장/progress/handoff/digest/manifest, close overlay·G-05 route·집중 테스트, `docs/WORK_STATUS.md`뿐이다. R6B exact5 제품/시험·증거 4개 및 다른 dirty 자료는 수정하지 않는다.
5. 새 validator의 양성·Event raw prefix/token/원장·미수락 변조 음성 테스트를 RED→GREEN으로 실행하고 G-05·diff·Git clean을 확인한다. 현재 작업 브랜치에만 commit/private push하고 WSL-server의 기존 **격리 QA checkout**에서 exact SHA Git clean/G-05를 확인한다. 정식 `/srv/anvil-wsl/repo`·`anvil-web`은 이 closeout에서 건드리지 않는다.

## 정식 환경과 후속 경계

- read-only 확인: WSL-server 정식 `/srv/anvil-wsl/repo`는 root:root·detached `a681e0c0a97bdb67956a0a50aa208bd38982a545`·tracked clean, `anvil-web`은 기존 `bb2ff4374c81865cab127eca14d3d4c9de575465` image로 healthy다. 격리 QA checkout은 `9ddbb65a`다. 현 closeout은 기존 서비스 재시작·root 권한 변경을 포함하지 않는다.
- 다음 내부 단계는 상위 작업계획 §13과 source/owner 감사에 맞춰 U-01의 실제 read model/화면/Network 미충족을 범위별로 다시 WI화하는 것이다. 새 공개 API·권한·DB/Secret 계약을 이 closeout으로 승인하거나 구현하지 않는다.

## rollback

- 후속 control commit을 채택하지 않는 경우 기존 사설 원격 `9ddbb65a`가 복구 ref다. Event 원문이나 제품 SHA를 수정하지 않으며 새 control delta만 별도 검토한다. force push·history rewrite를 사용하지 않는다.
