# FN16 선택 원본 반출 잠금 metadata 보호 조회 후보

상태: **DECISION_PENDING / NOT_ADOPTED / 제품·SQL 구현 GO 아님**. 2026-11-01 Main 어울 · r2 호출자·소유자 보호 보정. 부모 후보 D582E4DD…의 독립 C0/I1에 따른 보완이며 채택은 아니다. 기준 source/private 4a0626e2cef16cfe28f4e4669b160c36db06d38c. 현재 실제 DB·권한·키·서비스·Agent 실행/사용자·백업대상 조사 제외는 유지한다.

## 확인된 충돌·동등성 조건
기존 apps/server/modules/backups/project-backups.ts의 sourceRow는 고정 문서 버전 hash와 body/attachment 귀속을 확인한 다음 artifacts를 project/id/content_hash/bytes/media_type 다섯 조건으로 SELECT FOR SHARE한다. 제품 시작 SHA256 E1BE0569FE6925CE6B88965C0AF98FBD88FF72CCF45CBFDE8F54121497824A4B.

0003_project_artifacts.sql:33과0042_draft_artifact_storage.sql.pending:75는 anvil_v3_app UPDATE/DELETE를회수한다. [PostgreSQL15 SELECT](https://www.postgresql.org/docs/15/sql-select.html)는 FOR SHARE에도 UPDATE privilege를요구한다. 실제PG권한/상속/적용상태·재현은조회하지않았다. 현재SQL계약간정적충돌이지실DB실패확정은아니다.

단순잠금제거는채택하지않는다. 기존 row잠금이없으면조회/검사뒤target.copy대기중격리state/inspection 변경이commit되어도옛row로create저장까지갈수있다. 현재앱에재분류UPDATE producer가검색되지않았다는사실은운영owner의변경불가능증거가아니다. 0005의INSERT guard와0042의조건부draft-upload불변trigger를모든artifact행의대체잠금으로사용하지않는다. 독립검토는단순제거의동등안전주장을C0/I1로판정했고제품write0으로보존했다.

## 권장 A — 잠금 의미를 유지하는 한정 보호 조회 함수
기존테이블/기존SQL은변경하지않고새forward **미적용** SQL에서하나의고정DB함수 `anvil.fn16_export_artifact_metadata_locked`를정의하는안을제안한다.

- 입력은기존artifact선택의 project_id(uuid), artifact_id(uuid), content_hash(text), byte_count(bigint), media_type(text) 다섯값과 서버가 검증한 AuthenticatedIdentity의 session_id(uuid), actor_id(uuid), client_id(uuid) 세 값으로 총8개다. HTTP 새 입력이나 caller GUC를 신원으로 받지 않는다. 동적SQL/사용자지정테이블/경로/정렬/추가검색을받지않는다.
- 반환은기존artifacts SELECT가읽던정확행/기존metadata범위다. 새본문/키·계정자료를읽지않는다. 조건은기존다섯값동등비교를유지하고같은transaction에서 FOR SHARE를획득한다. 대상0행/권한/부재오류는기존sourceRow와storage오류경계로처리한다. 격리행을SELECT단계에서조용히숨기지않고기존READY/inspection검사에전달한다.
- 함수 소유자는 migration 소유자를 그대로 쓰지 않고, 미적용 SQL에 한정 NOLOGIN 소유자 anvil_v3_fn16_export_reader_owner를 정의하는 안이다. NOINHERIT·비-superuser·NOBYPASSRLS이며 app은 해당 role 멤버가 될 수 없다. 기존0037의 소유권 이전·임시 멤버십/CREATE 회수 검산을 참고하되 새 역할의 안전성을 별도로 검수한다. 함수는 SECURITY DEFINER, VOLATILE, PARALLEL UNSAFE, search_path=pg_catalog,pg_temp와 완전 수식 고정 객체명을 사용한다. 실제 role/계정/Secret 변경은 없으며 이 정의도 채택 전이다.
- 서버는sourceRow의artifact조회1개만이고정함수호출로연결한다. 앞선documentfullref/원문hash·첨부귀속과뒤의storagekey/project/hash/bytes/mediaType·READY/inspection/실bytes검사·create/read/list/file호출은보존한다. 현재actor/client/회원·허가/승인/감사체계를우회하거나함수실행만으로반출권한을부여하지않는다.
- 함수와그권한정의는**source-only 미적용 SQL**이다. 실제CREATE FUNCTION/GRANT/REVOKE·DB접속/SQL실행·실복사/반출·실서비스/Agent실행은이번채택에포함하지않는다. 적용전함수부재는기존NOT_READY/실패경계로남기며실동작PASS로표시하지않는다.

## r2 호출자·소유자 보호를 고정하는 상세안
- 내부 sourceRow는 현재 검증된 AuthenticatedIdentity를 인자로 받아 create/job/read/list/file의 같은 인증 주체를 새 함수에 전달한다. 신원3값은 브라우저 payload·사용자 지정 GUC·문서 metadata에서 가져오지 않는다. 직접 DB 접속은 기존 공유 app 서버 역할의 신뢰 경계이며, 활성 행 관계 검산만으로 임의 DB 역할 탈취나 임의 SQL 자체를 인증했다고 주장하지 않는다.
- 함수 내부에서 session_user=anvil_v3_app 및 기존 anvil.fn01_active(session_id,actor_id,client_id)를 검사한다. 이 함수의 auth_sessions·users/clients 회수·기한·credential 세대 검산을 재사용하며 새 소유자에게 필요한 이 함수 EXECUTE만 한정한다. 별도 auth 테이블 SELECT나 Secret 전달은 제안하지 않는다.
- 잠금 대상 프로젝트에 actor의 project_members 비회수 행과 projects 존재를 함수 내부에서도 확인한다. 역사 GET을 위해 OWNER 전용·미보관 조건을 공통 reader에 추가하지 않는다. fresh create는 기존 서버의 OWNER/미보관/control/policy/별도 승인 검사를 그대로 거친다. sourceRow→copy→persistProjectReceipt 순서이므로 아직 없는 APPLIED command/receipt나 anvil.command_id를 선행 조건으로 요구하지 않는다.
- 반환 열은 id,project_id,content_hash,bytes,media_type,storage_key,state,inspection_json 8개로 명시한다. 프로젝트 회원 범위와 다섯 원본 조건을 확인한 뒤 동일 행 FOR SHARE를 같은 외부 transaction 종료까지 유지한다. app이 UPDATE 없이 호출할 수 있으나 실제 격리·metadata 검사와 반출 권한을 대신하지 않는다.
- NOLOGIN 소유자에게 필요한 artifacts 8열 SELECT·행잠금에 필요한 최소 UPDATE(id), 프로젝트/회원의 검사 열 SELECT, 기존 fn01_active EXECUTE만 정의한다. 이 함수에는 INSERT/UPDATE/DELETE 문장·동적 SQL·사용자 경로가 없으며, app의 테이블 UPDATE/DELETE나 소유자 역할 멤버십은 추가하지 않는다. 임시 migration 소유권 작업 후 불필요 권한·멤버십·CREATE를 회수하고 검산한다. 기존 이름 역할이 있으면 자동 수정·인수하지 않고 불일치를 거절한다.
- RLS를 끄거나 BYPASSRLS를 부여하지 않는다. 함수 소유자는 artifacts 소유자가 아니며 NOBYPASSRLS로 기존 테이블 RLS가 적용된다. 현재 소스에 없는 artifacts 정책을 묵시 생성하지 않는다. 필요한 정책이 없으면 fail-closed로 남기며 해당 정책 변경은 이 후보 범위 밖이다. 원문 조회의 프로젝트 회원 조건은 함수 안에서 명시 검사해 table-owner 자동 우회를 근거로 삼지 않는다. [PostgreSQL15 RLS](https://www.postgresql.org/docs/15/ddl-rowsecurity.html)
- 함수 작성·소유권·PUBLIC EXECUTE 회수·app의 한정 EXECUTE 부여·임시 권한 회수는 동일 forward migration transaction으로 묶는다. 실제 실행은 제외다. 함수 부재42883은 현재 storage 처리대로 EXPORT_STORAGE_FAILED/503을 유지하며 NOT_READY로 새로 매핑하지 않는다. 부재를 정상 성공으로 대체하지 않는다.
## 추가 결정의 정확한 범위
기존계획은선택원본반출과불변원문보호를승인했다. 이번delta는원래불가능한locking SELECT를해결하기위해 **새SECURITY DEFINER DB함수·NOLOGIN 소유자와 한정 권한 정의·인증 주체 전달/고정DB호출계약**을source에추가하는것이다. 일반query문자열정리나단순scope내부변경으로그중요권한경계를임의채택하지않는다. 실제권한적용은계속제외다. 새외부HTTP API/DTO·원문저장형식·UI/자동실행/복원기능변경은제안하지않는다.

A를source-only로채택하면Main이정확신규pending SQL번호/허용경로와WI를고정하고같은Primary에구현을맡긴다. 현재예상은서버source1+신규pending SQL1+순수시험1이며기존migration/권한/키파일write0이다. 실제PG경합/함수소유권/RLS/행잠금전달은NOT_RUN으로남긴다.

## 검수·보류안
먼저기존앱권한계약과잠금요구를반영하는메모리DB로원함수의정적충돌RED를구분한다. 기능검수는실sourceRow/고정함수호출·document/artifact출처/metadata음성·부재/42501실패경계보존이며DB시뮬레이션을실제PG권한/경합통과로승격하지않는다. SQL의고정검색경로·8인자/명시반환·소유자/현재주체·회원 범위·PUBLIC회수/앱EXECUTE한정·FOR SHARE는정적검토한다. 실제파일QA/키/DB/서비스/Agent시험0이다. 내부파생읽기의권한공급/테이블RLS와함수소유자정확성은독립검토하고미정이면구현전추가로한정한다.

B는이계약을아직채택하지않고현제품/잠금·미완료상태를보존하는선택이다. UPDATE추가부여·잠금제거/관측시점변경을동등보완으로꾸며통과시키는대안은권장하지않는다. 기존계획의다른승인업무는계속한다.
