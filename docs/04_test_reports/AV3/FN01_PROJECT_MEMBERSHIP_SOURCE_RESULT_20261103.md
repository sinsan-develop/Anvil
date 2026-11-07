# FN01 참여권한·승인 원문 source 검수 결과 — 2026-11-03

판정: 승인된 source·합성 검증 단위는 한정 검수됐다. 전체 FN01/Stage/작업계획과 실제 사용자 인수는 미완료다. 실제 기능 상태는 **부분 구현**이다. 실제 DB 적용·served 화면/사용자 권한은 확인하지 않았으며 이 보고서로 실행을 승인하지 않는다.

## 기준·승인·담당

- 기준 branch codex/av3-stage-b, 부모 HEAD 6e3c8eb79aae943a22bf8520039f285f41ba50b8. 게시 checkpoint SHA는 WORK_STATUS 후속 기록에서 확인한다.
- 신산님 직접 답변: A안 계약·source-only 구현 승인. 승인 원문 docs/contracts/FN01_MEMBERSHIP_APPROVAL_SNAPSHOT_CANDIDATE_20261103.md SHA256 51292CA41A0A1C762104D6FF9890FF05A06DD4402DBAE6ABAB087045D48C1BE6.
- 착수 WI B495BB20888FEF3A16FD28724694A212D91B0D147CEFC7559636EED88DBD847B. 현재 같은 r4 LF33C3938DF482B4C0F5B65FB08EC2AE8413B0973EE4A7D7E10ECFEA5C67BF0D2D. Main이 추가한 CRLF3개만 정정한 MAIN_RECONFIRMED_NON_SEMANTIC이며 원 승인·문구·허용25·검수 의미는 불변이다.
- 기존 Primary는 구현·기본 검증, Main 어울은 관리·독립 검수·문서·Git. 한 명의 writer가 허용25 중22를 변경하고 반환했다. 인접시험3은 수정하지 않았다.

## 연결한 범위

- 기존 saveProjectMembership의 대상·역할·원 사유→원 명령→불변 버전/현재 head CAS→영수증/감사→현재/과거 보호 조회.
- requestApproval의 해당 연산만 candidatePayload와 membershipCandidate를 결박한다. 서버 보관 원문·과거 fullref/hash와 현재 결정/소비 검산을 분리한다. 최종 원 명령은 정확 ApprovalRef만 붙여 소비한다.
- UI01 명시 열기/조회·준비·별도 확인·저장·이력, UI08의 서버 보관 대상/이전·새 역할/원 사유와 명시 복귀를 연결한다. 승인 결정만으로 저장하지 않는다.
- OWNER/current·최근 재인증·명시 정책/DENY·lastOwner/자기 관리권 상실·회수관계 거절·원 commandId/body/UNKNOWN을 보존한다. 전역 사용자 검색/프로필·자동 권한 부여·실제 Agent 호출은 없다.
- schema0074와 최종 checksum이 실제 DB에서 맞지 않으면 NOT_CONNECTED로 거절한다. 실제 적용하지 않았다.

## 검수 중 보완

1. 관리 version 조회 RLS 목적 함수에 현재 명시 정책/head/hash·만료/DENY를 연결했다.
2. 과거 승인 targetRef와 보관 base fullref의 contentHash 누락: ed216e RED→c48a74 GREEN. 현재 head로 과거 사실을 바꾸지 않는다.
3. hash await 중 폐기된 화면의 SENDING 변이: c7edfe RED→13a6c5 GREEN. POST0/상태변이0을 분리했다.
4. 다른 project/command snapshot을 재hash한 응답 수용: 13a6c5 RED→e0ffa7 GREEN. 원14키·project/user/version/명령/작성자/client/base/ref/시각을 결박했다. 매개 조건을 독립 시험으로 부풀리지 않았다.
5. legacy/생성 anchor를 joined_at으로 소급 기록하던 문제: 642cd5 RED→d7b9c4 GREEN. 관측 기록시각을 사용하고 원 joined_at은 보존했다.
6. 새 프로젝트의 policy/context 없는 생성에서 지연 invoker 완결 검사가 FORCE RLS에 막힐 수 있는 회귀를 Main이 발견했다. source 및 [PG15 공식 trigger 구현](https://raw.githubusercontent.com/postgres/postgres/REL_15_STABLE/src/backend/commands/trigger.c)을 대조한 추론이며 실PG 재현은 아니다. fn74_version_final만 비공개 migrator 소유 SD/fixed path 무변경 무결성 검사로 한정하고 원 BEFORE/member/RLS/정책은 그대로다. 0fe87a 정적 RED→5d9a09 GREEN, Main의 정확 역차분/독립4 검수로 한정 보완됐다.
7. unsealed fake buffer의 앞단 거절을 UNKNOWN 상태 증거로 쓰지 않았다. 실제 prepare→응답유실로 만든 sealed UNKNOWN/동일 session에서 승인 요청·연결 거절과 추가IO0·원ID/body 보존을603cff로 검증했다.

위 검토 구간의 추가 미해결 Critical/Important는 없다. 실제 SQL 집행·RLS·경합·환경 인수의 합격을 뜻하지 않는다.

## 실행 증거

| 수행 | 실제 결과와 한계 |
|---|---|
| Primary 8ca383 선정8파일 | 31PASS/FAIL0/SKIP0, 3018.185ms, exit0. 보완 전 SQL 지문6100 기준이다. |
| Main09435e 신규5파일 | 21PASS/FAIL0/SKIP0, 2176.8713ms, exit0. 실제 React UI01/UI08 각1, 나머지 codec/Repo/fakeDB/API/helper·정적 SQL. 실PG/served가 아니다. |
| Primary 재작업5d9a09 | SQL schema4PASS/FAIL0/SKIP0,119.2585ms. 원 invoker 역할폐쇄 반례와 목적 SD 보완. |
| Main056b23 | 보완된 SQL 정적4PASS/FAIL0/SKIP0,147.8613ms,exit0. 앞21과3개가 겹치므로 합계25개 독립 시험이라고 하지 않는다. |
| Primary883c80/0a8e12 | root TypeScript noEmit 각각 exit0. 후자는 보완3 뒤다. |
| Primary5a5c8f | 실제 Vite write:false 메모리 build exit0, outputs3/4671686B/442.9547ms. 서비스 배포가 아니다. |
| Mainc97d17/0607e4 | 동결22 지문·승인/WI·보호3 일치, 지정 branch/remote/head/main과 diff 대조. |
| Main31ff5d | SQL 보완4곳을 정확 역치환해6100 원본 복원, service는 checksum 교체 외881B 원본 복원. 파일 쓰기0. |

직접 명령:
```powershell
node --test --test-concurrency=1 tests/unit/FN01/project-membership-input.test.ts tests/unit/FN01/project-memberships.test.ts tests/unit/FN01/project-membership-schema.test.ts tests/unit/FN11/project-membership-approval.test.ts tests/unit/UI01/project-membership-panel.test.ts
node --test tests/unit/FN01/project-membership-schema.test.ts
node node_modules/typescript/bin/tsc --noEmit -p tsconfig.base.json
git diff --check
```
첫 Node 명령은 Main의5신규파일 검사이며 Primary8파일에는 기존 project-access-summary/approval-input/policy-editor-qa-budget 3개가 추가됐다. 변경 없는 전체 회귀·UI·31건을 보완 뒤 다시 실행하지 않았다. 보완은 SQL역차분/지문·4건과 type로 확인했다.

## 미확정 실행·운영 오류 구분

- 이전 UI08 검사 출력과 handle을 잃은 실행은 UNKNOWN이다. 후속31PASS를 원 실행에 소급하지 않는다.
- 비승격646674 Get-Process 출력0은 sandbox 관측이다. 전역 Node0이 아니며 Main의 넓힌 표현을 정정했다. 승격0a9208에는 다른 Node가 존재/변경0,19dd39에는 본인 FN01 test/type 명령행 MATCHED0이 제출됐다. 절대 관측시각은 미기록이고 원 실행 exit는 미회수다. Main의 이후 독립 명령은 완료/exit0로 반환됐다.
- mock 테이블 prefix/알림 capacity·선언/비동기 타입·REVOKE 목록 단편 준비 오류와 제품 RED를 구분했다. 동일 근본 정식 제품 보정 실패3회는 없다.
- Main 역치환기2회 실패는 비교 도구 준비 오류다. 처음에는 postflight 일부가 누락됐고 JS replace 문자열의 $$ 치환 의미도 잘못 썼다. 제공받은 정확4곳을 literal callback으로 바꾼31ff5d에서 복원했다. 기준/기대값 완화·파일 수정은 없다. TypeScript 구문 API 읽기 도구1회 부재는 문자열 한정 읽기로 전환했다.

## 최종 source 지문

0074 raw SHA256 67696FDD3695199E2BE3450669D903BD286E6D87FE05361B7B2A75CE58A3EB96,33602B/CRLF0·service checksum 일치. Git 필터 전후 blob f8312bccca3a5e9cdc4049b7754a82bc4b8e28ce. 실제 적용0.

| 저장소 상대 경로 | SHA256 |
|---|---|
| .gitattributes | 4BDAF1DDD80CDC6CF4761568EFBB3B24EBC4450E98311F9F6BEA2CEF906006D0 |
| apps/server/modules/access/project-command.ts | CAB8C4A7609F54DDAB65ACEE5D75CDB73597ECED37BC8049C416AB13239BAA0B |
| apps/server/modules/projects/routes.ts | 69C9BD147EB3B520A4DC9B295AFF6CD29BAE870875FFBB9E25F00A0BE95CC9E1 |
| apps/server/modules/approvals/project-approvals.ts | 36269E15021A1E72A681DE8A8192E03F180753A4E8ACC3369BD9725B5A70A695 |
| apps/server/modules/approvals/approval-input.ts | 4127D0614DADF44DC9E6062A4B592FA53D4D2DA3C193DC4787BFFB22C7635BDA |
| apps/web/src/App.tsx | E1D2B9536A9609535A64652D7039BC34A24294472553FFEDAB4841806D8A76E4 |
| apps/web/src/features/projects/ProjectAccessSummary.tsx | 8CE76DF2C6716D03851C36223C0A2DAF4BAF8B8DF60602E2F28D528568845EFA |
| apps/web/src/features/connections/policy-editor-profile.ts | 2C23757A3D7058AA24164D2F5F107832527989D19AAF40815EAF045156836FC8 |
| contracts/runtime/project-membership-v1.ts | F2558ED90072644D74B4B1617611757EAFA7835BDF521D2E9D95115CD5764B0E |
| apps/server/modules/projects/project-memberships.ts | C32D51F62CE30D6D97BB4A9518E2EDDF5BBB9D527A9C05CE9C06EEFEF02DBAD0 |
| apps/server/modules/approvals/project-membership-approval-target.ts | C6797D31001EB17C87BD1A58F4D82E343789D036D6CB267AF509BBD43829481C |
| apps/web/src/features/projects/membership-api.ts | ADF25E5D1F8857ECE01AB12742B1035F920F4FC0E4C5669B7CC43943AD7A71B3 |
| apps/web/src/features/projects/ProjectMembershipPanel.tsx | BBA0E25C92B3D88B9D61F9528B7E93D4DA40FAA243D888821D76FAEF2079F975 |
| db/migrations/0074_project_membership_versions.sql.pending | 67696FDD3695199E2BE3450669D903BD286E6D87FE05361B7B2A75CE58A3EB96 |
| tests/unit/FN01/project-membership-input.test.ts | 1B5E39B06D9C834BF7EAD82234BD076373FEBBA6A4E11901E5D8FB00EC22B0D8 |
| tests/unit/FN01/project-memberships.test.ts | F3DE638B24C9BAE1825573AD36AFE16160D482E7EE79BB121A4A7EE667DCA192 |
| tests/unit/FN01/project-membership-schema.test.ts | E76387C7E3E7AA3CD7A447E547ECA392A3CD449AD44B1229FB14AE3BD9F87224 |
| tests/unit/FN11/project-membership-approval.test.ts | 4A9FBBF265385141C341850189C396AE845954F712754AF3BE6B839A3FFF9DBA |
| tests/unit/UI01/project-membership-panel.test.ts | EB7AF902F51C83598AAA1414E0AC8AC1679CBC18537E90E55C6A8837F8EAFC56 |
| apps/web/src/features/projects/ProjectsPage.tsx | 1ADA66F0A4329CBF810AA8BA79DB81864E6ACF067756E4BAFB647FE232ACDFC0 |
| apps/web/src/features/decisions/api.ts | A122F531FBEE6A4C9FCA49710645F346DAA48AE8F1258634AD80193E65D5FF29 |
| apps/web/src/features/decisions/ApprovalsPage.tsx | A6F70A7805ADB60D817A61439EA0960F386A9A40E6E7A766B2E879942AECC5EA |

## 남은 일·복구

실제 DB/migration·회원/정책/권한·키·서비스·Agent·제품 네트워크·served 브라우저·OS/물리 QA·사용자 인수는 NOT_RUN이다. 불변 메모리 build/시험 외 정리 대상으로 만든 서비스·DB·파일 QA는 없다. 다른 Node/기존 자료를 종료·삭제하지 않았다. 보호3은 보존·비게시 대상이다.

현재 기능을 신산님이 실제 화면에서 사용할 수 있다고 보고하지 않는다. 실제 환경 준비/적용·보호된 정상 흐름 검증은 해당 실행 범위가 허용된 후 필요하다. 기존 사용자 HE 정책 생산 후보는 미채택이며 이번에 확대하지 않았다. FN15 import/source·native 미채택 계약과 전체 계획 잔여를 계속 관리한다.

rollback은 정확22 source의 정상 Git revert이며 적용하지 않은 DB를 되돌렸다고 하지 않는다. PR/main 병합·새 branch·배포·실제 권한 변경은 수행하지 않는다.
