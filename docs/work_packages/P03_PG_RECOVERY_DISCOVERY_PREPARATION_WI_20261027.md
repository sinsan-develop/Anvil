# P03 보존 PG의 RO 구조 metadata 조사 준비 WI

2026-10-27 · Main 어울 · source f3d5357c099e6ef0edb79e7aa89d0eb888b319f3.

## 목적과 권한
정식DB 기능 검증은 보존volume 복구선행이 미완료다. 전체복구안을추측으로실행하지않고 P03_PG_RECOVERY_DISCOVERY_SCOPE_R2.md SHA6FC9A7CB0F6421944C60E7E8987DDF9579B9599F1844935381A58FC7CBE5E860의새RO단위에필요한정확script/argv/hash를source-only로준비한다. 기존PG_VERSION실측은반복하지않는다. 자료내용/Secret/원문/hash·PGbinary실행·DB접속·copy·PG기동은이번에하지않는다.
이번은승인계획의필수개발준비이며새공개API/DB계약이나실제새container/원volume읽기허가는아니다. 실제실행은별도정확직접결정전0. source준비를기능완료로계산하지않는다.

## 단일 writer 허용3경로
1. scripts/pg-recovery-discovery-readonly.sh 신규
2. tests/unit/P03/pg-recovery-discovery-preparation.test.ts 신규
3. docs/work_packages/P03_PG_RECOVERY_DISCOVERY_EXECUTION_PLAN_20261027.md 신규
Main소유현황/WI/계획·기존source/PGprovision·보호8·원native/승인/marker수정0. 새branch/worktree/채팅/자동화/commit/push0.

## 고정 실행 후보·경계
name anvil-v3-pgdiscovery-20261027-r2; cachedfullimage sha256:594290e91b09c09728ed945ff89db65cd0fafff251f7c03c3d99c00ae5d9442f; sourcevolume anvil-v3-development-pgdata→/var/lib/postgresql/data RO/volume-nocopy. 조사uid/gid999:999와실PGuid/gid는구별한다. networknone/publish0/rootfsRO/capdropALL/no-newprivs/pids32/memory128MiB/CPU0.2·전체60초/내부55초/출력8KiB/entry100000의제안한도를유지한다. 사전존재/정의불일치/추가VOLUME/익명volume/권한실패는실행하지않거나고정FAIL이다.
실제PGUID/도구주소/기능은미실측이다. 고정bootstrap후보 /usr/bin/timeout 및 /bin/bash 는imagefullID안의literal후보로만표시하고검증됐다고기입하지않는다. 명령실패면고정실패·다른image/tool/UID/주소의자동대체0. 실제명령에미해결placeholder를남기지않되미실측지원은정확한한계로표시한다. 안전하게고정할수없는사항은Main에정확미진을보고하고실행가능주장0.
Docker/SSH/WSL/Git fetch/원volume조회는이담당이실행하거나자동화하지않는다. 실행안에는검토용정확create→inspect→start1회→종료확인→자신fullID rm(-f/-v없음)순서와조사스크립트를 Git exact SHA로 가져오는 원칙을 한국어로 고정한다.

## shell source 요구
- source/import와인자없는실행은메타읽기·도구실행·FS쓰기0이며PREPARATION_ONLY만출력한다. 실제조사함수는명시고정인자/호출때만진입한다. 이문자열이사람승인을인증한다고주장하지않는다.
- 경로/명령/image/UID/한도를임의인자/환경변수로확장하지않는다. source root는고정literal, PATH에sourcevolume/현재폴더를추가하지않는다. profile/BASH_ENV/ENV실행을차단하는고정invocation을실행안에명시한다. eval·source된설정·file이름으로명령실행0.
- image내postgres와필수coretools는소수고정literal만확인해정규image파일/canonical허용대상·rawSHA를관측한다. postgres실행0/전체image검색/export/새설치0. tool지원불명은TOOL_SUPPORT_UNKNOWN으로끝내고검증된것으로합성하지않는다.
- postgres계정숫자uid/gid만id로관측한다. passwd/환경변수본문·home/shell·키출력0. source root숫자uid/gid/mode/type만관측한다. 원PG_VERSION은읽지않는다.
- find -P/-xdev의metadata열(type/device/inode/numericUID/GID/mode/size/blocks)만집계한다. filename·symlink대상·파일내용/hash출력/읽기0. 일반file/dir/link/특수file entry수·고유inode수·regular file logical/allocatedbytes를구별한다. 이것이filesystem전체실제점유/미래copy필요공간이아님을명시한다.
- 집계함수는수치metadata stream만받아in-memory로처리해synthetic검증할수있게한다. hardlink는device/inode별중복제거·entry100000/안전정수/필드오류/권한·부분순회실패로닫는다. 부분집계를완료true로반환하지않는다. 원stderr를로그에내보내지않고고정코드만반환한다. 어떤temp파일/목록파일도만들지않는다.
- stdout은허용toolpath/hash·숫자/root/집계/상태만JSON으로최대8KiB. 숫자이외source열/예상외값을원문으로오류에넣지않는다. 일반문자열경로는고정닫힌목록만허용한다.

## source 준비 검증·행동 제한
TEST_ONLY먼저: 신규unit은임시파일이나실제volume대신고정numeric metadata stream으로정상/hardlink/부분·악성필드/entry·숫자상한을검사하도록작성한다. source모듈부재행동RED를Main에보고하고제품source전중지한다.
허용되는실행은새Nodeunit과이미설치된localGit Bash의 -n 문법검사/함수정의 import+synthetic집계뿐이다. localGit Bash가없으면미검증으로보고·설치/WSL/SSH/Docker대체0. C:/Program Files/Git/bin/bash.exe가존재하는지읽기확인하고사용할때는 --noprofile/--norc 및BASH_ENV/ENV비활성·필요최소env로한다. 실제조사main/metadata접근은실행하지않는다. 기존preparation/PS/컴파일시험·실pwsh·PG/도커명령재실행0. 명령선택filter로다른기존시험을실행하지말고명시신규파일만검증한다.
새unit/새script만으로의회귀/문법·필요type/diff/독립C/I0한정이며현재image지원·실source구조/권한·metadata완료는NOT_RUN이다. 전용임시자원생성0,원volume/DB/Secret/서비스/Agent실행0.

## 결과와 다음
허용3지문/정확명령·exit/실행된로컬도구·오류/미검증·source-only한계·fixedliteral/non-ready조건을보고후동결한다. Main이실행안rawhash/private게시를검수한다. 그후에만새RO효과의정확실행결정을준비한다. 실제복제/사본PG기동/정식전환은이번에서계속제외한다. rollback은소유3파일후속revert·원volume/키/기존자료자동삭제0이다.
