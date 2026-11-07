# FN03 SOURCE_CONTENT 서명 검산 소스 결과 — 2026-11-07

판정: **기존 B source 승인 안의 서명 수학적 검산 단위 인수**. 실제 등록·관측·문서 연결이나 전체 FN03/계획 완료가 아니다.

- 기준 HEAD fca9bf8db2646e70b6126b32fff4643f917140c7, WI FN03_SOURCE_CONTENT_SIGNATURE_SOURCE_WI_20261107.md / E3DF68D2E2DEA0BBB317AAB4246EB68C1CA3799692E2B732A9F7AC607EF7A33B.
- 기존 Primary 구현, Main 검수·직접 검사, 별도 담당자 소스/시험 독립 C0/I0/M0.
- 기존 SOURCE_CONTENT preflight/challenge/report proof-input의 exact NUL domain·bytes와 canonical DER P256 key/fingerprint를 소비해 node:crypto SHA256/P1363 서명을 검산한다. 모든 입력을 안전 복사하며 고정 오류만 낸다.
- signatureValid:true는 수학적 서명 결과뿐이다. registrationVerified/observationVerified/currentAuthorityVerified/executionAuthorized/linkAuthorized는 false다. 기본 route/포트·기존 parser/서명 목적·SQL/권한은 불변이다. report는 원 receivedAt/observeBefore 문맥을 사용하고 새 현재시각 조건을 추가하지 않는다.

| 신규 경로 | bytes | SHA256 |
|---|---:|---|
| apps/server/modules/connections/source-content-proof.ts | 3956 | 5DEE24D176830CEA4A824003E8D56432FF91005476C5707A8C9A965BA5F14E24 |
| tests/unit/FN03/source-content-proof.test.ts | 14946 | 06AEB813F51538F3D0690F97B8EB7B1AF9C80898814F3F273D669CB11360EE97 |

## 증거

- 7bb2c9는 실제 codec의 합성 서명 자료 뒤 신규 export 부재로 구조적 RED 10FAIL/skip0·230.3808ms·exit1. 기존 verifier의 행동 실패로 세지 않는다. 16f3b9 구현10PASS, da7095 최종12PASS·310.7552ms·exit0.
- Primary 인접 dbd118 37PASS·376.5169ms·exit0; 시험 literal/배열 접근 타입 진단3은 실제 scope reader로 좁혀 해결한 준비 오류1건이며 guard는 변경하지 않았다.
- Main35ac89: node --experimental-transform-types --disable-warning=ExperimentalWarning --test tests/unit/FN03/source-content-proof.test.ts tests/unit/FN03/source-content-exchange.test.ts tests/unit/FN03/source-content-report.test.ts tests/unit/FN08/source-read-proof.test.ts. 고유49PASS/0FAIL/0CANCEL/0SKIP/0TODO·378.2511ms·exit0.
- Main63636b: node node_modules/typescript/bin/tsc --noEmit -p tsconfig.base.json, exit0.
- 실제 메모리 P256 정상3·다른 key/fingerprint·P384/RSA/비정규 SPKI·서명 길이/변조·purpose/등록/SOURCE_READ 교차·whole report JSON 서명·nonce/ref/기한 오염·실패 관측 보고/과거 수신시각·getter/Proxy와 false 결과를 검산했다.
- Main bc6f61/39b663 raw/source·Git diff0 확인. Primary의 Git worktree 인식 오류 b6fa7f는 도구 오류로 분리하고 성공으로 고치지 않았다.
- 테스트 key는 메모리 합성, 저장/출력/등록0·자원 생성0·live/pending0.

## 남은 범위

실제 key lookup·등록/현재 회수·permit 인증/nonce 소비·approved observer/handle/요청·실제 OS/hash 관측 및 별도 current verification receipt가 미완료다. 기존 UNVERIFIED lineage/head를 정상 DocumentSourceObservationPort로 바꾸지 않았다. 실제 DB/권한/키/서비스/Agent/SDK·실자료 조사·외부 실행0이며 실제 증빙이 필요한 IX01~08과 전체 계획은 미완료다. FN09 정책 인계 A5579A6E9도 별도 미채택이다. 복구는 신규2의 정상 역패치이며 기존 원자료를 삭제할 이유가 없다.
