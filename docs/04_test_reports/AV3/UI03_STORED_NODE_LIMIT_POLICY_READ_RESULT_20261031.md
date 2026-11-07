# UI03 저장 원본 단계의 연결 한도 정책 읽기 결과 — 2026-10-31

## 판정·범위
기존 보호 GET을 저장 원본 화면에 연결한 한정 기능의 source·핵심 동작을 검수했다. 실제 served/DB·현재 정책 효력/잔여·실행 강제·전체 UI03/FN02/WORK_PLAN 완료는 아니다.

- SCREEN_WORK UI03의 선택 단계 ‘환경·결과·조건·한도’에 근거한다. WI UI03_STORED_NODE_LIMIT_POLICY_READ_WI_20261031.md SHA9099FD501CCA3ABFED409DE49A89486A214C426BEE3DDBED5B8B874C52AF8116.
- 기준 codex/av3-stage-b / de497b1b660737f417e6b240944f128c82549155. 기존 Primary 단일 구현, Main 검수·통합, 기존 Reviewer 읽기 검수. Main 제품 코드 수정0.
- 제품 ProjectMethodologyPage.tsx/StoredNodeDefinition.tsx 2파일과 신규시험1만 변경했다. 기존 readLimitPolicy·편집·저장·확정·적용·NodeBudgetSelection·서버·SQL·전역 CSS는 불변이다.

## 구현
- 실제 저장 PROJECT 원본의 선택 단계에서 ‘연결 한도 정책 원문 보기’·닫기·재조회를 기존 readLimitPolicy에 연결했다. source.scope뿐 아니라 원본 응답의 projectId가 현재 projectId와 같은지도 확인한다.
- 공통/시스템·참조 없음·로딩/오류에서는 정책 GET0. 정확 source fullref/nodeId/정책 fullref/project/user/client/ApiClient·mutable transport에 조회를 결박한다.
- APPLIED/REVOKED는 고정보관 기록의 상태로, 결정·만료 시각과 6개 한도 값·단위/있는 경우 비용을 표시한다. 비용 미기록을0원/무제한으로 해석하지 않는다. 현재 효력·잔여 예산·실제 OS/Agent 강제·실행 허가는 미확인으로 유지한다.
- 닫기·단계/방법론 버전·주체/project/client·transport 전환·이탈 후 늦은 JSON/digest와 오류를 폐기한다. 렌더 transport ABA, 현재 활성401만 인증 만료 전달,중복GET1/POST0·원본/초안 불변을 유지한다.

## 검증
실행기 C:/Program Files/nodejs/node.exe.

```powershell
node --test tests/unit/UI03/stored-node-limit-policy.test.ts tests/unit/FN02/stored-node-definition.test.ts tests/unit/FN02/project-method-web.test.ts tests/unit/UI11/limit-policy-api.test.ts
node node_modules/typescript/bin/tsc --noEmit -p tsconfig.base.json
node --input-type=module -e "import {build} from 'vite'; await build({configFile:'apps/web/vite.config.ts',build:{write:false}}); console.log('UI03_FINAL_MEMORY_BUILD_OK');"
```
- Main a19338 최종동결본 **23PASS/fail0/skip0·type exit0·Web 메모리build482modules/exit0**. 신규8+직접15이며 기존 quota89/UI06 12를 반복하지 않았다.
- Primary080554 actual Page 목록→전용v1선택→graph hash 검산/단계N1 뒤 버튼0 RED,661b8d 정상1 GREEN. 앞선 a522eb 신규7·eead00 직접15/build/detect 후 projectId 결박1을 보완했고,5b6a0c 영향1은 분리 증거다. 7+1을 단일 전수로 보고하지 않고 Main이 최종8조건을 포함해 실행했다.
- Main0654d0 최종 변경 target2 detect `[]`/exit0. 독립 문서·최종 코드3 C0/I0이며 기준 완화나 미해결 C/I 없다.
- 합성시험은 실제 Page/ReactDOM/ApiClient/원 decoder와 소형 메모리 DOM이다. 실제 브라우저·DB 권한 증거로 승격하지 않는다.

## Main 실제 Chromium — 합성 Page
- D:/tmp/anvil-v3-stage-b/ui03-stored-node-limit-20261031-01을 생성 전 등록했다. 소유 SINSAN/cyhuh,상위/link/부재 검산·TTL30분/최대8MiB,06e919에서 실제 Page/Definition 최종 지문으로815,902bytes 메모리 화면을 만들었다. 실제 DB·키·서비스/listener·Agent0, CSP connect-src none·합성 transport다.
- ego space17/p1·1920×1080 기준.958436 초기 목록/적용ref GET3·정책GET0·편집/lost callback0.
- 284ac4에서 실제 원본 열기→선택 단계 정의 펼치기→정책 보기: 전체 GET5 중 고정 정책GET1·POST0,모든 값/단위·과거 기록 상태/기한/비용12.5USD·현재효력/잔여 미확인 표시를 확인했다. 실제 root 정책영역의 text로 검산했으며 inline script 문자열을 근거로 삼지 않았다.
- changes0·buffer unchanged true·lost0·실제 resource request0·가로 넘침0. 정책영역491.7px가 화면 안에 들어왔고 Main이 screenshot을 실제로 봤다. 전체 제품/모든 기기 검수는 아니다.
- 96d9b9 닫기 후 정책 값 제거·선택단계N1 보존·GET 증가0·초안 불변을 확인하고 space17.finish({keep:[]}) 정상1회 완료했다.
- screenshot SHA A654DC07DAA9C172CB4784CCFEB4AB5C5CEC80A060C94B0A77435A866F554EAE. a9a86d 등록7파일884,165bytes를 정확 경로/상위link/소유/이름/예산 검산 후 정리,170a34 별도 경로 부재=True다. 기존 사용자 탭/완료 space15/다른 프로젝트는 변경하지 않았다.

## 지문·오류·한계
|파일|최종 SHA256|
|---|---|
|apps/web/src/features/methodology-editor/ProjectMethodologyPage.tsx|4E70B9489D28E9EE23A3B8730152464B9319D04FCA231DF10239E9E7FF9BB272|
|apps/web/src/features/methodology-editor/StoredNodeDefinition.tsx|76A2F5230718E0F3ECA9E358EFDCE21A411FB9E26B4A29A4BB912AEF044154FB|
|tests/unit/UI03/stored-node-limit-policy.test.ts|3DBF9180F17CF2910FEAE121AAE9446E7A2108C96291CFEF80A06922DBEB80CD|

Main170a34에서 제품/시험 불변·diff0,기존 reader SHA030149EFF00C34F428A3C58969BFF5538A2B56CB10DE1BA96067DCD701B50F98 불변을 확인했다. Primary 편집 치환 가드의 후보2곳 중단1과 동반 임시 타입 오류1은 정확 선택 정의 위치로 좁혀 보정했다. Main의 추측 directory 읽기1은 실제 inventory 경로로 교정했고 이후 검색 결과 확인 후 읽는 순서만 사용했다. 동일 유효 FAILURE_REPORT3회·권한/ACL/Git 설정 변경0.

실제 HTTP/DB/권한·키·현재 사용자 파일 조사·서비스·Agent·현재 정책 효력/잔여·사용자 인수는 미검증/미실행이다. 반영 후 위치는 UI03 프로젝트 전용 방법론→저장 원본 열기→단계 선택→단계 정의 상세→연결 한도 정책 원문 보기다. 이번에는 실제 서비스를 반영하지 않았다.

검수된 source만 기존 private branch에 통합하며 롤백은 원형을 기준으로 새 정상 수정 commit을 사용한다. reset/force/history rewrite·실제 DB 롤백0. Main은 다음 승인 범위 미완료 업무를 이어가며 FN14의 별도 미채택 결정은 이 구현 승인과 분리한다.
