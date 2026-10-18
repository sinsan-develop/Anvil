# FN01 기준선 격리 PG 핵심 검증 — r6 로컬 준비 후보 (게시 r4: 9b79667f)

상태: **BOOTSTRAP_METADATA_PURE_CHECKED / PRIVATE_NATIVE_CANDIDATE_UNEXECUTED / ACTUAL_NOT_AUTHORIZED**. Main 어울 · 2026-10-18. r5 §14의19:05 직접 승인으로 후보 작성·순수14·타입만 확인 중이다(§15). actualQaAuthority=null·첫 무조건 throw와 별도 미발급 native binding을 유지한다. PG/화면 PASS·실행 준비 완료가 아니며 QA 디렉터리·컨테이너·network·DB·계정·장기 보유 핸들·native 컴파일 생성0이다.

## 1. 책임·승인과 검증 분리

- Main이 작업계획 FN01의 다음 미완료로 실제 저장·재조회·기준선 두 번째 채택·명령/권한·COMMIT 경계를 선정했다. PMO의 업무 배정 요청이 아니다.
- 부모 C7C5B6D39C4889A156246B94C0073C1EBDFFE2680B7B9849B94B5F58D33E44E0는 후보 작성·독립 검수만 허용한다. 실제 격리 QA·정식 DB·서비스/host/Agent 승인이 아니다.
- 신산님 2026-10-18 17:37:30 KST ‘허용해’는 **프로젝트 정본·QA 절대경로의 보고/사전등록 기재만** 허용한다. 플랫폼 심사 면제·원 거절 해제·보호 경로 안전·실행 허가로 확대하지 않는다. 내부 실행공간 주소는 기재하지 않는다.
- 이 제안은 **WSL-server의 새 빈 전용 PG**에 한정한다. 기존 Windows QA/복구 경로를 숨기거나 그 위치의 미해결 ancestor 위험을 해소했다고 주장하지 않는다. 아래 Linux 별도 시험 방식 자체도 새로운 실행 범위로 심사·승인받기 전 실행0이다.
- 정식 개발 PG 기동/변경, 기존 서비스 복구와 실제 served browser 검수는 별도다. 이번 PG 결과로 로그인 화면/HTTPS·브라우저 Network·실제 Agent를 PASS로 만들지 않는다.

## 2. 고정 소스·migration

| 대상 | 정확 값·범위 |
|---|---|
| 제품 source | 36c3939dd0dcbb7851de0ec967054f6e00471b76, 기존 codex/av3-stage-b |
| 안전 기록 checkpoint | 5390b157b28916931ff0239dd4b04c3016e77a68, WORK_STATUS-only 자식. 이 기록은 새 제품 source가 아님 |
| 후보 SQL | db/migrations/0015_project_baselines.sql SHA256 3E5EEA0F94186F0CC28819D435E85C4FEC97569DDA3BEF7751AD420ED9D3B6EC |
| 필요한 순서 | source-root-migration.ts의 legacyMigrationIds 44 → 0008_source_root_registry → 0008_source_read_observation → 0012_assignment_drafts → 0013_assignment_confirmation → 0015_project_baselines, **49개**. 파일명 정렬 금지 |
| 제외 SQL | 0014_context_preparation은 아래 §3.2의 기준선 전용 import/초기화/seed 정적 대조에서 직접 의존이 없으므로 이 한정 QA에서는 제외 제안. context API/업무는 시험하지 않으며 실제 app.ready/SQL 독립성은 미검증. 정식 DB의 미적용 후보를 몰래 모두 적용하지 않음 |
| 순서·hash 정본 | FN01_BASELINE_PG_MIGRATION_MANIFEST.json. ordered 배열 JSON UTF8 SHA256 e1d3666ff8e469feb9df0a80d440e0d06be35558f2943d24dabc4526a7989b2c |
| 보호 원문 | 공식 양식/방법론 seed의 정확 source36 docs 원문과 합성 증거만 사용. 실제 프로젝트/사용자 자료 수집0 |

실제 실행기는 현재 없다. 후속 QA runner/test 후보를 기존 branch에 추가할 경우 그 후보 commit을 H로 따로 고정하고, H의 apps/contracts/db/package.json/package-lock.json 및 공식 seed docs가 source36과 byte/tree 동일한지 검사해야 한다. H의 새 scripts/tests만으로 제품 수정이나 새SQL을 숨기지 않는다. lock/dependency의 정적 명세는 같은 JSON의 dependencyLock에 고정했다. 그러나 H·runner/test hash·Linux 실제 설치 집합·도구 신뢰/보호·실행 허가 ref/issuedAt/expiresAt는 미확정이므로 현재 실행 명령을 사용하지 않는다.

## 3. 이번 읽기 전용 확인

- SSH WSL-server: Linux, uid1000, Node /usr/local/bin/node v24.21.0, npm /usr/local/bin/npm 11.19.0, Docker server29.1.3, 고정 socket /var/run/docker.sock은 root:gid1001/0660이다. image/daemon 조회만 했고 DB 접속0이다.
- daemon ID e3349f1d-dbfc-478a-96d9-295bf6c6839e / Name SINSAN. 실행 전 재확인한다.
- **가변 postgres:15 태그는 image40710ae201396ad27dfd01526815d5ad83c83850e7cb16dce9f0012da66f4689로, 기존 검증 image와 다르다. 사용하지 않는다.**
- 기존 pinned image postgres@sha256:6eb0add3b77c081df18aa518ce43df58fdcc40f2e6d868a6fd08038dc7acd425가 실제 존재하며 ID sha256:594290e91b09c09728ed945ff89db65cd0fafff251f7c03c3d99c00ae5d9442f다. image pull/build/tag 변경0.
- 기존 정식 PG e6f798c3a2a3bdb2be533dd4c024d76f34d19fcfbbe4bf2acbe0437fb0cf32ba는 위594290 image, exited/restart0이다. 기동/DB 연결0. 정식 checkout /home/daon/deploy/anvil-v3는 ff0fcd13695ae0affa2fd773dc96667e1d7c88f8 clean으로 읽었고 fetch/checkout하지 않았다.
- 제안 root는 부재이며 label anvil.owner=FN01_BASELINE_QA_01의 자원과 제안 literal container/network 이름도 조회 결과0이다. 부재는 생성 권한이나 예약 독점 증거가 아니다.


### 3.1 도구·lock의 읽기 증거와 미해결 신뢰 경계

- 실행 uid는1000이다. /usr/local/bin/node·npm은 symlink이고 실제 Node는 /opt/node-v24.21.0-linux-x64/bin/node, npm 진입점은 /opt/node-v24.21.0-linux-x64/lib/node_modules/npm/bin/npm-cli.js다. 후속 후보는 아래 고정 실제 경로를 사용하되 이는 신뢰/실행 승인 자체가 아니다.
- Node SHA256 7fde7b8afa198da66257f42ee2001d874c7355631e6d1579a5fb5ef1f246df4c, npm-cli SHA256 8e5f6f3429f8cdbe693cdc29904e9d5a7b127a494bd15c804bd54c7403bfcbe7, npm/package.json SHA256 09dfcf187178ce1ab3ea6194c80d3ae082ad2a86dc1269ac963f94429e718122. 세 파일의 hash는 npm 전이 모듈 전체의 무결성이나 실행 중 불변성을 증명하지 않는다.
- /opt는root:root/0755이나 설치 root/bin/Node/npm-cli는uid1001/gid1001의0755, npm/package.json은1001/1001/0644다. 후속 getent passwd 1001 조회에 사용자 매핑 출력은 없었고 id daon은uid1000/gid1000·보조그룹1001(docker)이었다. npm 및 npm/node_modules 디렉터리도1001:1001/0755로 group 쓰기는 관측되지 않았다. 이 읽기만으로 미등록 UID의 사용 불가능·설치 주체·ACL/관리 권한 전체·변경 동결을 증명하지 않는다. root/Docker 관리자와 잠재 uid1001 실행 주체의 변경 위험을 구분하며 **uid 차이나 사용자 조회 출력 부재만으로 침해/안전 어느 쪽도 확정하지 않는다.**
- 실제 실행 전 선택안 A(권장)는 기존 설치의 관리 주체·접근 경계와 npm 전이 실행 파일 목록/전체 hash를 읽기 대조하고 그 범위의 신뢰·변경 동결 방법을 한정 결정하는 것이다. A가 불가능하면 B로 별도 보호 도구 설치/소유권 변경안을 정확 경로·권한·비용·rollback과 함께 별도 제안한다. **이번에 B를 실행하거나 다른 도구/이미지로 바꾸지 않는다.** 사전 hash 재확인은 uid1001/same-UID/root의 실행 중 변경을 막는 강제 보호가 아니며 이 잔여위협이 미해결인 현재 도구 실행0이다.
- package-lock.json v3 SHA256 ca586e2dd02c11c41da55a64aa4f07d3848936fe44dca1897f8586ac4fb0f1d6, 비root 패키지146개, 누락 integrity0, resolved origin은 https://registry.npmjs.org 하나다. 명세 projection({path,version,resolved,integrity,os,cpu,optional,hasInstallScript}, lock 순서)의 JSON UTF8 SHA256 d8968986422a06f5fe24c630486ee1ee6f13363e1a050a235a2a16b163b800ba. 정확146개는 migration JSON의 dependencyLock.entries에 보존한다.
- hasInstallScript=true는darwin 전용 optional fsevents1개다. lifecycle은 전부OFF이며 Linux 실제 선택/생성 파일·cache 명세는 설치 전 확정 증거가 아니다. npm ci/registry 요청/cache 생성0이다.
- 기존 npm 정의 파일 /opt/node-v24.21.0-linux-x64/lib/node_modules/npm/node_modules/@npmcli/config/lib/definitions/definitions.js:353~364를 grep으로 읽었다. bin-links 기본true는 실행 파일 symlink를 만들며 false는 이를 만들지 않는다는 로컬 11.19.0 계약이다. 따라서 --ignore-scripts만으로 링크가 없어지는 것으로 간주하지 않고 --bin-links=false를 별도 고정했다. 설치 동작을 실제 재현한 것은 아니다.

### 3.2 0014 제외의 정확한 정적 판단 범위

| 경계 | source36 정적 대조 | 남은 한계 |
|---|---|---|
| import/앱 초기화 | apps/server/app.ts는 project routes를 등록하고 routes.ts:32~34,65는 context 모듈을 import·생성한다. ProjectContexts/ProjectContextSources constructor는 reader 참조 저장만 하며 DB query가 없다. AccessRepository constructor도 pool/key/installation 참조 검사만 한다 | 모듈을 제거하거나 context route를 숨기지 않는다. 실제 app.ready/inject 초기화는 미실행이며 제3자 모듈/PG에 대한 runtime 보장이 아니다 |
| 요청 분기 | routes.ts:121~123은 saveBaselineDraft/reviewBaselineContent/confirmBaseline의 baseline 분기,124는 별도 buildTaskContext 분기다. 기준선 Web transport·baseline source readers는 context API를 호출하지 않는다 | 후속 시험은 baseline/upload/auth/project/control/policy의 정확 허용 경로만 사용. /context 조회·buildTaskContext 호출0, 전체 API smoke로 확대0 |
| 표/함수 소비 | apps/scripts/db 검색상 anvil.context_bundles/items의 소비는 context/project-contexts.ts 및0014 SQL에 한정. 0015는0012 canonical/0013 reason 함수와 기존 문서·원문·source-read 표를 사용하고 context 표/함수는 참조하지 않음 | 정적 검색은 실제 SQL parse/COMMIT 증거가 아니다. 런타임에서 누락 의존이 발견되면 실패로 기록하고0014 자동 추가/모의 테이블 생성0 |
| seed/생성 | documents/catalog-seed.ts와 methodologies/catalog-seed.ts의 기존 함수는 공식 양식·방법론/작성 기준 표만 소비. source36의 공식 3문서(공식산출물_양식정의.md·문서작성_공통기준.md·기본방법론_상세검토안.md)에서 읽은 고정 catalog만 후속 새 DB에 사용 제안 | scripts/migrate-development.ts의 정식 config/fixture 경로는 실행하지 않음. 임의 전체 fixture/정식 seed 복제0. 실제 새 DB seed·프로젝트 생성 미실행 |

따라서 **0014 제외는 새 FN01 baseline 전용 시험에 대한 정적 제안**이다. H의 runner가 전혀 다른 초기화/seed/라우트를 소비하면 이 판단은 상속되지 않으며 필요 migration은 별도 재대조한다. 전체 제품을49 migration으로 운영 가능하다는 뜻이 아니다.

## 4. 제안 자원 사전등록 — 아직 생성하지 않음

| 종류 | 정확 이름/경로 | owner·내용·수명·회수 |
|---|---|---|
| Linux QA root | /home/daon/.local/share/anvil-v3-development/qa-fn01-baseline-01 | uid1000/0700·new-only/recursive=false. source·의존성·합성 파일·비밀 없는 receipt. 최초 생성~20분/연장0 |
| QA Git source | 위 root의 /source | private Git에서 H exact clean detached checkout. git remote는 git@github-sinsan-develop:sinsan-develop/Anvil.git만. 기존 정식 checkout/branch ref 변경0 |
| 신규 의존성·cache | 위 root/source/node_modules, 위 root/npm-cache | lock 고정·lifecycle/자동수정0. 다른 개발 node_modules/cache 공유·복사·symlink0. 실제 설치/registry 접근은 실행 승인 포함 여부를 별도 명시 |
| 보호 합성 파일 root | 위 root/artifacts | uid1000/0700·새 artifact/body·격리 fixture 전용. 실제 원문 참조0 |
| 새 PG container | anvil-v3-fn01-baseline-pg-01 | labels anvil.project=v3 / anvil.owner=FN01_BASELINE_QA_01 / anvil.instance=실행 전 새 nonce. 생성 fullID 수집·일치 후에만 조작 |
| 새 단독 network | anvil-v3-fn01-baseline-net-01 | --internal, 위 동일 labels/nonce, 연결 container1개만. ID 수집·검사 |
| database | anvil_v3_fn01_baseline_qa_01 | 이 새 container 안에서만 생성. 기존 DB와 이름·주소 모두 다름 |
| PG roles | anvil_v3_bootstrap / anvil_v3_migrator / anvil_v3_app | 새 PG 내부 역할만. migrator/app NOSUPERUSER/NOCREATEDB/NOCREATEROLE, app NOBYPASSRLS. 같은 역할명인 정식 역할 변경0 |
| data | /var/lib/postgresql/data tmpfs rw,noexec,nosuid,size=268435456 | named/bind/anonymous persistent volume0·Mounts 빈 배열. 실제 /proc/mounts도 대조 |
| 연결/port | container 내부5432, **host publish0** | -p/hostnetwork/Windows relay/5546/5547/3830 게시0. WSL Node가 새 internal network의 실측 IP로만 접속 |
| 결과 원본 | root/receipt.json·safe stdout metadata, 이후 정본 docs/WORK_STATUS.md/결과 문서 | 합성 비밀·DSN/원문body/SQL 오류 원문을 남기지 않음. 검증된 비밀 없는 실패/정리 사실은 QA 폐기 전에 보존 |

이전 role/DB를 사용하거나 새 역할을 실제 사용자에게 부여하지 않는다. 합성 비밀번호·auth key/session·CSRF는 실행 중 메모리에 생성하며 대화/Git/명령 인자/원문 오류에 출력하지 않는다. 새 PG bootstrap 설정에만 환경 전달하므로 container inspect의 Env 전체 출력은 금지한다. 제안 root의 source/cache까지 정확 전체가 시험 후 삭제 대상이며, 이는 private source의 QA 사본과 합성 데이터 소멸이지 사용자 정본 삭제가 아니다.

## 5. 경로 안전·guard와 남은 위협

관측된 부모: / 와 /home은 root:root/0755, /home/daon은 uid1000/gid1000/0750, .local은1000/0755, .local/share와 .local/share/anvil-v3-development는1000/0700이다. namei의 해당 chain에 link 표시는 없었다. **이것은 관측 시점 metadata이지 TOCTOU·실행 중 안전 보장이나 보호root 승인 아니다.**

- 실제 생성 직전 root·부모 chain의 lstat/realpath/owner/mode·부재와 mount 경계를 재확인한다. 다른 UID/group/OTHER가 쓸 수 있거나 symlink/reparse/예상 외 mount·기존 root가 있으면 생성0/중단한다. 기존 ACL/chmod/chown 수리·새 위치 재시도0.
- Linux same-UID와 root/Docker 관리자는 source를 변경할 수 있다. 이것을 Windows ancestor guard로 막았다고 주장하지 않는다. 단독 QA writer·정확 Git clean/H/hash·lock/dependency integrity를 실행 전과 각 변경 단계 직전에 재검사하고 새 자원 ID/nonce·실제 mount/주소를 결박하는 guard 후보가 필요하다. same-UID 악의적 경합까지 완전 방어한 증거는 없으며 별도 위험 수용/보완 결정 없이는 안전 확정을 할 수 없다.
- guard는 스크립트 계약 후보이며 아직 작성/검증하지 않았다. 보유 handle·native observer·OS ACL/WSL/Windows 설정·소진 compile 허가를 재사용하지 않는다. 검수에서 kernel-level/추가 보호가 필수면 필요한 별도 권한만 요청하고 그 전 실행0이다.
- 제품 파일·49 SQL·공식 seed/lock 중 한 바이트라도 달라지면 기존 exact36 결과로 해석하지 않고 준비 중단한다. npm bin 링크는 명시적으로 비활성화한다. 설치 뒤 dependency의 임의 symlink/바깥 참조는 거절하고 내부 링크를 예외 허용해 정리 기준을 바꾸지 않는다. bin-links=false는 실행 예정 옵션일 뿐 설치 결과 nonlink/정리 성공 증거가 아니다.
- 신규 checkout은 Windows 소스 복사/scp/archive 배포가 아니라 private Git의 exact H다. tag/pull 최신 image·임시 localhost 우회·정식 proxy/인증서 변경0이다.
- 플랫폼에는 root/자원 사전등록과 실제 생성/접속/정리 명령을 각각 그대로 제시해 심사받는다. 보고 경로 허용만으로 mutation 심사가 해제됐다고 하지 않는다.

## 6. 단계별 명령·효과 계약 — 현재는 미실행 제안

아래 <H>/<containerId>/<networkId>/<실측IP>/<nonce>는 런타임에 수집·결박할 값의 표기이지 빈 값을 채워 즉시 실행하라는 명령이 아니다. runner hash와 승인 창이 없으므로 전부 비활성이다. shell 조합으로 삭제하지 않고 runner가 각 execFile/파일 API를 검증한다.

1. 사전 읽기: 기존 /usr/bin/docker --host unix:///var/run/docker.sock의 daemon ID/Name, pinned image ID, 정확 이름 부재와 root chain·부재·Git 보호 범위를 대조. 기존 정식 config 파일/credential은 열지 않는다.
2. 파일·Git: fs.mkdir(등록 root,{mode:0700,recursive:false}) → 기존 Git 인증으로 git clone --no-checkout git@github-sinsan-develop:sinsan-develop/Anvil.git <등록 source> → git -C <등록 source> checkout --detach <H> → HEAD/clean/remote·product36 projection과49 manifest hash 대조. 기존 개발 source로 fallback0.
3. 의존성(별도 실행 범위): /opt/node-v24.21.0-linux-x64/bin/node /opt/node-v24.21.0-linux-x64/lib/node_modules/npm/bin/npm-cli.js ci --ignore-scripts --bin-links=false --no-audit --no-fund --registry=https://registry.npmjs.org --cache=<등록 root>/npm-cache --userconfig=<등록 root>/empty-user.npmrc --globalconfig=<등록 root>/empty-global.npmrc. 새 빈 config만 사용하고 기존 환경의 NPM_CONFIG_*·NODE_OPTIONS/NODE_PATH·proxy/credential·비표준TLS override 승계0. 정확 lock의 resolved 공개 tarball/registry metadata만 요청하며 프로젝트 원문/Secret·audit POST 전송0. lock146개의 resolved/integrity/OS/CPU/optional/install-script 표식을 dependencyLock에 고정했고 aggregate를 §3.1에 기록했다. Linux 실제 선택 집합·설치 후 전체 파일 명세와 npm 전이 실행 모듈 신뢰/보호는 아직 미확정이므로 설치0이다. registry에는 요청 IP/패키지명 등이 남을 수 있으며 그 외부 보존 기간을 Anvil이 통제한다고 하지 않는다.
4. network: docker --host unix:///var/run/docker.sock network create --internal --label anvil.project=v3 --label anvil.owner=FN01_BASELINE_QA_01 --label anvil.instance=<nonce> anvil-v3-fn01-baseline-net-01. 수신 fullID/labels/Internal 검사 후 다음 단계.
5. PG: docker --host unix:///var/run/docker.sock run --pull=never -d --name anvil-v3-fn01-baseline-pg-01 <동일 labels> --network anvil-v3-fn01-baseline-net-01 --tmpfs /var/lib/postgresql/data:rw,noexec,nosuid,size=268435456 --env POSTGRES_USER=anvil_v3_bootstrap --env POSTGRES_DB=anvil_v3_fn01_baseline_qa_01 --env POSTGRES_PASSWORD postgres@sha256:6eb0add3b77c081df18aa518ce43df58fdcc40f2e6d868a6fd08038dc7acd425 -c log_statement=none -c log_min_error_statement=fatal. password 값은 stdin/환경의 합성값이고 command/log에 표시0이다.
6. SQL: fullID 확인 후 docker exec -i --env PGPASSWORD <containerId> psql --no-psqlrc --no-password --quiet --no-align --tuples-only --host=127.0.0.1 --port=5432 --username=<새 QA role> --dbname=anvil_v3_fn01_baseline_qa_01 --set=ON_ERROR_STOP=on --set=VERBOSITY=sqlstate --set=SHOW_CONTEXT=never --set=ECHO=none --file=-. SQL은49고정 manifest와유한테스트만 stdin. 일반 정식 scripts/migrate-development.ts·ANVIL_DB_CONFIG/ANVIL_MIGRATOR_CONFIG 사용0.
7. 인증 workflow: /opt/node-v24.21.0-linux-x64/bin/node --test --test-reporter=tap tests/integration/FN01/baseline-isolated.test.ts (아직 없는 후속 후보 파일). 새 app/migrator의 명시 QA database/실측IP와 메모리 비밀만 child env에 전달. test/worker는 target DB·role/비수퍼유저·actualIP/PG15·manifest49를 먼저 확인하고 각 mutation 직전에 deadline/abort/ownership fence. Fastify.inject+제품 Web transport→실제 새 PG·보호 합성 파일이며 actual socketHTTPS/browser 아님.
8. 회수: 모든 app/pool/stream/파일 writer가 닫힌 뒤 fullID/nonce/name/image/network/tmpfs/port 다시 일치한 **이번 신규 container만** docker rm -f <containerId>. 이 명령은 새 tmpfs 합성 DB를 파괴하며 일반 정식 DB stop/복구 명령이 아니다. network는 정확 ID/Internal/labels·endpoint0 확인 뒤 docker network rm <networkId>. 이름만으로 삭제/넓은 prune0.
9. 파일 회수: 등록 root 아래 파일별 lstat/nonlink/owner/hash/상대경로를 수집·재확인한 뒤 개별 unlink 및 leaf부터 rmdir. recursive rm·globs·바깥 link 따라가기0. 모르는 파일/소유자/변경/열린process가 있으면 해당 경로 보존·정리 실패 보고. 독립 조회로 root·label/name 자원·port publish0 확인, 원 failure와 cleanupFailure를 별도 유지.

전체 창은 root 최초 생성부터20분·연장0 제안이며 Git60초/npm300초/PG기동90초/workflow180초의 각 상한을 둔다. 실제 issuedAt/expiresAt는 허가 직전 고정하고 만료 후 새 시험 시작/재시도0이다. 회수는 만료 뒤에도 이번 생성 exact 자원에 한해 별도 정리 권한으로 지속되며 자동 재생성0이다. 시간 제한은 이미 전송된 원격 작업의 취소/rollback 보장이 아니므로 자식 완료/현재 자원을 끝까지 관측·기록한다. 종료/정리 확인이 안 되면 성공으로 표현하지 않는다.

## 7. 필요한 실제 PG 증거 — 아직 0

1. 새 DB의49 SQL 실제 파싱/COMMIT/ID·checksum 순서/각 신규4표·기존 baseline metadata guard·최소 ACL 확인. 이것만으로 API 업무 PASS가 아님.
2. 분리된 두 합성 사용자/프로젝트·실제 auth/session/CSRF·명시 AUTO/DENY/만료정책·current client/control 아래 새 초안→고정 재조회→HUMAN 구조검토→별도 채택→exact current/history 및 영수증 유실·동일 command 재확인.
3. 두 번째 초안 개정/채택·기기 전환·옛 세대 거절. 실제 UPDATE/INSERT 분기와 COMMIT 후 head/ref·과거 원문이 유지되어야 함. 기존 회귀 double PASS를 대신 쓰지 않음.
4. schema49 적용 전 최소 legacy baseline fixture를 원계약대로 보관한 경우0015 후 원행/hash 불변·LEGACY_UNVERIFIED·자동head0·새 채택 순번 포함을 확인. fixture는 legacy 공백 재현일 뿐 실제 source/권한 증거가 아님.
5. 다른 프로젝트/사용자·변조ref·최신 REWORK·미확인/STATIC/MOCK CORE·누락근거·실제 파일 hash/격리·추가 검토근거 사후격리 차단. 기준선 개정에서는 옛 격리 근거 제거 가능.
6. app의 무명령 INSERT/UPDATE/DELETE·receipt/scope/세대/교차프로젝트 위조와 동시 head/CAS/감사 순서·중복채택을 실제 transaction에서 확인. 관리자 trigger해제·시험 후 전체 ROLLBACK으로 COMMIT 실패를 숨기지 않음.
7. 정상·실패 모두 합성 자원 정리0과 독립 확인. 기본한도/기대값/기존 tests 완화0. sourceAuthorizationVerified/coverageVerified/executionAuthorized/dispatchPerformed=false 유지.

## 8. 실제 served browser는 별도 패킷

이번 PG QA는 브라우저 프로세스·port3830·기존 TLS/CA/신뢰·정식 API/Web/DB를 만들거나 교체하지 않는다. 합성 page.route 후보 시험과 실제 로그인/API/DB 화면 여정도 별개다. 실제 화면 패킷에는 배포 source/image/asset·기존 서비스 중단/rollback·인증정보/CA만료·정식/격리 DB 선택·현재 사용자 정책·원문 root·브라우저 profile/수명·same-origin Network/거절 후 본문 숨김·세대전환을 별도로 고정해 승인받아야 한다.

## 9. 독립 지적·Main 보완과 판정 밖

- 최초 독립 문서 검토는 **C0/I2/M1**, 실행 가능 수용이 아니다. I1(ignore-scripts의 bin 링크 누락)은 로컬 npm 정의를 확인해 bin-links=false로 제안 수정했다. I2(uid1001 도구와 npm 전이 모듈의 신뢰/변경 경계 누락)는 §3.1의 실제 target/hash·주체 미확정·선택안/잔여위협으로 보완했다.
- 원 M1(pull0와 Docker 기본 동작의 불일치)은 Main이 **승인되지 않은 외부 image 다운로드 위험으로 Important로 재등급**해 --pull=never를 명시했다. 원 검토 등급을 지우거나 새 독립 C0/I0 재판정을 주장하지 않는다.
- 이번 보완은 제안서/명세의 단일 수정이며 문서 문자열 검사를 runtime TDD나 설치/guard 성공으로 포장하지 않는다. 실제 SQL parse/COMMIT/동시성/권한, toolchain 전체 무결성/관리 주체, 경로 경쟁/실제 정리, H projection, npm 설치, app.ready, socketHTTPS/browser/HUMAN 의미/Agent는 전부 판정 밖·미검증이다.

## 10. 다음 Main 행동·정확 결정

### A. 먼저 필요한 코드 준비 범위 결정 — 실제 실행과 분리

신산님2026-10-18 18:10:34KST 직접 ‘승인해’를 PMO가 전달했다. 승인 대상은 r2 SHA256 EC52CAAE81A2E4740F4B485E874B9751C7BA0A53D32652A540A34650FDBBFE64 §10.A의 아래 **신규4파일 후보 작성·독립 읽기 및 연결 문서3종 결박만**이다. 직접 답변 완료이며 무응답 추정이나 반복 승인 요청으로 취급하지 않는다. 현재4파일을 작성했으나 테스트/타입/구문/빌드 실행은 전부0이다.

1. scripts/fn01-baseline-qa-guard.ts: 고정 product/manifest/daemon/image/경로·owner/불변 fence·최초 deadline/정리 계약의 후보. import 시 mutation0, 임의 경로·명령/환경 입력0, 원거절/PATH_GUARD/native 코드 수정0.
2. scripts/qa-fn01-baseline-isolated.ts: 위 guard를 소비하는49 SQL/new-only PG·합성 seed/workflow/정확 finally 회수 후보. 라이브 실행/자원 생성0, 기존 formal runner·SQL·계정·인증 설정 수정0.
3. tests/integration/FN01/baseline-isolated.test.ts: §7의 정상/거절·COMMIT·두번째 채택·legacy 보존 시나리오 후보 작성. 실제 테스트 실행은 뒤의 B 범위 결정 전0.
4. tests/unit/FN01/baseline-qa-guard.test.ts: 입력·시간·소유·예상 외 file/link·pull/install 옵션 등 순수 guard 음성/정상 후보. 우선 읽기 검토까지만; 실행을 허용할 경우에도 실제 OS/PG/fake host가 아니라 순수 double임을 별도 고정한다.

같은 기존 branch에서 이4파일과 본 제안/manifest/WORK_STATUS만 갱신한다. apps/contracts/db/package/seed docs·기존 scripts/tests 수정, 신규 dependency·native compile·자동 실행/외부 Agent 호출은 제외한다. 순수 unit을 포함한 테스트·설치/외부접속·QA/root/컨테이너/network/DB/핸들 생성·서비스/권한/도구 변경도 승인에서 제외됐다. 이번 r3는 작성 사실과 열린 경계를 결박하며 실제실행 재포장·기한/보호 완화가 아니다.

### B. 이후 별도 실제 실행 결정 — 현재 미요청/비활성

A가 허용되고 후보를 독립 검토한 뒤에만 H·runner/test 전체 hash·product36 동일 projection·lock146/실제 Linux 선택 명세·toolchain 관리/보호·부모 경로/경쟁 위험·정확 신규 자원/명령 효과·issuedAt/expiresAt·정리 파괴 범위를 결박한 실제 실행 패킷을 별도로 제출한다. H와 도구 신뢰/보호가 비어 있는 지금 **포괄 actual QA 승인을 요청하지 않는다.**

- 실행 방식/root·신뢰/변경 동결안이 타당하지 않으면 정확 근거·한정 대안을 먼저 결정받으며 권한 수리/다른 경로·도구 우회0이다.
- 기존 복구 PATH_GUARD/정식0012/서비스/실사용자 정책/Agent/Secret/cert·소진 compile 경계는 유지한다. 계획의 다음 미완료 선정·완료 책임은 Main에게 있고 PMO에는 필요한 결정/지원만 요청한다.
- 이번 문서 준비를 새 사용 가능 기능이나 전체계획 완료로 계산하지 않는다. 동일 제품 시험·빌드 반복0, 실제 QA·설치·새 디렉터리·핸들·DB/서비스 변경0이다.

## 11. 18:10 승인 후보 작성 단계의 명시적 판정 밖 (당시 기록)

- TDD 스킬의 실행 단계와 이번 직접 승인 제한이 충돌하므로 사용자 제한을 우선했다. 테스트 후보를 먼저 작성하되 RED/GREEN·합격·타입 안전을 주장하지 않는다. 기존 실행계획/작업현황을 ledger로 사용하며 skill 보조 실행기/새 폴더를 만들지 않았다.
- 실제 실행 binding은 null이며 assertActualQaAuthorized가 preflight·시계·파일/환경·Pool 이전에 무조건 거절한다. env/CLI/호출자 boolean으로 열 수 없다. 별도 B 결정 없이 이를 완화하지 않는다. 시험 파일을 import/실행하여 이 거절을 검증한 사실도 없다.
- Ruling: runner는 순수 계약/좁은 QaPorts와 제어 흐름까지 작성하고 native OS adapter·최초 H 적재 bootstrap은 미연결로 남겼다. 아직 없는 원격 H checkout 안의 runner가 스스로 첫 clone을 수행했다고 가정하지 않기 위함이다. 연결 전 실제 실행 준비는 미완료이며 잘못 판단하면 추가 후보 작성/심사가 필요하다. 이 제한을 성공 stub이나 fake 실제 QA로 처리하지 않는다.
- root 생성/clone의 부분 실패·create 응답 유실에서 fullID/소유를 확정하지 못하면 임의 회수하지 않고 실패·잔류 미검증을 보존하는 후보다. 실제 adapter의 자원 추적/원문 파일 manifest/반복 fence/신호·자식 종료는 구현·실측 전 안전 보장이 아니다.
- integration의 HUMAN 원문은 합성 SQL/API 기계경계 fixture이며 실제 기능 의미/소스 전체/실사용자 인수 판정이 아니다. Network socket/HTTPS/브라우저/Agent를 검증하지 않는다. 테스트 결과를 제출하지 않은 후보 코드와 실제 저장 기능 완료를 구분한다.
- 독립 읽기 검토 결과와 Main 단일 보완/미검증은 WORK_STATUS와 이 명세의 후속 binding에 기록한다. 현재 실행/원 거절·경로 안전·도구 신뢰를 해소한 것으로 판단하지 않는다.

## 12. 18:10 승인 독립 후보 검토·Main 단일 보완 (당시 실행 증거 아님)

- 최초 결과 **C0/I3/M1**을 보존한다. I1의 실제 허용 mediaType/HTTP201 불일치는 기존 API를 읽기 대조해 text/plain;charset=utf-8·201로 맞췄고 격리 상태/이후412 기준은 유지했다. 기대값을 느슨하게 바꾼 것이 아니라 실제 계약과 맞춘 후보 보완이다.
- I2는 재시도 이전 exact project/actor/external commandId로 저장 영수증·연결된 불변 초안1행·ref/hash/snapshot을 첫 응답 전체와 대조하고, 재시도 뒤 같은 행/영수증·count 불변을 확인하도록 작성했다. 실제 최초 COMMIT/재시도 성공을 확인한 것은 아니다.
- I3는 읽기/단계 대기에 유한 상한, 회수 전용30초와 각각5초의 writer/app/pool 종료 수집을 추가했다. 타이머 만료는 UNKNOWN이며 실제 취소/종료 증거가 아니다. 설치/생성/SQL/workflow의 완료가 불명이거나 writer 종료가 불명이면 파괴 회수0·보존/잔류 미검증으로 남긴다. 실제 native adapter·자식 watchdog·동기 blocking 강제 차단은 여전히 미연결/판정 밖이다.
- 원 M1의 legacy 보호 GET/원문 비공개 누락은 Main이 **중요한 미확인 원문 노출 회귀를 놓칠 위험으로 Important로 재등급**했다. 정확 legacy ref의 제품 Web 보호 reader에서 LEGACY_UNVERIFIED·ref/snapshot null·내용미확정/UNAVAILABLE와 current UNCONFIRMED를 확인한 뒤에만 LEGACY_PRESERVED marker를 남기는 후보로 보완했다.
- guard 순수 테스트10개와 실제 PG 여정1개는 작성만 했다. timeout 회귀 및 runner가 adapter를 읽기 전 권한 거절하는 순서 회귀도 작성했으나 **전체 테스트·RED/GREEN·타입/구문/build 실행0**이다. 독립 C0/I0 재검토를 요청하거나 Main 보완을 그 판정으로 바꾸지 않는다.
- Final Ruling: 검토가 판단하지 않은 native adapter/H/bootstrap·binding, uid1001/same-UID/root 경합, 실제 설치/보호/정리, SQL parse/COMMIT/잠금/ACL, 브라우저/TLS/HUMAN 의미/인수는 후보 수용이나 실행 허가로 승격하지 않는다. 이 후보는 실행 준비 미완료다. 잘못 판단하면 실제자료/권한/정리 피해가 가능하므로 B 결정을 앞당겨 요청하지 않는다. Main은 승인 준비 범위의 기록/읽기 검토를 마쳤다는 사실과 실제 미완료를 구분한다.
- 현재 승인에 외부접속이 제외돼 있으므로 이번 신규 후보를 원격 게시하기 위해 Git 네트워크 명령을 실행하지 않았다. local 안전 checkpoint와 파일 hash만 보존하며 기존 private728eb902와 별도 구분한다.

## 13. 18:37 후속 한정 승인·로컬 확인·새 게시 경계

- 신산님2026-10-18 18:37:59KST 직접 ‘승인해’를 PMO가 전달했다. FN01_QA_LOCAL_CHECK_AND_PUSH 권장A만이며 Node child의 순수1파일(최대30초)·tsc noEmit(최대120초), 새4파일 오류 보완/연결기록과 **기존 exact8cf2d29797b1bb9ccd216cc031b2eb9857403c3b의 보존 게시만**이다. 실제 integration/PG/WSL·설치/npm·전체회귀/build·native helper·서비스/권한/Agent/Secret은 제외됐다.
- 기준8cf2d297 local clean·정확7파일/제품36 동일과 C:\Program Files\nodejs\node.exe SHA256 9A4EB5F1C29C6A2E93852EAD46B999E284A6A5CA8BAB4D4E241D587D025A52DE를 읽기 확인했다. 두 child에 NODE_OPTIONS/NODE_PATH/NODE_COMPILE_CACHE를 승계하지 않았고 숨김·stdout/stderr 수집·고정 상한으로 실행했다.
- 최초 node --test tests/unit/FN01/baseline-qa-guard.test.ts는 **10PASS/156.9273ms, FAIL/SKIP/CANCEL0**, child236ms exit0이었다. 동시에 실행한 node node_modules/typescript/bin/tsc --noEmit -p tsconfig.base.json은 child1195ms exit1이었다. 확인한 대표 오류는 신규 runner의 string|null TS2345 및 TS2349/TS2339 never, 신규 integration의 TS18046/never 연쇄다. 최초 실패를 숨기거나 PASS로 소급하지 않는다.
- 원인 가설은 실제권한 assert의 :never가 뒤의 미연결 후보 본문을 도달 불가능으로 분석하게 하는 것이다. 기존 guard 패턴을 대조하고 새 guard 2줄(주석·반환형)만 :void로 바꿨다. actualQaAuthority=null·무조건 throw·첫실행거절의 본문/순서는 그대로이며 any/ts-ignore/tsconfig 완화·테스트 삭제/기대값 변경0이다. 이는 타입 표현 보완이지 실행 권한의 개방이 아니다.
- 이 코드 변경 뒤 같은 한정 검사에서 **순수10PASS/175.8832ms, FAIL/SKIP/CANCEL0·child287ms exit0**, **tsc noEmit child1302ms exit0**을 확인했다. 두 child 모두 timeout=false다. 타입 검사 RED→GREEN과 실제 거절 순수 회귀를 구분하며 브라우저/SQL/실권한/actual 종료·정리 TDD로 승격하지 않는다.
- integration은 타입 검사만 받고 **실행0**이다. native adapter/bootstrap·actual binding·toolchain/경로 위험·실제 PG/정리·HUMAN 의미·사용자 인수는 여전히 미검증이다. 바뀌지 않은 제품 전체 시험/빌드 반복0이다.
- 소스 보완과 이 기록으로 commit이 달라지므로 **8cf2d297 게시 승인을 새 commit에 자동 승계하지 않는다.** 이번 검사 후 Git 네트워크/push0으로 두고, 새 local exact·변경4파일(guard+연결문서3)·제품36 동일·위 결과를 PMO에 제시해 게시 대상 판단을 별도로 확인한다. 기존 불합격8cf를 새 정상 후보 대신 먼저 게시하지 않았다.

## 14. 후속 실행0 상세 설계 — bootstrap과 native adapter 분리 제안

이 절은 게시본9b79667f 이후의 **r5 승인 대상 설계**다. 최초 작성 당시 미승인이었던 이력은 유지하고, 후속19:05 승인의 한정 작성/순수검사 범위와 실제 실행 미승인을 §15에서 구분한다. Main이 다음 미완료를 선정한 것이며 PMO에 다음 업무 배정을 요청하지 않는다.

### 14.1 자기 clone 모순과 권장 구조

| 안 | 최초 진입/소스 | 영향·판정 |
|---|---|---|
| A 권장 | 별도 B의 정확 명령을 심사한 뒤 Main의 실행 플랫폼이 새 root·Git exact H·의존성을 최초 준비한다. 이후 그 H의 runner는 **bootstrap receipt를 읽는 본시험 단계**만 수행 | 기존 등록 root/source/cache·자원/정리 범위는 유지하되 controller 경계를 명시한다. runner가 존재하기 전 자기 자신을 실행한 것으로 가정하지 않는다. 지금 bootstrap 명령 실행0 |
| B 비권장 | 상주 원격 launcher/controller를 새로 설치해 자기 clone을 맡김 | 새 설치·지속 권한/수명·복구 범위를 추가하므로 현재 준비 범위 밖. 도입0 |
| C 제외 | 기존 정식 checkout을 H로 갱신한 뒤 그곳에서 실행 | 정식 checkout/개발 기준선 비접촉 계약과 충돌. 별도 변경 승인 없이 채택하지 않음 |

A는 Linux 방법/보호 root가 허가됐다는 뜻이 아니다. 원 거절·Windows PATH_GUARD·소진 native 허가를 새 경로/도구로 우회하지 않는다. bootstrap 및 본시험 모두 최초20분 창을 공유하고 두 번째 단계에서 새20분·새 nonce·임의 재시도0이다.

### 14.2 bootstrap receipt의 고정 항목·거절

- 수명/명세 제안은 새 root 안의 **/home/daon/.local/share/anvil-v3-development/qa-fn01-baseline-01/bootstrap.json** 1개다(uid1000/0600·시험 후 정확 회수). 최종 결과 receipt.json과 분리하여 최초 관측을 덮어쓰지 않는다. 기존 자원 등록에 없던 이 파일은 아직 만들지 않았으며 실제 B 승인 패킷에 추가 고정해야 한다.
- kind/version·전용 owner/새 nonce·최초 issuedAt/expiresAt, 정확 root/source/cache/artifacts 및 각 parent/root의 realpath·uid/mode/dev/ino·mount 관측을 결박한다. 기존 root 재사용·자동 소유 채택0이다.
- remote URL·H·clean·제품36 projection diff0·49 SQL aggregate/lock146·실제 설치 파일 명세·도구 실제 경로/전체 hash 및 관리/경로 위험 결정 ref를 기록한다. 합성 password/DSN·원문 body·credential 값을 receipt에 쓰지 않는다.
- receipt는 **사실 전달물이지 실행 권한이 아니다**. 같은 UID/root가 위조·교체할 수 있다는 잔여 위협을 숨기지 않는다. B에서 발급한 정확 권한/한정 위험 결정과 별도 대조하기 전 일반 env/파일의 claimedApproved:true만으로 실행하지 않는다. 현재 actualQaAuthority=null/첫 거절은 유지한다.
- receipt가 없거나 불일치·만료·기존자료·부분 생성/늦은 응답 상태가 불명확하면 본시험0/보존·정확 예외 기록이다. source를 복사/scp/archive로 옮기거나 다른 checkout·cache·port로 fallback하지 않는다.
- 최초 준비 도중 실패 시 그 단계가 확인한 새 inode/ID/nonce/작성 목록만 회수 후보가 된다. 본시험 runner가 생성 사실을 관측하지 못한 자료를 이름만 보고 지우지 않는다. 두 단계가 같은 회수 권한·목록을 소비해야 하며 실제 타이머/자식 종료·TOCTOU 강제 방어는 미검증이다.

### 14.3 코드 준비 범위안 (r5 요청 당시 미작성, 후속 작성은 §15)

Main 권장안은 기존 신규4파일에 한정한다. guard에는 receipt/source/deadline 순수 검증을, runner에는 **import 시 부작용이 없고 실제 첫 거절 뒤에만 닿는 비공개 native adapter**와 bootstrap 후 진입을 후보로 작성한다. 임의 command/path/env 실행기·기존 guard/launcher 변경·새 dependency/native compile·상주 서비스는 만들지 않는다. integration/순수 테스트 후보는 같은 인터페이스만 소비하도록 갱신한다.

필요한 새 범위는 native adapter의 **작성·독립 읽기**와 이를 위한 순수 검사다. 허용을 요청할 경우 exact4파일 및 연결문서3, bootstrap ref 불일치/새 nonce·root/만료·타 단계 시간창 재설정 거절의 순수 사례를 미리 고정하고 동일 Node child의 한정 unit/tsc만 제안한다. OS/파일 생성·Docker/Git clone/npm·실제 bootstrap/PG/network·보유 핸들·서비스/권한/Agent를 실행하는 승인은 아니며 §10.B의 정확 H·도구/경로/자원·수명·회수 결정은 별도다.

### 14.4 정확한 준비/최소검사 범위 (r5 요청 원문, 후속 승인은 §15)

- 파일은 기존 신규 scripts/fn01-baseline-qa-guard.ts / scripts/qa-fn01-baseline-isolated.ts / tests/integration/FN01/baseline-isolated.test.ts / tests/unit/FN01/baseline-qa-guard.test.ts 네 개와 연결 문서3종만이다. 다른 제품·SQL/package/seed·기존 launcher/guard·Secret/권한 파일은 수정하지 않는다.
- 새 native adapter는 private 함수/정적 선언으로만 작성하고 공개 entry의 actualQaAuthority=null/첫 무조건 거절을 유지한다. import/인자 기본값/단위 테스트로 실제 fs write·spawn·Docker·Git/npm·DB/핸들이 먼저 실행되면 이 준비 범위를 위반하는 것으로 판단한다. 임의경로/명령/환경을 받아 실행하는 우회 API를 만들지 않는다.
- 기존 순수10은 유지하고 다음4개만 추가해 **최대14개**로 한정한다: (R1) 일치하는 bootstrap metadata라도 executionAuthorized:false, (R2) root/nonce/H/parent 식별 불일치 거절, (R3) 최초창 만료·두번째 단계 시간창 재설정 거절, (R4) 이전/미소유/불명확 단계의 회수 범위 승계 거절. 이들은 metadata/descriptor 순수 입력만 사용하며 native 효과를 mock의 성공으로 증명하지 않는다.
- 허용을 요청할 검사는 고정 Windows Node child의 node --test tests/unit/FN01/baseline-qa-guard.test.ts(최대30초)와 node node_modules/typescript/bin/tsc --noEmit -p tsconfig.base.json(최대120초)만이다. NODE_OPTIONS/NODE_PATH/NODE_COMPILE_CACHE 미승계·숨김·유한 종료를 유지한다. integration/전체회귀/build·설치/외부접속·WSL/native helper/QA 생성·권한·Agent는 제외한다.
- 코드 후보 작성→독립 읽기→한정 보완/이 순수검사만을 요청할 안이다. 새 코드의 commit/push 대상은 작성·검증 후 exact로 별도 제시하며, 게시9b79667f나 이전 test10 허가를 새 코드/14개/새SHA 승인으로 자동 승계하지 않는다.

## 15. 19:05 직접 승인 — 후보 작성·순수 검사만

- PMO가 신산님2026-10-18 19:05:37KST 직접 ‘승인’을 전달했다. FN01_QA_BOOTSTRAP_ADAPTER_PREPARATION, r5 §14 SHA256 **92950411939CB78993613ABB79AF9F16CEE013C834554BFA50DB4C5B82ECBCEB**의 정확4파일+연결3문서·한정 검토/보완·순수 기존10+R1~R4(최대14)/30초·tsc noEmit/120초다. 답변 완료이며 무응답 위임·새 실행 승인으로 바꾸지 않는다.
- guard는 metadata·owner/nonce/H/정확 root/parents/inventory·최초 창을 대조해도 executionAuthorized:false만 반환한다. R2~R4의 누락 검증 RED는 **11PASS/3FAIL, 140.8241ms·child227ms exit1**이며, 보완 뒤14PASS/139.0828ms·child220ms exit0이었다. 해당 검사는 실제 bootstrap 파일/권한/경로 강제 방어가 아닌 순수 입력 검증이다.
- runner에서 claimAndClone/install 포트를 제거하고 bootstrap receipt의 최초 nonce/20분 창을 승계하는 본시험 단계로 변경했다. private native factory는 선언만 두며 공개 native entry는 첫 실제 거절 뒤 미발급 binding에서 다시 거절한다. import/default arg/순수14개에서 fs write·spawn·Docker/Git/npm·PG 효과0이다. Windows 고정 Node child 자체는 승인된 한정 검사이며 QA native 실행과 다르다.
- 비공개 adapter 후보에는 O_NOFOLLOW/bytehash·inode/부모 재대조, source/H/product36·49/lock, 고정 binary/최소 env, daemon/image/fullID/nonce·tmpfs·publish0, 새 PG 역할/원SQL 순서별 COMMIT, 단일 workflow child와 새 blob 영수증의 파일 명세, writer 종료/UNKNOWN 보존·정확 회수를 작성했다. 실제 네이티브 분기는 **전부 미실행**이며 순수 테스트로 이 효과를 증명하지 않는다. sameUID/root 경쟁, Linux 선택 패키지/전이 toolchain의 신뢰·issuer/위험 결정·TOCTOU/강제 취소·실제 정리 성능은 미검증이다.
- 추가 resource 제안: bootstrap은 기존 root/source/cache/artifacts 외 **docker-config 빈 전용 디렉터리**도 목록에 결박해야 한다. 기존/사용자 Docker config·로그인 정보를 읽지 않기 위한 private child 전용 값이며 아직 생성0·actual 승인0이다. bootstrap.json은 자기 자신을 inventory hash에 포함하지 않고 별도 원문 hash/0600·inode로 결박하여 self-hash 순환을 피한다. 결과 receipt.json 생성/기존 receipt 덮어쓰기0이다.
- 통합 후보는 빈 artifacts를 확인하고 성공한 일반/격리 업로드 영수증의 blob/부모 identity·hash만 즉시 기록해 최종 비밀 없는 marker에 반환하도록 작성했다. 실패 뒤 unknown 파일의 스캔/소유 채택0, writer/생성 응답·파일 목록 불명이면 보존·FAIL이다. 실제 PG/SQL/COMMIT/파일 회수 결과가 아니다.
- 연결부 작성 후 순수14PASS/196.1955ms·child356ms exit0, 타입 첫 exit1/child1280ms는 새 private helper의 never 분기 추론으로 LINK/null 진단6개였다. 명시 function 선언으로 보완 후 **타입 exit0/child1192ms**다. any/ts-ignore/tsconfig·기대값/검사 기준 완화0. 고정 Node hash/환경 제외·Hidden/상한은 §13과 같다.
- Ruling: 승인된 순수14·타입을 넘어 native 효과 TDD/전체 suite를 실행하지 않는다. 별도 B 전까지 실제 binding 발급·bootstrap·WSL/PG·설치/서비스/Agent/Secret·새 commit 게시0이다. 후보 독립 읽기와 한정 보완 후 hash/미검증을 결박하며 native branch의 테스트 부재를 숨기지 않는다. 실패 시 실제 정리/안전성이 입증된 것으로 오판할 비용이 있으므로 실행 준비 완료로 보고하지 않는다.

### 15.1 한 번의 독립 읽기·Main 단일 보완

- 원 판정 **C0/I1/M1**을 보존한다. I1은 boundedWait의 늦은 operation이 closeWriters의 전역 cleanup=true/회수30초를 일반 SQL 시간창으로 오인할 수 있다는 정적 반례다. 실제 발생/SQL 실행을 주장하지 않는다. Main은 timeout/종료 전환 시 QaWorkAdmission을 영구 stop하고, 모든 비동기 준비 뒤 spawn 직전에 다시 검사하도록 보완했다. 기존 child 종료와 별개로 active operation Promise의 종료도 유한 수집하고 불명이면 보존한다.
- 회수는 별도 purpose의 고정 명령 목록(정확 ID inspect·tmpfs 읽기·컨테이너/네트워크 제거·잔여 조회)만 허용한다. 일반 Git/Node/psql·생성은 회수 창으로 진입하지 못하며 migration 제한시간도 sourceProof 이후 새로 계산하지 않는다. 첫 actual throw/null binding은 그대로다. 해당 native 소비자 연결은 읽기·타입 확인뿐이고 실제 timeout/child/SQL TDD가 아니다.
- 원 M1은 R4의 미소유 UID/탈출/LINK가 hash 불일치에서 먼저 거절돼 의미 검증 퇴행을 잡지 못하는 점이다. Main은 향후 잘못된 소유 채택·삭제 회귀를 놓칠 위험 때문에 **Important로 재등급**하여 같은 단일 보완에 포함했다. 기존 hash 변조 음성은 그대로 두고, inventory hash를 receipt/expectation 양쪽에 정확히 갱신한 별도 의미 음성을 같은 R4 안에 추가했다. 검증 의미·합격 기준을 낮추지 않았다.
- 한정 회귀는 기존10번째 사례와 R4만 확장해 여전히14개다. 순수 admission의 누락 상태와 R4 의미 guard의 임시 mutation에서 **12PASS/2FAIL139.4749ms·child226ms exit1**, 실제 stop 검사/의미 guard 복원 후 **14PASS166.9475ms·child268ms exit0**, **타입 noEmit child1230ms exit0**, timeout=false·SKIP/CANCEL0이다. 임시 mutation/stub은 남기지 않았다. 원 독립 C0/I1/M1을 새 독립 C0/I0로 바꾸거나 재검토를 반복하지 않는다.
- Final Ruling(판단 밖): bootstrap/H·권한 issuer, native child 종료/생성응답 유실/정확 파일 회수, uid1001 도구 신뢰·sameUID/root 경쟁, PG49 문법/권한/COMMIT/동시성, 실제 원문 접근·HUMAN 의미·사용자 인수는 모두 미검증·미완료로 유지한다. 잘못 승인하면 데이터/권한·잔류 피해가 가능하므로 후보 작성·순수 검사를 실제 실행 준비나 제품 기능 완료로 승격하지 않는다.
- 정본 WORK_STATUS와 후보 기록의 기존 과거 행 차이를 읽기 대조했다. 정본에만 남은 과거 이력을 삭제·동기 덮어쓰기하지 않고 이번 소유 기록만 추가한다. 기존 Backup/사용자 자료·서비스·계정/권한·인증서 변경0이다.
