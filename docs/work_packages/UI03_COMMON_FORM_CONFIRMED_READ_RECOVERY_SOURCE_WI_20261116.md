# UI03/FN03 공통 양식 저장 확정 후 원문 조회 복구

기준 main95ff90397c1b625cfbb32f1340028e16fd368f38, branch codex/av3-ui03-form-read-recovery. 기존 공통 양식 초안 저장·고정 버전 조회 계약의 내부 화면 상태 보완이다. 새 공개 API·데이터 계약·DB·권한 변경은 없다.

## 확인된 누락

CommonFormEditor.submit은 writeCommonFormDraft의 검산된 APPLIED/DRAFT 영수증에서 받은 서버 발급 fullref를 지역변수에만 둔다. 후속 getForm 실패 시 원명령은 보존되지만 발급 참조를 잃고, 같은 양식 명령 결과 확인은 POST를 다시 호출한다. 신규 양식은 targetId=null이어서 발급 ID를 원명령에서 복원할 수도 없다.

## 단일 writer와 정확 경로

기존 developer_primary만 아래 세 파일을 소유한다. Main은 문서·검수·Git 통합을 맡는다. 다른 작성자의 변경을 되돌리지 않는다.

- apps/web/src/features/methodologies/CommonFormEditor.tsx
- apps/web/src/features/methodologies/form-editor-state.ts
- tests/unit/UI03/project-methodology-review-read.test.ts

FormBuffer.pending에 검산된 결과 fullref를 보존할 명시적 optional 필드를 추가할 수 있다. 이는 현재 사용자 화면 버퍼이며 서버 권위·저장 계약이 아니다. 임의 cast/숨은 반영속성·모듈 전역 map을 사용하지 않는다. 새 양식/기존 초안/복사 양식의 기존 submit·receipt 검산은 유지한다. 검산 영수증을 얻은 후에는 원 request와 fullref를 같은 pending에 결박해 보존하고 명시 GET만 수행한다. POST 응답 자체가 유실된 경우에는 원 body/ID/hash의 동일 명령 재확인 경로를 보존한다.

원문 GET과 fullref 대조가 성공한 뒤에만 기존 formBuffer/onSaved/목록 반영을 수행한다. 저장 확정과 원문 조회 미확인을 화면에서 구분한다. dirty 입력·원명령·검토·선택 원본·주체/client/transport·copyCurrent·현재성/만료/권한 검산을 유지하고 늦은 응답·다른 fullref 원문을 채택하지 않는다. 자동 POST/GET·자동 확정/적용은 하지 않는다. 다른 방법론·내용검토 패널은 이번 범위 밖이다.

## 검증

실제 CommonFormEditor를 기존 ReactDOM RAM 환경에 마운트해 수정 전 RED를 만든다. 유효 저장영수증→GET503→버퍼 fullref 보존→화면 왕복 자동요청0→같은 fullref의 명시GET200·POST총1·원문반영을 확인한다. 같은id/version의 다른hash는 거절한다. 늦은 성공/401의 주체교체·클라이언트/화면종료 폐기, 원POST유실→동일원명령재확인을 구분한다. 기존 시험 단언은 낮추지 않는다.

직접 시험과 필수 인접 공통양식 API/버퍼 회귀, typecheck·원웹config 메모리빌드·diff를 검증한다. 추가 경로가 필요하면 쓰기 전에 Main에 반환한다. 실제 DB·권한·키·서비스·Agent·SDK조회·실자료·P03조작은 제외한다. RAM DOM은 실제 브라우저/서버/DB 인수가 아니다. rollback은 세 파일의 한정 diff 역적용이며 기존 사용자 자료를 변경하지 않는다.
