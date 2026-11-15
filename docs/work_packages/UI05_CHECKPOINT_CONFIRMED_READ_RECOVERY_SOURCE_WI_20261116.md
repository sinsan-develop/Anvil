# UI05/FN13 체크포인트 저장 확정 이후 원문 조회 복구

## 기준·이유

기준 main f34786666976a67d8fad3a293f236f06bc0969fb, 작업 branch codex/av3-ui05-checkpoint-read-recovery. 기존 FN13 r2 A 직접 승인과 FN13_SERVER_CHECKPOINT_STORAGE_DECISION_PACKET_20261031.md §3~4에 따른 누락 보완이다. 신규 API·저장 형상·권한·설계 변경은 없다.

현재 CheckpointEditor의 save는 검산된 APPLIED/CHECKPOINT_RECORDED 영수증을 받은 뒤 고정 GET 실패까지 저장 실패 catch로 처리한다. 이때 확정된 fullref를 잃고 원 저장 명령을 결과불명으로 복원한다. 변경 후 저장 확정과 원문 조회 결과를 분리하고, 확정 ref로 명시 GET만 재조회한다. POST 응답 자체의 유실은 기존 동일 원명령 재확인으로 유지한다.

## 단일 writer와 허용 경로

기존 developer_primary만 아래 두 파일을 수정한다. Main은 이 문서·상황·검수·통합을 맡으며 같은 파일 쓰기는 하지 않는다. 다른 변경을 되돌리지 않는다.

- apps/web/src/features/session-detail/CheckpointEditor.tsx
- tests/unit/UI05/session-detail-read-context.test.ts

기존 서버/API/SQL/형상과 저장 fullref·영수증 검산을 그대로 사용한다. 새 export·공통화·리팩터는 필요하지 않다. 저장 성공 후 pending=null/uncertain=false/storedRef=검산fullref를 보존하고 조회 실패만 표시한다. 재진입해도 자동 POST/GET 없이 명시 GET으로 복구한다. 원 주체/client/transport/epoch/명령 결박 및 늦은 응답 폐기를 유지한다. 기준 선택(baseRef), 권위·완료·안전 재개 상태를 자동 변경하지 않는다. 실제 현재 공급자 연결과 모순되는 두 안내문은 현재 응답 기반의 중립 설명으로 고친다. 실제 저장 가능/전역 quota 검증을 허위 보장하지 않는다.

## 검증·제외·rollback

원 ReactDOM RAM 환경으로 수정 전 RED를 확인한 뒤 실제 컴포넌트를 통해 다음을 검증한다.

1. 저장 POST1 → 유효 영수증 → GET503 뒤 fullref/pendingnull/uncertainfalse 보존. 화면 왕복 뒤 자동요청0 → 명시 같은 fullref GET200 → 검산 원문 표시, POST 총1.
2. 지연 GET의 주체/client/화면 교체 뒤 늦은 성공·인증 오류가 새 상태/다른 buffer/인증 이탈에 반영되지 않음.
3. POST 응답 유실은 기존 pending 원 body/id/hash 유지, 자동 재전송0, 명시 같은 원명령 재확인만 허용.

직접 RAM 시험과 필수 인접 checkpoint-api 회귀, typecheck/build/diff를 한 번 수행하고 정확 totals·오류·미검증·최종지문을 반환한다. 기존 단언과 기대값을 낮추지 않는다. 필요 경로가 늘면 쓰기 전에 Main에 근거를 반환한다.

실제 DB·권한·키·서비스·Agent·실자료·SDK 조회·P03 자원 조작·복제·정리는 모두 제외한다. RAM DOM은 실제 브라우저/served/DB 인수 증거가 아니다. rollback은 두 파일의 한정 diff 역적용이며 사용자 기록·보존 자원 변경을 포함하지 않는다.
