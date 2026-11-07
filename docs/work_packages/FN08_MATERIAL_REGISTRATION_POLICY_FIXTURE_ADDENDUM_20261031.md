# FN08 지속등록 — 기존 정책 fixture 보완 부록

상태 MAIN_RECONFIRMED_NON_SEMANTIC. 직접승인 FB59E8C7A040D69CF9D11D8E753A3F5573647BE430E8A95E950EC2BABACABE6C, 원WI490C5E0D839EC380B54CCD2870FC2CDD133AC0290CB7E8B2FCF5A4ECFC36D7F6와 부록5FE4F963A3594772141034481A013C9CD6966E5A65EDDAFEE2C46558AED5235D를 보존한다.

## 이유와 정확 범위

최종후보9e3a9c의 107조건 중 기존 PGfixture6이 runtime policy 원증빙검사에서 실패했다. control a77415d1의 원시험을 메모리 TS-strip로 대조한 0fcf9d에서도 같은6이 실패했다. 이번 제품회귀나 이번 PASS로 소급하지 않는다. 추가 제품기능·계약·검증기준 변경은 없다.

기존 허용9번째 tests/unit/FN08/execution-instruction-queue.test.ts 현재 SHA256 BDED4429ECA1A8B58C092CB1AAA19C4C47FA59AD9CB86E77444C0E7299275FF2의 pgInstructionStoreFixture 내 policyRow생성·permissionPolicyRef 확정 직후(현재77~78행)에 한정한다. 함수전체·다른fixture·다른파일 수정은 허용하지 않는다.

현재 runtime-policy 판독기가 이미 요구하는 원명령·영수증·감사 증빙만 완전하게 구성한다. 내부 command_id/server_command_id, expected_version0, operation_id, authorization_receipt_id, policy_ref, approval_consumption_id/payload_ref null, approval_rows[], 원 result_ref의 commandId/operationId/target/ref.version을 결박한다. receipt_rows1과 audit_rows1은 원 PROJECT·HUMAN subject/actor/client·정책·target·operationId/internalcommand 및 동일 scopeDigest를 사용한다. digest는 기존 판독기의 pid/actor/client/controlGeneration/requestHash/policyRef/targetRef 계약대로 계산한다. 새 권위나 허가를 만들지 않는다.

## 검증·제외

기존6 실패원문·기준선 대조는 보존하고 수정된 해당6부터 GREEN을 확인한다. 기존 단언·음성조건·제품guard·기대값·한도·false flags는 변경하지 않는다. 수정이 영향을 준 fixture 범위 외 전체 반복검사는 하지 않는다. 최종 동결 뒤 Main 선택6파일·type/noEmit·diff 및 독립 fixture diff 검수로 통합한다.

동일 기존 Primary만 writer, Main은 동일코드 수정0. 실제 DB·SQL·권한·키·사용자파일 조사·서비스·Agent·기존 프로젝트 차단해제0이다. SQL 정적 C0/I0는 실제 PG 검증을 대신하지 않는다.
