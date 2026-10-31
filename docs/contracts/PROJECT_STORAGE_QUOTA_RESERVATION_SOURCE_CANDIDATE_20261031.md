# 프로젝트 저장량·지속 예약 source 후보 — 2026-10-31

상태: **DRAFT / NOT_ADOPTED**. 이 문서는 결정 자료이며 코드·새 표·SQL 작성/적용·권한 부여·실제 사용량 조사·서비스·Agent 실행의 승인이 아니다.

작성: Main 어울의 검토용 권장안을 Primary가 정리했다. 기존10GiB·UNKNOWN 보존과 달리 A의 임시 중복 산입·새 원장·초기 검증/해제 권한은 이번에 제안하는 선택이며 신산님의 기합의 사항이 아니다. source-only라는 이유로 새 계약이 자동 채택되지 않는다.

## 1. 결정의 정확한 대상

P02 [TECH_DECISIONS §12](TECH_DECISIONS.md)는 “프로젝트 원본/첨부 총10GiB”와 초과 시 입력 보존·명시 오류, 자동 절단/삭제0을 정했다. 문서 SHA256은 `2048226A20B4BB8922F53E2840367423B1C27158CB1BD1EDF16ECD167A4B0FE4`다. 이 값은 DB 물리 점유량·인덱스·모든 metadata를 합친 디스크 quota라고 정의되지 않았다. 백업의 별도10GiB와 spool1GiB도 이 프로젝트 원장으로 임의 합산하지 않는다.

채택된 [FN13 r2](../work_packages/FN13_SERVER_CHECKPOINT_STORAGE_DECISION_PACKET_20261031.md), SHA256 `61BBF0DC715F6326E17791147F604ED0E7921C5AD28B1858DD7486F29071C26F`는 checkpoint의 canonical 최종 snapshot+recordText 논리 바이트를 프로젝트당1GiB/10000기록으로 제한하고, 전체10GiB의 같은 transaction 사용량·새 바이트 예약 근거가 없으면 `412 PROJECT_STORAGE_QUOTA_UNVERIFIED`로 신규 저장을 막도록 명시했다. 정확한 같은 명령 replay와 보호 읽기는 신규 용량이 아니다.

다음 A는 이 둘을 연결할 **집계 단위·새 지속 예약/정산·writer 참여 및 미적용 forward SQL**의 제안이다. FN13 승인만으로 아래 새 저장 계약이 채택됐다고 하지 않는다. B는 현재412를 유지한다. 전체 FN13·P02·프로젝트 완료 여부를 묻는 결정이 아니다.

## 2. 현재 확인한 실제 source와 공백

|실제 경로|현재 동작|재사용과 한계|
|---|---|---|
|`apps/server/storage/artifact-store.ts:31,46,141`|`#usage`가 프로젝트 `blobs`와 `staging`의 파일 크기를 합산하고 `put/copyDraft`가 10GiB를 검사한다.|FS 원본 바이트의 실제 접점이다. DB checkpoint metadata·별도 지속 예약은 없고 공개 usage provider도 아니다. 이번에 실제 디렉터리/파일을 조사하지 않았다.|
|`apps/server/modules/documents/project-files.ts:46–64`|현재 controller/정책→replay→`store.put`→receipt→`artifacts` INSERT.|신규 upload의 증가 writer. 저장소 쓰기가 DB INSERT보다 먼저다. 격리된 파일도 남는다.|
|`apps/server/modules/documents/project-documents.ts:37–41`, `project-proposals.ts:34–43`|현재 문서의 보호 reader로 diff를 만들고 `ArtifactStore.put` 후 diff artifact·proposal·receipt를 저장한다.|본문·첨부 upload와 별개의 서버 생성 diff 증가 writer다. 누락하면 우회 경로가 된다.|
|`apps/server/modules/access/project-command.ts:54–66,138–167`, `access/repository.ts:66–85`|정상 명령은 인증 transaction과 `FOR UPDATE OF p,m`/control 잠금 아래 실행하고 COMMIT/ROLLBACK한다.|정상 동시 명령의 직렬화에 재사용한다. ROLLBACK은 DB 대상이며 FS를 원복하지 않는다. DB 세션 잠금 상실 뒤 OS I/O가 끝났다는 보장도 없다.|
|`db/migrations/0003_project_artifacts.sql`|artifact별 bytes/hash/상태와 project 또는 draft 귀속·명령을 기록한다.|행의 bytes 합계만으로 DB rollback 뒤 남은 파일·부분 staging을 알 수 없다.|
|`db/migrations/0042_draft_artifact_storage.sql.pending:3–54,117–123,253–260,277–318`|개인500MiB/200·업로드2배 예약, 생성 복사 예약, target project의 선택첨부 예약, adoption 뒤 중복 회수 확인을 분리한다.|`fn01_project_quota`는 생성 intent 전용이다. 일반 upload/diff/checkpoint의 전체 집계 원장이 아니며 실제 적용 상태도 이번에 확인하지 않았다.|
|`apps/server/modules/projects/draft-artifacts.ts:163–208`, `draft-artifact-files.ts`|별도 예약 transaction→DB 밖 복사/검산→같은 생성 transaction의 adoption→후속 정확 중복 회수.|선행 지속 예약이라는 구조를 참고한다. 원함수·개인 quota를 전역 quota로 이름만 바꾸지 않는다.|
|`apps/server/modules/checkpoints/project-checkpoints.ts`|현재 권한/replay·chain/CAS·최종 canonical 바이트를 검사하고 전역 공급자 부재412.|실제 새 저장을 허용하지 않는다. 합성 seed 조회를 저장 성공 공급자로 쓰지 않는다.|

증거 지문: ArtifactStore `769F3C69FF879E1B1553AFB2D2B7E51212C467EBE9423EE0A365341E4131BFD4`, 0042 `76D16C972339359B839ADA8A27A466C1F60873B5734FC37303F042B75C2CAA87`, project-files `79AB7BF44B55D85D38FE59DBA3F48E39B903C0D8066C4FF721C2CAC4E46CE7D4`, project-proposals `C7F4C4ED27B38EFE1F00160B306084FF4471346B69B40331753BDF312072233A`.

따라서 `SUM(artifacts.bytes)+checkpoint metadata+incoming`만 추가하는 안은 현재 원문 잔류를 빠뜨린다. FS가 남은 채 DB만 rollback된 경우를 정상0으로 처리해서는 안 된다. 정상 project 잠금이 있다는 사실을 FS/DB 원자성이나 OS 절대 기한 보장으로 확대하지 않는다.

## 3. A안 — 보수적 집계 단위 후보

아래는 **채택을 요청할 제안 단위**이며 P02 원문의 기확정 세부값이라고 주장하지 않는다. 전부 비음수 정수 바이트이며 SQL bigint/numeric 또는 정확한 decimalstring을 사용한다. JS Number를 거쳐 큰 정수를 반올림하지 않는다.

|항목|A 후보의 산입/정산|
|---|---|
|프로젝트 원본·본문·첨부·서버 생성 diff|실제 별개 artifact ID/보관 본문마다 최종 UTF-8/원바이트 크기 B를 한 번 산입. 같은 ID의 여러 참조는 추가0, 같은 hash라도 다른 ID/실파일이면 각각 산입. 현재 저장소는 content-hash dedup 또는 공유 hardlink를 전제로 하지 않는다.|
|READY·QUARANTINED·FAILED·미확정/참조 해제된 파일|실보관 중이거나 잔류가 불명이면 계속 산입/예약 유지. 격리·실패·문서 detach를 용량 반환 근거로 쓰지 않는다.|
|일반 upload/diff의 staging과 게시 중복|최대 동시 본문 사본2개를 고려해 쓰기 전 **2B**를 지속 예약하고, 최종 파일·staging 회수의 정확 검산 뒤 B로 정산한다. 이는 현재 `usage+incoming B`보다 보수적이어서 경계 부근의 허용량이 줄 수 있는 중요한 제안 delta다. seal·디렉터리/FS 할당 overhead는 본문 바이트와 별개이며 이 수치가 디스크 여유 보장은 아니다.|
|개인 DRAFT 원본/중복|프로젝트 귀속 전에는 기존 개인 quota에 남긴다. target project의 복사는 기존 durable creation intent/선택 합계의 B 예약으로 시작하고, adoption 뒤 프로젝트 본문 B로 정산한다. 남은 개인 중복은 기존 owner 예약에서 실제 회수 확인 전까지 계속 산입한다. 프로젝트와 개인 한도를 더한 전체 디스크10GiB를 주장하지 않는다.|
|checkpoint|기존 r2대로 최종 stored snapshot의 canonical UTF-8 + 원 recordText UTF-8 합계 C. 임시 준비 snapshot 크기로 축소하지 않는다. 물리 파일을 만들지 않으므로 이 항목의 논리 증가량은 C다. 프로젝트 전체10GiB와 FN13 개별1GiB/10000 모두 만족해야 한다.|
|DB 물리 overhead·다른 metadata|페이지/TOAST/인덱스/WAL, 명령·영수증·감사 JSON의 중복 바이트, 일반 graph/방법론·기타 snapshot은 이 후보10GiB 집계에서 제외한다고 **명시 제안**한다. 별도 실제 DB/디스크 한도·보존은 미해결이며 이를 무제한/안전으로 해석하지 않는다. 다른 metadata까지 포함하려면 표별 canonical 정의·모든 writer를 별도 확정한다.|
|FS·DB 불일치/미등록 원문/길이 불명|0 또는 declared bytes로 추정하지 않는다. 검증 근거가 없는 범위는 UNVERIFIED로 닫고 신규 저장412. 불명 진행 중 I/O는 이미 보유한 예약 상한을 낮추지 않는다.|

전역 판정 후보는 `확정 산입량 U + 미정산 보유량 R + 새 예약 증가량 <= 10GiB`다. 같은 물체의 RESERVED→SETTLED 전환을 U와 R에 이중 산입하거나 둘 다 빠뜨리지 않게 같은 transaction에서 바꾼다. 이미 cap을 넘는 기존 자료를 자동 삭제/축소하지 않고 새 증가만 거절한다. replay/읽기를 새 증가로 세지 않는다.

## 4. 운영 transaction rollback 뒤에도 남는 예약 프로토콜

예약을 artifact/명령과 같은 운영 transaction에서만 INSERT하면 rollback과 함께 사라지므로 **그 방식은 채택하지 않는다**. 다음 순서가 A의 핵심이며 외부 입력 bool/가짜 provider로 단계를 건너뛸 수 없다.

1. **보호 계획 조회 Tx:** 실제 현재 인증/CSRF·OWNER/controller/generation·AUTO/필요 원승인·정책/세션 기한·고정 원자료를 검사하고 원 command 전체 hash, part별 artifact ID/bytes/hash, 예상 charge를 고정한다. diff 계산이 기존 보호 read를 필요로 하면 이 Tx에서 읽되 아직 새 파일을 쓰지 않는다. 이 Tx를 종료한 뒤 다음 Tx를 시작한다. 기존 project 잠금을 잡은 상태에서 다른 연결로 동일 잠금을 요구하는 예약 Tx를 중첩해 deadlock을 만들지 않는다.
2. **독립 예약 Tx:** 현재 권한/기한·고정 계획을 재검사하고 동일 project 잠금 아래 원 command+part의 유일 키로 예약을 확보한다. 기존 검증된 U/R와 cap을 검사하고 **예약 COMMIT을 확인한 뒤에만** 진행한다. 동일 외부 commandId의 다른 hash/주체/part는409, 같은 키의 재확인은 새 예약0이다.
3. **독립 시작 Tx:** 예약의 현재 소유·정확 part/fence를 CAS로 `IO_STARTED`에 바꾸고 **별도로 COMMIT 확인**한다. 운영 Tx rollback이 시작 표식을 RESERVED로 되돌리지 않아야 한다. 한 번만 시작 가능하며 대기 중인 같은 요청이 두 번째 writer를 만들지 않는다. 인증·승인·기한은 이때도 원규칙대로 검사한다. 예약은 권한 연장/승인 소비의 대체가 아니다.
4. **쓰기/운영 Tx:** 현재 권한·원자료·project 잠금을 다시 검사하고 이미 시작된 정확 예약으로만 FS를 쓴다. 데이터 경로·O_EXCL/원hash/close·copy/adoption·격리 의미를 약화하지 않는다. FS 완료와 원명령/receipt/audit/자료 INSERT를 대조하고, 예약 정산을 같은 운영 Tx에 결박한다. checkpoint는 FS 없이 같은 C를 보관하며 원명령·chain·감사 순번 검산을 그대로 유지한다.
5. **확인된 정산:** 정확 artifact/row·command/receipt/audit와 예약 양방향 대응, 최종 원문 및 임시 중복 회수의 확인을 모두 거쳐 U/R를 원자 전환한다. 서버 내부 commands.id와 외부 commandId를 구분한다. receipt만/원문만/예약 정산만 COMMIT되는 형태는 deferred 완결 검사로 거절한다. 제안 검사 source를 실제 PG 원자성 증거로 표시하지 않는다.

|crash/불명 지점|필수 보존 결과|
|---|---|
|예약 COMMIT 전 실패|새 FS I/O0. 확정 rollback과 COMMIT 결과 불명은 구별한다.|
|예약/시작 COMMIT 응답 불명|I/O 시작0, 원 commandId 보존. 단순 조회에서 행이 안 보인다는 이유만으로 새 ID/예약으로 자동 재실행하지 않는다. 원 transaction 종결·현재 원장 결과를 확인할 수 없으면 UNKNOWN이다.|
|예약 COMMIT 후·시작 전 crash|예약은 운영 Tx와 독립적으로 남는다. 서버 시간이 지났다는 이유로 해제0.|
|IO_STARTED COMMIT 후 권한 만료/FS 실패/프로세스 소실/DB 연결 상실|보유 charge가 남는다. DB lock 해제를 FS 종료/회수 증거로 쓰지 않는다. UNKNOWN의 자동 재시작·감액0.|
|FS 게시 후 운영 Tx rollback|예약은 선행 Tx에 남고 FS 잔류는 보존한다. U=0으로 되돌렸다는 이유로 R까지 제거하지 않는다.|
|정산 COMMIT 응답 유실|정확 같은 명령의 원영수증·행·정산 원장을 현재 권한 아래 재검산한다. 새 파일/새 예약을 만들지 않는다.|
|원본 검산/close/회수 결과 불명|UNKNOWN으로 보유. 절대 OS 기한·파일 회수 성공·실사용량 정확을 주장하지 않는다.|

`RESERVED`이고 시작 CAS가 한 번도 성립하지 않았다는 원장 잠금을 확인한 경우의 취소만 원래 주체/명령에 결박해 제안한다. `IO_STARTED/UNKNOWN`은 시간·기한 만료·클라이언트 취소·프로세스 PID 부재만으로 해제하지 않는다. 실제 no-writer/부분·최종 파일/반대편 transaction을 검증하는 별도 재조정·정확 해제 계약/실행이 필요하며 이번 source-only A에 실제 회수 실행을 포함하지 않는다. UI의 취소 버튼을 새로 발명하지 않는다.

순수 DB checkpoint에도 예약·운영 Tx의 명령 결과를 정확 연결하되 실제 새 저장 허용은 전체 provider/coverage가 검증된 경우에만 가능하다. 이 프로토콜을 구현하지 못한 채 더 많은 NOT_CONNECTED 함수만 추가한 것을 작업 완료로 부르지 않는다.

## 5. 새 프로젝트와 기존 프로젝트를 분리한다

**새 프로젝트도 현재 코드만으로 자동0 초기화하지 않는다.** 현재 `createProject`는 먼저 `prepareCreation`으로 기존0042의 지속 intent/선택첨부 예약을 만들고 DB 밖에서 복사·closed 검산을 한 뒤, 생성 transaction에서 project·adoption·원명령/receipt를 연결한다. 무첨부는 저장소 초기화를 생략할 수 있으므로 ‘DB project가 방금 생겼다’만으로 실제 namespace가 비었다고 할 수 없다.

A의 새 프로젝트 경로 제안:

- 정확 생성 command·targetProjectId·동결 선택 snapshot/selectionHash·원 upload provenance와 copy 완료를 재사용한다. 기존0042의 예약은 기존 상태/수명·개인 quota 그대로 보존하며 전역원장으로 이름만 바꾸지 않는다.
- 프로젝트 row가 아직 없을 때 FK를 가진 새 account를 먼저 COMMIT하는 모순을 피한다. 사전 생성/복사는 현재0042의 durable creation 예약이 소유하고, 새 account의 인계는 project/adoption이 실제로 성립하는 **동일 생성 Tx**에서 수행한다. 부분 실패/UNKNOWN이면 기존 intent·예약을 남긴다.
- 무첨부의 U=0은 정확 무첨부 원명령/선택 snapshot뿐 아니라 실제 생성 namespace의 신규·비혼재/빈 상태 검산이 필요하다. 첨부가 있으면 U는 검증한 선택 B 합계이며 0이 아니다. 이 사실을 실제 수행하는 저장소 접점·생성 순서 검수 전에는 READY account를 만들지 않는다. 공개 caller의 `empty=true`·임의 환경 flag·과거 이름만으로 승격0이다.
- 인계 이후 upload/diff/checkpoint 및 모든 추가 바이트 writer가 같은 계정/예약 프로토콜에 참여해야 한다. 과거 코드나 직접 INSERT가 새 writer 경로를 우회할 수 있는 배포 상태에서는 신규 usage를 VERIFIED라 하지 않는다.

**기존 프로젝트는 이번 A에서도 자동 승격하지 않는다.** 기존 metadata·미등록 blob/staging·개인 draft/adoption/중복·UNKNOWN의 목록/바이트·소유와 진행 writer를 실제 대조하는 별도 시작 패킷이 필요하다. 이번 결정으로 실제 FS/DB 사용량을 읽거나 마이그레이션으로 `usage=0`을 채우지 않는다. 미검증 프로젝트의 신규 저장은412를 유지하고 기존 원문/정확 replay는 원보호 조건으로 제공한다.

## 6. 새 데이터·권한·API와 writer 영향

제안하는 최소 지속 모델은 프로젝트별 coverage/집계 세대·정산 상태의 account와 command/part별 불변 연결·상한·phase/fence를 담는 reservation 원장이다. **신규2표 후보**이며 이름/열·CHECK/FK/양방향 deferred guard·최소 앱 SELECT/쓰기 함수 권한은 채택 후 WI에서 고정한다. 기존0042를 전역원장으로 확장하는 대안은 생성전 FK·개인 quota·기존 보존 이력의 의미를 바꾸므로 별도 비교가 필요하다. 이 후보는 원0042 수정/실제 GRANT가 아니다.

- 새 public route/목록/latest/search/사용자 quota setter는 제안하지 않는다. 기존 upload/명령의 입력·hash·고정 ref와 원영수증 형태를 보존한다. 내부 여러 transaction과 신규 DB 지속 상태·새 오류 의미는 중요한 변경 delta다.
- 표준 오류 외피 안에 quota 미검증412, 확정 cap 초과429, 같은 명령 hash 충돌409, 시작/COMMIT/FS 결과 불명503을 구분하는 후보를 둔다. 이미 I/O 가능성이 생긴 원명령을 명확한 입력 거절로 분류해 새 명령을 자동 만들게 하지 않는다. 최종 code 문자열/일반 업로드의 기존 오류와 호환성은 WI에서 고정한다.
- 원래 operation의 인증/CSRF·정책·재인증 필요 여부·승인 소비를 단계마다 재검사한다. 준비 예약이 승인 소비나 실제 저장 성공은 아니다. 승인 만료 후 예약이 남아 있어도 신규 부작용 허가0. 승인 소비는 원운영 Tx의 원명령/자료와 기존 완결 계약대로 묶고 실패 시 부분 소비 성공0이다.
- 실제 활성 role/GRANT·기존 DB 수정·원문/권한 활성화는 제외다. GUC나 account metadata만으로 인증·현재 coverage 권위를 발급하지 않는다. 실제 captured repository/store의 현재 검산을 통해서만 provider가 성립해야 하며 테스트 bool/callback을 제품 성공 경로로 노출하지 않는다.

읽기에서 확인된 최소 영향 제품 경로는 다음과 같다. 정확 allowlist·신규 이름은 채택 후 실제 인벤토리와 WI로 확정하며 이 문서로 쓰기 권한을 주지 않는다.

1. `apps/server/storage/artifact-store.ts`: 실제 FS phase/정확 바이트·닫힘/잔류 검산 접점, 기존 put/read·개인 DRAFT 의미 보존.
2. `apps/server/modules/documents/project-files.ts`: 일반 upload의 분리 예약·원명령 replay·운영 Tx/UNKNOWN 연결.
3. `apps/server/modules/documents/project-proposals.ts`, `project-documents.ts`: 보호된 diff 계획/고정 byte·실제 put의 예약/정산.
4. `apps/server/modules/projects/draft-artifacts.ts`, `draft-artifact-files.ts`, `repository.ts`: 현재 생성 예약→실 copy→project/adoption account 인계·기존 중복 회수/owner quota 유지.
5. `apps/server/modules/checkpoints/project-checkpoints.ts`: 현재412를 실제 검증된 provider로 대체할 조건, 현재 권한/replay/CAS·로컬한도 보존.
6. `apps/server/modules/projects/routes.ts` 및 필요 시 `apps/server/modules/access/project-command.ts`의 해당 operation 한정 dispatch/transaction 접점: 현재 `policies.command`는 material callback 전에 project 잠금을 잡는다. 그 callback 안에서 별도 연결의 지속 예약 Tx를 시작하지 않도록 호출 경계를 실제로 분리해야 한다. 일반 command의 권한/replay/승인 의미는 유지하고 정확 수정 여부를 WI에서 고정한다.
7. 신규 내부 quota 모듈 및 신규 미적용 forward SQL 후보. 적용 loader·기존 migration 원형 변경0. 실제 PG 검증/적용은 별도다. 현재0058의 신규 INSERT 거절 guard를 실제 provider에 결박해 바꾸려면 새 forward에서의 정확 대체/역방향 완결 검사를 함께 제시해야 한다. 원guard를 무조건 삭제하거나 GUC 한 개로 통과시키지 않는다.
8. 위 제품 경계의 집중 메모리 transaction/FS 대역 시험과 SQL source 구조 검사. 기존 FN01 draft service·프로젝트 file/proposal·FN13 receipt/chain/replay 직접 회귀를 선택한다. UI에서 불명 원명령 보존·정확한 거절 분류의 영향이 있으면 해당 실제 consumer 경로를 WI에 추가하고 승인 범위로 대조한다.

참조만 추가하는 attach/saveDocumentDraft 등은 원문을 새로 보관하지 않으면 delta0다. 이를 파일 삭제·새 quota 발급으로 취급하지 않는다. 별도 새 원본 writer가 발견되면 임의로 ‘그 외0’ 처리하지 않고 coverage를 닫아 allowlist/계약 차이를 먼저 확정한다.

## 7. 검수·완료 조건과 남은 선택

source-only A의 필수 합성 반례는 다음과 같다.

- 기준 U/R·최종 C·incoming body·2B 임시 중복의 정확 경계/초과, 같은 artifact 참조 재사용과 같은 hash 다른 실제 파일의 차이, 격리/실패/미등록/크기 불명 미감액.
- 동일 command 동시 요청·다른 hash·다른 주체/client/project·현재 제어/정책/세션·승인 만료, 원 command/hash/ID와 server command row ID·artifact/fullref 연결.
- 예약 COMMIT 유실/시작 COMMIT 유실/FS 전후 crash/운영 rollback/정산 응답 유실을 각각 모사하고 선행 예약이 사라지지 않는지 검증. UNKNOWN 시간 경과/취소·프로세스 소실로 자동 해제0.
- 원문만/영수증만/정산만·고아·역방향 누락, 새 프로젝트 empty 증빙·첨부 B 인계·기존 프로젝트 UNVERIFIED·구 writer 우회 거절.
- 정확 replay는 현재 보호 검산 뒤 새 charge0, 보호 GET은 quota 미검증과 무관하게 원권한/무결성 유지. UI 불명 결과는 원명령 보존/자동 POST0.

가짜 transaction/FS 대역은 source protocol의 인과관계만 검증한다. 실제 DB rollback/COMMIT 경합·연결 상실·OS I/O/전원손실/FS 소유·실제 사용량·신구 코드 혼재/배포·실제 role는 NOT_RUN이다. 합성 성공을 현재 프로젝트의 VERIFIED usage로 쓰지 않는다.

아직 확정되지 않은 선택은 ①임시2B를 전체10GiB에 함께 산입하는 보수안의 실제 허용량 영향, ②기존 usage 검증·진행 writer fencing/권위와 복구·해제 절차, ③새 프로젝트 namespace 검산 접점/0042 account 인계의 정확 guard·열, ④공개 오류 code/기존 명령 consumer 영향이다. 이들을 정하지 못하면 안전한412 해제/사용가능 완료를 주장할 수 없다. 일반적인 immutable account descriptor나 더 많은 NOT_CONNECTED stub만 구현하는 것은 A의 완료가 아니다.

실제 프로젝트의412 해제 재개조건은 해당 프로젝트의 현재 원본/첨부 namespace·row/원명령/선택·copy/adoption 관계와 진행/잔류 I/O를 검증할 수 있고, 모든 증가 writer가 동일 예약 프로토콜을 사용하며, 초기 account 인계/기존 usage와 UNKNOWN 상한이 빠짐없이 결박된 증거가 존재하는 것이다. 특정 현재 원문/IO 참조를 검증할 수 없으면 해당 범위는 미확인412로 남긴다. 전체 bootstrap을 이번 문서/합성으로 검증했다고 하지 않는다. 실제 증거를 얻는 DB/FS·권한·소유/수명·회수 실행 패킷은 별도 정확 판단 대상이며 아직 발행/실행하지 않았다.

## 8. B안·권장 판단·실행 제외

B는 기존 P02 FS cap/0042 원형과 FN13 신규 저장412·기존 읽기/replay를 유지한다. 데이터 계약/지속 예약을 추가하지 않지만 FN13 신규 서버 저장은 사용 불가로 남는다. UI에 그 사실을 계속 보여준다.

검토용 권장안은 **A의 source 계약과 포함 바이트를 먼저 정확히 결정하되 기존 자료를 승격하지 않는 것**이다. A 채택 후에도 미적용 forward SQL·모든 writer·합성 crash 반례가 준비되기 전에는412를 해제하지 않는다. 기존 프로젝트를 실제로 활성화하는 행위는 본 A에 포함하지 않는다.

두 안 모두 실제 DB/SQL/GRANT·권한/정책 부여·키/Secret·사용량 측정/원FS IO·서비스·Agent·실사용량 초기화·자동 삭제·실제 예약 재조정/복원·배포를 허가하지 않는다. 현재 Main의 문서 초안 작성 허가만으로 A를 채택하지 않는다.

rollback은 소유 source checkpoint를 일반 revert하고 신규 연결을 failclosed로 돌리는 방향이다. 실제 적용된 예약/원문/영수증을 reset/delete하거나 UNKNOWN을 감액하지 않는다. 향후 적용 후 rollback은 기존 charge를 보존할 호환 writer/guard와 별도 정확 실행 계획을 먼저 마련해야 한다. 미적용 SQL rollback을 실제 DB 원복 성공으로 표현하지 않는다.
