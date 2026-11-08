# UI02 실제 기준선 선택 화면·명시 저장 여정 검수

WORK_PLAN Stage B UI02/FN01의 실제 화면 동작 검수이며, 기존 PR72 helper 검사를 반복해 화면 완료로 대체하지 않는다. 현재 Stage B branch codex/av3-origin-technical-contract 안에서 미채택 계약 준비와 별도로 기존 구현의 화면 여정 검증을 보완한다. 이 문서는 새 계약/권한/기능 승인이 아니다.

## 담당·정확 소유
기존 Primary 단일 writer는 신규 tests/unit/UI02/baseline-design-screen.test.ts 한 파일만 작성한다. Main은 문서·검수·통합을 담당한다. 시작 전 해당 경로 부재/현재 Git과 원 제품 지문을 확인한다. 다른 담당자 변경을 되돌리지 않는다. 제품 또는 추가 시험 변경이 필요하면 원인·diff 후보와 함께 Main에 반환하고 임의 쓰지 않는다. 현재 origin 후보 cbefc3e3/패킷239845d6는 미채택/제품·SQL GO0 불변이다.

## 목적과 기존 선례
실제 React ProjectBaselinePanel→BaselineDesignPicker→readBaselineDesign→setBaselineDesign→명시 saveBaselineDraft→실 sendBaselineCommand 호출선을 검증한다. 기존 tests/unit/UI02/common-setup-screen.test.ts의 React createRoot/act·MemoryNode·Vite write:false 가상 entry·실 ApiClient/상태 host와 globals 복구·OwnedChannel 회수 선례를 재사용한다. 새 의존 설치/jsdom/served 프로세스·서비스/실브라우저는 만들지 않는다. 기존 baseline-api.test.ts의 strict snapshot/hash 계약을 재사용한다. 일반 성공 fallback 없이 정확 예상 경로·method·body만 받는 합성 transport로 구성한다.

## 최소 인수조건
1. 실제 Panel에 현재 OWNER/project/control을 주고 목록→정확 문서/본문/AF02 조회를 클릭한다. 정상4종 각각/묶음의 content·분리refs/fullhash를 통과시킨다. 선택은 root designRef 한 건만 부모 buffer에 commit하고 하위refs/evidence·기존항목은 보존한다. 선택만으로 POST0이다.
2. ‘초안 저장 · 미확정’ 명시 클릭 뒤 기존 control GET 및 정확 commands POST1을 확인한다. 단일 designRef·CSRF·same-origin·Idempotency-Key·원UUID/버전 결박과 strict hash snapshot·false flags 수신으로 실제 부모가 saved/dirtyfalse/pendingnull을 반영해야 한다. 반환 DTO를 직통 state에 주입하지 않는다.
3. 403·오염·늦은 metadata/body/form·unmount/새buffer·다른owner/client·control 교체는 원ref 적용/추가 POST0을 유지한다. 부모 CAS 거절 시 성공으로 표시하지 않는다. 실제 코드가 지원하는 fence를 시험하고 새 authority/현실 이탈을 가정해 실패를 지우지 않는다.
4. 저장 응답 유실은 원 packet UNKNOWN/자동POST0을 유지하고 명시 재확인은 정확 같은 ID/body를 재사용한다. 새 저장명령으로 갈아타지 않는다.

## 검증·반환
정확 신규 시험 node --test tests/unit/UI02/baseline-design-screen.test.ts 를 실행하고 필요한 직접 인접은 기존 helper12 전체를 반복하지 말고 실제 변경/발견에 맞춰 선택한다. Primary typecheck/diff, Main 독립 spec/quality 읽기·필요 merged-smoke를 분담한다. 합성 fixture 준비 오류와 실제 제품 RED를 구분한다. 실패 시 임의 기대값 완화·skip·guard삭제0. 동일 근본원인 3회는 중단해 Main에 정식 원인/변경/증거를 반환한다. 정확 명령/exit/실패·성공 수/raw지문/시간/알려진 handle·globals/channel 회수/미검증을 보고한다.

실제 DB·권한·키·서비스·Agent·사용자 원문·파일 조사·SSH·J3·P03 R3·컴파일0. 새 파일 출력 없이 메모리 build만 허용한다. 이 여정의 합성 실제 React 검수는 served/실DB/실 사용자 인수·전체계획 완료를 증명하지 않는다. rollback은 신규 시험의 정상 revert이며 기존 시험·원문·역사는 보존한다.
