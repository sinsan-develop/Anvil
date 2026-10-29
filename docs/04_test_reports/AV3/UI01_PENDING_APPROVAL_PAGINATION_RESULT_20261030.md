# UI01 대기 승인 페이지 왕복 결과

판정: 기존 GET 계약을 사용하는 화면 누락 보완의 source/합성 UI 한정 검수. 전체 UI01/FN01/Stage B 또는 실제 사용자 기능 인수 완료가 아니다.
기준: a3718a18fe37ed353b3f47b3c27a23effa090717, codex/av3-stage-b. WI UI01_PENDING_APPROVAL_PAGINATION_IMPLEMENTATION_20261030.md SHA256 D6BADB9BA87B1225BD0DB94C96274C05DF376B34A7406DFAB67121C104256D3B. Main 관리·검수/통합, 기존 Primary 단일 코드 writer·해제, 기존 Reviewer 읽기 검수 C0/I0.

## 바뀐 동작과 범위

기존에는 다음 cursor를 덮어써 이전 페이지로 돌아갈 수 없었다. 이제 정확한 cursor의 GET으로 이전 페이지를 재조회한다. 요청 위치와 마지막 성공 위치를 분리해 실패는 성공 이력을 바꾸지 않는다. 같은 요청 재시도와 마지막 성공 페이지 재조회·첫 페이지 갱신·닫기를 구분한다. 부모 잠금/프로젝트·client scope 변경/늦은 응답 뒤 옛 cursor와 자료를 재사용하지 않는다.401/403/404는 과거 본문·탐색을 잠그고 기존401 상위 처리를 유지한다.

새 API/SQL·승인 결정/소비·쓰기/실행·자동 권한0. 기존 관측 시각/페이지 건수·전체 건수 미산정·원문 상세 이동을 보존한다.

정확 코드3:

| 파일 | SHA256 |
|---|---|
| apps/web/src/features/projects/ProjectPendingApprovals.tsx | 4484C2742CA85565E030BBDC818AEBD8182C7F1E0DE28758887168D29277327E |
| tests/browser/UI01/project-pending-approvals-pagination.spec.ts | 840FEFEA77A9037406F6942275A22D571551A07C346E194C66FEFF3272A5B3E7 |
| tests/browser/project-pending-approvals-pagination.config.ts | D1980C570EBB995FE6B30312E2AC03676E1A00CE8CF1BA3D498F2ADDCFB33B49 |

## TDD·오류·검수

- 93d3c0 이전 버튼 부재 RED1. Main 중간42ed00에서 성공 전 history 변경을 발견, 0b9254 실패한 이전의 마지막 성공 보존 RED1. requested/성공 position 분리 후 2ada3a 신규2 PASS/build0.
- Primary 0236dd 추가4 PASS/401 fixture1FAIL. Main be2840/d2c020/288f89로 AuthForm30·access repository116/routes32의 기존 auth/setup 응답을 확인했다. 정확 {setupRequired:false,policyVersion:1}를 신규 시험에 공급한 뒤 a1a37d 해당1 PASS. 기준 완화/제품 인증 변경0.
- 855502 HTML 보강 신규1+기존 직접4=5 PASS·원 reader4 PASS/type/diff0. 수행자 분리 실행이며 하나의 최종7 전수로 합산하지 않는다.
- Main dea469: 신규7+기존1=8 PASS/0FAIL/0SKIP,8.2초/exit0. 선택식의 ^ 앵커가 전체 Playwright 제목에 맞지 않아 기존3을 선택하지 못한 Main 선택 오류1이었다. ce4a24에서 누락3만 별도3 PASS/3.2초/exit0. 앞8을 재실행하지 않았다. 단일11 전수 실행으로 합산하지 않는다.
- Main420072 원 reader4 PASS/0FAIL/0SKIP/242.096ms, aa3a77 typecheck/diff exit0. 최종598253에서 코드3지문 불변. 독립 최종3지문/C0I0, Reviewer 자체 시험 실행0.
- 실제 카드 왕복/실패이전/실패다음 retry/빈 끝/갱신·닫기/늦은 body/부모 잠금/401·403·HTML 실행0·예상 밖 요청/쓰기/런타임 오류0을 합성 Edge에서 확인했다.

Main 정확 명령:

```powershell
node node_modules/@playwright/test/cli.js test --config=tests/browser/project-pending-approvals-pagination.config.ts --grep 'UI01_APPROVAL_BACK|프로젝트 대기 승인은|^대기 승인' --output=D:/tmp/anvil-v3-stage-b/ui01-approval-pagination-20261030-01/results/main
node node_modules/@playwright/test/cli.js test --config=tests/browser/project-pending-approvals-pagination.config.ts --grep '대기 승인 재조회403|대기 승인 다음 커서가 반복|대기 승인 응답 소비 전에' --output=D:/tmp/anvil-v3-stage-b/ui01-approval-pagination-20261030-01/results/main-adjacent
node --test tests/unit/FN01/project-pending-approvals.test.ts
npm run typecheck
git diff --check
```

수행자 마지막 npm run build는2ada3a exit0/473modules/380ms, 제품 수정17:30:43Z→dist17:30:47Z·이후 제품 변경0. 파생 build index A9FD943631478E14F9CCC8F7ACA064EDBC4487DAD65C7103E58012818DA03189/css BC67262F3704E1FC62ECC0F21B976BDD60A84893B25206197DA7D60E2B015E87/js A347E300EE8B7BD056B6DD14ECC75DF4C9188BC9FE5D9E9109639E606A3052B6. 기존 chunk500k/NO_COLOR 경고는 보존·자동수정0. Main은 같은 파생 빌드로 한정 UI를 검증했고 불필요 재빌드0이다.

## QA·실행심사·미검증

사전 등록 root D:/tmp/anvil-v3-stage-b/ui01-approval-pagination-20261030-01, owner SINSAN\cyhuh/link0, 생성2026-10-29T17:26:21.7437284Z(10/30KST), 수명30분. route.fulfill과 합성 API로 기존 Edge를 실행했으며 제품 서버·listener·실제 TLS/DB0. 39d3d1에서 exact realpath/owner/자식 link0/자기 node·Edge process0 확인 후8항목 삭제, 별도598253 부재 확인. 기존 파생 apps/web/dist는 정상 build 출력으로 남겼으며 원자료·다른 QA·보호8은 삭제하지 않았다.

Primary 추측 project-list-state.ts 조회절차 오류1은 내용0/ACL변경0/재시도0. 신규 경로 탐색을 Main으로 회수했다. Main UTC/KST 생성 날짜 오기1은 실제 e7f869 metadata/clock으로 정정·원인 기록. 두 오류를 제품 실패로 세지 않는다.

자동 실행심사는 처음에 현재 FN16 승인과 별개 UI01 구체근거 부족으로 거절(실행0)했다. Main은 현재 전체 WORK_PLAN 수행 지시·계획 내 구현/테스트 재승인 불필요·PMO§6·project AGENTS·SCREEN_WORK UI01을 실제 대조해 정상 재심사1회만 요청했고 허용됐다. 우회0·반복 사용자 질문0이다.

직접 client/project prop 교체는 NOT_RUN이며 소스 scope 장벽·부모 잠금 시험을 그 직접 증거로 바꾸지 않는다. 실제 DB/WSL served·정식 로그인/권한·사용자 인수·전체 Stage B/WORK_PLAN은 미완료다. 실제 키·DB·서비스·Agent·인증서 변경0. rollback은 본 단위 정상 Git revert이며 실제 자료/보호8을 변경하지 않는다. 다음은 기존 GET에 이미 있는 UI03 방법론 확정사건 상세의 표시 누락을 동일 방식으로 이어간다.
