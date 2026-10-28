# FN05/UI10 새 지식 본문 업로드 일회 승인 소비선

기준: 기존 WORK_PLAN/FUNCTION_WORK FN05, SCREEN_WORK UI10 및 INTERFACES uploadArtifact 일회 승인 계약. source baseline fa913f857aaaa0a57466e5887076483704cb4e89. 이전 대화 업로드 승인 연결과 공유요청 A안은 완료범위로 보존·재구현하지 않는다.

## 범위
새 지식 작성의 uploadArtifact가 명확한 승인 필요 412로 거절된 경우에만 기존 승인 API를 사용해 요청→UI08 별도 결정→명시 원명령 결박→같은 bytes/hash/command 재확인을 연결한다. 후속 saveKnowledge는 별도 명령이고 반드시 approvalRef:null을 유지한다. 다른 자동승인/일회권한 확대·새 API/서버/SQL/정책·실제 DB/Agent/서비스/비밀 변경0. 업로드 후 save 거절을 업로드 승인으로 우회하지 않는다. 기본 null 동작과 기존 호출자 호환을 유지한다.

## 정확 허용8
- `apps/web/src/features/knowledge/api.ts`
- `apps/web/src/features/knowledge/KnowledgePage.tsx`
- `apps/web/src/features/knowledge/knowledge-upload-approval.ts`
- `apps/web/src/features/knowledge/KnowledgeUploadApprovalEditor.tsx`
- `tests/unit/FN05/knowledge-upload-approval.test.ts`
- `tests/browser/UI10/knowledge-upload-approval-dom.test.ts`
- `tests/browser/UI10/knowledge-upload-approval-dom-harness.tsx`
- `docs/04_test_reports/AV3/FN05_KNOWLEDGE_UPLOAD_APPROVAL_RESULT.md`

기존 raw:
apps/web/src/features/knowledge/api.ts SHA256 9A594FB0FC7E64646907AF6DD0E45F45493455A2B7A64293D7E8D7B3F20F2F35
apps/web/src/features/knowledge/KnowledgePage.tsx SHA256 83DA518BDB52B7F299E7887D3BFFD1621A22FB93516531737D58288F7B4874FE

## 순서
단일 담당 fn05_share_request_impl. 먼저 신규 unit/DOM 시험만 작성·정확 RED 제출, Main 실제 RED 확인 전 제품4파일 수정 금지. 기존 unit/DOM 시험 변경·삭제0. 메모리/SSR 가짜 API 검증은 합성으로 구분. 이후 같은 원명령 보존·결과유실/최종소비·거절/만료·actor/client/project/control ABA·늦은 JSON·닫기/이탈/복귀·전송 전 입력변경 대조를 검사한다. 불명 결과/미확인 pending을 새 명령이나 닫기로 유실시키지 않는다. 의미없는 timeout 연장/skip/원 기대값 완화0.

Main 제품write0, 같은 파일 동시writer0, 보호12와 기존9beb/3bc8 작업 보존. 기존 대화 승인 helper/editor는 읽기 참고만. 결과에 정확 명령·exit·원FAIL·수정전후 diff·미검증·rollback을 남긴다. 새 실제 DOM 자원 생성은 Main 사전등록·GO 뒤만, 현재 환경생성0. 전체 FN05/UI10/Stage/계획완료 또는 실DB/served 인수라고 하지 않는다.
