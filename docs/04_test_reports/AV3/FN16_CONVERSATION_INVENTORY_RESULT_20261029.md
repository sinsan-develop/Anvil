# FN16 대화 원문 참조·정정 이력 수집 결과

## 판정
대화 자료군 내부 metadata 수집 source·합성검증 완료. 전체 FN16·백업·복원·작업계획 완료는 아니다. 실제 키·DB·서비스·원문 파일은 변경하거나 읽지 않았다.

## 기준과 변경
- 기준 branch codex/av3-stage-b, 부모 81a509afbc4ca44fa76888dd10bc235342e3a3b2.
- WI docs/work_packages/FN16_CONVERSATION_INVENTORY_SOURCE_IMPLEMENTATION_20261029.md SHA256 D835B90ECA17A4F62EB458BAEA938A767A1A69AF3090CDBC47897B0627F09B99.
- 기존 fn16_primary 단독 writer, Main 검수·통합, fn16_review 독립 읽기. 신규 제품1·시험2, 기존 제품 변경0. 동시 writer0.
- conversation-inventory.ts SHA256 7115F0FF13DBB7B1F8B20216F1734AE2355194FDD19F83EF1B17795E0D076B50.
- conversation-inventory.test.ts SHA256 CD9532053747D33B90B835E1FDE29E8C88DD6152E1ED2FB74A8535E8A6711BCE.
- conversation-inventory-schema.test.ts SHA256 F05437F3749DFC933E863E8F1401F0F4FD224E75D2E003075DA04477A26404DA.

## 실제 동작과 한계
conversations/conversation_messages 및 정확 참조된 artifacts를 명시 열·200건 keyset·SQL payload 크기 제한으로 읽는다. 같은 project의 순서 1..head, 작성자/마지막 명령 내부 결박, 같은 대화의 선행 reply/정정 exact hash, 분리 열과 원 snapshot hash를 대조한다. 원 지시와 정정 이력은 모두 남기며 실행 지시로 해석하지 않는다.
원문은 ID/크기/hash/mediaType·격리/검사 상태만 수집한다. 중복 원문은 용량·개수만 한번 계산한다. 원 snapshot hash와 사용자 식별자를 제외한 metadata projectionHash는 구분한다. 전체 contentHash는 projectId/conversations/messages/artifacts/issues/externalDependencies의 canonical hash이며 관측시각과 usage는 제외한다.
시작/종료 현재 OWNER·세션·credential 세대와 최소 기한을 별도 RC로 확인하고, 자료는 단일 RO RR snapshot에서 수집한다. 자료 transaction 반납 후 최종 auth/COMMIT 완료까지 기한·취소를 검사한다. BEGIN/rollback 불명은 정상 client 재사용 없이 503이다. 기존 pool/auth 잠금 대기 전체의 강제 시간 상한은 이번 구현이 보장하지 않는다.
명령 증빙은 exact COMMAND ID와 NOT_PERFORMED 의존으로 남긴다. 격리·UNKNOWN을 안전·검증 성공으로 승격하지 않는다. blobVerification=NOT_PERFORMED, fullProjectCoverage=false, restorable=false. 해당 내부 함수는 실제 route/job/UI에 연결하지 않았다.

## 검증 증거
- Main 64eb9c: node --experimental-strip-types --test tests/unit/FN16/conversation-inventory.test.ts tests/unit/FN16/conversation-inventory-schema.test.ts → 구현 전 exit1, schema1 PASS/제품부재13 FAIL, skip0, 260.0287ms.
- Developer 최초1265a9: 13PASS/1FAIL, 정적 검사에서 SQL OFFSET이 아닌 지역변수 offset을 감지했다. SQL/기대값은 유지하고 batchStart로 이름만 정리했다. 144c72: 14PASS/skip0/482.4627ms, type/diff0. 시험 두 파일 불변.
- Main 5a291b: 위 동일 신규 명령 → exit0, 14PASS/0FAIL/skip0, 459.3723ms. npm run typecheck와 git diff --check도 exit0. 정상2대화3메시지·201대화202메시지 pagination, 변조/누락/정정 scope, 격리, 한도, 최종 권한/세대·기한·취소/회수를 확인했다.
- 기존 reviewer WI/TEST_ONLY/동결 제품 각 C0/I0/M0. Main은 e3a37f/9f27f7로 전체 신규 제품을 직접 읽었다. PostgreSQL bigint canonical decimal·안전정수, JSON timestamp 투영도 코드 대조했다.
- 기존 문서/원문 32검증은 source 불변으로 재실행하지 않았다. 기존 기능 영향은 신규 내부 모듈 추가 및 타입 검사 범위에 한정한다.

## 오류·미검증·다음 조치
제품 정식 실패 인수0. 지역변수 정적 오탐1은 보완했고 원 결과를 보존했다. Main 읽기 PATH_NOT_FOUND1과 sandbox Git 인식 실패1은 WORK_STATUS에 원문·교정 근거를 기록했다.
실제 PG 구문/RLS/동시성·원문 FS·키·서비스·전체 archive/복원·화면·사용자 인수는 NOT_RUN이다. schema 시험은 migration 원문 대조일 뿐이다. 실제 P03/R2 실행을 재사용하지 않았다.
다음은 동일 승인 내 지식·헌법 버전/정정/검토/적용 이력 수집이다. 공유요청의 본인 조회 범위를 확대하지 않는다. 복구는 신규 내부 함수 호출선이 없으므로 게시 commit의 해당 변경만 정상 revert할 수 있으며 데이터 복구 작업은 없다. 보호 미추적 자료는 stage/삭제하지 않는다.
