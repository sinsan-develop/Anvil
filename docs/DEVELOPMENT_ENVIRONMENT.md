# Anvil 재설계 개발환경

## 현재 단계와 정본

현재는 상세 설계 r8·작업계획 r7에 검토 보완을 본문 통합하고 P02 상세 계약을 작성하는 단계다. 작업계획 r3 승인·P01 시안/양식 승인·TD-01 A안·TD-02 Anvil 전용 로그인 설계 선택을 유지하되 P02/P03 선행과 실제 실행 승인 경계는 별도로 대조한다. TD-02는 설계 선택이며 실제 사용자·DB·Secret·인증서 변경이 아니다. 제품 구현과 신규 배포는 시작하지 않았다. 새 작업의 기준은 AGENTS.md, docs/design/Anvil_설계서_v3_초안.md, docs/design/Anvil_v3_인터뷰_합의사항.md, docs/design/문서작성_공통기준.md, docs/WORK_PLAN.md와 연결된 업무 카드, docs/WORK_STATUS.md다. 예전 개발환경 문서와 실행 도구는 Backup/Anvil/legacy-20261015-1420에 보관했다.

## 합의한 제품 배치

- Anvil 서버: 현재 사용자 환경에서는 WSL-server. 헌법·지식·문서·지시·진행·결과의 원본을 관리한다.
- Agent 실행기: Windows PC. 지원되는 로컬 도구를 실행하고 중요한 기록과 결과를 Anvil로 회수한다.
- 사용자 화면: Windows 설치형·PC 브라우저·모바일 웹. 준비된 인터넷/VPN 경로와 인증·권한이 있을 때 원격 사용한다.

이 배치는 신규 제품 설계 방향이며 구현·배포 확인 기록이 아니다. 계정·토큰·Secret 원문을 문서나 Git에 기록하지 않는다.

## 기존 코딩 Agent 설치·사용 가능 정보

2026-10-15 신산님 직접 제공. 사용자 확인과 Anvil 실제 연동 검증을 구분한다.

| 도구 | 설치·사용 위치 | 현재 확인 근거 | 아직 확인하지 않은 것 |
|---|---|---|---|
| Codex | Windows PC | 신산님 사용 가능 확인. 직전 PATH 읽기에서 codex 명령 발견 | Anvil의 공식 지시/관측/결과/중지/승인 연동 |
| Claude Code | Windows PC | 신산님 사용 가능 확인. 직전 PATH 읽기에서 claude 명령 발견 | Anvil의 공식 지시/관측/결과/중지/승인 연동 |
| Hermes | ysna-server | 신산님이 설치 위치 제공 | 제품/버전·실행 형태·사용 상태·공식 연동 기능 |
| OpenCode | WSL | 신산님이 설치 위치 제공 | 정확한 WSL 배포판/호스트·제품/버전·사용 상태·공식 연동 기능 |

위 정보로 새 설치를 먼저 요구하지 않는다. P02는 기존 도구의 실제 지원과 연결 방식을 조사해 첫/둘째 연동 대상을 정한다. 설치됐다는 사실이 Anvil 연결 완료·작업 실행 승인·4종 어댑터 구현 확정을 의미하지 않는다. 특히 ‘WSL’을 WSL-server와 같다고 단정하지 않으며, ysna-server의 Hermes 실행/설정 변경이나 운영 서비스 접근으로 범위를 확대하지 않는다. 원격 설치 Agent의 실제 실행 지원은 기존 설계 범위와 영향 대조 후 필요 시 별도 결정한다.

## 기존 환경 정리 결과

- WSL-server의 /home/daon/deploy/anvil은 전체 로컬 백업·대조 후 삭제했다. /home/daon/despoy/anvil은 처음부터 없었다.
- /srv/anvil-wsl 및 기존 Anvil API/Web/OIDC 컨테이너, DB, 인증서·Secret·공유 네트워크는 이번 폴더 정리에 포함하지 않았다. 기존 화면은 새 설계의 구현 증거가 아니다.
- Git 목표는 sinsan-develop/Anvil, 저장소 ID1356865616을 그대로 유지하면서 현재 파일만 비우는 것이다. 저장소 자체 삭제는 담당자 오해였으며 실제 시도는 HTTP403으로 실패했다. 삭제 권한 추가 인증은 필요 없고 진행하지 않는다. 재생성·강제 초기화·다른 원격 push는 하지 않는다.
- 파일 정리 반영 완료: PR40 merge 뒤 main b4f9006e30e5afcf98ef8ef1f39707ecc8954feb, tree 4b825dc642cb6eb9a060e54bf8d69288fbee4904로 현재 파일0개다. Git fetch·ls-tree·기존 main ancestry와 저장소 ID 불변을 확인했다. 이력과 로컬 백업은 보존하며 새 설계 자료는 아직 원격에 올리지 않았다.
- 기존 cyhuh7950/anvil 등 다른 GitHub 저장소는 정리 대상이 아니다. 기존 로컬 Git 메타데이터는 복구·참조용으로 유지하며 현재 원격 설정으로 임의 push하지 않는다.
- 로컬 보관 위치: D:\Project\Anvil\Backup\Anvil\legacy-20261015-1420. WSL 전체 압축·원격 mirror·로컬 bundle·메타데이터·기존 파일을 보관한다.
- 접근 제한된 기존 .pytest_cache 1항목은 남아 있으며 ACL 변경·강제 삭제를 하지 않았다.

신규 port·패키지·DB 스키마·인증 방식·배포 절차는 상세 설계와 새 계획 이후 확정한다. 과거 compose나 배포 도구를 새 환경에 그대로 실행하지 않는다.

## P03 준비 범위 — 실행 승인·생성 전

2026-10-16 P02 종료 대조와 다음 승인 경계를 준비한 읽기 결과다. 신산님은 질문 `call_f2cd20981cc64d83aceff512225037b5`에 **‘새 Stage A 기준선·private push 승인’ / ‘새 전용 개발 자원 준비 승인’ / ‘개발 인증서 생성·현재 사용자 신뢰 승인’**으로 아래 세 범위를 직접 승인했다. 승인은 실행 결과가 아니며 P02 검수 뒤 정확 대상·생성 직전 상태를 확인한다. 실제 유료 Agent 호출·기존 서비스 교체·Oracle는 제외한다.

- 지정 development 원격의 현재 main은 실제 `git ls-remote`에서 `b4f9006e30e5afcf98ef8ef1f39707ecc8954feb`였다. 로컬 development/main은 `0443043251d25aa77c17d23165b7c9299c8dbeb8`로 오래됐으므로 그 로컬 ref를 최신으로 쓰지 않는다. 원격 수정/소스 전송0. sandbox의 MSYS SSH 오류와 WSL 접근 거부는 승인된 외부 읽기 실행 exit0 결과와 구별한다.
- WSL의 현재 container 이름/이미지/port를 읽었다. 공유 DB/다른 프로젝트·기존 서비스는 제외한다. Windows/WSL의 후보3830·5546 listener는 확인 시점0이었다. 프로세스/서비스 변경0, 생성 직전 점유/부모 realpath·소유/링크·동명 자원을 다시 대조한다.
- 로컬 `.av3-data`, `Backup/Anvil/v3-development`, `D:\tmp\anvil-v3-stage-a`는 확인 시점 존재하지 않았다. 실제 만들지 않았다. 임의 전체 디렉터리 정리/기존 Backup/자료 변경은 하지 않는다.

### Git 기준선 제안

현재 `codex/anvil-public-ui-preview`의 legacy 기준 HEAD/기존852삭제·3수정·미추적 자료는 그대로 보존한다. 기존 branch 종료 전 새 branch 예외를 위 직접 승인으로 결박한다. 최신 지정 private main에서 `codex/av3-stage-a`를 시작하고, 기존 이력을 reset/rebase/force하거나 다른 origin 저장소로 올리지 않는다.

제안 private payload는 [정확 파일 목록](contracts/STAGE_A_PAYLOAD_MANIFEST.json)의 관측51파일·7,653,332byte다. v3 정본/계약·승인/검토·상태·시안/이력이며 사용자 제공 최신 검토 Word1개도 포함한다. Backup/legacy 제품 소스/다른 프로젝트/Secret/계정/인증서/DB/스풀은 제외한다. 이후 P02 검수 기록/P03 실행 문서·승인 범위에서 새로 작성하는 v3 코드/테스트/lockfile은 exact commit 목록으로 추가 대조한다. 아직 commit/push하지 않았다. 목적은 새 개발 기준선/복구와 Git exact SHA WSL QA이며 private 저장소 일반 Git 이력으로 보존한다.

### 신규 개발 자원 — 승인된 이름·생성 전 상태

| 자원 | 대상/목적·수명·정리 |
|---|---|
| 공통 제품 port | 로컬/WSL/향후 승인 Oracle의3830을 제안. 현재는 신규 로컬/WSL 개발만, Oracle 실제 이전0. 브라우저는 HTTPS same-origin `/api/v1`, 내부 DB 주소 노출0 |
| WSL Git 경로 | `/home/daon/deploy/anvil-v3` 제안. Git의 승인 branch/exact SHA만 사용, 기존 삭제한 anvil 경로/공유 서비스를 복원/교체하지 않음. 부모/실경로·소유/부재 검증 후 생성 |
| WSL 격리 DB | 새 container `anvil-v3-development-pg`, volume `anvil-v3-development-pgdata`, network `anvil-v3-development`, DB `anvil_v3_development`, 전용 migration/app 역할. PostgreSQL15의 정확 이미지/digest 검토 뒤 사용. host DB port는 loopback5546만·공유 local-postgres/DB/권한 변경0 |
| WSL 새 server | 필요할 때 `anvil-v3-development-server`, 같은 새 network·3830만. Node24 정확 이미지/commit·migration과 합성 QA 자료로 개발 검증. 기존 API/Web/인증서·proxy 교체0 |
| 로컬 DB 연결 | 필요한 개발 process의 전용 SSH tunnel loopback5546→WSL loopback5546. 시작 전 충돌/실소유 확인, 프로젝트 사용 종료 시 정확 소유 process만 종료. 브라우저가 DB/tunnel을 직접 호출하지 않음 |
| 보호 자료 | 신규 로컬 `.av3-data`와 WSL `/home/daon/.local/share/anvil-v3-development`. 합성 QA owner·DB role·session/등록 검증용 Secret은 Git/로그/문서에 원문0, 기존 사용자/계정/키·ACL 변경0. 새 파일의 최소 접근/소유만 설정 |
| 백업/임시 QA | 새로운 `Backup/Anvil/v3-development` 수동 검증 보관·자동 삭제 OFF, 일회성 도구/fixture는 `D:\tmp\anvil-v3-stage-a`의 정확 Task 하위에 등록 후 사용/실패 즉시 정리/잔여 확인. 기존 legacy Backup 보존 |

정식 개발 DB/자료는 Stage B 이후에도 사용할 새 자원이므로 작은 검사 종료마다 volume을 삭제하지 않는다. 별도 QA 일회성 DB/container/경로는 먼저 이름/소유/수명/정리를 기록하고 종료 때 exact 자원만 제거한다. 실제 사용자 자료/운영 복제 없이 식별 가능한 합성 QA project/owner/viewer·멱등 seed/reset만 사용한다.

### 개발 HTTPS의 별도 신뢰 경계 제안

새 Anvil 개발 전용 CA/leaf 파일(대상 localhost/127.0.0.1/현재 WSL 개발주소)만 보호 경로에 생성하는 안이다. 기본 제안은 CA 유효7일·개발 leaf7일, 코드/Git에 키 원문0·기존 인증서/OS machine store 변경0이다. 일반 브라우저의 실제 로그인/CSRF를 확인하려면 신뢰 설정이 필요하며 포괄 TLS 무시/보안 flag 완화로 통과시키지 않는다.

CurrentUser Root 신뢰 저장소에 새 CA의 정확 thumbprint1개를 넣는 것은 다른 HTTPS에도 영향을 줄 수 있는 별도 보안 변경이며 위 직접 승인 대상이다. 생성 결과·subject/SAN/유효기간/hash·private key 보호를 확인하고 정확한 새 thumbprint만 추가하며, 검증 종료/만료 때 그 항목만 회수한다. LocalMachine/기존 root·인증서·VPN/공유 proxy는 건드리지 않는다. 실제 생성·추가·회수 증거는 별도 기록하고 승인만으로 브라우저 검증을 통과 처리하지 않는다.

### P03 실제 확인 — 자원 생성과 구분

- 로컬 Node24.18.0/npm11.12.1, WSL 기존 Node24.21.0을 각각 읽었다. 같은 버전이라고 보고하지 않는다. 제품 engines는 Node24.18 이상/25 미만이며 정확 lockfile을 사용한다.
- 기존 공식 PG15.18 이미지 ID `sha256:594290e91b09c09728ed945ff89db65cd0fafff251f7c03c3d99c00ae5d9442f`, digest `postgres@sha256:6eb0add3b77c081df18aa518ce43df58fdcc40f2e6d868a6fd08038dc7acd425`; 실제 `postgres --version`은15.18이었다. 전용 DB 실행은 아직 전이다.
- Node24.18.0-bookworm-slim 후보 ID `sha256:2f35c3d18013b7d65e31c40f0602e4c0a65a18efc65c16e2b98497f13f4da921`, digest `node@sha256:6f7b03f7c2c8e2e784dcf9295400527b9b1270fd37b7e9a7285cf83b6951452d`를 관측했다. 실제 사용 시 exact image와 별도 결박한다.
- 개발 CA subject `CN=Anvil v3 Development CA`, thumbprint `498348218A4015B341A90B10FF4FE176987D4424`, leaf `047CD961EB4B376350A1119C46185FB6D8721F14`; SAN localhost/127.0.0.1/172.27.253.53, 만료2026-10-23 03:29:02 KST. 신산님 OS 확인 뒤 허용된 실제 Root 조회에서 정확1개를 확인했다. sandbox 조회0과 실제 store 결과를 구별한다. 새 보호 root ACL 상속 차단·현 사용자/SYSTEM만, 키 파일은 그 제한을 상속한다. 기존 key/Root/LocalMachine 변경0, 아직 HTTPS 브라우저 PASS 아님.
- 신규 개발 DB 역할은 `anvil_v3_bootstrap`(새 컨테이너 초기화만), `anvil_v3_migrator`(신규 schema migration), `anvil_v3_app`(비관리자 DML)로 한정한다. 보호 파일은 위 WSL 경로의 bootstrap-password/migrator.json/app.json이며 stdout/Git 원문0. 기본 생성은 기존 자원/경로 발견·조회 오류 때 중단하고 새 instance label/ID/image를 다시 검증한다.
