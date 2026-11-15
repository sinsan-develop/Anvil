# UI06/FN03 문서 내용검토 사건 재조회 — 작업지시

기준 main `64aba39f192219abf2f7da629e2400dd2ed0bd61`, branch `codex/av3-ui06-review-receipt-read`. WORK_PLAN Stage B UI06/FN03의 문서 버전·내용검토·이력 조회를 기존 계약 안에서 연결한다. Primary 단독 제품 writer, Main 기록·검수·통합, 독립 검수자는 읽기 전용이다.

## 변경 이유와 기대 동작

현재 sendDocumentReview는 검산한 저장 영수증의 reviewRef를 반환하지만 화면은 이를 버린다. 저장됐다는 사실은 유효하며 그대로 유지한다. 추가할 기능은 원 검토 사건을 사용자가 명시적으로 재조회하고 원 입력·주체·대상과 대조하는 것이다. 저장 확인과 사건 재조회 확인을 구분한다.

- 검산된 영수증의 전체 reviewRef와 원 명령·대상·검토자를 버퍼에 보존한다. 유효 영수증에서만 saved=true로 전환하고 원 POST 결과 불명·명시 거절 처리는 유지한다.
- 기존 고정 버전 GET만 이용해 ref·criteriaVersion·outcome·reviewer·항목/근거·종합 이유가 정확한 사건을 확인한다. 배열 첫 행이라고 가정하지 않는다. 없는 사건·중복·다른 hash/actor/items/reason을 일치로 표시하지 않는다.
- GET 오류·누락·불일치에서도 저장 확인과 참조는 유지한다. 사용자의 명시 재조회는 GET만 사용하며 POST 재전송이나 자동 재시도를 하지 않는다. 원 POST 불명은 기존 동일 명령 재확인 동작을 유지한다.
- 사용자·client·project·제어 세대·대상 버전/내용·전송 문맥 변경, 화면 종료와 ABA 후 늦은 200/401을 현재 화면/버퍼/인증에 반영하지 않는다. 새 입력은 기존 조회 결과를 잘못 재사용하지 않는다.
- 현재 GET의 문서 확정 정보에는 별도 확정 사건 ID가 없으므로 이번에 확정 사건 검산을 추가하지 않는다. 새 API·SQL·권한·정책·실제 DB·키·서비스·Agent·SDK 실행은 제외한다.

## 허용 제품 경로

1. apps/web/src/features/design-trace/review-api.ts
2. apps/web/src/features/design-trace/DocumentReviewEditor.tsx
3. tests/unit/UI06/document-source-refs-ui.test.ts

다른 제품 경로가 필요하면 이유와 정확 diff 범위를 Main에 먼저 반환한다. Main 소유 기록은 이 WI와 WORK_STATUS/WORK_CHECK·결과서다. 다른 담당자 편집을 되돌리지 않는다.

## 검증·인계

실제 React 패널 RAM에서 기존 저장 이후 사건 참조 소실을 RED로 확인하고 정상·GET 실패/불일치·GET만 재조회·POST 불명 유지·문맥 변경/이탈/늦은 401을 집중 검증한다. 직접 영향 UI06/FN03 검사와 typecheck·메모리 웹 build를 선택하며 기존 기대값을 낮추지 않는다. 명령·exit·개수·변경 전후 diff·파일 hash·잔류 실행·미검증을 보고한다. 실제 브라우저/DB/서비스·사용자 인수는 미검증이고 전체 UI06/FN03 완료로 승격하지 않는다. rollback은 세 경로 한정 diff 역적용이다.
