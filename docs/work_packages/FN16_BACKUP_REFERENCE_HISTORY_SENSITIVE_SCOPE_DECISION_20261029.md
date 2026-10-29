# FN16 보호참조 이력의 민감자료 접근 경계 결정안 — 2026-10-29

상태: CANDIDATE / NOT_ADOPTED. 기준 codex/av3-stage-b 6fb6f482be8c03d9b8bdee86dc63f1f71e2b1f2a. 이번 문서는 결정 요청이며 제품 코드·기존 GET/권한 변경·실제 실행 승인이 아니다.

## 확인된 계약과 실제 차이
승인 CA7774의 FN16_PROTECTED_REFERENCE_REGISTRATION_CONTRACT_R2.md §2는 현재 로그인·활성 OWNER와 민감자료 접근 검사를 요구한다. Main/Primary c1edc4·469f43·345cb8·7c007c 및 독립 읽기 대조 결과, BackupReferenceStore.#owner는 현재 actor/client RLS변수·활성 OWNER·세션기한을 검사하고 0053 SELECT RLS도 OWNER다. 작성자/client 한정은 조회 조건이 아니다. 별도 민감자료 권한/정책/검사 함수가 무엇인지 정의된 근거는 확인하지 못했다. 이를 OWNER가 자동 충족한다고 단정하거나 명목 검사 함수를 만들어서는 안 된다.

반면 #view는 원snapshot·이전ref·원명령/승인·회수event 무결성을 검사한 뒤 공급자 미연결을 eligible:false로 분리하면서 이력 정보를 반환한다. 따라서 현재 불가면 상세를 숨기는 FN05 공유요청과 같은 방식으로 취급하지 않는다. 실제 설치 Resource/키 현재성은 catalog/파일 검사를 요구하므로 metadata 수집의 검산으로 대체할 수 없다.

## 권장 A: 비민감 역사 metadata 한정 허용
현재 활성 OWNER·세션의 기존 접근 범위 안에서 보호참조3표 head/version/event 이력과 선택 명령·승인 증빙을 내부 source-only 수집 대상으로 한정한다. 자유 displayName/reason/check 문자열·사람/client 식별자는 해시·익명화한다. 원 hash와 투영 hash를 구분하며 원 경로·설치 handle·키·실제 descriptor·Secret는 수집/반환/로그하지 않는다. 알려진 비밀 표식은 고정 오류로 거절한다. 현재 key/resource/profile 가용성·별도 민감자료 권한 확인은 NOT_PERFORMED이며 사용자 자료 조회 권한이나 실제 백업 실행 허가로 사용하지 않는다.

정확 구분: 여기서 허용할 것은 위 익명화된 metadata 수집뿐이다. 기존 R2의 원형/민감자료 조회 요구가 OWNER만으로 완료됐다고 확정하지 않고 그 미정 조건을 남긴다. 기존 GET·0053/RLS·권한 정책을 변경하거나 접근 제한을 약화하지 않는다. 전체 EXPORT_BACKUP_PROTECTED_REFERENCE_HISTORY 미수집 항목은 삭제하지 않는다.

## 대안 B
익명 metadata도 별도 민감조회 정책이 먼저 필요하다고 정한다. 이 경우 해당 단위는 미구현으로 남기고 정책 정의·명시 부여·거절/회수 경계를 별도 구체화한다. 이름 없는 권한을 자동 생성/부여하지 않는다.

## A의 구현·검수 한계
R2 역사 무결성을 유지하려면 보호참조3표31열, 선택 commands/receipts/audit46열, 승인 nonnull의 요청/결정/소비39열, 총9표116열이 필요하다. 원명령을 재구성할 수 있는 부분은 실제 snapshot/payload/승인ref로 검산하고 원 hash·이전 버전·회수 대상·과거 주체를 보존한다. 기존 조회가 검사하는 승인 결박을 생략하지 않는다. 상세 열·순서·허용3코드와 보안 반례를 WI에서 고정하고 독립 검토 후 기존 단일 Primary TDD/Main 검수·통합으로 수행한다.

이 결정은 내부 계약·source·합성 시험에만 적용한다. 공개 API/기존 조회 동작·schema/SQL 적용·현재 정책/권한·실제 키·DB·서비스·파일IO·catalog/대상/원문 조회·Agent 실행·공유·반출/복원 실행은 제외한다. 설치자원/0054·intent/lease/envelope·실제 export 파일은 별도 미수집이다. 현재 공급자 검사 부재를 정상·READY로 보고하지 않는다. rollback은 신규 source 비활성/검토된 revert이며 기존 자료·권한·키는 보존한다.

## 현재 상태
제품 source·시험·Git 명령 실행 없이 읽기 조사했고 이 결정안과 작업현황만 작성했다. 기존23조합·R2 GET·0053·158E10BC 미채택·공유요청 B의 권위 미충족과 전체계획 미완료는 유지한다. PMO에 A/B 해석을 요청하며 재승인 대기로 기존 완료 작업을 다시 실행하지 않는다.
