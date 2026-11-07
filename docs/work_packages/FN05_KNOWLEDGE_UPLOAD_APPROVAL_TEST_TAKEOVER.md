# FN05/UI10 합성 시험 Main 인수

- 근거: 동일 DOM fixture 계약/최종 관측 준비 누락 3회. 원 FAIL c1a9c5(2PASS4FAIL/15023.6321ms),ea2b4b(3PASS3FAIL/7105.7941ms),5e3bc5(4PASS2FAIL/12956.1426ms)를 보존한다. 기존 App PASS는 최종 UI08 정산을 확인하지 못한 제한 증거다.
- 단일 작성자 fn05_share_request_impl 중단/작성 권한 회수. Main은 시험 harness 한 파일만 순차 인수하며 제품4·기존 테스트·판정 기준·timeout/skip은 변경하지 않는다.
- 현재 test3AF0BF2E7C6E07CDBAD13399E6DAA522A897A3717678BE10E0F71C32C67BB0EB/harness4101DD6D84B61FA8998EF6289B086F710091BD260429C5B52E4CD371C94AF77A.
- 원인: 기존 sendApprovalCommand는 decide receipt decision에서 id/decidedAt을 뺀 snapshot hash를 대조한다. 서버 ProjectApprovals.decide도 decision 본문과 data.ref를 분리한다. 그러나 합성 harness는 GET용 decision.ref를 decide receipt 본문 안에도 중첩 반환하여 RESPONSE_INVALID가 발생한다(Main98ab3d/b27512).
- 허용 수정: tests/browser/UI10/knowledge-upload-approval-dom-harness.tsx의 decideApproval 응답 분기 한 곳에서 ref를 destructure하고 나머지 decision 본문만 반환한다. UI08 기존 validator·제품 코드·명령/승인 의미는 그대로다.
- RED는 강화된 실제 App UI08 정산 case 실패5e3bc5이며 기존 검사 완화 없이 같은6사례를 재검증한다. 다른3 DOM 사례와 SSR은 3회차 PASS였으나 harness 공유 변경 영향으로 같은 파일 전체를 최종1회 실행한다. type/diff/보호 자료·독립 검수 후 source checkpoint로 보존한다. 실제 DB/서비스/Agent/Secret/실제 승인0.
- QA3회차8ff819: 등록 root 소유228files80dirs16075515bytes만 회수, a43013 별도 root부재/profile0. 재생성 직전 동일 등록 경로 부재/owner/link/profile0을 새로 확인한다.
