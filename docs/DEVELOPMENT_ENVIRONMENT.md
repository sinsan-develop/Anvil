# Anvil 개발환경

## seq494 로컬 검증 마감 / 2026-09-05

- 담당: Main 어울 관리, pg18_binding_resume 구현 후 seq494_local_finish가 단일 writer 인수. candidate a342d62391a44b349733d1468ac3b180761155ab, candidate56 / record12 / 누적58. Main의 최종 문서 검토·record commit·clean postcommit 검증은 아직 전이며 외부 실행은 하지 않는다.
- tooling 전체 139 PASS/471.73s/exit0은 직전 writer의 실제 결과를 Main에게서 인수했으며 중복 실행하지 않았다. 기존 harness session8103 최종 결과는 세션 소실로 미확인이고 제품 실패나 PASS로 계상하지 않는다.
- 인수 후 frozen harness만 1회 재실행: session96554, 80 PASS / 1 Compose parser SKIP / 428.42s / exit0. stdout·exit는 D:/tmp/anvil-seq494-harness-resume-6fa1d981bdb54491a32aab02a9375c66에 보존했다. SKIP는 로컬 parser 환경 한계이며 실제 WSL 검증 성공이 아니다. 프로세스 확인이 실행 후 이뤄진 인수 절차 누락은 기록했고 이전 suite 잔존 없이 현재 launcher/worker 한 쌍만 확인했다.
- Main 독립 B 검증: I1 보완 직전 핵심 Git/public READY/ABA 4 PASS/53.45s/exit0(session34066), 보완 후 runtime_next_action coherent 변조 거부 1 PASS/7.03s/exit0(session67752). Reviewer I1 해소 후 SPEC PASS / QUALITY APPROVED, Critical 0 / Important 0. 전체 검증 후 문서 마감 검토는 별도다.
- 정상 exact HOLD는 PASS하고 임의 dispatch·다른 HOLD·빈 문자열·필드 누락은 FAIL하는 계약을 유지한다. event494 canonical SHA 644592AE2E1FE61A074455358F786BC84AE4BA28D71D1EEF3AF87154B02314D2, derived2320 bytes/hash2A57298FA53B8D16AA399DEB9DE695620A20581B5FA85845B4C0EEE573647BE6 및 seq1~493·기존 approval/evidence는 변경하지 않는다.
- READY는 기술 준비 상태일 뿐 dispatch 허가가 아니다. runtime_next_action은 HOLD_EXTERNAL_EXECUTION_PENDING_SCOPE_RECONFIRMATION_AFTER_LOCAL_SEQ494_COMMIT 그대로다. private push·WSL·DB·실제 rollback/cleanup·Provider·Telegram·ysna·main 병합은 하지 않았다. 다음은 로컬 기록 마감 후 정확한 candidate/control/ref 및 실행 범위에 대한 외부 재개 조건 확인이다.

### 아래는 준비 당시의 누적 기록



## seq494 승인된 WSL QA 재개 사전 checkpoint / 2026-09-05

- Main 관리·단일 writer pg18_binding_resume. candidate `a342d62391a44b349733d1468ac3b180761155ab` / parent `ad3355baf0aa94da27b8cb6b5ee5a90215ee5994`, correction2 / candidate56 / record12 / post58. 기존 seq1~493·승인 원문·historical evidence 보존. 새 인간 승인을 작성하지 않고 기존 cleanup·ingress 승인 및 WI `52AA197F724F1D0AB59F061D187EFE3744ED86AFC52E5E504DA0E26C4BE04FF8`를 `MAIN_RESUMED_APPROVED_WSL_QA` derived로 연결한다.
- A 로컬 제품 검증: Producer focused7 PASS/22.23s, full76 PASS/1 Compose parser SKIP/363.15s(exit0), Main 독립7 PASS/35.19s, review SPEC PASS/QUALITY APPROVED C0/I0. B seq494 결박·전체 public READY 테스트는 아직 미실행이며 A helper 성공으로 대체하지 않는다.
- `READY_FOR_APPROVED_WSL_QA`는 기술적 준비 상태일 뿐 현재 실행 dispatch 권한이나 배포 성공이 아니다. 최신 PMO 지시는 이번 범위를 로컬 B494 검토·commit·clean postcommit까지만 제한했다. private push·WSL·DB·rollback·cleanup을 실행하지 않고 완료 후 외부 범위를 재확인한다. 현재 후보 push·배포·DB·실제 rollback·cleanup은 NOT_EXECUTED. Main의 predecessor3ref atomic FF push 및 Reviewer fresh clone/content validator/fsck0/residue0만 별도 확인됨. 실제 WSL은324/control3f52이며 ccf/5f8 배포 성공으로 기록하지 않는다.
- 기존 `.env` root:600과 `/srv/anvil-wsl/repo` root 소유권을 보존한다. 아래 자원·실행·정리 목록은 후속 외부 범위 재확인용 사전 계획이며 이번에는 실행하지 않는다. 후속 실행이 허용된 경우에만 Git-only candidate exact56와 그 direct-child control 및 raw manifest/action checksum을 검증한 뒤 Main이 bootstrap/control-runtime을 호출한다. bootstrap/control-runtime은 검증 전에도 제어 checkout·lock/active 경로를 만들 수 있어 read-only 검사로 부르지 않는다.
- 승인 자원: 프로젝트 `anvil-wsl-pg15`, `anvil-wsl-pg18rc`; 각 `anvil-db`, `anvil-web`, `anvil-ingress`(최대6 컨테이너). 기존 internal망 `anvil-wsl-pg15_anvil-wsl`, `anvil-wsl-pg18rc_anvil-wsl`은 internal=true. 승인 ingress-only non-internal망 `anvil-wsl-pg15_anvil-ingress`, `anvil-wsl-pg18rc_anvil-ingress` 두개는 ingress만 연결한다. app/DB outbound는 계속 차단한다.
- ingress image `nginx@sha256:a8b39bd9cf0f83869a2162827a0caf6137ddf759d50a171451b335cecc87d236`, user101/read-only/cap-drop ALL/no-new-privileges/tmpfs16m. `127.0.0.1:4770`, `127.0.0.1:4870` → ingress8080 → web3770, 원 Host/SSE 유지. ysna의 anvil-web:3770 단일 런타임이나 임시 UI Preview와 무관한 WSL 전용 QA ingress다.
- DB 볼륨은 `anvil-wsl-pg15_anvil-db-data`, `anvil-wsl-pg18rc_anvil-db-data` 두개만. PG15 mount `/var/lib/postgresql/data`, PG18RC mount `/var/lib/postgresql`. project/service/environment/cleanup-scope labels exact 및 anonymous volume0을 Main이 실측한다. 기존 PG15/18 image와 app image324 상태는 이전 read-only 증거이며 새 배포로 간주하지 않는다.
- 수명: C-21 WSL 검증 동안만 사용하고 성공 증거·복구 자료 보존 후 정리한다. Main 실행 순서는 pinned `control-runtime.sh deploy a342d62391a44b349733d1468ac3b180761155ab` → verify → genuine previous324 rollback → 실제 image/current/health/SSE/DB 독립 관측 → 후보 재배포·verify → cleanup. 각 action에 immutable control SHA/raw manifest/action checksum을 전달한다. rollback approved_commits는 `[candidate,324]`만 허용한다. 이전 dump/receipt는 재배포로 갱신되기 전 별도 보존한다.
- 정리 명령은 검증된 control의 `control-runtime.sh cleanup a342d62391a44b349733d1468ac3b180761155ab`(내부 cleanup.sh)이며, 양 프로젝트 label allowlist를 모두 확인한 뒤 서비스3종·비어 있는 전용망4개·지정 볼륨2개만 제거한다. 이미 없는 자원은 idempotent 처리하고 unrelated 자원/기존 `.env`/자료는 보존한다. Main 최종 Docker inspect/list로 지정 container/network/volume 및 restore scratch DB/cookie 잔류0을 검증한다. 실패 시 부분 상태를 각각 기록하고 전체 PASS를 선언하지 않는다.
- Telegram·Provider 실제 호출, ysna 실행, main 병합 제외. C-21 실제 검증 결과 후에만 별도 결과 event를 append하고 C-01은 독립 판정까지 차단한다. B finalizer는 현재 HEAD와 historical bytes를 검증하며 같은494 event만 재결박하고 다른494는 덮어쓰지 않는다.



## seq493 로컬 결박 검증 완료 / 2026-09-05

- 최종 producer 전체 tooling130 PASS/445.50s, harness69 PASS/1 Compose parser SKIP/399.44s(exit0, 각1회). Main 독립 critical3 PASS/36.72s와 historical raw239파일 감사 PASS, reviewer archive402/기존 validator AST 보존 PASS. 이는 로컬 개발·기록 검증이며 이번 WSL/서버 실행 결과가 아니다.
- 현재 local candidate5f8c301/parent48fbad8를 seq493 exact12로 결박했다. 실제 잔류 runtime324eb169/control3f52d26 및 이전 미배포 candidateccf5109/control48fbad8는 서로 다르다. 로컬 I-3 보완 완료와 `BLOCKED_EXTERNAL_EXECUTION_NOT_IN_SCOPE`/public guard22를 함께 유지한다.
- 같은 생성기+finalizer 재실행 결과12파일 hash 동일/이벤트493 byte 불변(exit0). 최종 Main 기록 검토에 인계하며 외부 push/merge/배포/DB/rollback/cleanup/Telegram/Provider는 하지 않았다.

### 아래는 seq493 준비 시점의 누적 상태

- 담당: Main 어울 관리, 단일 writer pg18_binding_resume. 제품 후보 `5f8c301e18c332e3353092dab9efe5c32d0fda84`, parent `48fbad8be35c7e826dd31363464c7c477d9ca9e8`, correction exact2. 내부 기록 예상 exact12, validated base 누적 candidate54 / record 후56.
- I-3 rollback approved_commits membership 누락은 기존 승인 계약의 제품 구현 결함으로 보완됐다. Producer focused10 PASS(21.78s), 전체 harness69 PASS/1 parser SKIP(346.77s, exit0), Main 독립 focused10 PASS(25.19s), SPEC PASS/QUALITY APPROVED는 로컬 제품 증거다. 새 seq493 결박 테스트는 아직 미완료이며 이전 결과로 대신하지 않는다.
- 직전 로컬 ccf5109 candidate/48fbad8 control은 미push·미배포. 실제 WSL 잔류는 candidate324eb169/control3f52d26이며 보조 internal transport의 API·SSE·Last-Event-ID·backup/restore 성공과 정식 localhost ingress 실패는 과거 증거 그대로 유지한다.
- 현재 gate는 `BLOCKED_EXTERNAL_EXECUTION_NOT_IN_SCOPE`. public guard는 고정 exit22로 실행을 거부한다. 제품 I-3의 로컬 보완과 외부 실행 허용은 별개이며 이번 기록 범위에서 push/merge/배포/실제 rollback/cleanup/DB/Telegram/Provider를 수행하지 않는다. C-21 완료나 C-01 시작으로 승격하지 않는다.
- 기존 seq1~492와 historical evidence/approval 원문은 보존하며 seq493 이벤트 단1개만 append한다. cleanup·ingress human approval hash를 유지하고 seq492 derived hash를 부모로 새 내부 구현 수정 binding을 연결한다. 원격 관측은 09:59의 3f52/324 확인이며 새 원격 관측으로 표현하지 않는다.
- 다음: seq493 정적 원문 검토 → focused RED/GREEN → tooling/harness 각1회 → checksum/계보/변조 거부 확인 및 Main 검토. 서버·네트워크·Secret 변경은 없다.


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
