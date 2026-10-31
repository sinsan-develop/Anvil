# FN16 전체 백업의 동일 기준 수집 — 계약 후보

2026-10-31 / Main 어울 / NOT_ADOPTED / source 구현·DB 실행 GO 아님.
상위 범위: FN16_FULL_BACKUP_VERIFICATION_SCOPE_DECISION_20261031.md A2.
연계 A1: FN16_FULL_BACKUP_DATA_MAPPING_CANDIDATE_20261031.md(작성 중; 확정 근거로 사용하지 않음).

## 1. 실제 코드와 바꿔야 할 지점
현재 project-inventory-composition.ts는 자식 관측마다 READ COMMITTED 인증 transaction을 사용하고, 결과에 START_AND_END_READ_COMMITTED/atomic=false를 명시한다.
참조 충돌·의존성 계산과 artifact byte/current 검산은 재사용한다. 이 관측 묶음을 하나의 DB snapshot이라고 표시하지 않는다.
AccessRepository.authenticateInTransaction은 현재 session lock/DB 시각·CSRF 검산과 인증 신원 반환만 제공한다. 프로젝트/정책/실행권한을 대신하지 않는다.
본 후보는 기존 collector 공개 동작을 바꾸지 않는 별도 전체백업 수집 경계를 제안한다. 기존 RC 관측과 정책 r2의412를 보존한다.

## 2. 한 번의 수집 시도와 입력
하나의 시도는 정확 projectId·수동 job/attempt ref·정책 ref/hash·include7/sourceSelection NONE·네 보호 참조·자료 registry/schema 버전·유한 한도와 최단 기한에 고정한다.
job/attempt 저장 형식은 A5에서 함께 채택한다. 본 문서만으로 임의 ID/허가를 발급하지 않는다.
snapshot 결과는 데이터 관측이며 현재 실행/복원/권한을 발급하지 않는다.
인증자료/계정/token/구독비밀/실키 바이트는 수집 DTO나 snapshot 식별 정보에 포함하지 않는다. 비밀 없는 참조/제외 이유/재연결 metadata만 남긴다.

## 3. 권장 수집 경계
1. 현재 READ COMMITTED 경계에서 로그인·OWNER·제어 세대·명시 정책·일회 명령/기한·보호 참조·예산/저장량 예약 상태를 확인한다. 이 시점의 정확 신원/세션세대와 허용 범위를 서버 내부에 고정한다.
2. 별도 하나의 PoolClient에서 REPEATABLE READ 수집 transaction을 시작하고 실제 isolation을 검산한다. RLS actor/project는 검증된 내부 신원에서만 설정한다. 사용자 제공 GUC를 권위로 쓰지 않는다.
3. 모든 해당 collector는 같은 client·snapshot을 읽는 내부 접점으로 실행한다. 내부 접점은 connect/BEGIN/COMMIT·독자 인증·별도 SQL 연결을 하지 않는다. 현재 공개 wrapper는 보존한다.
4. A1의 포함 목록·허용열·자료 관계를 같은 snapshot에서 직렬/유한 페이지로 수집한다. 공개 summary digest만 보관하지 않고 검증·복원에 필요한 불변 원문 DTO를 함께 고정한다. 참조 충돌/누락을 기존 알고리즘으로 대조하고 원 issue/gap을 보존한다.
5. artifact는 snapshot에 고정된 ref/bytes/hash와 연결한다. 실제 보호 reader는 READY/격리/현재 등록·대화원문 관계·바이트/hash/기한을 검산한다. 같은 파일이 여러 자료군에 연결되면 바이트 원본은 한 번 보관하고 각 참조는 남긴다.
6. DB snapshot 완료와 파일 관측을 별도 증거로 기록한다. 파일 저장소는 DB snapshot에 포함되지 않는다. 파일 변화·격리·회수/불명·필수 외부 참조 누락이면 성공/전체 가능 상태를 만들지 않는다.
7. 수집 종료 전후의 현재 로그인/OWNER·제어/정책/보호참조/예약과 artifact 현재성은 별도 최신 READ COMMITTED 경계에서 재검산한다. 오래된 RR snapshot의 인증 상태로 현재 허가를 주장하지 않는다. 현재 검사에 실패하면 공개하지 않고 실패/불명 시도 이력을 보존한다.
8. 암호화된 staging 결과 검사 후 publish 직전에도 A5의 현재 허가·기한·정확 job/attempt fence·ref·원명령/예약을 다시 대조한다. publish와 DB 완료 COMMIT은 원자적이라고 주장하지 않는다.

RR snapshot은 데이터 일관성 수단이다. 모든 자료의 의미 적합·파일 안정성·복원 성공을 한꺼번에 증명하지 않는다.
인증 lock을 파일 수집 전 과정에 붙잡는 설계는 채택하지 않는다. 구체 세션/RLS snapshot 접점과 기존 auth 계약 영향은 구현 WI 전에 별도 검토한다.
동시에 최대 한 writer/외부 실행이라는 기존 정책을 이 수집 계약이 늘리지 않는다.

## 4. 시간·자원과 실패
- 전체 시도의 단조 기한, 현재 DB clock/세션 idle·absolute·허가/profile/예약의 최단 기한을 모두 적용한다. await/lock 뒤 남은 시간을 다시 확인하며 timeout을 연장하지 않는다.
- statement/lock/idle transaction timeout을 남은 기한 이하로 설정·검산한다. 취소/timeout 뒤 같은 시도를 자동 재시작하거나 다른 snapshot을 이어붙이지 않는다.
- 자료/원문/metadata/출력/staging/파일수/실패본의 실제 사용을 각각 계산하고 기존 한도·profile·예약의 최솟값으로 차감한다. 동일 실제 바이트와 반복 읽기 비용의 계산 기준을 구분한다.
- client 회수·ROLLBACK·reader handle 닫기 실패는 UNKNOWN_RESOURCE_STATE로 보존한다. 정리 성공/원본 삭제·안전 종료라고 거짓 보고하지 않는다.
- 늦게 도착한 pool 연결/reader 결과는 원시도·현재 fence·기한을 재검산하고 성공 결과에 채택하지 않는다. 소유권이 확인되지 않은 자원은 강제 종료/삭제하지 않는다.

## 5. publish/COMMIT 불명 창
정확 상태 이름·저장 원자성은 A5에서 채택한다. 아래 사실 구분은 필수다.
- staging만 존재/미검사: 완성 백업이 아니다.
- 암호화/검사 완료·미게시: 아직 사용자 완료 파일이 아니다.
- 파일 publish 성공·완료 COMMIT 불명: 성공을 재전송하거나 같은 파일을 다시 만들지 않는다. 원 job/attempt·객체 ID·cipher/manifest hash·DB 원명령/영수증을 재대조하는 조정 상태로 둔다.
- 완료 기록 존재·파일 지문/원문 불명: 다운로드/복원 가능으로 표시하지 않는다.
- 실패본/옛 사본/참조된 자료는 자동 삭제하지 않는다. 명시된 보존/정리 계약과 정확 소유권 검증 전에는 유지한다.
기존 실제 사용자 데이터/원문을 덮거나 실행 권한을 복원·재개하지 않는다.

## 6. 필수 검수와 미검증
source/합성 검수는 같은 client 사용, 다른 snapshot 혼입 거절, 독립 connect/COMMIT 금지, 정확 registry/원문/참조 보존, cross-project/수집 중 revocation·시간/용량·artifact 변화, pool/rollback/reader 불명, publish/COMMIT 각각 응답 유실 반례를 포함한다.
실제 PG isolation/RLS/lock·COMMIT·실제 파일/키·서비스/실복원은 합성 시험으로 대신하지 않는다.
A1 registry·A3 묶음 형식·A4 복원 형식·A5 상태/저장 계약이 채택되기 전에는 이 문서만으로 전체수집 provider나 profile을 활성화하지 않는다.
새 실제 DB/권한/키/파일 조사/서비스·Agent 실행·프로젝트 차단 해제는 이번 범위에서 제외다.
