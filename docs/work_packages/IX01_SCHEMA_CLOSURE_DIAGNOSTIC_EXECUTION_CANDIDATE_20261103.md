# IX01 schema 의존 한정 진단 — 실제 실행 후보
2026-11-03 · Main 어울

**NOT_APPROVED / NOT_READY_TO_RUN**. 이 문서는 준비 중인 실제 실행 범위를 보여준다. source 구현 승인이나 기존53개 시험을 새 DB 실행 승인으로 해석하지 않는다.

## 목적·필요성
현재 프로젝트 생성과 파일 저장은 quota_adopt_creation/최신 quota_complete에 연결된다. 기존53개에 없는0042·0058·0059·0072·0073 및 metadata 정의의 설치 선행을 확인해야 한다.
새 빈 PG에서 선택한 고정 SQL의 정의 설치가 어디서 실패하는지 확인한다. 원 SQL을 바꾸거나 guard/권한을 낮추지 않는다. DDL 설치 성공도 함수 runtime/RLS·실제 문서 여정·IX01 합격은 아니다.

## 실행 전 반드시 채울 결박
- 검수된 driver code commit/hash: 미정. source 구현·독립 검수 후 고정한다.
- SQL baseline: d2f6ab8c74fad09f26319f77b3acb80afe3f927b.
- tracked SQL allowlist106개: 생성 중. index raw hash·총bytes를 검수 후 고정한다. 표시는 적용 순서가 아니다.
- slot별 선택 순서/원문 digest: 미정. 확인된 의존 DAG를 근거로 명시하고, 허가된 index 밖 추가/본문 변경0. 다음 slot은 앞 결과와 정리 증거를 대조한 뒤에만 선택한다.
- 실행 입력/원 기한/hash 및 정확 code SHA의 새 빈 Git checkout: 미정. 기존 인증만 사용하며 실제 key/credential 설정 변경0.
이 항목이 비어 있으면 실행 요청·실행을 하지 않는다.

## 새 전용 자원 후보
| 대상 | 환경·소유·제한·정리 |
|---|---|
| 실행 장소 | 기존 WSL-server Anvil 개발 대상·Linux 비root daon/UID1000. 예상 Docker daemon e3349f1d-dbfc-478a-96d9-295bf6c6839e는 과거 기록이므로 실제 전 다르면 중단 |
| source checkout | 신규 /home/daon/anvil-ix01-ddl-20261103-r1-qa. 기존 경로/자료 재사용0. 검수된 code SHA를 기존 private Git에서 받음. 종료 뒤 owner/realpath/link/dirty를 재검산해 새 소유 source만 정리 |
| PG image | 기존 cache sha256:594290e91b09c09728ed945ff89db65cd0fafff251f7c03c3d99c00ae5d9442f. pull/build/갱신0, 부재/불일치면 생성 전 중단 |
| 컨테이너 | 신규 anvil-ix01-ddl-pg-20261103-r1-a1/a2/a3. 동시1·각 slot 일회·전체 창≤30분/slot≤10분. 앞 slot UNKNOWN/미정리 시 다음0 |
| 격리 | network none/포트0/hostbind·named·anonymous volume0. PGDATA/socket/tmp는 명시 tmpfs만. read-only root·UID999:999·capdropALL·no-new-privileges·pids64·memory512MiB·CPU1 |
| DB/역할 | 신규 anvil_v3_ix01_ddl_20261103_r1_a1/a2/a3. 빈 합성 DB와 기존 QA source와 일치하는 비 superuser app/migrator 역할만. 오류 회피용 권한 상승0. Docker 내부 socket만 사용하며 기존 사용자·DB·비밀번호/키를 읽거나 바꾸지 않음 |
| 소진·감사 | 신규 /home/daon/.local/share/anvil-v3-qa-receipts/ix01-ddl-20261103-r1. owner/link/0700·파일0600/O_EXCL·원 입력hash/기한·fullID를 보존. 비밀 없는 소진 원장은 의도 보존하고 잔여0 주장과 구분 |
| toolchain | 기존 Bash/Git/Docker/기존 Node24 내장 모듈. Node24 실제 존재는 아직 미확인이며 없으면 자원 생성 전 중단. 자동 설치/fallback0 |

## 실행·중단·정리
1. 승인·고정 입력·source/기한·대상/이름 부재·image/declared VOLUME·원장/owner를 검산한다.
2. 일회 의도를 남긴 뒤 create fullID를 획득하고 label/image/mount/port/network/자원 한도를 시작 전 재검산한다.
3. 새 PG의 준비와 합성 역할을 확인하고 선택 순서만 원 Git SQL bytes로 적용한다. 중복/미선택 파일·inline SQL/임의 경로·자동 전체 설치0.
4. 최초 실패의 code/대상과 bounded≤16KiB 비밀 없는 출력을 보존하고 즉시 그 slot을 끝낸다. SQL file≤30초/metadata command≤10초, source file≤2MiB/총≤16MiB.
5. 확인된 원장·create fullID·label/image·mount/port/network가 모두 일치하는 새 QA만 종료·제거한다. 필요 시 새 일회 QA container에 한정한 강제 제거를 실제 승인 문구에 명시한다. 기존 서비스/PID/volume/네트워크/host path는 대상0.
6. create/COMMIT/종료 결과 불명·출력 소실·신원 불일치는 보존/보고하며 성공·미전달로 추정하거나 다른 이름으로 재시도하지 않는다. cleanup 부재도 별도 조회로 확인한다.

## 영향·제외·선택
기존 정식/복구 DB·P03 R3/원 volume·실사용자/회원/권한·실제 key/Secret/CA·API/Web 서비스·Agent/LLM 비용·ysna/Oracle·외부 배포는 전부 제외한다. 이 실행은 그 상태를 복구하거나 변경하지 않는다.
권장 A는 최대3개의 일회 slot으로 서로 다른 명시 후보 순서만 진단하는 안이다. 더 작은 B는 slot1 한 번/10분만 허용하고 결과 후 추가 판단한다. C는 실제 실행 없이 source 검토를 유지하되 SQL runtime 미확인을 남긴다. 모두 현재 미승인이다.

현재 사용자 조치를 요청하지 않는다. 검수된 code/index/첫 선택 순서·입력hash와 정확한 명령을 채운 뒤 기존 source-only 경계를 벗어나는 **새 임시 PG 기동·합성 DB/DDL 실행·한정 정리**만 별도로 결정받는다.

## r2 — 실제 실행 선행 미충족 보완 (2026-11-03)
- 이전 후보 SHA D48D8B5F49DC24449BF7E33140947CBFB4E68E51F80B06C3E82A952058B246F6는 역사 snapshot이다. 판정 NOT_APPROVED / NOT_READY_TO_RUN을 유지한다. 앞 표의 runtime/수명 설명은 아래 정정에 따른다.
- code3은 동결됐으나 아직 이 후보에 게시 SHA를 결박하지 않았다. SQL index raw SHA dc8b5fc0fc6fc980ec28c7c5dc367bee2cbaf1b20f877c06ff6e97851d286045,106 Git blob 지문/크기를 Main4509c1에서 대조했다.
- 전체 후보는 기존 manifest53의 실제 builder 순서+최초 추가 이력 및 직접 FK/ALTER/alias를 대조한 후행52=105개다. 0031_empty_project_methodology_application.sql.pending 1개는 이미 prefix의 .sql과 같은 정의이므로 제외한다. 순서 hash(JSON.stringify(selected), UTF-8, 끝개행없음)는 09d2e7d5cd8715a0ff02540d4397db2d4cb8dcf818d808ce328423d7583f24ef/5420B, SQL 합2376107B. 순서의 PG 실제 타당성·미정 간선0을 보장하지 않는다.
- 비특권 bootstrap 유지 시0065까지96개 후보의 orderHash는98a6f1bac74eba21ff2825de5f5a493349b0141174e2f5954edc2836eb1a26dc/SQL1816707B이다. 이는 최신 collector0073/0074를 제외하므로 전체 IX01 실행 준비가 아니다. 검증 범위를 줄여 전체 합격으로 바꾸지 않는다.
- 0066은 CREATEROLE 또는 superuser 및 reader role 부재를 강제하며0073도 같은 선행을 요구한다. 현재 bootstrap NOCREATEROLE/NOSUPERUSER과 충돌한다. 알려진 권한 거절을 시험으로 반복하거나 SQL/guard/권한을 바꾸지 않는다. 이후105 후보 실행은 새 일회 QA 역할 선행의 정확한 결정이 필요하며 아직 미채택이다.
- 원장 아래 신규 빈 docker-config/0700, owner.json/0600 및 열린 부모 directory FD 검산이 필요하다. source/원장 생성 자체도 아직 실행하지 않았다. 전용 root의 소진 감사는 보존 대상으로서 QA 잔여0과 구분한다.
- 새 PG는 암호/키/Secret 생성 없이 내부 Unix-only local trust/host reject/listen_addresses 빈 값이며 Docker log-driver none을 고정한다. 외부 포트·network·로그 전달0을 source로 의도했으나 실제 inspect 검증은 NOT_RUN이다.
- Node는 개발환경 과거 등록의 /opt/node-v24.22.1-linux-x64/bin/node root:root/0755/126879696B/SHA e32e2d16081cf644f88392934288086e7662529d0d43277c34f7aad2207cfafb를 실행 전 확인한다. 현재 WSL 존재 확인/설치0이며 부재·차이면 생성0으로 중단한다.
- UNKNOWN이면 자동 mutation·정리·다음 slot0이다. 자원은 원기한을 넘겨 남을 수 있고 수동 소유 검토가 필요하므로 '30분 안에 무조건 정리0'으로 요청/보고하지 않는다. 실제 허가 질문에는 이 제한과 임시 QA의 정확한 종료·제거 범위를 밝힌다.
- 현재는 PMO에0065까지96 한정안과 전체105의 역할 선행 판단을 요청했다. 이것이 신산님의 source-only/실제 DB·권한·키·서비스·Agent 제외를 해제하지 않는다. 실행 입력·원 기한·code SHA·선택안이 미정이므로 지금 실제 실행 승인 질문도 하지 않는다.
