# P03 보존 PG 복구의 선행 RO 조사 범위 R2

2026-10-27 · Main 어울 · 지원 계획 후보/실행 승인0.
기존 P03_PRESERVED_PG_VOLUME_RECOVERY_REVIEW.md와 PMO의원본RO사본→사본격리검증→전환별도방향은유지한다. 전체복구를바로실행하지않고미확정사실을얻을별도최소RO단위부터정확히준비한다. 기존 PG_VERSION 시험은완료했으므로반복하지않는다.

## 1. 현재 사실과 부족한 정보

역사관측은 daemon e3349f1d-dbfc-478a-96d9-295bf6c6839e, 원volume anvil-v3-development-pgdata·instance dc22a0629e79f259dcd935845e88e58e·소비자0, 캐시image sha256:594290e91b09c09728ed945ff89db65cd0fafff251f7c03c3d99c00ae5d9442f/digestpostgres@sha256:6eb0add3b77c081df18aa518ce43df58fdcc40f2e6d868a6fd08038dc7acd425다. 현재형태를승인전에fresh확인해야하며현재지원이실행허가는아니다.
원본내용무결성·cluster완전성·schema/migration·WAL/외부참조안전·실DB/서비스ready는미확인이다. 원volume·기존PG설정/Secret은수정하지않는다.
미확정은image내postgres/복제·검사도구의정확경로/hash/지원기능, PG계정숫자UID/GID, source root소유/권한/용량/inode구조다. QA UID999를실PGUID로치환하지않는다.

## 2. 새 RO 단위의 후보 자원·한도

| 항목 | 제안값/영향 |
|---|---|
| 신규helper | anvil-v3-pgdiscovery-20261027-r2, owner P03/Project Main |
| image | 위fullID·pullnever, 재검증필수 |
| 조사주체 | uid/gid999:999, 조사주체일뿐PG계정확정아님 |
| source | 원volume를/var/lib/postgresql/data에RO/volume-nocopy |
| isolation | networknone/publish0/rootfsRO/capdropALL/no-new-privileges |
| resource | pids32/memory128MiB/CPU0.2·전체60초/내부55초·출력합계8KiB 후보 |
| traversal | filesystem경계비진입·symlink비추종·entry100000상한 후보 |
| 금지 | copy·source내용/hash·PG_VERSION재조회·PGbinary실행·DB/SQL·Secretbind·새tool설치·이미지전체export |

이미지선언VOLUME이등록된PGdata1개와다르면중단하며추가익명볼륨을만들지않는다. 실제생성전literal부재/daemon/image/원volume소비자·label을대조하고생성후fullID/image/entrypoint/argv/UID/network/mount1/RWfalse/추가volume0을확인한뒤에만단1회start를검토한다. 이문서만으로create/start하지않는다.

## 3. 읽을 정보와 내보내지 않을 정보

1. 이미지내postgres및필수shell/timeout/find/stat/집계/hash/id도구의소수literal후보를검사한다. 이미지전체 / 검색0. 정확경로·도구자체rawSHA·일반파일/허용이미지link대상만공개후보로보존한다. postgres는바이트hash읽기만하며 --version등실행0이다.
2. 지원이확인된id명령으로postgres계정의숫자uid/gid만관측한다. passwd본문/home/shell/Env/키출력0. NSS/계정미확인은PG_ACCOUNT_UNKNOWN이다.
3. source root의종류/숫자UIDGID/mode를stat하고일반file/dir/link/특수file entry수·고유inode수·logicalbytes/allocatedblocks×512를집계한다. hardlink는device/inode별중복을분리한다.
4. filename/설정내용/Secret/원문/PG_VERSION/symlink대상은출력하지않고source본문/hash도읽지않는다. 접근거절·부분순회·상한초과는완료true가아니라고정실패enum이다. 다른UID/권한확대로자동재시도하지않는다.
5. 공개출력은허용image도구경로/hash·숫자PG계정/root metadata·집계·완료여부만JSON으로한다. 원stderr·오류message·경로dump0, 합계8KiB초과는실패다. 원데이터안전/DB준비완료로승격하지않는다.

## 4. source 준비에서 먼저 고정할 것 — 아직 미충족

이문서는아직실행준비완료가아니다. 다음담당이단일작업에서실행하지않는준비소스/정확스크립트/정리절차와rawhash를고정하고독립검수해야한다.
- bootstrap으로쓸image내shell/timeout의literal주소·어떻게imagefullID신뢰와개별hash미확인한계를구분할지명시한다. 확인되지않은주소나GNU기능을검증됐다고기입하지않는다.
- find -P/-xdev/-printf·stat·pipe실패전파·inode집계도구가해당image에서지원되는지미확정이다. 지원불가면TOOL_SUPPORT_UNKNOWN으로종결하고대체image/tool/권한으로확대0이다.
- 실제script/정확argv/rawhash·합계시간/출력상한을수행전동결한다. placeholder명령을실행가능안으로승인요청하지않는다.
- Source metadata만으로복제중불변을보장하지않는다. 본복제단계의전/후source hash·사본대조와단일작업창/새writer통제는후속별도계약이다.
- 복구설정include/SSL/restore/archive/preload/standby/pg_wal/pg_tblspc등내용·외부참조는이번metadata범위밖이며, 사본PG시작전별도검수로남긴다.

## 5. 종료·정리·보존

등록helper만관측해정상종료후정확fullID/image/label/mount대조뒤 docker rm fullID로회수한다. -f/-v/원volume삭제0. 시간초과는확인된자신helper에정상SIGTERM단1회요청·유한관측을제안하며미종료/신원불명은STOP_UNCONFIRMED로보존/보고한다. force kill/재시작확대0·kernel대기까지60초강제종료보장0이다.
정리뒤helper부재와원volume보존을별도관측한다. 사본은아직생성0이며원볼륨은자동폐기0이다. 실제DB/copy/PG기동·API/Web/TLS/서비스·Secret/권한/Agent/비용은이단위에포함하지않는다.

## 6. 다음 순서

source-only정확준비→독립검수/지문고정→신규RO효과의정확직접실행결정→metadata1회→얻은실제값으로복제/사본PG안동결→각실행/전환별도결정이다. 범위가다른승인이나침묵을새container/원본읽기허가로사용하지않는다. 이지원정리를사용자기능구현완료로계산하지않고FN16등독립기존계획은별도계속한다.
