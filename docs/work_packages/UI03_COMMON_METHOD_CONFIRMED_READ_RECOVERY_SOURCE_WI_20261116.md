# UI03/FN02 공통 방법론 저장 확정 뒤 고정 조회 복구

기준 main bda73f035ded566d850e0caa5160804e428c33b7, branch codex/av3-ui03-method-read-recovery. 기존 공통 방법론 saveMethodologyDraft/copyMethodology 및 고정 버전 GET 계약의 내부 화면 누락 보완이다. 새 공개 API·DB·권한·저장 계약은 없다.

## 문제·변경

CommonMethodEditor.submit은 writeCommonMethod가 검산한 APPLIED/DRAFT fullref를 지역변수에만 보관한다. 후속 GET 실패 시 발급ID/hash가 사라지고 재확인 버튼이 POST를 다시 호출한다. 신규 저장/복사는 targetId=null이라 원명령만으로 발급참조를 복원하지 못한다.

!gateway의 USER_COMMON 공통방법론 저장/복사에만 원pending request/name/purpose와 검산 fullref를 같은 화면 버퍼에 명시적인 optional 타입으로 보존한다. 영수증 확인 후에는 명시 GET만 수행하고, 원문검산 후에만 methodBuffer/onSaved·목록을 갱신한다. POST 응답 자체가 유실되면 기존 동일 원명령 재확인을 유지한다. 화면 왕복 시 자동GET/POST는 하지 않는다. 지역 cast/숨은속성/모듈전역map을 사용하지 않는다.

프로젝트 gateway.prepare/write/read의 순서·원 동작·정책/일회승인·preparationId·application 상태는 그대로 둔다. 공통 저장 성공을 프로젝트 실행권위로 확대하지 않는다. 원미저장 편집/검토입력·copy 원본/currentness·주체/client/transport/CSRF·수명 보호를 보존하고 늦은200/401·다른fullref 원문은 반영하지 않는다. 기존 내용검토·확정·적용 기능을 이번에 변경하지 않는다.

## 단일 writer·허용 세 경로

기존 developer_primary만 아래를 수정한다. Main은 문서/검수/Git 통합 담당이며 다른 작성자 변경을 되돌리지 않는다.
- apps/web/src/features/methodology-editor/CommonMethodEditor.tsx
- apps/web/src/features/methodology-editor/common-api.ts
- tests/unit/UI03/project-methodology-review-read.test.ts

## 검증·제외

실제 CommonMethodEditor의 기존 ReactDOM RAM 환경에서 수정 전 RED를 재현한 후 신규 저장/복사 POST1→GET503→화면왕복 자동요청0→원fullref 명시GET/다른hash거절→일치원문 이후onSaved1을 검증한다. POST자체유실 동일body/ID재확인·늦은200/401·주체/client/화면종료·복사원본교체를 구분한다. PROJECT gateway 순서/기존흐름을 회귀로 확인하고 기존 기대값을 낮추지 않는다.

직접/필수인접 FN02 공통 API·프로젝트 웹 회귀, typecheck·원웹config 메모리빌드·diff/지문을 반환한다. 추가경로 필요시 쓰기 전 Main에 반환한다. 실제 DB/권한/키/서비스/Agent·SDK조회·실자료·P03조작은 제외한다. RAM은 실제브라우저/served/DB 인수증거가 아니며 전체계획완료로 보고하지 않는다. rollback은 세 파일 한정 diff 역적용이다.
