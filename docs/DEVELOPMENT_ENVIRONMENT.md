# Anvil 개발환경

## Git 저장소 역할

- canonical Windows repository: `D:\Project\Anvil`
- 현재 C-21 worktree: `D:\tmp\anvil-c21-operational-execution`
- private development repository: `git@github-sinsan-develop:sinsan-develop/Anvil.git` (브라우저에서 Private 생성 확인)
- temporary `development` remote access: `VERIFIED`
- candidate push: `SAFETY_GATE_PENDING_EXACT_DESTINATION_APPROVAL`
- official release repository: `https://github.com/cyhuh7950/anvil.git`
- 전환 목표: private development=`origin`, official release=`release`
- official 저장소에는 실제 배포 allowlist만 clean RC branch로 반영하며 private 전체 history를 mirror하지 않는다.
- official main 직접 push, history rewrite, force push는 금지한다.

## WSL-server

- 역할: Anvil 개발·Test/Staging
- SSH alias: `WSL-server`
- GitHub SSH alias 목표: `github-sinsan-develop`
- WSL-server 전용 private key는 WSL 내부에만 생성·보관하고 public key만 GitHub에 등록한다.
- Windows private key를 WSL-server로 복사하지 않는다.
- 실제 endpoint, 사용자, key 원문과 Secret은 이 문서와 Git에 기록하지 않는다.

## C-21 현재 검증 기준

- candidate implementation: `93c58f7a8eaf803e4c3e56b9f03df0f70674a4ad`
- local checker: PASS sequence 486
- tooling: 97 PASS
- WSL harness focused tests: 15 PASS
- 실제 WSL PG15/PG18 RC 배포 검증은 private Git remote와 exact candidate binding 이후 수행한다.
- Telegram·Provider 실제 호출은 이번 C-21 WSL 검증에서 제외한다.

## Rollback

- remote 전환 전 기존 공식 URL과 refs를 보존한다.
- private remote 또는 SSH 검증 실패 시 기존 공식 remote 설정을 변경하지 않고 추가 remote만 제거해 원상 복귀한다.
- canonical root의 dirty/untracked 자료는 전환과 무관하게 보존한다.
