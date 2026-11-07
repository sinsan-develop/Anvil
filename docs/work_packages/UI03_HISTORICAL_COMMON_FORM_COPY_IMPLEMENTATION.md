# FN03/UI03 과거 공통 양식 복사·편집·저장 연결

2026-10-27 / Main 어울. 기준 branch `codex/av3-stage-b`, checkpoint `561b00470a84caeb68ed7f87d5dcbafb991da02a`.

## 목적과 기존 지원

계획 FN03/UI03의 공식 양식 버전 재사용·복사/개정·원본 보존을 구현한다. 현재 FormVersionComparison은 과거본을 조회/비교하지만 선택 callback이 없고 FormsCatalog→CommonFormEditor는 현재 detail만 복사 원본으로 제공한다. 서버 documents/common-write.ts20~28의 기존 copyForm은 exact 과거 sourceRef.id/version/hash를 확인해 새 ID/v1과 COPY parentRef를 저장한다. 기존 조회/비교 완료를 다시 구현하거나 새 API·DTO·SQL·권한을 만들지 않는다. 직전 방법론 커밋은 양식 경로를 바꾸지 않았다.

## 단일 writer 허용 4경로

- `apps/web/src/features/methodologies/FormVersionComparison.tsx`
- `apps/web/src/features/methodologies/FormsCatalog.tsx`
- `apps/web/src/features/methodologies/CommonFormEditor.tsx`
- 신규 `tests/browser/UI03/historical-form-copy.spec.ts`

기존 서버/API/reader·form-editor-state·공통 command helper·검토/확정·기존 비교 spec/config·CSS/메뉴·방법론4경로는 수정하지 않는다. 필요한 추가 범위는 실제 호출선과 최소 diff를 Main에게 먼저 제시한다. Main은 제품 수정 없이 관리·검수·통합하며 code writer는 한 명이다.

## 동작과 보호

1. 현재 USER_COMMON 양식 v2와 다른 과거 v1을 명시 조회·비교한다. 기존 무결성 검증을 통과한 과거 결과만 ‘이 버전을 복사 원본으로 선택’할 수 있다. 선택은 POST0이며 FormBuffer의 현재 편집/검토·원문을 바꾸지 않는다.
2. FormsCatalog의 일시 상태로 과거 **복사 전용 snapshot**을 소유한다. session 객체/user/client/CSRF·API/transport·현재 exact 원본/ref·비교 generation에 결박한다. 현재 detail은 기존 원본 표시·편집/신규 작성·검토에 유지하고 과거 source는 copy에만 선택적으로 전달한다. App FormBuffer에 별도 UI 선택을 저장하지 않는다.
3. 기존 복사 이름·미저장 교체 확인·명시 copyForm을 사용한다. sourceRef와 formCode·정의/작성 기준 참조는 과거본 것을 일관되게 사용하고 최신본 메타데이터를 섞지 않는다. 새 ID/v1을 기존 보호 GET으로 확인한 뒤 편집·saveFormDraft·새 버전 재조회로 이어간다. 원본/현재 v2·적용 참조·검토/확정 상태를 덮거나 복제하지 않는다.
4. 원본/비교 입력 변경·재조회 시작·403/hash 오류·사용자/client/session/CSRF/API/transport 전환·닫기에서 선택을 해제하거나 현재 문맥에서 쓸 수 없게 한다. 늦은 응답/ABA로 과거 선택이 부활하지 않도록 render와 실행 직전에 확인한다.
5. pending/미확인 원명령·review.pending 중 선택/복사로 기존 상태를 해제/교체하지 않는다. dirty·내용검토 dirty의 기존 확인을 유지한다. 전송 뒤 문맥이 바뀌면 늦은 결과가 새로운 buffer를 덮지 않으며 원명령을 보존하고 명시 재확인만 허용한다. POST 수락 뒤 GET 실패도 저장·재조회 완료로 표시하지 않는다. 자동 복사/저장·확정·적용은 없다.
6. 기존 현재본 복사/편집·신규 양식 작성·검토는 같은 동작을 유지한다. 구조 개편/공통화·새 방법론/메뉴는 하지 않는다. 실제 DB/서비스·정책·Secret·Agent 실행은 제외한다.

## TDD와 검수

먼저 신규 spec/fixture만 작성하고 제품3파일은 보존한다. Main이 실제 기존 App의 과거 비교 성공 이후 버튼 부재 RED1을 확인한 뒤 제품 구현을 지시한다. writer는 자체 browser/파일 QA/PG를 만들지 않는다. typecheck·메모리 build/write:false·diff·수집만 수행한다.

정상 여정은 과거 정의/메타데이터가 현재와 다른 상태에서 선택 POST0→별도 복사→새 ID/v1의 과거 정의→편집→기존 save/v2 재조회다. 원본/현재본 유지, dirty 확인 취소, pending 차단·원명령 재확인, 입력/원본·문맥 전환·지연/ABA·403/hash 실패를 필요한 최소 사례로 확인한다. 응답 유실과 **POST 수락 후 첫 사본 GET 실패**는 따로 검증해 기존 commandId/sourceRef/name을 보존하고 동일 새 ID/v1을 재확인하는지 확인한다. 서버/reader의 전수 회귀는 반복하지 않는다.

새 QA root는 `D:/tmp/anvil-v3-stage-b/ui03-historical-form-copy-20261027-01`, 후보 bundle은 `dist`다. 환경변수 `ANVIL_UI03_HISTORICAL_FORM_COPY_DIST`는 그 정확 dist를 가리킨다. Main이 생성 전에 WORK_STATUS/commentary에 owner·수명·정리를 등록하고 새 root 부재/nonlink/실제경로를 확인한다. 실제 App/Edge 검증과 독립 검수 뒤 기존 branch에 통합한다. 실제 DB/served·사용자 인수는 별도 미확인으로 남기며, 전체 FN03/UI03·작업계획 완료라고 하지 않는다.
