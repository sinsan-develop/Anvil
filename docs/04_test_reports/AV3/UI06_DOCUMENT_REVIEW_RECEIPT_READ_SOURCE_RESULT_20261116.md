# UI06/FN03 문서 내용검토 사건 재조회 결과

기준 main64aba39f, branch codex/av3-ui06-review-receipt-read. Primary 제품3경로 구현, Main 검수·통합. 기존 내용검토 저장과 이력 조회 계약의 내부 화면 연결이며 새 API/SQL/권한을 추가하지 않았다.

변경 전 저장 영수증을 검산하고도 반환 reviewRef를 버렸다. 변경 후 savedReview에 전체 ref·검토자·원 명령을 보존한다. 저장 확인은 그대로 유지하며 사용자가 명시 조회하면 기존 고정 버전 GET과 원문 GET을 검산한 뒤 전체 이력에서 원 사건을 찾는다. ref·criteriaVersion·outcome·reviewer·items/근거·reason이 유일하게 일치해야 원문 일치를 표시한다. 첫 행 가정은 없다. GET 오류·사건 누락/중복·내용 불일치는 조회 미확인으로 남고 saved/원 참조를 보존한다. 명시 조회의 POST는0, 최초 POST 불명은 기존 동일 명령 재확인이다.

사용자/client/project/세대·버전·전송·입력 문맥 변경과 왕복/닫기 후 늦은200/401은 현재 버퍼/인증에 반영하지 않는다. 입력 수정 시 이전 사건 참조를 재사용하지 않는다. 부모 onRecorded의 기존 일반 refresh는 유지하며 그것을 원 사건 일치로 계산하지 않는다. 별도 확정 사건은 이번 범위에 포함하지 않는다.

## 검증

- RED d1a234: 검산된 저장1회 뒤 saved=true이나 savedReview.reviewRef가 없어 실제 React RAM 단언 실패. 0P/1F/exit1. GREEN d4b30d 1P.
- node --experimental-strip-types --test tests/unit/UI06/document-source-refs-ui.test.ts tests/unit/UI06/review-api.test.ts tests/unit/UI06/confirmation-api.test.ts tests/unit/FN03/document-confirmation.test.ts — 3fa2bd, 21P/0F/0SKIP/exit0, 2035.8327ms.
- npm run typecheck — 시험 카운터 추론 TS7022 한 곳을 before:number로 명시한 뒤 원 session73279 → 6e118e exit0. 동작/기대값 변경 없음.
- envDir:false/write:false 원 웹 Vite 메모리 빌드 ef9565: 520모듈/exit0. 실제 서비스 실행 없음.
- Main c293a5: 최종 시험의 검토 영수증·명시 GET 핵심1P/0F/0SKIP/exit0. diffcheck0. 기록 append의 CR 개행 경고1은 해당 추가 절만 LF로 정리했고 제품 변경 없음.
- 독립검수 제품/시험 C0/I0/M0, 최종 지문 대조. 실행 세션0.

## 동결 지문

- DocumentReviewEditor.tsx SHA256 4FA3BC9C1CF6EEFA114DEB438CCEB1241EF151A37ECE70D0B555B09DC787E475
- review-api.ts SHA256 C45DA471E3A2EA0A47C7E0A1019D76D1013A511BBDA18E68D611554A4A5D7189
- document-source-refs-ui.test.ts SHA256 6D8923A07DA5C903A5682C44FECEF9964DBB069A98FC0F9E454E12BFE8DE1B20

실제 브라우저/서비스/DB·사용자 인수는 미검증이다. source/RAM 결과를 실제 저장·사용 가능·전체 UI06/FN03/계획 완료로 승격하지 않는다. DB/권한/키/서비스/Agent/SDK·R3 추가 관측 변경0. rollback은 제품3경로의 한정 diff 역적용이다. 다음 독립 구현은 FN08 START 내구 응답 뒤 재수신의 관측/ACK 복구다.
