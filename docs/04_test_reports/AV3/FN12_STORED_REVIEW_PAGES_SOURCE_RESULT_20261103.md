# FN12 보관 검수 과거 페이지 — source 구현·검수 결과
2026-11-03 · Main 어울 검수·통합 / 기존 Primary 구현

판정: **SOURCE_SCOPE_ACCEPTED**. 21번째 이후 검수 목록의 코드·화면·합성 검증 단위를 인수한다. 실제 서비스 반영·DB·브라우저 사용 검증 및 전체 FN12/작업계획은 미완료다.

## 승인과 기준
- 기준 branch codex/av3-stage-b, HEAD4e0cd142464aafc3589cb98bc9c8a7032896c473.
- 신산님 직접 답변 call_38ed4cc7f50742c396f42772d7a66447: 'A안 계약·source-only 구현 승인'.
- 동결 계약 r2: FN12_STORED_REVIEW_PAGES_CANDIDATE_20261103.md SHA256 59B7F0E6178048AD5E5D1A3F1CF8E5B6C11B44A609B0A911182C91E1F44FF0B4. 채택 전 후보 원문을 수정하지 않았으며, 현재 승인은 직접 답변·WI·WORK_STATUS binding에 기록한다.
- WI 최초30D4089DC433234EF2A6800DDB15D38940D7F07D6A5615B56D825ED7B447D7CE → 최종 FACB86E240C9E66467D106D633C638C9430FF0D3B4912BCB431BF026A66CE15C.
- 기존7/신규시험1 정확8. Main은 제품 코드를 수정하지 않았다.

## 구현과 기존 동작 보존
기존 최근20 no-query GET와 고정 원문 GET/DTO를 보존하고, 새 GET /api/v1/projects/:projectId/results/:id/review-pages를 추가했다.
고정20/DB후보21의 keyset, 원제출·검수 행/command/receipt/audit/ref/hash 검산, 현재 로그인·회원 접근을 소비한다. 새 OWNER·쓰기 정책이나 완료 판정을 부여하지 않는다.

응답 정확9키, window2, 64KiB/opaque cursor4096 한도와 원30분/현재 세션 최소 기한을 유지한다. 사용자/client/session/credential/project/exact resultRef·원 조회창을 서버 서명에 결박하며, 내부 session ID·키·토큰을 노출하지 않는다.
first query{} 위치를 null로만 보관하면 복귀 때 새 window가 생기는 문제는 내부 signed root/position 프레임으로 해결했다. 첫 위치는 rootToken으로 재조회해 원 startedAt/expiresAt을 유지한다. 공통 purpose는 승인 literal FN12_REVIEW_PAGES이며, root/position의 서명 입력 domain과 exact 키셋을 분리한다. 새 공개 필드를 추가하지 않았다.

UI05는 명시 이전/다음·새 조회·실패 target 재조회·원문 별도 선택을 연결한다. 이전 위치100과 현재 위치만 유한하게 보존하고, 초과하면 안내한다. 페이지 이동/오류 때 이전 원문은 숨기며 성공 위치는 응답 검산 후 확정한다. 주체/client/transport·project/result/조회창의 ABA 및 늦은 응답/JSON/오류/finally가 새 문맥을 덮지 않는다.
completionAccepted/formalFailureCounted/evidenceProvenanceVerified/executionAuthorized/dispatchPerformed는 계속false다. 저장 검수를 실제 검증 증거·합격·정식 실패 집계·Agent 실행으로 바꾸지 않는다.

## 검수·재작업
- 실제 page 미구현, route404, Web API 미구현, 실제 React 미소비를 각각 RED→GREEN으로 확인했다.
- Primary a7c9ae의 첫 전체38PASS는 보완 전 제출 증거다. 후속 시험과 중복 합산하지 않는다.
- Main508332/2baa7a 독립 검수 Important2:
  - 응답 대기 중 연결 close가 원 signal에 연결되지 않음.
  - Web 항목 시각이 observedAt만 검사돼 window.startedAt을 넘는 항목을 수용함.
- 같은 Primary230f55에서 두 반례RED/정상close1PASS를 확인했다. 최종 route는 request aborted와 reply close를 함께 관측하고, 정상 writableEnded를 취소로 바꾸지 않는다. 이미 destroyed 및 finally 양 listener 회수를 검사한다. raw DB query의 정착 전 조기 반환/release를 하지 않는다.
- 항목 reviewedAt은 observedAt과 window.startedAt을 모두 넘지 않아야 한다.
- f7ee27의 공통 purpose 정합 RED도 승인 literal로 보완했다. 이는 Main 내부 지시의 명료화이며 새 공개 계약 변경이 아니다.
- Primary424306의 영향받는 좁은10PASS/2315.0572ms. 후행 타입의 시험 pending 단언1건을 보정한 d880ce root noEmit exit0/6.2997초. 28bdf2 diff0.
- Main53daaf 최종 직접4파일 **41PASS / FAIL0 / SKIP0 / CANCEL0 / TODO0 / 8013.1315ms / exit0**. 실제 등록 handler+합성 EventEmitter, 메모리 DB와 React 상태 행동이다. 실제 socket/PG/served 브라우저 시험이 아니다.
- Main829b79 기존 Vite config를 사용한 메모리 build: configFile:false, write:false, emptyOutDir:false, 출력3/2692028B, exit0. 파일 출력·개발 서비스 생성0.
- Mainba29f9 최종8 지문 일치·보호3 불변·diff0. 실제 인증 source의 user/session/client FOR UPDATE와 기존 pool/Tx 종료 소유를 읽기 대조했다.
- 검토한 source 범위의 추가 미해결 Critical/Important는 없다. 실제 경합·네트워크 취소 보장은 미검증이다.

### 중단·준비 오류 보존
원17dba7/session12325는 후속 fake query까지 무한 deferred였던 시험 준비 문제로 본인 handle Ctrl-C(7ef582, exit1/출력0) 종료됐다. 원 assertion 결과는 UNKNOWN으로 보존한다.
이후 후속 query를 유한 오류로 만들고 raw deferred를 finally에서 해제·관측해 실제 반례를 얻었다. 원 중단을 후속 PASS로 소급하지 않았다. 별도 OS kill·프로세스 열거0.
초기 export/assignment fixture·정확 필드 재조립/타입 오류는 준비 오류로 분리했다. 기준 완화·동일 근본 정식 실패3회0이다.

## 정확 명령
```powershell
node --test --test-concurrency=1 tests/unit/FN12/project-result-reviews.test.ts tests/unit/FN12/result-routes.test.ts tests/unit/UI05/stored-result-reviews-api.test.ts tests/unit/UI05/stored-result-reviews-pagination.test.ts
node node_modules/typescript/bin/tsc --noEmit -p tsconfig.base.json
git diff --check
```
메모리 build는 기존 apps/web/vite.config.ts를 직접 import하고 Vite build의 write/emptyOutDir를 false로 덮어 출력 코드·asset 바이트만 집계했다. 의존성·설정 파일 변경0.

## 최종8 지문
| 경로 | SHA256 |
|---|---|
| apps/server/modules/results/project-result-reviews.ts | 64B044F60847C853965204FD7650181B2A6390B065C40B2393467C1CBA3680C0 |
| apps/server/modules/projects/routes.ts | D77527DF00F3EFF1A047240252852436A5C29A95C0AF79DC7591642AF85CC3BA |
| apps/web/src/features/session-detail/stored-result-reviews-api.ts | ED03BBA92767C4E771EC2C565F12BBDA708CA6453715738A9C5094F46FD4C767 |
| apps/web/src/features/session-detail/ResultReviewSources.tsx | 3B3AECD0DE0B224700AADF16C1CCDB70621069D32DF7E0080D4D802C8A1109D7 |
| tests/unit/FN12/project-result-reviews.test.ts | A9A60F996AD1AA5533085E0063888BB4484523A8468D8E1FCD0B30310C3D507B |
| tests/unit/FN12/result-routes.test.ts | 2F5C3BADE1DC636F9EC6A4383FE87CE30D0974FD94EFFE59A914D81BC4B8F654 |
| tests/unit/UI05/stored-result-reviews-api.test.ts | 74CF2CC9EFF57F8EA26842BA1FC6B019450DE6C8AFDCB4859D9CD74B8ED7B1B4 |
| tests/unit/UI05/stored-result-reviews-pagination.test.ts | DD70885ACB9515CD8C98192485EAEAA8506E9931A11B73CF8012EAA9D009E8AE |

## 사용 범위·잔여·복구
- UI05의 '보관 검수 이력'에서 명시 조회/이전/다음/새 조회/원문 선택 흐름을 구현했다. 실제 서버 반영과 사용자 접속 검증은 수행하지 않았다.
- 목록은 각 요청 때 현재 보이는 불변행이다. 과거 transaction_timestamp의 지연 commit은 이미 지난 위치에서 누락되거나 뒤 페이지에 나타날 수 있다. 완전 고정 snapshot을 보장하지 않으며 명시 새 조회가 필요하다.
- 30초는 page callback 진입 이후 페이지 소유 처리 예산이다. 기존 인증 pool/BEGIN·진행 중 DB query 정착/rollback/release를 포함한 전체 응답30초 SLA가 아니다.
- 실제 DB/SQL·RLS/권한/회원/정책·키·서비스·Agent·OS/제품네트워크/실자료/파일 조사·served 브라우저·사용자 인수는 NOT_RUN. 새 SQL/DDL/migration0, 임시 QA 자원0, 최종 본인 live0.
- 실제 검증된 증거→ACCEPTED, 후속 실제 Agent 배정·실행, native 위임·타사용자 HE 정책 생산은 별도 미완료다.
- rollback은 이8 source 변경을 기준4e0와 대조해 정상 revert한다. 기존 저장 검수·원문·사용자 dirty/보호3에는 적용하지 않는다.
- 정확 checkpoint/private SHA는 WORK_STATUS 후속 기록을 따른다. main/PR/merge/배포0.

참고: Node24의 ServerResponse close와 IncomingMessage 이벤트 구분은 [공식 HTTP 문서](https://nodejs.org/docs/latest-v24.x/api/http.html)를 확인했다. 이 문서와 합성 handler 시험을 실제 네트워크 재현으로 취급하지 않는다.
