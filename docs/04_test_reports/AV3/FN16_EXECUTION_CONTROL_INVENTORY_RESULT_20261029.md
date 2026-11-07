# FN16 실행 명령·복구 허가·회수 이력 수집 결과

2026-10-29 / codex/av3-stage-b / 첫 내부수집 단위 검수 결과

## 판정과 범위

WI `FN16_EXECUTION_CONTROL_INVENTORY_SOURCE_IMPLEMENTATION_20261029.md` SHA74F5073879723928BDF79EF7C79FBB7968791F609BB2A78D0718504D46FE7864. 시작 HEAD17ddf0b5b3243365610b6a4d5b1acd2cfdd44da8. 기존 fn16_primary 단독 구현, Main 관리·검증·통합, fn16_review 읽기 독립검수. 보호 untracked8 보존.

실행·중단·회수 자료군을 ①이번 실행명령/복구허가/회수/outbox/공유초기graph ②단계queue/정책·전체예약 ③worker관측/ACK/permit로 분할했다. 첫 단위만 신규 source1/test2로 구현했다. 전체 FN16·해당 전체 이력·백업/복원 완료가 아니다.

- apps/server/modules/backups/execution-control-inventory.ts: B281D33B40679A87E1822885FA2CDBA3A3F496C2EC663A6A3C96E5B9FE87D675
- tests/unit/FN16/execution-control-inventory.test.ts: F341CE051EF8727E54D23A6EEA8131DF066B59514856B2322FAD64D1393CFC77
- tests/unit/FN16/execution-control-inventory-schema.test.ts: C4D1841D53C0DFB36AA83AF36A4D6B217EE5BD28BF40F849313D77BBAE4B805B

원 intent/봉투별 hash·공유초기6표·정확원명령/영수증·국소auth/audit와 복구/회수 참조를 검증한 뒤 비밀 없는 metadata를 반환한다. credential/challenge/proof는 조회하지 않으며 raw grant/봉투·개인식별·source 경로는 반환하지 않는다. 회수 기록을 종료·실효회수·writer 해제로 승격하지 않는다.

## 검증·오류·보완

- Primary201eb5: schema1PASS/미구현12FAIL/skip0/527.1898ms RED. 후단 모든 반례를 개별 재현한 결과는 아니다.
- 최초 제품 지역 external 중복선언 SyntaxError1회는 변수명만 교정. 초기 da1107 13PASS/type0.
- 정상 pagination fixture가 동일project 초기graph201개로 실제writer단일/초기예약 제약을 위반했다. 단일START+SEND100+STOP100으로 바꾸고 각각quota100·크기2MiB 이내와writer1을 확인했다. 초기 fixture를 실제DB 증거로 세지 않는다.
- 독립 I3: SEND의 당시 예산 정책을 최초grant로 잘못 고정, 같은명령의 미참조 EXECUTIONgrant 누락, 회수요청자/명령actor 결박 누락. ad53d5 3RED→7a75e5 3GREEN.
- 추가 SQL 국소관계: RECOVERY 원등록/책임세션, STOP 원fact 예약/등록/세션/문맥, 회수 recordedAt 기준grantState. Main7f6d74 실제0020/21/22 대조, a445c7 RED→edb8cf GREEN. 회수정상fixture는당시만료전 ACTIVE로교정. RECOVERY originalGrantState에는 계산을 확대하지 않았다.
- RED 그룹은 최초 실패지점만 관측했고 뒤 SESSION 등은 최종 GREEN에서 각각 pure parser 통과 후 거절을 확인했다. 시험 기대·기존 SQL/source 완화0.
- **Main9769e7:** `node --test --test-reporter=tap tests/unit/FN16/execution-control-inventory.test.ts tests/unit/FN16/execution-control-inventory-schema.test.ts` → **19PASS/0FAIL/0SKIP/2954.7949ms exit0**. `npm run typecheck` exit0, 최종3지문 일치. Main49f1ee/c75ce6/2699ff/26b4d0 source·보완반례 읽기 대조.

## 미검증·후속·rollback

실제 키·DB·서비스·Agent·원문FS/RLS/guard 적용은 변경0·NOT_RUN. 실제 실행허가/전달/종료/회수·writer해제·복원 가능성은 false/미검증. 단계queue/정책·usage전체전이 및worker관측/ACK/permit는 미수집이다. 현재권한·외부참조 검증은 NOT_PERFORMED. 원본 해시 일치가 해당 증거를 대신하지 않는다.

rollback은 신규3파일의 해당 개발branch 변경만 후속 정상commit으로 되돌린다. 지속데이터 변경이 없어 데이터 rollback은 없다. 보호자료/P03 원·R1·R2 자원은 대상 밖이다. WORK_STATUS/WORK_PLAN 누적 기록, 결과7경로만 checkpoint한다. 두 번째 단계queue/정책 및실제지원v1예약 이력 WI를 준비하며 후속usage 저장생산자 부재를 미완료로 구분한다.

- 최종 동결3지문 독립 한정 재검수 C0/I0/M0. 기존I3 및추가SQL3관계 모두해소,원hash/receipt재결박확인. 실제자원/시험재실행0.
