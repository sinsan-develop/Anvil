# P03 R3 고정 대상 source 결박 구현 계획

> 실행: 기존 fn16_primary_recovered 단일 writer·subagent-driven-development/TDD, Main 관리·검수·통합. 새로운 담당자/branch/worktree/자동화는 만들지 않는다.

**목표:** 이미 검수된 제한 복제 보호를 바꾸지 않고 보존 중인 R1/R2와 다른 R3 고정 대상6/candidateSHA를 제품2·기존시험3에 일치시킨다.
**구성:** 기존 닫힌 controller/shell 결과·parser의 결박과 독립 fixture만 정합. 외부 API·protocol/schema·위험/한도/실제 실행 허가 변경0.
**기술:** 기존 Node/TypeScript/node:test·기존 Git Bash 합성검사. 의존성 추가0.
**기준:** 후보 docs/contracts/P03_PG_COPY_LIMITED_RISK_R3_BINDING_CANDIDATE_20261028.md SHA94BB0D36438873994003F062A9C18ABC378E9C2382A7D617C45EE411141F0092; source 채택/직접후속 지시 binding EF21B4CBB5EB394A03EFDEFC49583DC9664EE056735BCD5D545C57362479F19C.

## 1. 허용5와 시작 지문
| 경로 | 시작 SHA256 |
| --- | --- |
| scripts/p03-pg-copy-host.ts | AF61BAF27184529505689B5BAE68ACDDFBF2E0B4406DF5D8486312F636449ABC |
| scripts/pg-recovery-copy.sh | 76952702BA93E48ACE81A879C19D0190A7CE3D4EA5A7374B0E494AD650335271 |
| tests/unit/P03/pg-recovery-copy-host.test.ts | 29902D848B7CBDF45649DAD924EF006914074BA5EF8365CC10BC682AA2DCF05F |
| tests/unit/P03/pg-recovery-copy-docker-time.test.ts | 95A87C0A3B922D92DF6B7701C7183A3D75D8D27340C3781DDFA8EBA9B756D270 |
| tests/unit/P03/pg-recovery-copy-preparation.test.ts | 40E275DBBB57F4018CEFD61682C1580FD6685BD5D84E5CC1F1C8A9411F35E782 |

업무 시작 source baseline은 Main의 이 WI control checkpoint로 고정하며 현재 문서 준비전 HEAD aaa1551aa154a906bff3df613c55449758eacd87이다. Primary는 실제 전달된 control HEAD·binding/WI hash·시작5지문을 대조한다. 다른 파일/원보호3/사용자 변경은 보존한다. Main 제품 동시 수정0, Primary commit/push0.

## 2. source 변경의 전부
- host의 FIXED_COPY에서 sourceRoot/ledgerRoot/copyVolume/toolsName/initName/copyName을 후보의 R3 literal6으로 정합하고 limitedCandidate를 후보94BB0D36의 기존 hash 표기 규칙에 맞춘다.
- shell의 strict 결과·limited 결과의 copyIdentity.name, limited parser/결과의 candidateSHA만 같은 새 결박으로 맞춘다. 결과와 parser 한쪽만 바꾸지 않는다.
- 독립 정상 fixture/grant/report/label/created-stage를 R3로 명시 정합한다. R1/R2 실패 반례의 원literal·과거candidate를 전역 replace로 바꾸지 않는다.
- 전역 replace로 protocol/policy/mode의 R1 버전 접미사를 R3로 바꾸지 않는다. 신규파일/의존성/범용arg/env/동적 대상 선택기/fallback0.

## 3. 불변 보호와 제외
- 원본 volume identity/daemon/image/Node loader와 기존 제한 검산·원본RO/사본RW/NoCopy·network none/포트0·UID/caps/rootfs·정상 cleanup/불명 보존·단발 consume/nonce/labels/fence·시간/공간/위험4는 보존한다.
- volume0의 HostConfig.Mounts 생략/[]와 별도 정확Tmpfs·첫쓰기전실제tmpfs 검산은 이미 보완·검수됐다. 새로 바꾸거나 같은122검사를 source 변경 없이 재실행하지 않는다. init/copy mount·created/started 기준 완화0.
- TEST_ONLY 동안 제품2는 시작 지문과 byte 동일해야 한다. 제품 GO는 Main의 실제 RED 확인 후 별도 발행한다.
- 실제 actual packet/grant·nonce/issuedAt/expiresAt·원격 checkout/관측·sourceRoot/ledger·volume/helper·cp/copy·신호·PG/SQL·인증/권한/Secret·서비스·Agent 실행0. 소진R1/R2/원장/사본 재사용·삭제0.
- 시험은 기존 fake runner/메모리 frame·기존 보호 합성 경로만 사용한다. Git Bash의 문법/기존 합성 frame 처리 외 실제 Docker/volume/DB/원사용자파일 접근은 금지한다. 새물리QA 경로가 필요하면 생성 전에 Main에 정확경로/수명/정리를 반환하며 임의 생성0.

## 4. TEST_ONLY — 기존 시험3만 먼저
- [ ] 승인 binding/WI·시작5지문·현재HEAD/dirty를 확인한다. 제품2 쓰기0.
- [ ] 정상 fixed/limitedCandidate/report/grant를 독립 R3 literal로 정합하고 새 선택 반례에는 r3Binding 접두사를 사용한다.
- [ ] 양성: 새R3의 고정대상/후보/controller 결과 parser·shell 결과 이름이 일치해야 한다. 현재R2 제품은 이 양성의 원binding 검사에서 실제 RED여야 한다.
- [ ] 음성: 원R1 경로/이름/candidate 거절은 그대로 보존하고 원R2 각fixed/grant 이름·candidate outer/acceptance/both 및 oldgrant 전체를 consume/첫mutation 전에 거절하도록 추가한다. 기존R2제품이 옛결박을 받는 RED도 양성실패와 구분한다.
- [ ] 생성후 oldR2 metadata 거절은 이미 copyCreated/consumed인 상태와 사본 보존/helper0을 구분한다. 생성전 실패를 생성후 cleanup 성공처럼 처리하지 않는다.
- [ ] docker-time은 독립fixed/candidate·정상report만 바꾸고 timestamp/단계 음성은 보존한다. preparation은 정상copyname만 정합하고 NUL/rawframe/metadata·한도 단언은 유지한다.
- [ ] 고정 Node로 r3Binding 선택 RED를 실행·반환하고 제품2 지문불변/시험3 최종지문·정확실패코드/단계를 제출한다. 준비/문법 실패를 결박기능 RED로 세지 않는다. Main은 같은 선택의 fresh RED와 제품 불변을 확인한다.

## 5. PRODUCT_GO 이후 — 제품2 최소 정합
- [ ] Main의 제품 GO 뒤 §2의 상수/결과/parser 결박만 수정한다. 보호·프로토콜/과거거절·기한/위험 의미변경0.
- [ ] 새R3 양성 GREEN 및 옛R1/R2의 첫consume/mutation전 거절, 생성후 oldmetadata 사본보존을 확인한다.
- [ ] 변경된 시험3의 전체 단일묶음, TypeScript·필요 Bash 문법/기존 합성 frame·LF/공백을 실행하고 정확 명령/exit/실제 count·최종5지문/diff·미검증·오류를 반환한다. 동일 검사는 새변경/실패 없으면 반복0.

명령 기본형(고정 Node, 기존 source cwd/login:false):
```
C:\Program Files\nodejs\node.exe --test --test-name-pattern=r3Binding tests/unit/P03/pg-recovery-copy-host.test.ts tests/unit/P03/pg-recovery-copy-docker-time.test.ts
C:\Program Files\nodejs\node.exe --test tests/unit/P03/pg-recovery-copy-host.test.ts tests/unit/P03/pg-recovery-copy-docker-time.test.ts tests/unit/P03/pg-recovery-copy-preparation.test.ts
C:\Program Files\nodejs\node.exe node_modules/typescript/bin/tsc --noEmit -p tsconfig.base.json
git diff --check
```
첫 선택 RED의 비선택 skip은 최종 합격이 아니다. 최종전체묶음에서 skip/cancel/todo·미해결C/I0 조건을 확인한다. 실제 Bash 실행파일/인수는 기존 preparation 시험의 검증된 경로를 사용하고 새 추측도구·다운로드/설치0이다.

## 6. 검수·통합·rollback
- Main은 수정전후 diff에서 literal6/후보SHA·결과2·parser 및 독립fixture·oldnegative만 바뀌었는지 읽는다. 기존 reviewer는 실패전consume/mutation·생성후보존·불변보호를 독립 검토한다.
- 최종 Main fresh 전체집중/타입/필요구문·LF/diff 및 최종5지문 동일·C/I0 후 같은 기존branch에 정확5source/시험+관련문서만 보존한다. 기존 통과 mount단위를 새 기능으로 재보고하지 않는다.
- rollback은 새R3 결박 diff만 후속 일반commit으로 되돌린다. 최종 mount/시각 보완·다른기능/원자료/보호3을 되돌리지 않는다. 옛source로돌아가도 소진승인이복구되지 않는다.
- 별도actual실행조건/대상등록·위험/시간/정리결정은 최종source checkpoint 후다. 이 source 검수로 복제/정식PG/IX01·전체계획완료를 주장하지 않는다.
