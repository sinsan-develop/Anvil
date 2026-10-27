# P03 보호 사본 실행 준비 — 단일 작성 업무

Main 어울 · 2026-10-27 · source/fake 준비만. 정본 범위 P03_PG_COPY_PREPARATION_SCOPE_20261027.md SHA009EA66913339B31A08F53900515BD0B5F518F5AD114215AD2C65CB47B67C44E. PMO 직접 전달은 기존 승인 계획 안의 이 준비에 추가 사용자 결정이 필요 없다고 확인했다. docs/approvals/P03_PG_COPY_SOURCE_PREPARATION_DECISION_20261027.json은 **실행 grant가 아니다**.

## 목표·단일 작성 범위

보존 원본 RO→새 보호 사본 RW·원본 전후/사본의 내용·선정 metadata 대조에 필요한 controller/shell·합성 검증·정확 실행안을 한 호출선으로 준비한다. 임포트/기본/plan 모드는 외부 환경·Docker·파일 mutation0이다. 실제 apply는 별도 정확 실행 결정/새 단발 기록 없으면 거절하며 이번 업무에서 실행0이다.
기준 branch codex/av3-stage-b, HEAD7b633d922479b3090cf283aecb4fac58a777b81a. 원R2 controller/shell·시험4와 보호8은 신규 manifest에 raw로 고정했다. 이전 조사·UI/FN04/소진 marker·사용자 dirty를 수정/재검사하지 않는다. Main은 제품 파일을 쓰지 않는다.

허용 정확5:
1. scripts/p03-pg-copy-host.ts
2. scripts/pg-recovery-copy.sh
3. tests/unit/P03/pg-recovery-copy-host.test.ts
4. tests/unit/P03/pg-recovery-copy-preparation.test.ts
5. docs/work_packages/P03_PG_COPY_EXECUTION_PLAN_20261027.md

새 dependency/image/install·프로젝트 앱/DB/API/권한·source 외부경로 쓰기·WSL/SSH/Docker·실제 도구probe/복제·Bash의원내용모드·PG/Agent·실grant/소비 작성·Git/PR/merge0. shell은 LF·정확 raw로 준비한다. Main이 실제 실행안을 보고할 때 미래 exact commit/hash를 별도 결박한다.

## 고정 설계와 과장 금지

- FIXED_COPY/proposalCopy/parseCopyArguments/runCopyHost/createCopyDockerAdapter/createCopySystemPorts/parseCopyResult를 내부 공개 접점으로 고정하고, 옛 FIXED/R2 grant/scope를 넓히거나 소진 원장을 재사용하지 않는다. 기존 code/import/default 무효과 원칙을 유지한다. CLI는 plan/apply만·임의 이름/volume/source/실행파일·위험 우회flag0.
- 후보의 source·ledger·volume·tools/init/copy helper 이름/이미지·daemon·RO/nocopy/networknone/publish0/예산을 literal로 동결한다. image 선언VOLUME은 probe/init의 전용 tmpfs 또는 copy의 원PGdataRO로 덮고 익명volume0·추가mount0이다. 각create뒤fullID/nonce/role/image/entrypoint/argv/user/caps/network/ports/mount를검사하고불일치는start0/보존.
- init은 원본 mount0·새 사본만 RW. host에서 신규volume label/instance/CreatedAt 귀속을 검증하고, init은 같은 볼륨의 빈root·예상UID/mode/regular/nonlink를 확인한 뒤 root한 곳만 chmod/chown한다. 재귀chown/chmod0·기존 대상0. 필요한 정확UID/capability/argv를 실행안에 쓰고 최소권한으로 고정한다.
- copy는 UID999/GID999·capdropALL·원본RO/사본RW/보호audit tmpfs만. 하위소유/장치/링크·특수/hardlink·도구/공간·선정metadata가확정되지않으면미확인으로닫는다. 원본copy전·후·사본의반복비교·원본/사본identity/소비자관측시점을고정한다. RO/전후hash로writer부재나point-in-time완전성을보증0. 새한정위험결정없이UID1001/ACL/xattr/quota/writer미확인정상화0.
- logical256MiB는자료범위의사전guard이며실filesystem할당hardquota라고부르지않는다. 실제availablebytes/inodes·할당/manifest/sort임시공간/reserve·quota미관측과실행중변화한계를구분한다. 강제상한이없으면그사실/새위험조건을명시하고승인없이copy0. 숫자overflow·무제한·silentlyskip0.
- NUL-safe 상대경로 record는개행/탭/공백/구분문자/비UTF8에도모호하지않아야한다. root/빈directory 포함·mtime정밀도·file길이/UID/GID/mode·선정ACL/xattr·하드링크판정을정하고allocatedblocks/inode번호/atime을내용동일성으로오인하지않는다. 민감manifest는PGdata가아닌0700/0600보호tmpfs안에서처리·폐기하며stdout/Git/대화/receipt에이름/개별hash/원문0. 외부출력은whitelistenum·집계·전체지문만.
- cp/find/hash/sort/cmp의오류·짧은출력·중복/누락·부분NULframe·stderr와sort임시파일도private/bounded다. 빈manifest/도구exit0만으로성공0. 실제이미지의도구기능/도구hash/metadata는미관측으로정확표시한다. 선행지원/도구검증은미래한copy실행안안에서수행하도록준비하며확인불가능한특정사실만별도probe필요로보고한다.
- 전체600초·source단계500초와cleanupreserve는하나의monotonicdeadline에결박,단계마다시간재설정0. 시작잔여부족이면그mutation/start0. kernel/daemon불명종료까지기한내강제회수보장0. stdout16KiB/control256KiB/audit32MiB/pids32/memory256MiB/CPU0.5·entry100000 등후보값을명시하고실제run승인으로오인0.
- grant는exactscope/commit/controller·shellhash/이름/최초승인창최대30분/nonce/선정위험결정에결박하며최초Docker mutation전O_EXCL단1회소비. 실제owner·Node/Git/Docker/부모/proc/handle/hash·loader/교체위험과새사람결정한계를명시하고externalUserApprovalVerified=false유지. 옛R2위험ack/다른scope/다른grant/재소비/만료는거절.
- 정상/실패 모두원본과새volume보존. remove는정상exit/close·동일fullID/role/nonce/mount확인한자신helper만. volume rm/force/SIGKILL/자동재시도/다른서비스영향0. deadline에서확인된자신helper SIGTERM1/유한관측만; PID/ID/close/IO불명·원장실패는UNKNOWN/보존/필요조치다. preflight/create/init/copy/verify/cleanup실패별 helper·volume·원장 상태표를실행안에넣는다.

## TDD·검수 순서

1. TEST_ONLY: 신규시험2만먼저쓴다. 공개 runCopyHost/proposalCopy 등의 실제부재 RED와, plan/default/provider 미사용·grant/실행순서·sourceRO/init/예산/실패보존/비밀없는출력을검증한다. fixture/type오류를기능RED로대체0. 코드/실행안/실probe0으로동결·해시/정확Main실행명령을제출한다.
2. Main fresh RED 뒤 같은담당에게만 신규controller/shell/실행안 GO. 실제Docker/WSL/DB/FS grant는fakePorts만·부수효과0. 모든정상/실패/지연case는유효한단발권한·생성귀속·정확상한과비밀방어를실소비하도록한다. source/helper만만들고호출선미연결을완료라고하지않는다.
3. 실제shell grammar는확인된Git-for-Windows Bash가있을때 -n만가능하다. WindowsApps bash/WSL launcher는실행0. default/source의무효과·framing함수는순수합성stdin만의로컬시험을허용하되실copy/init/probe모드0·임시파일0으로준비한다. 가능범위를넘으면정확히NOT_RUN으로보고한다. 실제image기능/복사/PG는시험하지않는다.
4. 신규집중·필요직접인접/type/diff만실행한다. 원R2전체/완료UI/FN04시험반복0. 제출은변경5raw·전후diff·실명령/exit/count·오류/미검증·rollback(미적용소스정상revert만)/실행안이다. 보호12지문/실제효과0/소비0을확인하고동결한다. Main·독립검수·안전게시뒤별도실행결정을요청할수있다.

## 다음 실제 승인 경계

이번source준비는copy/create/권한/원내용hash/PG/SQL/서비스를승인하지않는다. 검토된exact source/실행안과실제새대상·범위·남는위험을구체적으로정리한뒤에만실제실행결정을받는다. source준비성공을기능사용가능/DB무결성/복구완료·전체계획완료로승격하지않는다.
