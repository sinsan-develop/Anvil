# UI02 기준선 설계 문서 출처 소비 보완 결과

판정: 기존 계약의 소스 단위 검수 완료. 전체 UI02/FN01·작업계획·사용자인수 완료 아님.

## 근거·변경
WORK_PLAN UI02/FN01, INTERFACES의 DocumentContent 출처4종 및 보호된 AF02 선택을 따른다. WI SHA256 845195bfa2a7509706a5c7bbaa27d27575384f1ad4ce612707b2707ea038797f. 시작 HEAD fca1eb94e7470bff38a93bf4a7ee9dd8b9f59a79, branch codex/av3-source-content-origin-contract.

기존 readBaselineDesign은 유효한 비빈 출처 문서도 거절했다. 제품 diff는 sourceRefs.length 조건 제거 한 곳이다. strict4종·분리열 검산, 원문·전체 documentDraftHash, pinned form integrity/AF02, owner/client/current buffer·pending/upload/UNKNOWN·await 뒤 현재성·선택 ABA를 보존한다. 하위 출처를 펼치지 않고 선택한 root designRef 한 건만 연결한다. 실제 API·DB·권한 의미 변경은 없다.

단일 기존 Primary가 제품1/시험1만 작성하고 Main은 문서·검수·통합을 담당했다. 원7사례 assert 본문을 보존하고 5사례를 추가했다. 독립 최종 읽기 4315b9 C0/I0/M0, 시작·끝 raw 지문 동일·writer 반환·알려진 실행0.

## 검증과 오류
- RED 248327 exit1/1FAIL: 유효한 AF02/content+분리 refs/full hash를 기존 조건이 DOCUMENT_REFERENCE_CHANGED로 거절. 수정 전 제품에서 재현.
- Primary `node --test tests/unit/UI02/baseline-design-selection.test.ts`: e0127c exit0, 12PASS/skip0.
- Primary `node --test --test-name-pattern='기준선 쓰기는 같은 pending|정확 초안 수신|늦은 결과는 새 버퍼' tests/unit/UI02/baseline-api.test.ts`: 00c135 exit0, 3PASS/skip0.
- Primary `npm run typecheck`: d097d8/session65903→a954db exit0.
- Primary `git diff --check`: a2db62 exit0. 준비 오류0/추가 경로0.
- Main의 이전 build+focus 출력은 유실되어 exit/handle UNKNOWN으로 보존한다. 이를 PASS로 소급하지 않는다. 현재 node 프로세스 조회 결과0은 과거 종료코드를 증명하지 않는다.
- Main 별도 e479ce: `node --input-type=module -e "const {build}=await import('vite');await build({configFile:'apps/web/vite.config.ts',build:{write:false}})"` 뒤 성공 조건으로 위 집중 명령 실행. exit0, Web 520 modules/507ms·파일 출력0, 집중12PASS/skip0/381.4934ms. 출력과 terminal을 직접 확인했다.

정상4종 각각/묶음/[]·root ref와 입력 불변, hash-valid unknown/추가키/잘못된 kind 키·분리열 오염, full hash/AF02/403, 각 await 이탈·선택 ABA·잠긴 조회 GET0을 확인했다. 합성 GET/helper 범위이며 실제 Picker DOM/served·서버 출처 보호·실 DB/사용자인수 증거로 확대하지 않는다.

## 지문
- 제품 apps/web/src/features/project-create/baseline-design-selection.ts: 2499B, SHA256 8511cd2c5009e386fa11f35dc075d141db5e4d71d0da1f6c9291de3c80e263c6.
- 시험 tests/unit/UI02/baseline-design-selection.test.ts: 10963B, SHA256 cc8b3b4638fcfcc01dc1681a1b4948f385dffddf16ffc53f771b90f3b2d6a905.
- sorted compact2 manifest c705f5ff7d718d5a5292ae41835884934e71f839184c5367852e587b5f512919.

## 통합·미검증·복구
같은 Stage B 묶음의 FN03 관리origin 후보 문서는 검토 이력 보존뿐이다. 해당 계약 미채택/제품·SQL GO0는 변하지 않고 관리생산자 코드는 없다. 실제 DB·권한·키·서비스·Agent·사용자 자료 접근0. 통합 후 이 helper 집중12개로 merged-main smoke하고 정확 PR/source/tree·원격 ref·clean 확인 후 정상 정리한다. 복구는 이 단위 정상 revert이며 역사·원문·이전 후보를 삭제하지 않는다.
