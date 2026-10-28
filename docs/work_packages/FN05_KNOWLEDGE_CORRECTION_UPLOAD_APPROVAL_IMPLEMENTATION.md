# FN05/UI10 지식 정정 원문 업로드 일회 승인 연결

기준 source32d34b524771859b854c0b0486fa020391e73456. 기존 FN05/UI10 지식 정정과 INTERFACES uploadArtifact 일회 승인 계약의 UI 소비선 누락만 보완한다. 새 공개 API/SQL/권한 계약0.

## 허용8
- `apps/web/src/features/knowledge/correction-api.ts`
- `apps/web/src/features/knowledge/KnowledgeCorrectionForm.tsx`
- `apps/web/src/features/knowledge/knowledge-correction-upload-approval.ts`
- `apps/web/src/features/knowledge/KnowledgeCorrectionUploadApprovalEditor.tsx`
- `tests/unit/FN05/knowledge-correction-upload-approval.test.ts`
- `tests/browser/UI10/knowledge-correction-upload-approval-dom.test.ts`
- `tests/browser/UI10/knowledge-correction-upload-approval-dom-harness.tsx`
- `docs/04_test_reports/AV3/FN05_KNOWLEDGE_CORRECTION_UPLOAD_APPROVAL_RESULT.md`

기존 raw2:
apps/web/src/features/knowledge/correction-api.ts E590A2A2C43A2045211E34A38470FA115D4F894235AB93D9B5B387D15024EFBD
apps/web/src/features/knowledge/KnowledgeCorrectionForm.tsx B2C9E617866008A781380BBCA2192B2C401A477820DA7812635B15092E7210BD

## 처리·제외
정정 원문 uploadArtifact의 명확 APPROVAL_REQUIRED412 이후만 기존 requestApproval/보호GET/UI08별도결정/명시결박/같은 원command·bytes/hash 재확인. 현재actor/client/project/control/기준 targetRef/input·최단기한·현재정책·consumed exacthash만 허용한다. 후속correctKnowledge는 별도 명령·approvalRef:null을 명시 유지하며,정정 targetId/expectedVersion/기준ref와 원문/출처를 보존한다. 정정 명령 자체 승인미지원은그대로거절. 기본null/기존호출자·완료된새지식/대화업로드/공유코드불변. 불명pending을닫기/새명령으로버리지않고actor·client·project·control·target변경/늦은JSON뒤상태덮기·후속전송차단. 실제DB/정책/서비스/Agent/Secret/공유/기준전환0.

## 순서·최소검증
단일담당 fn05_share_request_impl,Main제품write0. TEST_ONLY 신규unit1과필요SSR/DOM2부터 작성하고 제품4는MainfreshRED후만GO. 기존tests/unit/FN05/knowledge-correction*.test.ts수정0. 정상기본null·독립scopeexpected와유효재hash변조·uploadnonnull/correctnull·target/version보존·원명령유실재확인·만료/회수/후속412전파0·늦은응답/최종상태를검증한다.
실제DOM은수정된Form/editor의정상승인업로드→정정과중요실패/문맥이탈만선택한다. UI08자체전체회귀와새지식완료시험은다시하지않는다. 기존검증된harness의POST decision.ref분리·SAVED/REJECTED정산·POST정확증가/원명령선캡처를읽어같은fixture오류반복0. 새자원은Main사전등록/GO전생성0·timeout연장/skip/기대완화0. 집중/직접기존correction회귀·type·실제DOM·독립검수·정확정리뒤source한정결과/rollback·미검증을기록한다. 실DB/정식served/전체FN05/UI10/계획완료로승격하지않는다.
