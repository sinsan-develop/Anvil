# FN05/UI10 새 지식 본문 업로드 일회 승인 소비선 결과

- 현재 상태: **한정 소스 구현·검수 완료 / 실제 DB·정식 served·전체 FN05/UI10·Stage·계획 미완료**
- 작성자 제출 당시 상태: INCOMPLETE / 실제 DOM 실패 후 Main 재검증 전(아래 원기록 보존)
- 기준: fa913f857aaaa0a57466e5887076483704cb4e89, WI FN05_KNOWLEDGE_UPLOAD_APPROVAL_IMPLEMENTATION.md SHA 3F3D69D15AC6AD03D8D91A09DC49D8F383447B9145EFF221C762D41610EFE085, 정확 허용8.
- 새 지식 본문 uploadArtifact의 기존 일회 승인 요청·UI08 별도 결정·현재 조회·명시 결박·같은 bytes/hash/command 재확인만 연결한다. 후속 saveKnowledge는 별도 명령이며 approvalRef:null이다. 대화 업로드·공유요청 완료코드·기존시험은 수정하지 않았다.
- 실제 DB/서버 API/SQL/정책/서비스/Secret/Agent 변경0. 실제 승인·업로드·저장 동작은 합성 API 검증이며 정식 served/DB 인수 증거가 아니다. author actualDOM/QA 실행0, Main 실제 DOM 실행은 아래 실패와 별도 정리로 기록한다.

## TDD·기존 동작 증거

- author 182272: 신규 unit11 수집/PASS1/FAIL10/skip0/cancel0, 188.4732ms, exit1. 기본 null 양성1은 PASS, helper 부재9와 늦은 업로드 JSON 뒤 checkpoint1!==0 반례1은 RED. Main 72e737 fresh11: PASS1/FAIL10, 188.992ms, exit1.
- 독립 scope 반례1을 append했다. 원 upload에서 candidateCommandId/actionScope를 독립 계산하고, command/payloadHash/subject/client/control/baseline/environment/target을 일관되게 재해시한 승인 응답도 결박하지 않도록 검사한다. Main 5236f5 fresh12: PASS1/FAIL11, 196.5515ms. 승인 준비 결과를 그대로 expected에 복사하지 않는다.
- author 41e860 SSR: 실제 KnowledgePage에 editor 소비선이 없어 1FAIL, 811.1383ms, exit1. Main 291baa fresh SSR1 FAIL, 656.5267ms. 모두 write:false 메모리 SSR, browser/QA 자원0.
- author 26b26e 집중 unit12 PASS, 257.2417ms; efab96 SSR1 PASS, 702.7478ms; f8bebb 기존 knowledge-api/conversation-upload 직접회귀13 PASS, 256.7983ms. 각 exit0/skip0/cancel0. API는 upload nonnull→save 명시 null, upload/save별 원명령, consumed exact hash, 이탈 뒤 checkpoint0을 확인했다.
- 신규 시험 타입 오류6건(좁은 failure 추론2·의도적 environmentRef 변조1·DOM label/callback3)은 타입 표기만 교정했다. 223724는 표기를 역변환하면 unit04645/DOM678C raw와 정확히 일치함을 확인했다. 원11 raw3C94는 658131에서 append 전 prefix와 동일했고, 이후 타입 표기로 바뀐 raw는 별도로 보존한다. assertion/실행 기대 변경0. 43dca5 type exit0.
- 독립 품질 C0/I0/M1 중 안내 문구 한 곳을 대화 저장→지식 저장으로 보정했다(d90e5c/editor9DC66EF8). 동작 변경0.
- Main 87e24b: 신규12+기존13 단일25PASS, 281.0955ms, type de0045 exit0. 이 결과가 이후 실제 DOM 실패를 무효화하지 않는다.

정확 직접 명령:

```powershell
node --test --test-reporter=spec tests/unit/FN05/knowledge-upload-approval.test.ts
node --test --test-reporter=spec --test-name-pattern="^SSR " tests/browser/UI10/knowledge-upload-approval-dom.test.ts
node --test --test-reporter=spec tests/unit/FN05/knowledge-api.test.ts tests/unit/FN05/conversation-upload-approval.test.ts
node node_modules/typescript/bin/tsc --noEmit -p tsconfig.base.json
```

## 실제 DOM 최초 실패와 정리

- Main afcbd7→6641/c1a9c5: tests6/PASS2/FAIL4(SSR+App 정상 PASS, 나머지3 child FAIL+parent), 15023.6321ms, exit1. child2/3은 qa.approve의 null.requestRef TypeError, child4는 빠른 거절 뒤 수정 버튼 부재 timeout10000. 원 FAIL을 보존한다.
- Main 0dd962: 정상 종료 뒤 등록 root owner SINSAN cyhuh, 228files/80dirs/16099776bytes, link/escape0/profile0을 확인하고 정확 회수했다. b4d94f 별도 root 부재/profile0. author의 실제 DOM 재실행은 0이다.
- Main preflight shell 자체 일치 검사 ab13f7는 9ea66d에서 현재 pwsh만 확인하고, 205037에서 actual browser0·owner/raw를 확인해 정정했다. 실제 자원 생성 전 도구 검사 문제이며 제품 실패로 합치지 않는다.

## 원인 분리와 한정 보완

- PAGE/APP는 같은 body seed·actor/client/project/control7을 사용하고 요청 만료는 now+60초, 정책 만료는 now+300초다. 날짜/신원 불일치 근거는 없었다.
- 시험 경합: request(page)는 click까지만 await했다. PAGE child2/3은 저장 완료 전에 qa.approve()를 호출할 수 있었고, APP 정상 사례만 별도로 저장 확인을 기다렸다. 시험 helper를 SAVED/REJECTED로 나눠 실제 requestApproval 호출1과 완료 상태·원 upload 전체 불변·업로드 추가0을 기다리도록 강화했다. REJECTED는 빠른422·수정 버튼 visible/enabled·request pending/실패422/uncertain:false를 그대로 요구한다. timeout/skip 완화0.
- 제품 상태 전달: editor24/25는 pending→uncertain 연속 functional updater를 호출한다. Page55~57의 adapter는 saveOwner.current를 갱신하지 않아 같은 old buffer에 두 updater를 평가했고, 두 번째 CAS 및 catch의 거절 정보가 누락될 수 있었다. 성공의 commandId 기반 최종 정산이 통과하는 것과 모순되지 않는다. Main c8698b도 기준 ref 미갱신을 확인했다.

정확 제품 diff:

```diff
- saveOwned.current.add(next);onChange(next);
+ saveOwned.current.add(next);saveOwner.current=next;onChange(next);
```

- Page의 자체 소유 next 발행 한 곳만 동기 ref 반영했다. actor/client/project/epoch/owned guard는 유지하고 외부 buffer 교체·지연 응답 거절을 바꾸지 않았다. 다른 제품3/신규unit/harness는 동결했다.
- DOM request helper의 기본 SAVED는 저장 확인/qa.view 준비, REJECTED는 오류/수정 가능 상태를 명시 관측한다. child4의 호출1만 REJECTED 인자를 추가했다. 기존 정상·유실·후속null·ABA 기대는 유지한다.
- author bd9985 type exit0. 이 한정 보완 뒤 unit25·SSR·actualDOM은 반복하지 않았다. Main이 실제 DOM 재실행으로 영향을 검증한다.

## 현재 동결 파일 지문

- `apps/web/src/features/knowledge/api.ts`: `74BD47F41AC67EE9DC977A71E59FB3F1D67D259EA6A4967C41308192919B250E`
- `apps/web/src/features/knowledge/KnowledgePage.tsx`: `2073E8D3AF8A985989AAEF96CAAACB82EFCC757F5076F21B4EA1BDDCBB3DC444`
- `apps/web/src/features/knowledge/knowledge-upload-approval.ts`: `FA1978071B6B7CD57E5D21D2FC99453CDB996B910FCA23FDBE2B3FE218D19375`
- `apps/web/src/features/knowledge/KnowledgeUploadApprovalEditor.tsx`: `9DC66EF8651AAAD32F0080BC292CDC9237F12465C3852BA0E9E5EF074B60D70D`
- `tests/unit/FN05/knowledge-upload-approval.test.ts`: `C8BA75CDC718C4BA0E4DF6BC0EF640497244AD0DFCDE82ECB26A71141F2502DA`
- `tests/browser/UI10/knowledge-upload-approval-dom.test.ts`: `17C79E8A8432F08FEFAA62A977F3A3A928A0D8AC89552544CBAA5A43E7BB8061`
- `tests/browser/UI10/knowledge-upload-approval-dom-harness.tsx`: `FA31CFCC2434419B93DC0E7F1E32E15D92A6F7F99FF064DC84526E1CD9CA29C1`

- 이전 Page raw AD914732, DOM raw81295C0D를 위 한정 diff의 직전 기준으로 보존한다. 다른5 지문은 동일했다. 결과서 자기 지문은 제출 메시지에 별도 기록한다.
- 확인 중 초기 원11 prefix 비교는 두 개행 separator 가정 오류로 1회 실패(97cdd5)했고, 658131에서 append 경계를 정확히 찾아 raw 동일을 확인했다. 파일 변조나 기능 실패로 세지 않는다. 이번 Page/helper 보완의 도구·수집 오류0, 실행 중 handle0.

## Main 최종 검증 전 작성자 제출 당시 미검증·rollback·다음

- 실제 DOM 보완 결과, 실제 DB 승인/RLS/권한/소비·정식 served·사용자 인수 NOT_RUN. 원문 bytes/hash·명령 결박·유실/ABA는 현재까지 실행한 합성 범위만 증명한다. 전체 FN05/UI10/Stage/계획 완료 아님.
- 실제 DB/정책/서비스 변경이 없어 실행 환경 rollback은 발생하지 않았다. Main이 허용8의 정확 diff와 기준 commit을 사용해 source rollback/통합을 검토하며 보호 자료·무관 dirty는 유지한다.
- 다음: Main fresh 실제 DOM 및 scoped 품질 검수→필요 보완→결과/정리 기록→정확 private checkpoint. Main 소유 WORK_STATUS/WORK_PLAN/WI는 이 담당자가 수정하지 않는다.


## Main 최종 판정·실패 보존

- 판정: 기존 계약의 새 지식 원문 uploadArtifact 일회 승인 소비선 source-only 검수 완료. 실제 DB·정식 served·사용자 인수와 전체 FN05/UI10/Stage/WORK_PLAN은 미완료. 제품4는 담당 구현, Main 제품 수정0·시험 harness 한 분기만 3회 동일 준비 오류 후 인수했다.
- Main 87e24b 신규12+직접회귀13 단일25PASS/281.0955ms/exit0·de0045 type0. 이후 Page 상태 ref 한 곳 보완은 아래 실제 DOM으로 검증했다. 006ab4/14bdd4 최종 type exit0. 변경 없는 단위25는 반복하지 않았다.
- 원 DOM2회차 ea2b4b: 6수집3PASS3FAIL/7105.7941ms, 빠른422·유실·닫기 제품 I1 해소 확인. 정리c3477d 186files59dirs14702229bytes/별도0fc438 root부재·profile0.
- 원 DOM3회차 4d504e→5e3bc5: 6수집4PASS2FAIL/12956.1426ms. 강화된 App UI08 정산은 RESPONSE_INVALID/v1 PENDING. 앞선 App PASS는 내부 view만 관측하여 실제 결정 정산을 확인하지 못한 제한 증거로 보존한다. 정리8ff819 228files80dirs16075515bytes/별도a43013 부재·profile0.
- 동일 DOM fixture 계약/최종 관측 준비 누락3회로 담당 중단·시험 write 회수/인수문서 작성 f97bec. Main98ab3d/b27512가 실제 서버/API의 ref와 결정 본문 분리 계약을 대조했다. fixture만 GET용 decision.ref를 POST 본문에 중첩 반환하여 hash 거절이 발생했다. Main762226은 허용 harness 분기1곳만 ref를 destructure, 제품 validator/검사 기대/timeout/skip은 불변. 독립 scoped C0/I0.
- 최종 Main052082: 같은 테스트 파일의 SSR1+DOM 부모1/하위4=6수집6PASS/FAIL0/skip0/cancel0/todo0·7460.5211ms/exit0. 실제 React App→UI08 결정의 API 응답검증/현재 v2 APPROVED/재조회→후보복귀·원명령 결박→명시 재개·upload nonnull/save null, 소비·유실 정확 재확인, actor/client/project/control ABA, 거절수정·요청 유실/닫기 보호를 합성 transport에서 확인했다. root 공통 CSS 포함, 실제 서비스/DB 증거는 아니다.
- 생성 전 2d9c63 root부재/ownerSINSANcyhuh/link0/profile0. 최종1a9537 소유186files59dirs14705929bytes/linkescape0/profile0 정확 정리, 9f8aec 별도 root부재/profile0. QA4회 모두 자원 회수·별도 부재 확인, 기존 사용자/서버 자원 변경0.
- 실제 DB/SQL/RLS·승인 소비 권한 집행·정식 API/Web·실제 Agent/비용·사용자 인수 NOT_RUN. 기존 계약·기준을 낮추거나 테스트 PASS를 실제 기능 배포로 승격하지 않는다. rollback은 승인 범위 source diff만, 실제 환경 변경0.

### 최종 동결 코드·시험7 raw

- `apps/web/src/features/knowledge/api.ts`: `74BD47F41AC67EE9DC977A71E59FB3F1D67D259EA6A4967C41308192919B250E`
- `apps/web/src/features/knowledge/KnowledgePage.tsx`: `2073E8D3AF8A985989AAEF96CAAACB82EFCC757F5076F21B4EA1BDDCBB3DC444`
- `apps/web/src/features/knowledge/knowledge-upload-approval.ts`: `FA1978071B6B7CD57E5D21D2FC99453CDB996B910FCA23FDBE2B3FE218D19375`
- `apps/web/src/features/knowledge/KnowledgeUploadApprovalEditor.tsx`: `9DC66EF8651AAAD32F0080BC292CDC9237F12465C3852BA0E9E5EF074B60D70D`
- `tests/unit/FN05/knowledge-upload-approval.test.ts`: `C8BA75CDC718C4BA0E4DF6BC0EF640497244AD0DFCDE82ECB26A71141F2502DA`
- `tests/browser/UI10/knowledge-upload-approval-dom.test.ts`: `3AF0BF2E7C6E07CDBAD13399E6DAA522A897A3717678BE10E0F71C32C67BB0EB`
- `tests/browser/UI10/knowledge-upload-approval-dom-harness.tsx`: `BFEC8F6E2AB2A87E38D0F104A6F68199F3D9F2CEEC9CCAD3DD9DD1A16BCE03BD`
