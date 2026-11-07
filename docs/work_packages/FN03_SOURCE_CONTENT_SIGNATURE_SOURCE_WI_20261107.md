# FN03 SOURCE_CONTENT 서명 수학적 검산 구현 지시서

- 상태 MAIN_INTERNAL_SOURCE_GO. 기존 B 병렬 source/codec·기본 미등록·합성 검증 승인 안의 내부 누락 보완이다.
- 기준 HEAD fca9bf8db2646e70b6126b32fff4643f917140c7. 직접 근거 FN03_SOURCE_CONTENT_HASH_DELTA_CANDIDATE.md §3/§6/§7/§11와 WORK_STATUS의 2026-10-22 B SOURCE 채택. §13.4 관리 원문/현재 권위는 미채택 유지한다.
- 기존 Primary 단일 writer, Main 관리·검수·통합, 기존 별도 담당자 독립 리뷰. 다른 작업자·현황·보호3 보존.

## 정확 허용2

- 신규 apps/server/modules/connections/source-content-proof.ts
- 신규 tests/unit/FN03/source-content-proof.test.ts

부재·HEAD·기존 parser/hash/보호3를 먼저 확인한다. 기존 proof-input·codec·등록 verifier·서버 route·SQL·정책·실행 포트는 수정하지 않는다.

## 동작과 의미

기존 source-content-exchange-proof-input.ts의 readSourceContentPreflightProofInputCandidate/readSourceContentChallengeProofInputCandidate, source-content-report-proof-input.ts의 readSourceContentReportProofInputCandidate가 만든 목적별 exact proofBytes와 canonical 64바이트 signatureBytes를 소비한다. expected/context/now를 원 reader로 검산하며 임의 proofBytes/성공 verifier callback을 입력받지 않는다. 고정 함수별 목적은 preflight/challenge/report로 나누고 원 서명 domain·nonce·refs·hash·기한을 그대로 적용한다.

registration-proof.ts의 readHostPublicKey/publicKeyFingerprint를 재사용해 canonical DER SPKI·EC prime256v1/P256·정확 fingerprint를 대조한다. 실제 node:crypto.verify의 sha256·ieee-p1363로 수학적 서명만 판정한다. key 조회나 신뢰 등록/새 key/credential/permit 인증·nonce 소비·DB 저장·영수증·observer/OS 검증·Artifact/원문 수집을 하지 않는다.

반환은 서명 수학적 진위 한 항목과 현재 권위/등록/관측/실행/LINK가 미검증 또는 false임을 명시하는 내부 결과다. 유효 서명을 currentAuthorityVerified·executionAuthorized·linkAuthorized true나 실제 파일 관측 성공으로 승격하지 않는다. 함수/반환 이름에 현재 실행 허가를 암시하지 않는다. invalid는 고정 오류만 반환하고 signature/key/raw 예외를 노출하지 않는다. 모든 입력은 기존 원형을 보존하며 caller 변경으로 서명 원문과 비교 원문이 달라지지 않아야 한다.

## 검수

실제 node:crypto로 기존 SOURCE_CONTENT의 정상 preflight/challenge/report 서명을 만든 합성 메모리 자료를 사용한다. 기존 동일 codec이 만드는 bytes로만 sign하고 검산한다. 테스트의 키는 실제 설치/사용자 키가 아닌 메모리 전용 합성이며 파일에 저장/출력하지 않는다.

모듈/기능 부재 RED 뒤 정상3 종류와 원 bytes/domain 불변, wrong key/fingerprint·P384/RSA 등 곡선/형식·비정규 SPKI·base64·길이·변조 signature/body·purpose 교차/nonce/ref/기한 오염·input getter/Proxy/변이의 기존 parser 거절·서명 성공이어도 false 경계를 검증한다. 실제 실제등록/OS/현재 권위가 없는 양성도 서명 수학적 유효 범위에서만 통과다. 기존 직접 인접 proof-input/codec 검사를 필요한 범위만 실행하고 type/diff를 확인한다. 기존 수백 검사나 unchanged build를 반복하지 않는다.

## 금지·반환

실제 키·DB·권한·서비스·Agent/SDK·실자료/백업대상 파일 조사·네트워크·P03R3/J3/컴파일·원격/PR/병합0. 새 함수의 route/port 등록0. 범위 밖 소스가 필요하면 임의 확장하지 말고 Main에 정확 근거를 반환한다. raw 지문·diff·RED/GREEN/정확 명령/exit·오류횟수·미검증·live0와 writer 반환을 보고한다. 이 단위는 FN03 보호 관측 공급자나 전체 계획 완료가 아니다.
