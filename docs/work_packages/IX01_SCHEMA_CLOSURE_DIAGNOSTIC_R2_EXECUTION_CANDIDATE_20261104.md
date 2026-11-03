# IX01 수정 SQL 정의 설치 — r2 실행 후보
2026-11-04 · Main 어울

**미승인 / 소스 검수 중 / 실제 실행 금지**

첫 단발 실행은0035 정의 설치에서22P02로 실패했다. 설치 역할 권한은 회수됐고 QA 컨테이너와 새 checkout은 별도 조회에서도 부재를 확인했다. 감사 원장만 보존했다. 첫 승인은 소진됐으며 이 문서는 그 승인을 재사용하지 않는다.

## 목적과 고정 범위
수정된 SQL의 정의가 새 빈 PG15에서 설치되는지 한 번 확인한다. 기존 서비스·데이터 복구나 실제 API/화면·RLS·Agent/사용자 인수를 수행하는 실행이 아니다.

- SQL 기준:7e9ab984d2dad98fed208a2473853409dde927b9.
- 첫 실행 대비 SQL 변경:0035/0071/0072의 JSON 추출 결과를 먼저 묶는 괄호 총8바이트. 다른103개 원문은 같은지 source 검수에서 대조한다. 원D2/Git/첫FAILED·원장3은 보존한다.
- index106개는 표시 목록이다.0031의 중복 pending 원형을 제외한 명시105개만 같은 순서로 선택한다. compact orderHash09d2e7d5cd8715a0ff02540d4397db2d4cb8dcf818d808ce328423d7583f24ef, 합계2376115B다. 선택 순서는 기존 r4의 고정 JSON 배열을 그대로 따른다.
- driver code SHA·새 index SHA·bootstrap/회수 SQL/hash는 소스 동결·Main 독립 검수 후 채운다. 값이 비어 있는 동안 실행 질문·실행을 하지 않는다.
- 진단 출력에는 검증된 psql 접두의 안전 정수 statementEndLine만 추가한다. 문장 끝 위치이며 함수 내부 원인 행이라고 단정하지 않는다. 오류문장·SQL본문·DETAIL/CONTEXT·Secret은 계속 버린다.

## 새 전용 자원
| 대상 | 고정 값과 처리 |
|---|---|
| 실행 장소 | 기존 SSH WSL-server, daon/UID1000. 예상 daemon e3349f1d-dbfc-478a-96d9-295bf6c6839e/Name SINSAN. 실행 전 다르면 생성하지 않는다. |
| source | 신규 /home/daon/anvil-ix01-ddl-20261104-r2-qa. 검수된 code SHA를 기존 private Git으로 받아 clean·지문·owner/realpath/link를 확인한다. |
| PG | 신규 anvil-ix01-ddl-pg-20261104-r2-a1 / DB anvil_v3_ix01_ddl_20261104_r2_a1. slot1 단1회. 원 r1 이름·감사 경로는 재사용하지 않는다. |
| image | 기존 cache sha256:594290e91b09c09728ed945ff89db65cd0fafff251f7c03c3d99c00ae5d9442f. pull/build·기존 image 변경0. |
| 격리 | network none/포트0/hostbind·named·anonymous volume0. PGDATA256MiB·socket16MiB·tmp16MiB의 tmpfs만. read-only root·999:999·capdropALL·no-new-privileges·pids64·memory512MiB·CPU1·log-driver none. |
| 역할 | 그 새 빈 cluster 안의 installer만 설치 구간 CREATEROLE. NOSUPERUSER/NOCREATEDB/NOREPLICATION/NOBYPASSRLS 유지. app/reader는 비특권이며 원0066/0073에서만 reader를 생성한다. |
| 인증·키 | Docker 내부 Unix socket trust·TCP listen 비활성화(listen_addresses 빈 값). 암호·키·인증서·실제 로그인 생성0. 기존 인증 설정 변경0. |
| 감사 | 신규 /home/daon/.local/share/anvil-v3-qa-receipts/ix01-ddl-20261104-r2 및 빈 docker-config. directory0700/원장0600·O_EXCL·단일link·현재uid를 검산한다. 비밀 없는 원장은 보존한다. |
| Node | 기존 등록 /opt/node-v24.22.1-linux-x64/bin/node, root:root/0755/126879696B/SHA e32e2d16081cf644f88392934288086e7662529d0d43277c34f7aad2207cfafb. 부재/차이면 자동 설치·대체하지 않는다. |

CREATEROLE은 DB 하나만의 권한이 아니다. 다른 비superuser 역할·멤버십까지 영향을 줄 수 있으므로 새 빈 전용 cluster의 격리 자체가 경계다. 기존 PGDATA·volume·socket·실사용자/권한을 물리지 않는다. bootstrap 관리자가 원 SQL을 대신 설치하거나 reader를 선생성하지 않는다.

## 실행·정리와 불명 결과
새 직접 허가 수신 뒤30분 이내 준비·실행하며 PG 작업 예산은10분이다. 실행 직전1회 고정한 issuedAt/기한·소유 instance·공개 plan/owner 원문 hash를 감사에 남긴다. 해시는 사람 승인을 대신하지 않는다.

원 의도 저장→create fullID/label/image/mount/network/port 검산→start/ready→pristine/bootstrap/installer role 검산→명시105 원문 설치→명확 정착 뒤 role 회수/검산→fullID 재검산→stop --time5/rm→별도 부재 확인 순서다. stop은5초 후 새 QA에 SIGKILL할 수 있다. source checkout도 새 소유·Git clean·사용 프로세스와 실제 경로를 재검산한 경우만 제거한다. 감사는 의도 보존하며 QA 잔여와 구분한다.

생성·COMMIT·회수·종료 결과 불명 또는 신원 차이는 UNKNOWN이다. 자동 후속 mutation/삭제·재시도·다음slot은 하지 않는다. 자원이30분 뒤 남을 수 있으며 그때 정확 소유 검토와 추가 조치를 보고한다. 실패를 성공으로 추정하거나 검사하지 않은 정리를0으로 보고하지 않는다.

## 제외와 결정
기존 정식/복구 DB·P03 R3/원 volume·실사용자/회원/권한·실제 key/Secret/CA·API/Web 서비스·Agent/LLM 비용·ysna/Oracle·운영 변경은 제외한다. 단순 정의 설치 통과도 실제 함수/RLS/문서 여정·IX01/전체 계획 통과가 아니다.

권장안은 위 새 QA 한 번만 실행해 보정 후 설치와 다음 오류를 실제로 확인하는 것이다. 대안은 source-only를 유지해 실제 PG 미확인을 남기는 것이다. 현재는 어느 실행도 승인되지 않았다.
