# FN08 혼합 SEND polling·관측 ACK·cursor source 검수 결과

## 판정과 범위
source·RAM 합성 검증 한정 수용. 실제 SDK/Agent·DB·OS 내구성 및 전체 작업계획 완료는 아니다.
기준 main62a0e16a0c36bf9742e00d17697770a86537d939, branch codex/av3-fn08-send-polling, 지시 HEAD6d0a67c696414569f75cfbf7a6c41266425a526e. WI SHA256 3F15D614CE0F9EE3FF595A99DC0B0961BA60979C7D18D0D128C048C73093EFF9. 기존 Primary 단일 writer, Main 제품 수정0·독립 검수·통합.

## 동작과 영향
START/SEND 혼합 polling을 연결했다. 역사 원 수신·시도·RESPONSE를 먼저 검산하여 추가 자료 GET·permit·driver 없이 관측을 복구한다. 정상 미수신과 attempt 부재가 확인된 경우에만 자료 GET을 시작한다. 손상/소실/UNKNOWN은 새 실행으로 fallback하지 않는다. 원 ref·시각을 보존하고 spool의 연속 ACK가 해당 명령의 마지막 관측까지 덮은 뒤에만 cursor를 확정한다. sync 호출당 POST1회 계약과 기본 START를 유지한다. 201건 backlog에서 첫 ACK205와 최종210을 구분한다.

## 검증과 실패 이력
- 목적 RED0P1F(0ae36d)→최초 GREEN1P(82800c). 설정 객체에 wire를 넣은 조립 오류는 정확 형상 유지로 해결했다.
- 중간6P1F: append 실패 UNKNOWN lock 보존과 재시작 성공 기대의 충돌. lock 획득 전 복구 반례와 append 불명 보존을 분리했고 제품 guard를 낮추지 않았다.
- 중간73건72P1F: 재봉인 음성에서 실패 뒤 fixture를 재사용한 문제. 독립 fixture로 분리했다. 최종 PASS로 소급하지 않는다.
- 독립 spec I1: 역사 복구 전에 GET을 하여 원문 정정/격리 시 원관측 복구 차단. Main f6bae6 확인, 구 polling RED0P1F(9dedc9)→보정 GREEN1P(6fb609). 조사 중 challenge429·공통 START 원문 정정409는 별도 fixture 원인으로 기록한다.
- 최종 독립 spec/quality 각각 C0/I0/M0. 마지막 coordinator 두 TypeScript cast 역치환 SHA가 검수 지문0F70428B…9A548D와 일치한다.
- Primary 최종 영향3파일: node --experimental-strip-types --experimental-test-module-mocks --test --test-reporter=tap tests/unit/FN08/normal-instruction-intake.test.ts tests/unit/FN08/normal-instruction-coordinator.test.ts tests/unit/FN08/normal-instruction-polling-journey.test.ts →57P/0F/0SKIP exit0 35007.7733ms(9649e9).
- 변경 없는 spool6P/polling8P/START여정5P는 앞선 실행 증거 재사용, 중복 합산하지 않는다.
- Main 최종 단독 normal-instruction-polling-journey.test.ts →12P/0F/0SKIP exit0 22238.9941ms(21d2cc→700df3, session39912 종료).
- 직전 Main 시험 출력은 유실돼 판정에 사용하지 않았다. CIM 제한 오류(41a4b3) 후 읽기 전용 권한 확인으로 해당 시험 프로세스0(879aa0)을 확인하고 최종 단독 시험을 다시 확보했다. 임의 프로세스 종료0.
- npm run typecheck exit0(4c1383), 제품4 각각 fresh-process import0·diffcheck0(7aa318), Primary live0·10경로 쓰기 반환.

## 제외·후속·복구
실제 DB·권한·키·파일 내구성·서비스·SDK/Agent 실행0. RAM ACK/driver는 실제 업무 완료 근거가 아니다. 전체 44업무 완료 체크는 변경하지 않는다. 복구는 이 source 단위 정상 revert이며 실제 DB rollback은 없다. 다음 STOP 계약은 별도 직접 채택 후 별도 업무로 구현한다.

## 최종 작업 사본 SHA256
- `apps/connector/runtime/normal-instruction-intake.ts`: `3EA92932C0B24CCC211FB6B4BF892508BA40147A75978C7D0BA79354DAEB9D4D`
- `apps/connector/runtime/normal-instruction-coordinator.ts`: `465615509F0474479F047A77B436C76732CAB36F52F63B7336C30F1403FA235E`
- `apps/connector/runtime/normal-observation-spool.ts`: `4A98C98F49ADB1E4F0B486875B6050DD0257213143B7BF2ECB7E691157B05CE8`
- `apps/connector/runtime/normal-start-polling.ts`: `1786428B60BCA612CB32248E027DD23A791404A2A7CECB40E5CEF576316FBAF5`
- `tests/unit/FN08/normal-instruction-intake.test.ts`: `57E5694AE11B5A521329D8A84D15E5DE34B8D9B743AD40C3020DB07F6E949164`
- `tests/unit/FN08/normal-instruction-coordinator.test.ts`: `738386E529B87EA3CB5959D957B9D473D9D7B2332FCD07D3EDA0116DA702B9B7`
- `tests/unit/FN08/normal-observation-spool.test.ts`: `AF281AD09250ED386C78EB166FB50AD98C06E37F8CE599C7C17048CDE64AD3BA`
- `tests/unit/FN08/normal-start-polling.test.ts`: `59FB971B55EE6672D70FF7E7FB600720EF35ECA13B0F75D49A6CEF5E0C913526`
- `tests/unit/FN08/normal-instruction-polling-journey.test.ts`: `6A5DC20857D55B83CDD54C55BAA148654600767387C240C92217EB585E3DC082`
- `tests/unit/FN08/normal-instruction-dispatch-fixture.ts`: `10925E062AB740DDCF6E555F126B1806C698E6E659FABC4A8F50F60A0098A1F6`
