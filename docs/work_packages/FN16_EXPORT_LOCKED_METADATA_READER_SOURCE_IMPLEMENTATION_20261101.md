# FN16 잠금 metadata 보호 조회 r2 A source 구현 작업지시서

2026-11-01 신산님이 FN06 A와 FN16 r2 A의 코드·화면·미적용 SQL·합성 검증을 직접 승인했다. 실제 DB·권한·키·서비스·Agent 실행은 제외한다. 승인 후보 docs/contracts/FN16_EXPORT_LOCKED_METADATA_READER_CANDIDATE_20261101.md SHA256 2B351AA71037E43474CF767962821578B1F5DF49600E832AA17AF3D26BD59881의 r2 A만 따른다. 기존 Primary가 FN06 동결 뒤 순차 구현하며 Main 제품write0/Reviewer 읽기다. 이 문서의 작성은 FN06와 동시 writer GO가 아니다.

## 허용3
1. apps/server/modules/backups/project-backups.ts — 시작 SHA256 E1BE0569FE6925CE6B88965C0AF98FBD88FF72CCF45CBFDE8F54121497824A4B
2. db/migrations/0066_export_locked_metadata_reader.sql.pending — 신규,0065 FN06 뒤 예약
3. tests/unit/FN16/project-export-locked-metadata.test.ts — 신규
기존 SQL/role/계정·UI·실파일 QA·Agent/서비스·보호 untracked3은 수정/실행하지 않는다. 0066 자동 적용 등록도 하지 않는다. commit/문서는 Main이 소유한다.

## 구현
기존 sourceRow의 FOR SHARE는 앱 UPDATE 회수와 정적 충돌한다. 단순 잠금 제거·app UPDATE 부여·잠금 없는 fallback은 금지한다. 기존 sourceRow를 실제 AuthenticatedIdentity를 받도록 연결하고 create/job/file의 같은 actor를 전달한다. 실제 필드는 authSession?.id, actorId, clientId이며 authSession 부재를 payload/GUC/임의 UUID로 채우지 않는다. 현재 인증 문맥 부재는 기존 인증 거절로 닫는다.

고정 함수 anvil.fn16_export_artifact_metadata_locked의 인자는 project UUID,artifact UUID,hash text,bytes bigint,mediaType text,session UUID,actor UUID,client UUID 순8개다. source의 문서 fullref/hash·첨부 귀속 검사 뒤 같은 db에서 호출하며 metadata8열(id,project_id,content_hash,bytes,media_type,storage_key,state,inspection_json)과 같은 transaction FOR SHARE를 유지한다. 격리행을 SQL에서 숨겨 통과시키지 않는다. storagekey/후속 READY·inspection·실bytes 검사와 create/read/list/file 의미를 보존한다.

0066에 승인된 NOLOGIN/NOINHERIT·비-superuser·NOBYPASSRLS 소유자 anvil_v3_fn16_export_reader_owner와 고정 SECURITY DEFINER/VOLATILE/PARALLEL UNSAFE/search_path=pg_catalog,pg_temp를 정의한다. 기존 같은 이름 role을 자동 수정·인수하지 않는다. app 역할 멤버십0, 필요한 metadata SELECT/잠금용 UPDATE(id)·프로젝트/회원 검사열 SELECT·fn01_active EXECUTE만 한정하고 PUBLIC 실행을 회수한다. 함수 작성/소유권/app EXECUTE·임시 CREATE/멤버십 회수·후검산은 같은 migration transaction으로 보존한다. RLS를 끄거나 우회하지 않으며 새 artifacts RLS정책을 만들어 성공시키지 않는다.

함수 내부 session_user=anvil_v3_app·fn01_active(session,actor,client)·프로젝트 존재/현재 비회수 회원 검사를 한다. 역사 GET을 OWNER/미보관 전용으로 축소하지 않는다. fresh create의 기존 OWNER/control/policy/별도 승인 검사를 그대로 두며 sourceRow→copy→persistProjectReceipt 순서상 아직 없는 APPLIED command/GUC를 선행 요구하지 않는다. 42883은 현재 EXPORT_STORAGE_FAILED/503,42501은 현재 storage 분류를 유지하고 성공/NOT_READY로 새로 위장하지 않는다.

## 검증
실 sourceRow와 app 권한 계약을 반영한 메모리 DB로 원충돌 RED를 먼저 확인한다. 신규 순수 시험에서 고정 함수8인자·정상 주체/역사 회원·신원부재/비활성/교차 프로젝트/5조건 mismatch·문서 hash/첨부/storagekey·격리/inspection·42883/42501을 검산한다. 새 SQL 파일 읽기/정적 구조 검산만 허용하며 실제 PG·DDL/GRANT·원본 FS·Secret·actual target copy는 실행하지 않는다. 기존 FS 포함 project-backups.test.ts 전체 실행0. 메모리 모델/SQL 정적 검사를 실제 권한·RLS·잠금 경합 PASS로 보고하지 않는다.

기존 source/backend 오류 경계·원문/Secret 비노출과 head/참조 불변을 보존한다. 실제 payload 검사와 readonly-source 행 검사만으로 전체 backup/job/복원·coverage·프로젝트 차단 해제를 완료라고 하지 않는다. 정확 pure 명령/exit/type/diff·변경사유/diff·최종3지문·오류·미검증/QA/live0과 writer 반환을 보고하고 Main fresh/독립 검수로 통합한다.
