# P03 개발 기준선·실행 환경 결과

2026-10-16 / Main 어울 / branch `codex/av3-stage-a`.

## 판정

**ENVIRONMENT_READY — 준비 환경 수용, 제품 기능/Agent 연동 미검증.** P01/P02 수용, 정확한 코드·lock·명령/신규 DB·HTTPS 준비를 재현했다. Stage A PR/병합·merged-main smoke·정리는 이 결과 작성 시 아직 전이다. 전체44업무 중 준비3개만 수용했으며41개 제품/통합 업무가 남아 있다.

직접 승인: `call_f2cd20981cc64d83aceff512225037b5`의 새 Stage A/private push·전용 개발 자원·개발 인증서/현재 사용자 신뢰3개. Windows 신뢰 확인은 `call_85f65c255a7049bbabc5172dc868f021`의 ‘확ㅇ니햇어’와 실제 Root 정확1개 조회를 대조했다. 키/비밀번호 원문은 이 문서에 없다.

## 기준과 실제 Git

- 공식 프로젝트 `D:\Project\Anvil`. private `git@github-sinsan-develop:sinsan-develop/Anvil.git`의 지정 branch만 사용했다. 다른 origin/Backup/legacy 소스는 전송하지 않았다.
- base main `b4f9006e30e5afcf98ef8ef1f39707ecc8954feb`, 초기 checkpoint `8f3af6565654af2649e2737933b243c3a969becd` 정확89파일. 최초 승인51파일과 계획 범위 신규 코드/계약/기록이다.
- WSL 실행 SHA `892ea1e1f3e65c408910ffa3ae5f8e9f807fb361`. 이후 Windows 보호 DB 참조/시작·HTTPS probe·브라우저 구성 변경은 `86a6af5a`→`38ea2ebf`→`0ec17f1a79c6bb5733ca0e6b41901e9e8f34e8fb`에 기록했다. 최종 local/private 동일·tracked clean 확인 뒤 결과 문서만 작성했다.
- 원래 branch `codex/anvil-public-ui-preview` HEAD ef80f61c의 삭제852/수정3·미추적 자료 보존. 원래 main/이력 reset·force·직접 개발0. 신규 branch 예외는 위 직접 승인에 한정된다.
- r3 승인 당시 hash 미수집 사실 유지. BASELINE_MANIFEST의 새 값은 현재 관측이지 과거 승인 바이트 증명이 아니다. STAGE_A_PAYLOAD_MANIFEST의 파일 hash는 초기 checkpoint 관측이며 현재 전체 파일 목록으로 오인하지 않는다.

## 조건별 증거

| P03 조건 | 실제 결과·범위 |
|---|---|
| 정확 도구·lock/출처 | Windows Node24.18.0/npm11.12.1, WSL24.21.0/11.19.0. engines24.18+<25. package-lock 정확 버전/integrity, 설치 lifecycle OFF·최종102패키지. 자동 업데이트0 |
| 최소 실행·계약 | unit13 PASS·0fail/skip/todo, typecheck exit0, 생성 schema 타입 `--check` exit0. Vite Web14모듈 build exit0 |
| 실제 저장/조회 | WSL exact892ea1e1과 Windows 신규 app 참조에서 실제 storage 각1 PASS. 별도 연결 재조회·접속 DB/role/port 확인·DDL거절42501·고유 probe 정리count0 |
| 신규 DB/QA | PG15.18 exact image/ID/instance·loopback5546. migration0000 실제 적용/멱등 재적용, 합성 fixture7. 제품 로그인 사용자·프로젝트 생성0 |
| 실제 HTTPS/화면 | Windows exact0ec17f1a의 Node 승인 CA probe exit0. 실제 Edge155.0.4283.45/Playwright1.64.1 1 PASS(2.0초), Network3/off-origin0/pageErrors0/TLSignorefalse. React 준비 화면만이며 UI00 아님 |
| 권한/비밀 | 새 로컬 root는 사용자/SYSTEM만, WSL0700/0600·UID1000. exact CurrentUser Root CA1개. 기존 key·LocalMachine·기존 인증/공유 proxy 변경0, 키/DSN 원문 출력0 |
| 정리·재현 | Windows 등록 npm-cache/P03-browser·WSL 등록 npm-cache 잔여0. QA Edge0·동적 DB probe0. 정식 개발 PG/volume/Secret 참조는 후속 개발 보존. 동일 명령 재실행 가능, 이미 성공한 검사를 불필요 반복하지 않음 |

정확 재현 명령은 `docs/contracts/COMMAND_MAP.md`에 있다. 실행한 주요 명령은 `npm test`(13), `npm run typecheck`, `npm run build`, `npm run contracts:generate -- --check`, `node scripts/migrate-development.ts`, `npm run test:db`(실제1), `node scripts/check-development-https.ts <보호경로의 공개CA>`, `npx --no-install playwright test tests/browser/P03/environment.spec.ts`(실제1)이다. DB 명령은 승인된 보호 설정 참조만 환경으로 전달하며 값/DSN을 로그에 넣지 않는다.

## 보존할 자원과 회수

- WSL source `/home/daon/deploy/anvil-v3`·전용 `anvil-v3-development-pg`, network `anvil-v3-development`, volume `anvil-v3-development-pgdata`·DB `anvil_v3_development` 보존.
- PG ID `e6f798c3a2a3bdb2be533dd4c024d76f34d19fcfbbe4bf2acbe0437fb0cf32ba`, image `sha256:594290e91b09c09728ed945ff89db65cd0fafff251f7c03c3d99c00ae5d9442f`, digest `postgres@sha256:6eb0add3b77c081df18aa518ce43df58fdcc40f2e6d868a6fd08038dc7acd425`.
- instance `dc22a0629e79f259dcd935845e88e58e`, project=v3/owner=P03. migration0000 SHA256 `6ebbb9c580d54a50e0431806ee982244cbe134613354f8c3a8cd4f547e30178d`.
- 보호 참조: WSL `/home/daon/.local/share/anvil-v3-development`, Windows `D:\Project\Anvil\.av3-data`. 실제 값은 Git/문서 제외. 신규 app참조만 Windows에 전달했고 bootstrap/migrator 값은 복사하지 않았다.
- 로컬 소유 HTTPS Node52852·startUTC `2026-10-15T19:08:42.2263733Z`·code0ec17f1a·127.0.0.1:3830. 전환 시 receipt/PID/시각/exe/port를 확인해 정확 소유 process만 종료한다. 공유 wslrelay26052/5546은 회수 대상이 아니다. 신규 SSH tunnel0.
- CA `498348218A4015B341A90B10FF4FE176987D4424`, leaf `047CD961EB4B376350A1119C46185FB6D8721F14`·SAN localhost/127.0.0.1/172.27.253.53. 2026-10-23 03:29:02 KST 만료 또는 지속하는 개발 HTTPS 검수 종료 때 **이 CurrentUser Root1개만** 회수한다. 새 인증서 재생성/기존 신뢰 삭제는 하지 않는다.

## 실패·보완 이력과 미확인

- 독립 검토 첫 C0/I2/M0: Docker 조회 실패를 부재로 오인할 위험과 DB endpoint 불일치 위험. fail-closed 조회·새 instance label/ID/image·정확 endpoint/접속 신원으로 보완하고 음성 RED→GREEN, scoped C0/I0/M0. Windows 후속 scoped도 C0/I0/M0.
- PG init 임시 socket 서버를 최종 준비로 오인하는 RED를 확인해 TCP127 readiness로 고쳤다. 초기 실패를 성공으로 소급하지 않았다.
- 최초 Windows 시작은5546 점유에서 process 생성 전 중단. 기존 Microsoft wslrelay를 독립 신원 확인 후 명시 재사용했으며 종료/교체하지 않았다.
- 최초 HTTPS 시작 후 PowerShell 웹 cmdlet만 시간 초과. 정확 소유 Node 정리 후의 브라우저는 연결거절로1실패. 독립 Node CA검증/Windows 기본신뢰 HttpClient/Edge는200·PASS이나 cmdlet 내부 원인은 미확정. 보안/timeout을 낮추지 않고 exact CA·신뢰·Node2초 probe로 준비 확인을 분리했다. 원래 실패는 WORK_STATUS에 보존.
- module 부재2는 기능 TDD RED에서 제외. Vite sandbox EPERM1/실제 허용 실행 성공, Git sandbox diff 오류/실제 diff0, 초기 DNS읽기 오류·잘못된 PowerShell/도구 인자·생성타입 EOF·타입 오류는 WORK_STATUS에 원인/정정/횟수를 보존했다. ACL/네트워크/공유 서비스 수리0.
- 미검증: 제품 로그인/프로젝트/방법론/문서/권한·Agent 지시/회수/비용·설치형/모바일/Oracle/전수 보안·성능. 준비 fixture·health/build를 이 기능 PASS로 승격하지 않는다.

## 조치·rollback·다음

P03 준비 조건을 수용하고 Stage A PR 통합·필수 검수·merged-main smoke·정리로 이어간다. 원래 사용자 자료/backup은 보존한다. 실패 시 해당 새 source commit만 비교해 별도 보완하며 자동 reset/down/drop·기존 DB/권한 복원은 실행하지 않는다. 새 runtime은 정확 소유 확인으로만 중지하고 신규 개발 데이터는 보존한다. Stage B는 UI00→FN01/FN11 기반과 계획 의존을 따른다. 실제 Agent 호출·Oracle 이전 같은 남은 승인 경계는 도달 시 별도 요청한다.
