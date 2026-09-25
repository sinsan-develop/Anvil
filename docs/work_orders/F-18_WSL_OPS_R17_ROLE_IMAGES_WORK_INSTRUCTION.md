# F-18 R17 Role Images WorkInstruction

- 담당: `developer-primary` 단일 제품 writer. Main은 canonical 통제·독립 검토·push·WSL-server 세 image 실측·lease 종료를 소유한다.
- 기준: 승인 설계 v2.8 SHA-256 `1DD7D91D6A0F9406A100B43B68285AD0A06F453FEC55F497458D55B20F481712`, 작업계획 v1.7 `943B4123C5A8F273FF628E150501E0D66FAC10705A72989CA98E8453A083AEEB`, 매트릭스 `1AFDDC9A0D35868EC9D1774CE6A6087A177620875074D7198C361AFF92363AD6`, 테스트계획 `902A6E64E06E92C5F8856EE6C18CA94983F4F72040351AD954ADD1428555A014`; F-18 기본 WorkInstruction 단계1과 `F-18_WSL_OPS_R17_ROLE_IMAGES_PLAN.md`.
- 분류: 이미 승인된 Web/API/Worker 세 image digest 검증을 위한 WSL 전용 내부 빌드 파일 배치. 공개 API·인증/권한·DB/Secret·운영 배포 계약 변경이 없는 `MAIN_RECONFIRMED_NON_SEMANTIC`; 부모 `APPROVAL-20260925-LOCAL-WSL-OPERATIONS-SCOPE-001`. Docker image 빌드만으로 F-18 capability를 합격 처리하지 않는다.
- 제품 exact4: `deploy/wsl/Dockerfile.f18`, `deploy/wsl/Dockerfile.f18.dockerignore`, `tests/deploy/test_f18_role_images.py`, `docs/04_test_reports/F-18_WSL_OPS_REPORT.md`. 다른 제품·control·progress 경로는 쓰지 않는다. canonical worker/write lease의 두 fencing token·시작 HEAD·branch·만료를 확인하기 전 쓰기를 금지한다.
- 목표: 잠금파일/고정 base digest로 `web`, `api`, `worker` final target을 빌드 가능하게 한다. 각 target은 exact `ANVIL_RELEASE_COMMIT` OCI label과 최소 source/role entrypoint를 갖는다. 기존 `deploy/local/nginx.conf`의 `/api/`·`/auth/` same-origin proxy를 Web target에서 재사용한다.
- 금지: 기존 `deploy/wsl/Dockerfile.web`, `deploy/local/`, `deploy/ysna/`, Compose·network·API/Worker runtime 의미, 공개 route·권한·DB schema/Secret/certificate 수정, 새 branch, Subagent의 원격 push·병합·WSL 실행. `ysna-server`/Production 미접근.
- 실행: 계획의 RED→GREEN, 관련 로컬 회귀·Web typecheck/build·전체 pytest 시도·diff-check, exact4 clean commit. 기본 Windows pytest temp ACL 문제가 있으면 worktree 내부 전용 `--basetemp`만 사용하고 정확한 path 검증 후 정리한다.
- 보고: 기준 hash, 시작 HEAD/branch/status, exact4 diff, 실제 명령/exit/PASS·FAIL·SKIP, 로컬 build와 WSL 실제 image를 분리, 기존 동작/rollback·미검증·정식 실패 횟수. progress/HANDOFF는 Main만 갱신한다.
