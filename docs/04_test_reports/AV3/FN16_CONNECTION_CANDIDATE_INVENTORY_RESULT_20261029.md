# FN16 연결·환경 후보 이력 내부 수집 결과 — 2026-10-29

## 판정·기준
신규 내부 metadata 수집기를 Main16합성PASS/type·diff0, 독립최종C0/I0로 검수했다. 실제 연결·Agent 실행·전체 백업 완료가 아니다. 기준 codex/av3-stage-b, 최초 조사7b2498e5에서 Main의 문서4 checkpoint f242ec09b56d63cf7a5616fff3b2cb3fb7dfead3를 순차 인수했다. 중간 제품 source 변경은 없었다.
최종 WI docs/work_packages/FN16_CONNECTION_CANDIDATE_INVENTORY_IMPLEMENTATION_20261029.md SHA2566506EC730F98912B22D5DA2B72748566A14C61258CD0FE13448BE60D6DA3D9AE. 초기7140A3E0/AF9B1632/258B3E5B는 사전검수 보완 이력이다. Main 관리·검수·통합/기존 Primary 단독구현/Reviewer 읽기.

## 구현과 한계
프로젝트 회원 조회가 허용된 connection_candidates/versions 2표와 선택commands/receipts/audit의 정확63열을 수집한다. 단일 RO RR 자료 관측과 시작/최종 RC 인증·OWNER/신원·기한을 구분한다. head/연속버전/이전ref/원snapshot hash·실제 두 operation/result/명령 주체/정책/일반 digest를 결박한다. 과거 만료·다른 creator/client 버전을 현재 정책으로 제거하지 않는다.
DB expiry는 원input.expiresAt와 정확 비교하고 1micro 차이도 거절한다. PG DB offset/마이크로초와 원 프로토콜 strict ISO를 분리한다. 승인 null/nonnull 두 경우를 실제 producer대로 보존한다. 자유문자열·URL·사람ID는 해시·익명화하고 원ref와 projectionHash를 분리한다. 후보는 NOT_READY이며 실제 등록/설치자원/소스root 권한이 아니다.

원request 전체 재구성·approval scope/소비원장 검산·현재 정책·재인증·신뢰/능력실측은 NOT_PERFORMED. sourceSnapshot NOT_EXPORTED·현재권한복원/실행/dispatch/전체성/restorable/atomic false다. 기존 CONNECTION_REGISTRATION_SOURCE_ROOT_SETTINGS 전체 미수집과 22조합은 그대로이며 이번 신규 수집기를 조합/공개 API에 연결하지 않았다.

## 검수·오류와 실제 명령
사전검수에서 expiry 정확일치/정책 결박 및 정상 일회승인 보존을 명시했다. Primary f79ff0 신규 부재RED0P12F→1895d1 15PASS. Main84528e 15PASS는 보완 전 증거다.
제품 I1 1건: 원request 전체 미저장과 snapshot.input의 원payload 보존을 혼동해 승인 payloadHash 검산을 누락했다. Main0b51c0/독립확인 후 WI를 정정했고, 동일 Primary 200e87에서 정상fixture H(input) 검산 뒤 payloadHash만 다른 유효hash로 변경한 RED0P1F를 확인했다. source 비교 조건 추가 후 c42973 16PASS/type·diff0, writer해제.
Main6ef39c 정확 명령: node --test tests/unit/FN16/connection-candidate-inventory.test.ts tests/unit/FN16/connection-candidate-inventory-schema.test.ts →16PASS/0FAIL/0SKIP/736.8498ms/exit0. npm run typecheck 및 git diff --check exit0,최종3지문 일치. 독립최종C0/I0는 원인 보완·비마스킹 반례와 기존 경계 보존을 읽기 확인한 것이며 실제 실행과 구분한다.
201행 keyset·원hash/이전ref/head·주체·승인null/nonnull·DBexpiry/inputpolicy·PII/비밀·누적한도/최종 현재성·신원/취소/기한/회수503을 합성 확인했다. 기존 collector/helper/producer/parser/SQL·실제DB키서비스/파일IO/Agent·Git개발자쓰기0, 완료 수집기 전수 반복0.

## 지문·미검증·복구
- source3560579EE9A3C0CB08C760E1836D777E48CC87991E7EA3346E34965C54BC4B6B
- 행동7F6D0F8CD6D4CCDCF40AED8C47352B335DC5042B465A3A9FD76DA1D78F29AAD1
- schema3E80A1CEAE78AC89B458D6CB9ABA53E76B897C3480E9E0A23E04BF79A8B54E95
실제 PG/RLS·동시실행·물리원문/키/서비스·원형복원/archive/UI는 NOT_RUN이다. 기존 producer의 clock_timestamp와 created_at transaction timestamp 차이로 documentation.observedAt 경계가 기존 read에서 거절될 수 있는 한계는 수정/우회하지 않았다.
Main만 신규3+WI/본결과/WORK_STATUS/WORK_PLAN 정확7경로 checkpoint, 보호8 보존. rollback은 신규3의 검토된 revert/비활성이고 자료·권한·키 삭제0이다. 공유요청 원형/최소봉투의 RO·무결성 미충족, 정책158E10BC 미채택, 전체 FN16/WORK_PLAN 미완료를 유지한다.
