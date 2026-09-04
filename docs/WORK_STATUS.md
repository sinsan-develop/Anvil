# Anvil 작업현황

## 2026-09-04 private 개발 Git 시범 전환

- 담당: Main Agent 어울
- 적용 범위: Anvil만 해당하며 다른 프로젝트에는 적용하지 않는다.
- 판정: `ACTIVE_GIT_REMOTE_TRANSITION`
- canonical repository: `D:\Project\Anvil`
- active worktree: `D:\tmp\anvil-c21-operational-execution`
- active branch/HEAD: `codex/c21-operational-execution` / `93c58f7a8eaf803e4c3e56b9f03df0f70674a4ad`
- 기존 공식 remote: `https://github.com/cyhuh7950/anvil.git`
- 기존 공식 remote 역할: 전환 후 `release`
- 계획 private 개발 remote: `sinsan-develop/Anvil`, visibility `private`, 전환 후 `origin`
- private 저장소 존재 확인: `CREATED_AND_BROWSER_CONFIRMED_PRIVATE` (`sinsan-develop/Anvil`)
- GitHub CLI 확인 계정: `cyhuh428-sinsan`; `sinsan-develop` 인증은 아직 확인되지 않았다.
- canonical root dirty 보존: `AGENTS.md` modified, `packages/agent_team/`, `tests/agent_team/` untracked. reset, clean, stash, 삭제, 덮어쓰기 금지.
- C-21 candidate 상태: local commit `93c58f7`, 기존 공식 remote보다 1 commit ahead, 기존 공식 remote push 미실행.
- 생성 예정 외부 자원: `sinsan-develop/Anvil` private repository.
- 생성 이유: WSL-server LLM 개발 전체 history를 비공개로 보존하고 공식 저장소에는 승인된 배포 allowlist만 반영하기 위함.
- owner/lifetime: `sinsan-develop`; Anvil 개발 기간 유지, 종료·이관 시 신산님이 archive/delete 여부 결정.
- 폐쇄 조건: private 개발 history 보존·공식 release 인수·필요 branch/tag archive가 완료되고 신산님이 폐쇄를 승인한 경우.
- WSL SSH 원칙: WSL-server 전용 key pair와 `github-sinsan-develop` alias를 사용하고 Windows private key는 복사하지 않는다. public key만 GitHub 계정에 등록한다.
- 오류: 기존 공식 원격 push가 exact destination 승인 부족으로 1회 차단됨. 최신 Git 분리 지시에 따라 같은 push를 재시도하지 않는다.
- 미검증: `sinsan-develop` GitHub CLI 인증, WSL SSH public-key 등록 필요 여부, private push/clone 복구 검증, official clean RC allowlist.
- 다음 조치: private 저장소와 WSL 전용 SSH 인증을 구성하고 기존 공식 remote를 보존한 채 private remote를 추가하여 push/clone을 검증한다.

## 2026-09-04 C-21 WSL Git SSH 선행작업

- 시작: `2026-09-04T16:59:26+09:00`
- 담당: `developer-primary-wsl`
- 상태: `IN_PROGRESS`
- 승인 범위: 실제 WSL-server 접속 경로 확인, WSL 사용자 홈 전용 ed25519 키 생성 또는 재사용, `github-sinsan-develop` SSH alias 멱등 구성
- 비공개 원칙: private key 내용은 출력·기록하지 않고 public key, SHA256 fingerprint, 권한만 보고한다.
- 금지 범위: 제품·역사 파일, Docker, DB, volume 변경 없음
- 접속 확인: Windows `wsl.exe -d Ubuntu -- ...` → WSL2 `Ubuntu`, user `daon`, home `/home/daon`, hostname `SINSAN`
- GitHub 기존 key 기준: 이름 `sinsan-develop`, fingerprint `SHA256:RYyFyGUnPJjzMI53sLRiJJNfRa2cHL7ASGZBqfHk7N8`
- 오류 횟수: 1
- 오류: 첫 key 구성 명령은 Windows→WSL 중첩 quoting으로 WSL의 key 경로가 빈 문자열이 되어 `ssh-keygen`이 즉시 실패했다. 키·config 파일은 생성·변경되지 않았다.
- 다음 조치: quoting 영향을 제거한 stdin script 방식으로 동일 작업을 1회 재실행하고 fingerprint를 기존 GitHub key와 비교한다.
- 키 결과: `CREATED`; `/home/daon/.ssh/id_ed25519_github_sinsan_develop`
- public key: `ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAICD0B/9D44dRWm06tj8e3XyWPGxh5A/+osehuAgLlvkN anvil-wsl-server`
- WSL key fingerprint: `SHA256:5nr41sDAJxdLKcegRsQL2RS6oA/BLuHBmHGwD6A8Zk0`
- GitHub 기존 key fingerprint 비교: `DIFFERENT`; 새 public key는 GitHub 등록 대기
- 권한: `.ssh=700 daon:daon`, private key=`600 daon:daon`, public key=`644 daon:daon`, config=`600 daon:daon`
- alias 해석: host `github.com`, user `git`, identities-only `yes`, identity file `~/.ssh/id_ed25519_github_sinsan_develop`
- 멱등 검증: alias block count `1`, config hash unchanged `no`
- 오류 횟수: 2
- 오류 2: 기존 alias block 제거 후 앞쪽 빈 줄을 정규화하지 않아 두 번째 적용에서 config 파일 hash가 변경됐다. alias 의미와 단일 block은 유지됐으나 byte-level 멱등 계약은 실패했다.
- 최종 상태: `FAILURE_REPORT`
- failure fingerprint: `WSL_SSH_CONFIG_TRAILING_BLANK_NON_IDEMPOTENT`
- 영향: 키와 alias는 사용 가능한 상태지만 config를 다시 적용할 때 빈 줄이 누적될 수 있다. private key는 재생성하지 않는다.
- 미수행: GitHub public-key 등록, SSH 네트워크 인증, private repository push/clone. 제품·역사 파일, Docker, DB, volume 변경 없음.
- 정확한 다음 조치: 기존 키를 재사용하고 alias block 제거 결과의 trailing blank를 정규화한 뒤 두 번 적용하여 byte hash가 동일한지 확인한다.

### Fix round 1

- 시작: `2026-09-04`
- 상태: `IN_PROGRESS`
- 보존 조건: 기존 `/home/daon/.ssh/id_ed25519_github_sinsan_develop` key와 fingerprint를 재생성·변경하지 않는다.
- 수정 범위: `~/.ssh/config`의 `github-sinsan-develop` 관리 block과 파일 끝 연속 blank/공백만 정규화한다.
- 다음 조치: 변환 전 fingerprint를 확인하고 같은 변환을 2회 적용하여 hash·block count·`ssh -G`·권한을 검증한다.
- Fix round 1 오류 1: 검증 단계의 inline `awk`에서 `$1`이 Bash positional parameter로 해석되어 `bash: 줄 38: $1: 바인딩 해제한 변수`, exit 1이 발생했다. config 변환 2회와 hash 산출은 이미 끝났으나 의미 검증 출력 전 중단됐다.
- 조치: config를 다시 변환하지 않고 현재 파일의 hash·block count·의미값·권한·fingerprint를 read-only 명령으로 검증한다.
- 적용 명령: `wsl.exe -d Ubuntu -- bash -lc "echo <base64-encoded approved fix script> | base64 -d | bash"`
  - script 핵심: fingerprint 선검증 → exact managed block만 `awk`로 제거 → 파일 끝 whitespace-only line 제거 → blank separator 1개와 관리 block append → 같은 함수 2회 실행 → `sha256sum` 비교
  - 적용 명령 exit: 1. 두 번 적용과 `hash1 == hash2`, block count 1 검사는 통과했으나 후속 inline `awk` 의미 출력의 Bash quoting 오류로 종료했다.
- 최종 read-only 검증 명령: `wsl.exe -d Ubuntu -- bash -lc "echo <base64-encoded read-only validation script> | base64 -d | bash"`
  - 검증 명령 exit: 0
- 1차 적용 hash: `6dd3e81cfbc61f1989a3fd4dd5138c48742ea30b0c8794d405fc54798ab9d257`
- 2차 적용 hash: `6dd3e81cfbc61f1989a3fd4dd5138c48742ea30b0c8794d405fc54798ab9d257`
- byte-level 멱등성: `PASS`
- alias block count: `1`
- `ssh -G` 의미값: `hostname github.com`, `user git`, `identitiesonly yes`, `identityfile ~/.ssh/id_ed25519_github_sinsan_develop`
- 보존 fingerprint: `SHA256:5nr41sDAJxdLKcegRsQL2RS6oA/BLuHBmHGwD6A8Zk0`
- 최종 권한: `.ssh=700 daon:daon`, private=`600 daon:daon`, public=`644 daon:daon`, config=`600 daon:daon`
- Fix round 1 오류 횟수: 1
- Fix round 1 최종 상태: `COMPLETED`
- 변경 범위 확인: WSL `~/.ssh/config` 관리 block과 파일 끝 blank만 변경. 기존 key 재생성 없음. 제품·역사 파일, Docker, DB, volume, Git 변경 없음.
- 잔여 작업: fingerprint가 기존 GitHub key와 다르므로 새 public key의 GitHub 등록은 별도 단계에서 필요하다.

## 2026-09-04 C-21 WSL harness review fix round 1

- 담당: `developer-primary-wsl`
- 상태: `IN_PROGRESS`
- 변경 범위: `deploy/wsl`, `tests/deploy`, `docs/WORK_STATUS.md`
- findings: I1 Git blob 원본-byte checksum, I2 control/candidate ref 분리 및 verify 선행 guard, I3 fake Docker cleanup 무삭제/정확삭제 계약
- 금지: seq/event historical 파일, commit, push, deploy, 실제 Docker·DB·volume 삭제
- 오류 횟수: 0
- 다음 조치: 실패하는 checksum/ref/verify/cleanup 계약 테스트를 먼저 추가한다.
- TDD RED 명령: `.venv\\Scripts\\python.exe -m pytest tests/deploy/test_wsl_staging_harness.py -q -p no:cacheprovider`
- 최초 RED 결과: exit 1, 15 tests 중 3 failures. control ref exact 제한 미구현 2건(상속 중복), verify 선행 guard 미구현 1건.
- RED 보강: fixture manifest 끝 LF를 추가하여 Git blob raw-byte checksum 결함도 탐지하도록 조정했다.
- 사용자 정정 인수: 정식 alias의 IdentityFile은 `~/.ssh/sinsan-develop`이다. harness 검증 후 기존 key의 fingerprint/권한을 확인하고 alias를 이 경로로 멱등 복원한다. 새로 생성된 `id_ed25519_github_sinsan_develop`은 삭제하지 않고 `UNUSED_UNREGISTERED_RESIDUAL`로 보존한다.
- 구현 결과:
  - I1: control Git blob을 `git show ... | sha256sum`으로 직접 hashing하여 끝 LF를 포함한 원본 byte checksum과 일치시켰다. 정상 checksum 및 manifest blob 1-byte 변조 거부 계약을 추가했다.
  - I2: control ref를 `refs/remotes/origin/codex/c21-operational-execution`, candidate ref를 `refs/remotes/origin/candidates/c21-wsl-exact34`로 고정했다. 두 commit의 상이성과 candidate→control ancestry를 강제했다. `verify.sh`는 checksum과 control ref를 요구하고 첫 runtime-state write 전에 동일 guard를 호출한다.
  - I3: fake Docker/Compose로 세 label 각각의 mismatch 및 두 번째 volume mismatch에서 삭제 호출 0건, 정상 시 allowlist의 정확한 두 volume만 삭제함을 검증했다.
- 변경 파일: `deploy/wsl/CandidateReleaseManifest.json`, `deploy/wsl/candidate-manifest-guard.sh`, `deploy/wsl/verify.sh`, `tests/deploy/test_wsl_staging_harness.py`, `docs/WORK_STATUS.md`
- TDD GREEN 명령: `.venv\\Scripts\\python.exe -m pytest tests/deploy/test_wsl_staging_harness.py -q -p no:cacheprovider`
- TDD GREEN 결과: exit 0, `15 passed in 18.56s`
- Bash/diff 명령: 모든 `deploy/wsl/*.sh`에 `bash -n`; `git diff --check -- deploy/wsl tests/deploy docs/WORK_STATUS.md`
- Bash/diff 결과: 각각 exit 0
- 전역 `git diff --check` 참고 결과: exit 1, 범위 밖 `docs/DEVELOPMENT_ENVIRONMENT.md:36 new blank line at EOF`; 해당 파일은 수정하지 않았다.
- 실제 배포·Docker·DB·volume 삭제: `NOT_EXECUTED`
- WSL 정식 key 확인 명령: `wsl.exe -d Ubuntu -- bash -lc <public fingerprint and file metadata only>`
- WSL 정식 key 확인 결과: exit 1, `/home/daon/.ssh/sinsan-develop` 및 `.pub`가 존재하지 않음
- 후속 공개키 inventory: exit 0. 기존 public key fingerprint 어디에도 GitHub 등록 기준 `SHA256:RYyFyGUnPJjzMI53sLRiJJNfRa2cHL7ASGZBqfHk7N8`가 없었다.
- 현재 `github-sinsan-develop` alias: `~/.ssh/id_ed25519_github_sinsan_develop`을 가리킴. 이 key는 `UNUSED_UNREGISTERED_RESIDUAL`; 삭제·등록하지 않았다.
- alias 복원: `BLOCKED`; 존재하지 않는 `~/.ssh/sinsan-develop`로 변경하면 SSH alias가 깨지므로 수정하지 않았다.
- harness review 상태: `COMPLETED`
- 전체 결과: `FAILURE_REPORT`
- failure fingerprint: `WSL_OFFICIAL_SINSAN_DEVELOP_KEY_MISSING`
- 오류 횟수: harness 0, WSL 정식 key 확인 1
- 정확한 재개 조건: 올바른 WSL-server 경로 또는 기존 `~/.ssh/sinsan-develop` key가 존재하는 환경을 확인한 뒤 fingerprint `SHA256:RYy...` 일치와 권한을 검증하고 alias block을 멱등 복원한다.

### 정정 checkpoint

- 정정 근거: `~/.ssh/sinsan-develop` key와 `github-sinsan-develop` alias는 WSL이 아니라 Windows 사용자 SSH 설정이며, Windows `ssh -G`에서 확인됐다.
- WSL 판정 정정: WSL에 위 경로가 없는 것은 제품 또는 harness 실패가 아니다. WSL alias를 존재하지 않는 경로로 변경하지 않는다.
- WSL 신규 key: `/home/daon/.ssh/id_ed25519_github_sinsan_develop`은 GitHub 미등록 상태의 `UNUSED_UNREGISTERED_RESIDUAL`로 보존한다. 등록·삭제·재생성하지 않았다.
- 외부 인증 다음 조치: Windows의 기존 등록 key를 사용해 private repository push 인증을 우선 검증한다.
- harness I1-I3 최종 상태: `COMPLETED`
- 전체 최종 상태: `COMPLETED_WITH_EXTERNAL_AUTH_PENDING`
- 미검증: Windows key를 사용한 private repository 실제 push 인증. 이번 범위에서 push는 실행하지 않았다.

## 2026-09-04 비의미 EOF cleanup 및 candidate 외부 쓰기 계획

- 담당: `developer-primary-wsl`
- 상태: `VALIDATING`
- 비의미 cleanup: `docs/DEVELOPMENT_ENVIRONMENT.md`의 의미 내용은 유지하고 EOF 여분 blank line만 제거하여 단일 LF로 정규화했다.
- planned external write source: local commit `93c58f7a8eaf803e4c3e56b9f03df0f70674a4ad`
- planned external write destination: private `sinsan-develop/Anvil`의 `refs/heads/candidates/c21-wsl-exact34`
- 목적: immutable WSL candidate를 private 개발 저장소에 보존한다.
- 공식 origin: 변경하지 않고 그대로 보존한다.
- rollback: private candidate branch 삭제이며 별도 승인이 필요하다.
- 현재 상태: `PUSH_NOT_EXECUTED`; 실제 push는 Main Agent가 수행한다.
- 외부 Git 전환 오류 1회: active worktree에서 `git remote add development ...`가 shared gitdir `D:/Project/Anvil/.git/config` 권한 거부로 실패했다. 제품 파일 변화는 없다.
- 외부 Git 전환 오류 조치: Main Agent가 승인된 Git 전환 범위에서 escalated 명령으로 재실행한다.
- 다음 조치: 전체 `git diff --check`와 focused harness 15 tests를 재실행해 결과를 기록한다.
- 전체 diff 검증: `git diff --check` → exit 0
- focused harness 검증: `.venv\\Scripts\\python.exe -m pytest tests/deploy/test_wsl_staging_harness.py -q -p no:cacheprovider` → exit 0, `15 passed in 19.32s`
- 최종 상태: `COMPLETED`; commit·push는 수행하지 않았다.
- exact push 안전 게이트: `git push development 93c58f7...:refs/heads/candidates/c21-wsl-exact34`는 private remote와 대상 저장소에 대한 구체적 승인 부족으로 거부됐다.
- 재시도 정책: 동일 push 재시도·우회 금지.
- 필요한 정확한 승인: source commit `93c58f7a8eaf803e4c3e56b9f03df0f70674a4ad`의 전체 history/content를 private `git@github-sinsan-develop:sinsan-develop/Anvil.git` branch `refs/heads/candidates/c21-wsl-exact34`로 push하는 승인.

## 2026-09-04 C-21 WSL governance control successor

- 담당: `developer-primary-wsl`
- 상태: `IN_PROGRESS`
- isolated worktree: `D:\tmp\anvil-c21-operational-execution`; git dir와 common dir가 달라 기존 linked worktree임을 확인했다.
- 시작 branch/HEAD: `codex/c21-operational-execution` / `93c58f7a8eaf803e4c3e56b9f03df0f70674a4ad`
- 시작 dirty 보존: `deploy/wsl/CandidateReleaseManifest.json`, `deploy/wsl/candidate-manifest-guard.sh`, `deploy/wsl/verify.sh`, `docs/DEVELOPMENT_ENVIRONMENT.md`, `tests/deploy/test_wsl_staging_harness.py` modified; `docs/WORK_STATUS.md` untracked.
- 승인 범위: immutable candidate `93c58f7...`, validated base `eef3496...` 대비 cumulative exact34, historical seq1~485 불변, reviewed harness/Git transition docs의 control successor projection.
- 금지 범위: 기존 seq1~485 event/historical 내용 수정, commit, push, deploy, Docker·DB·volume 삭제.
- 탐색 오류 1회: sandbox에서 `rg.exe` 실행이 access denied로 실패했다. 제품 변화 없음; PowerShell 파일 열거로 대체한다.
- 다음 조치: authority/progress/HANDOFF/manifest/digest/checker/test 구조와 historical prefix hash를 읽고 신규 successor 계약 테스트를 RED로 추가한다.
- TDD RED: `.venv\\Scripts\\python.exe -m pytest tests/tooling/test_project_progress.py -q -p no:cacheprovider -k c21_wsl_control_successor` → exit 1, 신규 control successor manifest 부재로 1 failure/96 deselected. 요구 기능 부재를 정확히 탐지했다.
- checker 시도 1: `EVENT_EFFECT_MISMATCH`, `EVENT_PAYLOAD_MISSING`, `GIT_DESCENDANT_ORIGIN_MISMATCH`, `PRG_REFERENCED_HASH_MISMATCH`, `PRG_REGISTRY_HASH_MISMATCH`; seq486 envelope와 projection/hash 결박을 보완했다.
- checker 시도 2: `PRG_REFERENCED_HASH_MISMATCH` 1건; 두 번째 historical `progress-events.json` 참조가 구 hash인 원인을 확인해 갱신했다. 동일 fingerprint 연속 반복은 아니다.
- PMO 보고 routing: 향후 checkpoint, 예외, 승인, quality gate, 완료 후보는 parent PMO task `01a054f5-c2b4-7af0-b31a-c8148ef74642`로 직접 보고한다.
- legacy PMO task `01a027a8-0a37-7821-9980-aa029a33e8fd`는 read-only이며 수신·판단·승인 대상이 아니다. 기존 범위·순서·승인은 변경하지 않는다.
- 구현 결과: seq486 `evt_c21_wsl_control_successor_bound`를 append하고 candidate `93c58f7a8eaf803e4c3e56b9f03df0f70674a4ad`를 base `eef3496...` 대비 cumulative exact34로 고정했다. 기존 seq1~485 내용은 변경하지 않았다.
- CandidateReleaseManifest: `APPROVED_FOR_STAGING_VALIDATION`, candidate ref `refs/remotes/origin/candidates/c21-wsl-exact34`, control ref `refs/remotes/origin/codex/c21-operational-execution`, 승인 원문 SHA-256 `03F4DAC0219F92DA43E2972B59E40453BDB56DF36E9E4E6B4F098BEEBBBADFB7`, rollback exact candidate로 결박했다.
- 신규 evidence: `docs/evidence/manifests/C-21_WSL_CONTROL_SUCCESSOR_MANIFEST.json`, `docs/progress/progress-handoff-detached-digest-c21-wsl-control-successor.json`.
- TDD GREEN targeted: WSL active/control projection `2 passed, 95 deselected`; focused harness `15 passed in 18.15s`.
- 최종 checker: `.venv\\Scripts\\python.exe scripts/check_project_progress.py` → exit 0, `PASS sequence=486 reporting=AUTO_CONTINUE`.
- 최종 tooling: `.venv\\Scripts\\python.exe -m pytest tests/tooling/test_project_progress.py -q -p no:cacheprovider` → exit 0, `97 passed in 41.02s`.
- 최종 focused harness: `.venv\\Scripts\\python.exe -m pytest tests/deploy/test_wsl_staging_harness.py -q -p no:cacheprovider` → exit 0, `15 passed in 20.85s`.
- 최종 whitespace: `git diff --check` → exit 0.
- historical prefix: seq1~483 `163E5D0E6741DFE08112C73C4D3EF763D3AFDF2E5003D316A323E2685072B4D2`, seq1~485 `CC2A98A539CB226DB213CF4E715C599598E4819300A2676EC64E38D15DB2CDE8`, 모두 PASS.
- candidate exact34: `git diff --name-only eef3496... 93c58f7...` 34 paths가 checker의 cumulative set과 완전 일치.
- 오류 횟수: 탐색 `rg` sandbox 1회, checker 보완 round 2회, final suite 기대값 drift 2건 1회. 동일 근본 원인 3회 없음.
- 외부 side effect: push, deploy, Docker, DB, volume 삭제, Telegram, Provider 모두 `NOT_EXECUTED`.
- 최종 상태: `COMPLETED_CONTROL_SUCCESSOR_PENDING_MAIN_COMMIT_AND_APPROVED_PUSH`.

## 2026-09-04 C-21 control successor review fix round 1

- 담당: `developer-primary-wsl`
- 상태: `IN_PROGRESS`
- review findings: I1 승인 binding이 원문 artifact와 독립 결박되지 않음, I2 seq1~485 canonical JSON hash가 raw whitespace/key-order byte 변조를 탐지하지 못함, minor 개발환경 private repository 상태 불일치.
- 시작 HEAD/branch: `93c58f7a8eaf803e4c3e56b9f03df0f70674a4ad` / `codex/c21-operational-execution`; 기존 control successor dirty 자료를 보존한다.
- historical raw 기준선: candidate `93c58f7...`의 seq1~485 event-object slice와 current slice가 byte-identical, bytes `780353`, SHA-256 `39D6D6ECE49C8D8EE0CB9BA0A64FC9BC33231E335DCE84DEB4B4A70D497E60FA`.
- 승인 원문 hash 검토: 원문 UTF-8만 hash한 기존 `03F4...`와 달리, 이번 artifact 계약은 정확한 원문 뒤 단일 LF를 포함한 509 bytes를 SHA-256한 `2167308A28325D199D290574E619BCAEA62056E85BC5860719ADE25C39A753D5`로 명시한다.
- 승인 evidence 조건: source `DIRECT_USER_APPROVAL`, actor `신산님`, approved_at은 확인 가능한 `2026-09-04 (Asia/Seoul)`만 사용하며 시각은 추측하지 않는다.
- 금지: seq1~485 event semantic/byte 수정, commit, push, deploy, Docker, DB, volume 삭제. 외부 push 재시도 금지.
- 다음 조치: 승인 artifact 및 raw byte mutation 음성 계약을 RED로 추가한 뒤 checker/manifest/progress binding을 최소 수정한다.
- TDD RED: `.venv\\Scripts\\python.exe -m pytest tests/tooling/test_project_progress.py -q -p no:cacheprovider -k approval_artifact_and_raw_historical_bytes` → exit 1, `C21_WSL_HUMAN_APPROVAL_ARTIFACT_MISSING` 1회. 승인 artifact 부재를 정확히 탐지했다.
- 승인 artifact: `docs/approvals/APPROVAL-20260904-C21-WSL-EXACT34-CLEANUP-001.md`; file SHA-256 `92C34A49FA194F52219D764335157791F37069C2A95AFED65374072F6F60831F`; source `DIRECT_USER_APPROVAL`, actor `신산님`, approved_at `2026-09-04 (Asia/Seoul)`로 기록했다.
- 승인 원문 결박: fenced payload의 정확한 원문과 후행 LF 1개를 UTF-8 509 bytes로 해시하여 `2167308A28325D199D290574E619BCAEA62056E85BC5860719ADE25C39A753D5`를 산출했다. candidate/control manifest, seq486, progress, HANDOFF가 artifact path/file hash/text hash를 독립 검증한다.
- historical raw 결박: candidate `93c58f7...`와 current의 seq1~485 event-object raw slice가 byte-identical이며 780353 bytes, SHA-256 `39D6D6ECE49C8D8EE0CB9BA0A64FC9BC33231E335DCE84DEB4B4A70D497E60FA`다. whitespace 1-byte 및 semantic-equivalent key-order mutation이 raw hash에서 거부됨을 계약 테스트로 추가했다.
- 보완 오류 1회: key-order 음성 fixture가 CRLF를 가정해 `RAW_KEY_ORDER_FIXTURE_LINE_ENDING_MISMATCH`로 실패했다. 실제 LF로 수정했으며 동일 fingerprint 반복은 0회다.
- TDD GREEN: 동일 targeted 명령 → exit 0, `1 passed, 97 deselected`.
- DEVELOPMENT_ENVIRONMENT 정정: private repository는 browser-confirmed created, temporary `development` remote access는 `VERIFIED`, candidate push는 `SAFETY_GATE_PENDING_EXACT_DESTINATION_APPROVAL`로 현재 WORK_STATUS와 일치시켰다.
- 최종 checker: `.venv\\Scripts\\python.exe scripts/check_project_progress.py` → exit 0, `PASS sequence=486 reporting=AUTO_CONTINUE`.
- 최종 tooling: `.venv\\Scripts\\python.exe -m pytest tests/tooling/test_project_progress.py -q -p no:cacheprovider` → exit 0, `98 passed in 52.03s`.
- 최종 focused harness: `.venv\\Scripts\\python.exe -m pytest tests/deploy/test_wsl_staging_harness.py -q -p no:cacheprovider` → exit 0, `15 passed in 20.78s`.
- 최종 whitespace: `git diff --check` → exit 0.
- historical/exact 검증: seq1~483 canonical `163E5D0E...B2D4D2`, seq1~485 canonical `CC2A98A5...2CDE8`, raw seq1~485 `39D6D6EC...7E60FA`, candidate exact34 모두 PASS.
- 변경 파일: `deploy/wsl/CandidateReleaseManifest.json`, `docs/approvals/APPROVAL-20260904-C21-WSL-EXACT34-CLEANUP-001.md`, `docs/DEVELOPMENT_ENVIRONMENT.md`, `docs/evidence/manifests/C-21_WSL_CONTROL_SUCCESSOR_MANIFEST.json`, `docs/progress/BUILD_HANDOFF.md`, `docs/progress/build-progress.json`, `docs/progress/progress-events.json`(seq486만), `docs/progress/progress-handoff-detached-digest-c21-wsl-control-successor.json`, `scripts/check_project_progress.py`, `tests/tooling/test_project_progress.py`, `docs/WORK_STATUS.md`. 기존 harness review 변경은 보존했다.
- 미검증/미실행: private candidate push, control commit/push, WSL 배포, Docker, DB, volume 삭제, Telegram, Provider 모두 `NOT_EXECUTED`. seq1~485는 semantic/byte 모두 변경하지 않았다.
- 다음 조치: Main Agent가 검토 후 exact 승인 경계에서 immutable candidate push와 별도 control successor commit/push를 수행한다. 그 전에는 WSL 실제 배포를 시작하지 않는다.
- 최종 상태: `COMPLETED_CONTROL_SUCCESSOR_REVIEW_FIX_PENDING_MAIN_COMMIT_AND_APPROVED_PUSH`.

### Reviewer Minor 외부 Git 상태 정정

- 기존 `생성 예정 외부 자원` 표기는 당시 계획 기록으로 보존한다. 현재 authoritative 상태는 `생성 완료 외부 자원`: private repository `sinsan-develop/Anvil`이 생성됐고 브라우저에서 Private임을 확인했다.
- GitHub CLI의 `sinsan-develop` 계정 인증 여부는 `NOT_VERIFIED`로 유지한다.
- Windows SSH alias `github-sinsan-develop` 인증은 `SUCCESS`이며 temporary `development` remote access는 `VERIFIED`다.
- candidate push 상태는 `SAFETY_GATE_PENDING_EXACT_DESTINATION_APPROVAL`; 실제 candidate push는 `NOT_EXECUTED`다.
- private repository clone 복구 검증은 `NOT_EXECUTED`다.
- 이 정정은 현재 상태를 분리해 명시하는 append-only checkpoint이며 기존 오류·작업 이력의 의미를 변경하지 않는다.

## 2026-09-04 C-21 control successor post-commit fix round 1

- 담당: `developer-primary-wsl`
- 상태: `IN_PROGRESS`
- 시작 branch/HEAD: `codex/c21-operational-execution` / `73c39ca03caa615f7207eac3499c668497cecc5a`; 시작 worktree `CLEAN`.
- upstream/remote head: `origin/codex/c21-operational-execution` / `ca92b7845eda803cff3c432799642e4f9243d4d6`.
- 승인 범위: 실제 committed control commit과 그 exact path set을 신규 seq487 post-commit successor로 결박한다. candidate `93c58f7...`, base `eef3496...` exact34, 승인 artifact와 seq1~485 raw hash는 불변이다.
- 금지: seq1~486 historical event 수정, commit, push, deploy, Docker, DB, volume 삭제.
- 명령 해석 오류 1회: PowerShell이 인용되지 않은 `@{u}`를 hash literal로 해석해 baseline 조회가 실패했다. 제품 변화 없음; ` '@{u}' ` 인용으로 즉시 해소했다.
- TDD RED/checker: `.venv\\Scripts\\python.exe scripts/check_project_progress.py` → exit 1, `GIT_DESCENDANT_ORIGIN_MISMATCH`, `GIT_DESCENDANT_PATH_SET_MISMATCH`.
- TDD RED/tooling: `.venv\\Scripts\\python.exe -m pytest tests/tooling/test_project_progress.py -q -p no:cacheprovider` → exit 1, `3 failed, 95 passed`; 같은 두 repository projection 오류가 원인이다.
- failure fingerprint: `C21_WSL_CONTROL_POSTCOMMIT_PROJECTION_UNBOUND_R1`; 동일 fingerprint 첫 정식 발생 1회.
- 다음 조치: 기존 post-commit successor 패턴을 따라 seq487, committed control exact path set, progress/HANDOFF/manifest/digest/checker 음성 계약을 append-only 구현한다.
- safety gate 1회: Parent PMO가 canonical `Anvil_작업계획서_v1.md`에 fingerprint/원인/조치/잔여 미검증 기록을 지시했으나, 실행 안전 게이트가 권위 문서 변경에 대한 신산님의 직접 승인이 없다고 판정해 patch 전체를 거부했다. 테스트 파일을 포함한 동일 patch는 원자적으로 적용되지 않아 추가 제품·historical 변화는 없다.
- 현재 상태: `BLOCKED_PENDING_EXPLICIT_WORK_PLAN_MUTATION_APPROVAL`; 우회·재시도하지 않는다. 정확한 재개 조건은 신산님의 `Anvil_작업계획서_v1.md` post-commit 정합화 checkpoint append 승인 또는 Main Agent가 권위 문서 변경을 제외한 축소 범위를 재지시하는 것이다.
- Main ruling: 권위 문서 `Anvil_작업계획서_v1.md` mutation을 축소 범위에서 제외하고 successor evidence/HANDOFF/WORK_STATUS만으로 재개한다.
- 작업계획서 미갱신 분류: `AUTHORITY_DOC_MUTATION_EXCLUDED`; 잔여 미검증이나 승인 대기 항목으로 분류하지 않는다.
- 재개 상태: `IN_PROGRESS_POSTCOMMIT_SUCCESSOR_REDUCED_SCOPE`.
- Main ruling: seq486 `docs/evidence/manifests/C-21_WSL_CONTROL_SUCCESSOR_MANIFEST.json`은 immutable historical evidence로 보존하고, seq487 정본은 신규 `docs/evidence/manifests/C-21_WSL_CONTROL_POSTCOMMIT_SUCCESSOR_MANIFEST.json`에 분리한다.
- 경로 비용: committed control exact39와 seq487 post-commit successor exact8을 분리해 신규 manifest 경로 1개가 post-commit path set에 추가됐다. `Anvil_작업계획서_v1.md`는 `AUTHORITY_DOC_MUTATION_EXCLUDED`를 유지한다.
- 현재 GREEN 전 재결박 오류는 `C21_WSL_CONTROL_POSTCOMMIT_PROJECTION_UNBOUND_R1`의 추가 정식 실패가 아니며, 최초 RED 1회만 유지한다.

### seq487 completion checkpoint

- checker GREEN: `.venv\\Scripts\\python.exe scripts/check_project_progress.py` → exit 0, `G-05 project progress contract: PASS sequence=487 reporting=AUTO_CONTINUE`.
- seq487 binding: committed control `73c39ca03caa615f7207eac3499c668497cecc5a`, candidate `93c58f7a8eaf803e4c3e56b9f03df0f70674a4ad` exact34, control delta exact14/path SHA-256 `A810194414EE28410CD816CF5EAB5D1D85E1C9D1A1AFCF04ED91C15EAEC1F61F`, cumulative committed exact39을 독립 검증한다.
- 새 정본: `docs/evidence/manifests/C-21_WSL_CONTROL_POSTCOMMIT_SUCCESSOR_MANIFEST.json`; seq486 `C-21_WSL_CONTROL_SUCCESSOR_MANIFEST.json`은 byte-immutable historical evidence로 유지한다. seq487 event가 신규 manifest path를 명시한다.
- 독립 raw binding: approval artifact `92C34A49FA194F52219D764335157791F37069C2A95AFED65374072F6F60831F`, approval text `2167308A28325D199D290574E619BCAEA62056E85BC5860719ADE25C39A753D5`, seq1~485 raw `780353` bytes/`39D6D6ECE49C8D8EE0CB9BA0A64FC9BC33231E335DCE84DEB4B4A70D497E60FA`, seq1~486 raw `782389` bytes/`784A0DC5BBDF916A752B8766E8DA89BB5B5FBC824765713DFB30C31E5269B053`.
- focused tooling GREEN: `.venv\\Scripts\\python.exe -m pytest tests/tooling/test_project_progress.py -q -p no:cacheprovider` → exit 0, `99 passed in 55.26s`. historical validator test은 current seq487에서 immutable seq486 artifact assertion으로 분기했고, post-commit bypass는 canonical branch 외 mutation을 거부하도록 보완했다.
- focused WSL harness GREEN: `.venv\\Scripts\\python.exe -m pytest tests/deploy/test_wsl_staging_harness.py -q -p no:cacheprovider` → exit 0, `15 passed in 19.05s`.
- full tooling attempted once: `.venv\\Scripts\\python.exe -m pytest tests/tooling -q -p no:cacheprovider` → exit 1, `445 passed, 19 failed in 104.13s`. seq487 접점 2건은 위 focused GREEN으로 해소했다. 잔여 17건은 `test_a13_repository_scan`, `test_a14_workbench_prototype`, `test_g06_test_assets`, `test_g07_baseline`, `test_phase_g_gate`이며 해당 tests/checkers/authority/A14 assets는 `git diff --name-only 73c39ca -- <paths>` 출력이 없어 control SHA 대비 unmodified baseline이다. 원인은 existing A13/A14/B12/G07 baseline/hash expectation drift와 `npm ci --offline` cache `EPERM`; 재실행하지 않았다.
- 오류 계수: formal `C21_WSL_CONTROL_POSTCOMMIT_PROJECTION_UNBOUND_R1` 1회 유지. GREEN 전 registry/reference rebinding 오류는 각각 단일 원인 확인 뒤 해소했고, 동일 seq487 failure 3회에 도달하지 않았다.
- 권위 문서: `AUTHORITY_DOC_MUTATION_EXCLUDED` 유지; `Anvil_작업계획서_v1.md`를 수정하지 않았다.
- 미실행/미검증: commit, push, deploy, Docker, DB, volume cleanup, Telegram, Provider는 모두 `NOT_EXECUTED`; full tooling 17 baseline failures는 seq487 completion evidence가 아니다.
- 다음 안전 조치: Main이 exact dirty path set과 evidence를 검토하고 별도 승인 범위에서만 commit/push를 판단한다.

### Reviewer final disposition

- reviewer 판정: `SPEC PASS` / `QUALITY APPROVED`; Critical/Important finding 없음.
- reviewer 재검증: checker PASS, focused contract 3개 PASS, WSL harness 15 PASS, candidate exact34/control delta14/cumulative exact39 및 seq1~485·seq1~486 raw hash 일치.
- full tooling baseline: base 기준 `443 passed / 20 failed`; 그중 detached 환경 3건과 기존 baseline 17건으로 분리한다. seq487 change의 회귀 또는 commit 차단 사유로 승격하지 않는다.
- Minor M1: 신규 postcommit test는 manifest field 변조를 직접 커버한다. noncanonical branch 및 extra dirty path의 actual negative case는 후속 package에 흡수하며, 현재 commit을 차단하지 않는다.
- 외부 side effect/권위 문서 상태는 이전 checkpoint와 동일하다: commit/push/deploy/Docker/DB/volume cleanup/Telegram/Provider `NOT_EXECUTED`, `AUTHORITY_DOC_MUTATION_EXCLUDED` 유지.
