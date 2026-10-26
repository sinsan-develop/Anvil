# FN02/UI03 과거 공통 방법론 복사·편집·저장 연결

2026-10-27 / Main 어울 / 기준 `codex/av3-stage-b`, checkpoint `c8765d5265416c53285b2b70cd92842ea2ff08c1`.

## 목적과 기존 근거

계획 FUNCTION_WORK FN02의 특정 버전 재사용·복사/개정·불변 이력과 SCREEN_WORK UI03의 버전/복사 출처→초안 편집·저장을 연결한다. 현재 비교 화면은 hash 검증된 과거 버전을 표시하지만 복사 대상으로 고르는 동선이 없고, 기존 편집기의 copy는 최신 목록 원본 ref만 사용한다. 기존 서버 common-write.ts의 copyMethodology는 head 제한 없이 exact sourceRef.id/version/hash를 확인하고 새 UUID/v1·origin.parentRef를 보존하므로 새 API/SQL/권한이 필요 없다. 기존 ‘조회/비교’ 완료를 다시 구현하지 않는다.

FN16 새 internal bridge의 TCP 미연결/정식 환경 gate와 독립적인 승인 범위다. 실제 DB/서비스·정책·Secret·Agent 실행은 하지 않는다. Main은 관리·검수·통합하고 제품 코드는 한 subagent만 수정한다.

## 허용 4경로

- `apps/web/src/features/methodology-editor/CommonMethodVersionComparison.tsx`
- `apps/web/src/features/methodology-editor/MethodologyEditorPage.tsx`
- `apps/web/src/features/methodology-editor/CommonMethodEditor.tsx`
- 신규 `tests/browser/UI03/historical-method-copy.spec.ts`

기존 server/API/공통 reader/common-api·project 전용 page·기존 비교 spec·원본/기준·권한·CSS/메뉴는 변경하지 않는다. 필요한 최소 delta가 있으면 실제 호출선과 함께 Main에게 먼저 보고한다.

## 동작과 상태 보호

1. 사용자가 현재 USER_COMMON v2를 조회하고 과거 v1을 명시 비교한다. 기존 graph hash/정확 버전 검증을 통과한 과거 결과에만 ‘이 버전을 복사 원본으로 선택’ 동작을 제공한다. 선택은 POST0이며 저장·편집 입력을 자동으로 바꾸지 않는다.
2. Page가 주체/client·API/transport/CSRF·현재 원본/ref·비교 결과 문맥에 결박된 **복사 전용** 과거 snapshot을 소유한다. 현재본 편집·검토/확정·저장의 source는 그대로 유지하고 복사 전용 대상만 기존 copyMethodology에 전달한다. 원본 ref/hash/graph를 새 mutable 입력으로 재구성하거나 최신 ref로 바꾸지 않는다.
3. 기존 복사 이름·별도 명시 복사와 replaceAllowed/미저장 확인을 재사용한다. 자동 전송·자동 확정·자동 적용은 없다. copy의 sourceRef는 과거 ref 그대로이며 scope=USER_COMMON이다. 새 ID/v1의 서버 결과를 기존 보호 reader로 조회하고 기존 buffer의 편집·saveMethodologyDraft/새 버전 재조회로 연결한다. 검토·확정·실행 상태를 복제하지 않는다.
4. 비교 입력/현재 원본·사용자/client/API/transport/CSRF 전환, 새 조회·오류/403·무결성 실패·닫기에서 복사 선택을 해제하거나 현재 문맥에서 사용할 수 없도록 한다. 늦은 응답/ABA로 선택이 부활하지 않아야 한다. 기존 buffer의 pending/미확인 원명령·preparation·검토/적용은 다른 source 선택으로 해제/교체하지 않는다. 사용 불가 상태와 해제 동작은 명확히 표시한다.
5. 현재 v2 편집·저장과 과거 v1 복사는 구별되어야 한다. 다른 화면의 CommonMethodEditor는 새 prop을 제공하지 않아도 기존 동작이 유지되는 선택적 연결로 한다. 새 메뉴·레이아웃·시각 구조 개편은 하지 않는다.

## 핵심 검증

실제 App 합성 DOM에서 버튼 부재 RED를 먼저 확인한다. 현재 v2와 과거 v1의 graph가 다를 때 과거 선택→선택 POST0→기존 명시 복사→새 ID/v1 과거 graph·sourceRef 확인→사용자 편집→기존 저장→새 버전 재조회를 검증한다. 기존 원본/현재 v2 보존, 현재본 저장 경계, 미저장 확인 거절, pending/응답 유실 원명령 보존, source/주체 전환·늦은 응답·403/hash 실패를 필요한 최소 사례로 확인한다. 기존 서버/과거 reader의 완료 검사를 전수 반복하지 않는다.

새 브라우저 spec의 후보 bundle root는 `D:/tmp/anvil-v3-stage-b/ui03-historical-method-copy-20261027-01/dist`다. Main이 실행 전에 root/owner/nonlink/부재·수명·정리를 WORK_STATUS와 commentary에 등록한다. source 작성 중에는 브라우저/파일 QA·새 listener·PG를 만들지 않는다. 정적/type·메모리 build/write:false·diff와 수집만 허용한다. 실제 DB·served·사용자 인수는 별도 미확인으로 남긴다.

writer는 정확 변경·원 RED/검증·오류·한계·지문을 제출하고 해제한다. Main이 실제 App 검증·독립 검수 후 기존 branch에 통합한다. 이 업무의 소스 검수와 FN02/UI03/전체 작업계획 완료를 혼동하지 않는다.
