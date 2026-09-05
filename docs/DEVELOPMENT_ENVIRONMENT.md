# Anvil 개발환경

## 2026-09-05 seq492 최신 checkpoint

- 실제 WSL deployed candidate/control은 `324eb169fedbce958d2e8cc29362deb7af433677` / `3f52d26a61e49543dd3d3121f5cc62a04f809a3d`다. PG15/PG18 migration 및 internal-bridge 보조 API/SSE/restore는 확인했지만 canonical host ingress/실제 rollback은 미완료다.
- local ingress 제품 후보는 `ccf5109d0640bf28c461e7754ad56e0821fd77be`, seq492 record 결박 대상이며 아직 push·배포하지 않았다. 기존 제품 review PASS 이후 I-3 rollback allowlist 누락이 발견되어 현재 `BLOCKED_IMPORTANT_I3`다.
- 새 control guard는 binding PASS와 runtime 허용을 분리하고 runtime 진입을 exit22로 거부한다. 실제 cleanup.sh 격리 fixture에서 Docker·파일 side effect0을 확인했으며 실제 서버 cleanup을 수행한 것은 아니다. 제품 rollback 보완 승인·검증 전 deploy/rollback/cleanup을 하지 않는다.
- 아래 과거 단계 설명과 당시 증거는 역사 기록으로 보존하며 위 최신 checkpoint를 현재 상태로 적용한다.

## Git 저장소 역할

- canonical Windows repository: `D:\Project\Anvil`
- 현재 C-21 worktree: `D:\tmp\anvil-c21-operational-execution`
- private development repository: `git@github-sinsan-develop:sinsan-develop/Anvil.git` (브라우저에서 Private 생성 확인)
- temporary `development` remote access: `VERIFIED`
- local remote 현황: `development`는 위 private Git SSH URL, `origin`은 아래 official HTTPS URL이다. remote 이름 전환은 아직 하지 않았다.
- latest private candidate ref: `candidates/c21-wsl-exact48` → `324eb169fedbce958d2e8cc29362deb7af433677`; control ref: `codex/c21-operational-execution` → `3f52d26a61e49543dd3d3121f5cc62a04f809a3d`. Main push·fresh recovery PASS 및 로컬 development remote-tracking ref 대조 완료.
- 승인된 개발·테스트 범위의 private push는 Main이 검증 후 자동 진행한다. 이전 `SAFETY_GATE_PENDING_EXACT_DESTINATION_APPROVAL`는 이미 해소된 과거 상태다.
- official release repository: `https://github.com/cyhuh7950/anvil.git`
- 전환 목표: private development=`origin`, official release=`release`
- official 저장소에는 실제 배포 allowlist만 clean RC branch로 반영하며 private 전체 history를 mirror하지 않는다.
- official main 직접 push, history rewrite, force push는 금지한다.

## WSL-server

- 역할: Anvil 개발·통합 QA/Test-Staging. ysna-server와 anvil.sinsan.kr는 별도 운영 전환 선언 전까지 사용자 인수검증 staging이다.
- SSH alias: `WSL-server`
- GitHub SSH alias: `github-sinsan-develop`. 신산님이 등록했다고 알린 기존 WSL key의 인증·private Git 읽기를 Main이 확인했다. 새 key 생성·등록은 필요하지 않으며 수행하지 않는다.
- repository-level read-only deploy key 속성은 독립 확인되지 않았다. 실제 인증 성공과 해당 권한 속성을 구분한다. root 실행에서 alias context가 필요한 경우 기존 key를 사용한 명시적 HostName github.com 옵션으로 처리했다.
- Windows private key를 WSL-server로 복사하지 않는다.
- 실제 endpoint, 사용자, key 원문과 Secret은 이 문서와 Git에 기록하지 않는다.

## C-21 현재 검증 기준

- candidate implementation: `324eb169fedbce958d2e8cc29362deb7af433677`; control `3f52d26a61e49543dd3d3121f5cc62a04f809a3d`.
- 위 clean checkpoint의 local checker PASS sequence491. 이후 현재 현황/ingress 보완 문서·제품 변경은 아직 seq492 재결박 전이므로 과거 checker PASS를 현재 dirty 전체의 PASS로 사용하지 않는다.
- 관련 tooling6 PASS, harness48개 node PASS. PyYAML parser1개 skip은 Main WSL Compose 실제 두 target config 검증으로 별도 보완했다.
- 실제 PG15.19/PG18rc1 startup, named volume 각1개/anonymous0, migration `0013_task_bootstrap_authority` PASS.
- Main 보조 internal transport 실행 exit0: 두 target authenticated SSE·Last-Event-ID·same-origin API contract·backupRestore PASS. host loopback publish는 실패하여 정식 verify.sh/브라우저 ingress는 미충족이다.
- rollback은 previous image 기록 부재로 preflight에서 무변경 종료했다. 실제 application rollback은 아직 미검증이다.
- 2026-09-05 신산님이 WSL QA nginx ingress-only non-internal망 예외와 구현·검증을 승인했다. app/DB는 기존 internal망만 유지한다. ingress 자체 outbound 능력과 실제 외부호출 금지는 별개이며 실제 Provider·Telegram 호출/credential 사용은 계속 금지한다.
- ingress image 기준: Main이 기존 WSL image를 read-only 확인한 `nginx:1.28.3-alpine3.23`, exact `nginx@sha256:a8b39bd9cf0f83869a2162827a0caf6137ddf759d50a171451b335cecc87d236`, linux/amd64.
- WSL runtime root `/srv/anvil-wsl`, `.env`는 기존 서버 전용 파일 그대로 보존한다. candidate repository `/srv/anvil-wsl/repo`, control physical stage `/srv/anvil-wsl/control/stage.*`는 Git exact SHA로만 갱신한다.
- Telegram·Provider 실제 호출은 이번 C-21 WSL 검증에서 제외한다.

## Rollback

- remote 전환 전 기존 공식 URL과 refs를 보존한다.
- private remote 또는 SSH 검증 실패 시 기존 공식 remote 설정을 변경하지 않고 추가 remote만 제거해 원상 복귀한다.
- canonical root의 dirty/untracked 자료는 전환과 무관하게 보존한다.
