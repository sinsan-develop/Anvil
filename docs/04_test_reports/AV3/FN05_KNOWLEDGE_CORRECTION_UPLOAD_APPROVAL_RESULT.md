# FN05/UI10 지식 정정 원문 업로드 일회 승인 소비선 결과

## 현재 판정

2026-10-28, 담당 fn05_share_request_impl. 승인된 기존 계약의 지식 정정 소비선에 한해 source-only 구현·한정 검수를 완료했다. Main의 독립 실제 검증과 품질·명세 검수 결과를 아래에 분리 기록한다. 전체 FN05/UI10·Stage·작업계획 완료가 아니다.

- 기준 source: 32d34b524771859b854c0b0486fa020391e73456, 기존 codex/av3-stage-b 및 격리 workspace C:/Users/cyhuh/.codex/worktrees/av3-stage-b/Anvil에서 수행.
- 정본 WI: docs/work_packages/FN05_KNOWLEDGE_CORRECTION_UPLOAD_APPROVAL_IMPLEMENTATION.md, SHA256 77056A7AAA69C1853DF1BFC16566402949D080FF968D8040F31B9880EED8607E.
- 허용8 중 제품4·신규시험3과 본 결과서1만 담당 범위다. Main 소유 WORK_STATUS/WORK_PLAN/WI 등은 수정하지 않았다. 새 branch/worktree/commit/push를 수행하지 않았다.
- 독립 품질 C0/I0/M0, 명세 C0/I0. 아래 ABA 완료 barrier의 미검증 한계는 별도로 보존한다.
- 기존 완료된 새 지식·대화 업로드·공유요청 코드와 기존 correction 시험은 변경하지 않았다. 서버/API/SQL/권한 계약 추가0, 실제 DB·정책부여·서비스·Secret·실 Agent 실행0.

## 변경과 계약

기존 correction-api는 uploadArtifact의 approvalRef를 null로만 허용하고, 후속 correctKnowledge를 upload 명령 전개로 생성했다. 이번에는 명확한 uploadArtifact APPROVAL_REQUIRED 412 이후에만 기존 requestApproval과 보호 조회 결과를 소비하도록 연결했다. 준비·요청 저장·승인 조회 결박은 업로드를 실행하지 않으며, 별도 승인 결정 이후 명시적으로 같은 원 업로드 명령과 bytes를 재확인한다.

신규 helper는 원 pending/input·actor/client/project/control·기준 targetRef·최단 정책 기한·독립 ActionScope·명령 해시를 결박한다. 재해시한 다른 command/payload/subject/client/control/baseline/environment/target도 거절한다. 결과 유실 후에는 소비된 exact command hash의 같은 업로드만 재확인한다. 후속 correctKnowledge는 별도 commandId와 approvalRef:null을 명시하며 targetId/expectedVersion/baseRef, 기존 원문 출처와 추가 출처를 유지한다. 정정 명령 자체의 승인필요 412는 업로드 승인으로 재사용하지 않는다.

correction-api는 원문 응답 검증 후 active 확인을 통과한 경우에만 후속 정정 checkpoint를 게시하고, 최종 응답 및 해시 검증 뒤에도 active를 확인한 뒤 ref를 반환한다. Form/editor는 actor/client/project/control/targetRef·client identity·epoch와 소유 buffer를 결박한다. 연속 갱신은 owned 등록→owner.current 동기 반영→onChange 순서로 처리하여 승인 요청의 pending/uncertain/완료 갱신을 보존한다. 늦은 응답은 onChange/onSaved를 수행하지 않는다. 불명 요청/업로드는 원명령을 보존하고 닫기를 차단한다.

## 동결 파일 지문

Main b0f900은 실제 DOM 실행 전에 동일 7파일 동결을 확인했다. 이후 제품·시험 변경과 author 추가 실행은 없다.

| 파일 | SHA256 |
| --- | --- |
| apps/web/src/features/knowledge/correction-api.ts | 5E7DE07F71A84B1A989634B5283C2C1073676BDEF4395B8B3B57C00AB3CB26E5 |
| apps/web/src/features/knowledge/KnowledgeCorrectionForm.tsx | 94C324101A5D7D00C39A941AD8FD3A88B85E499013B938E84AF8742DA5158E21 |
| apps/web/src/features/knowledge/knowledge-correction-upload-approval.ts | 1A188B5EB396E2600EA5080DB44101CD6530D4D23003DD8DB76A095FED0CC02E |
| apps/web/src/features/knowledge/KnowledgeCorrectionUploadApprovalEditor.tsx | 3A7C8DD27007D6DD1CB4376BACBBBE8BD2BCD211F650DA787F59892B344CFE55 |
| tests/unit/FN05/knowledge-correction-upload-approval.test.ts | D9239B4AB5906EC1F216B1684122093A5564F80E5FEEADB6E65675D7CBE2121F |
| tests/browser/UI10/knowledge-correction-upload-approval-dom.test.ts | 91B5F88BEFD54AEA9E8A79660B53EEE4099ED3BD378F2DB8F06B9DB3D152635F |
| tests/browser/UI10/knowledge-correction-upload-approval-dom-harness.tsx | FC8ADD77659CC1BBE8BC2F67E21322D2CE46C42F69DC4EA1D3AD257ABFDCEEE3 |

기존 correction-api 기준 raw는 E590A2A2C43A2045211E34A38470FA115D4F894235AB93D9B5B387D15024EFBD, Form은 B2C9E617866008A781380BBCA2192B2C401A477820DA7812635B15092E7210BD였다. TEST_ONLY 단계에서 두 기준 raw 불변을 확인한 뒤 Main RED/GO에 따라 제품을 수정했다.

## 정확 검증 범위와 결과

아래 명령은 위 격리 workspace 기준이다. 모든 PASS는 해당 실행 범위에만 적용한다.

| 수행자·증거 | 명령/선택 | 실제 결과 |
| --- | --- | --- |
| author e30afc | node --test --test-reporter=spec tests/unit/FN05/knowledge-correction-upload-approval.test.ts | 11수집/1PASS10FAIL, skip0/cancel0/todo0, 223.7054ms, exit1. 정상 기본null PASS, helper부재8·late upload checkpoint 1≠0·late final ref 반환2 RED |
| Main e540be | 동일 신규 unit 명령 | 11수집/1PASS10FAIL, skip0/cancel0/todo0, 209.0045ms, exit1. 제품 부재/현재성 RED 독립 확인 |
| Main 93a5e6 | node --test --test-reporter=spec --test-name-pattern=^SSR tests/browser/UI10/knowledge-correction-upload-approval-dom.test.ts | SSR1FAIL, 656.4364ms, exit1. 실제 Form의 승인 editor 부재 |
| author fb348f | 신규 unit 명령 | 11PASS, 254.6313ms, exit0 |
| author 0c4df3 | node --test --test-reporter=spec tests/unit/FN05/knowledge-correction-upload-approval.test.ts tests/unit/FN05/knowledge-correction.test.ts | 신규11+기존직접회귀2 단일13PASS, skip0/cancel0/todo0, 266.5592ms, exit0 |
| author 0c4df3 | SSR 선택 명령 | 1PASS, 592.8267ms, exit0 |
| author f6283d | npm run typecheck | exit0 |
| Main 1ce229 | 위 신규11+기존correction2 단일 명령 | 13PASS, skip0, 281.342ms, exit0 |
| Main 2982ca | node node_modules/typescript/bin/tsc --noEmit -p tsconfig.base.json | exit0 |
| Main e27bb8 | ANVIL_KNOWLEDGE_CORRECTION_UPLOAD_DOM_QA=1 환경에서 node --test --test-reporter=spec tests/browser/UI10/knowledge-correction-upload-approval-dom.test.ts | SSR1+DOM부모1+하위3=tests5/PASS5FAIL0, skip0/cancel0/todo0, 6152.6897ms, exit0 |

실제 DOM은 수정한 Form/editor의 정상 승인 소비→업로드→정정 완료, 승인 요청/업로드 응답유실과 원명령 보존·불명 닫기 차단·후속 정정412의 승인 재사용 거절, 늦은 승인 JSON의 actor/client/project/control/target ABA만 선택했다. 별도 승인 결정은 검증된 합성 fixture를 사용했고 UI08 전체 회귀를 다시 실행하지 않았다. 원명령은 click 전에 캡처했으며 SAVED/LOST 및 실제 POST 증가·pending/failure/uncertain·최종 저장 상태를 관측한 뒤 비교했다. CSS는 실제 entry의 tokens.css/app.css를 같은 순서로 포함하고 root token/app-shell 및 root 12px를 확인했다. 브라우저 외부 network와 unknown synthetic 경로는 시험 기대에서 차단했다.

## 오류와 이력 보존

- 최초 author b54ad6은 11수집/0PASS11FAIL/221.4112ms/exit1이었다. 신규 fixture가 v3에 supersedesRef:null을 넣어 정상 기준·late JSON 시험3건이 RESPONSE_INVALID로 먼저 실패했다. 이 3건은 제품 기능 RED로 계산하지 않는다. 기존 knowledge-correction-source-fixture.ts를 수정 없이 읽고, 검증된 v1 기준 계약을 재사용하도록 신규 fixture만 보정했다. 이후 정상 baseline PASS와 실제 현재성 RED가 확인됐다.
- 신규 unit 원 E36091A797B5829A355C8092ED9F77D3B467F303011850292845B030EEB6C286에는 scope 변조 재해시 구간의 rest 이름 input과 hash(snapshot)이 불일치했다. 독립 I1 지적 뒤 변수명 한 곳을 snapshot으로 정합화했다. 기대·흐름 변경0, D9239B4…로 갱신하고 author 13bdf4 typecheck exit0으로 확인했다. 원 E360의 helper부재 RED가 이 잠재 ReferenceError까지 검증한 것은 아니다.
- 이전 새 지식 업로드 업무의 동일 fixture 오류3회·Main 인수 BFEC/32d34b52 이력은 그대로 보존한다. 이번 업무의 완료 결과로 이전 원 FAIL을 소급 PASS 처리하지 않는다.

## 실제 QA 자원과 정리

Main만 QA를 실행했다. author의 실제 DOM/브라우저/QA 생성은 0이다.

- 등록 root: D:/tmp/anvil-v3-knowledge-correction-upload-approval-dom-20261028-01.
- Main b0f900: fresh root 부재, owner SINSANcyhuh, link0/profile0, 동결7 지문 확인 후 실행.
- Main e27bb8: 위 실제 DOM 5PASS.
- Main eded5f: 정상 close 후 등록 root owner 확인, 186files/59dirs/14638593bytes, linkescape0/profile0 확인 후 정확 회수.
- Main 330fc5: 별도 검사에서 root 부재/profile0 확인. author는 생성·삭제·프로세스 조작을 수행하지 않았다.

## 미검증과 잔여 한계

- ABA DOM의 마지막 대기는 transport JSON settled다. 제품의 후속 hash/finally까지 완결된 barrier는 NOT_VERIFIED다. 정적 epoch 차단 및 unit active 음성과 구분하며 완결 barrier 실증으로 승격하지 않는다.
- 실제 DB/SQL/RLS·app-role 권한·서버 승인 집행/소비 원자성·privileged 동시 변경·정식 served 환경·사용자 인수는 NOT_RUN이다. 합성 HTTP/승인 fixture PASS는 실제 서버/DB의 승인 생성·결정·소비 권한을 증명하지 않는다.
- UI08 자체 전체 회귀, 완료된 새 지식/대화/공유 전체 재시험, 전체 FN05/UI10/Stage/계획은 이번 검증 범위가 아니다. 전체 완료로 표시하지 않는다.

## rollback과 다음 조치

rollback은 Main이 이 업무의 변경 경계만 확인하여 기존 correction-api/Form을 기준 source32d34b52의 두 원 raw로 복원하고, 이 업무의 신규 helper/editor·시험·본 결과서를 해당 변경 경계에서 되돌리는 방식이다. 전체 checkout/reset/clean 또는 다른 dirty·보호 파일 삭제는 수행하지 않는다. DB·정책·환경 변경은 실행하지 않아 해당 rollback은 없다.

다음 조치는 Main의 최종 diff·허용8/기존시험·보호자료 불변 확인과 승인된 소스 통합이다. 이 결과서 작성 뒤 담당 writer는 동결하며 제품/시험/환경 변경과 추가 검증을 수행하지 않는다.
