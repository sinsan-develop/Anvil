# FN08 SEND 등록자료 공급 — 검토용 계약 후보

- 상태: 제안·미적용. 기존 P1 §6.2의 합성 전용 범위를 변경하거나 실제 원문·DB·Agent 실행을 승인하는 문서가 아니다.
- 2026-10-25 PMO 범위 대조: §1의 명시 합성 source 연결·음성 반례는 기존 P1 범위이므로 재승인 없이 진행한다. §2 전용3표·지속 결박은 미채택 제안이며, §3 실제 보호 원문·DD166F·DB/권한/서비스/Agent 실행 경계는 그대로다.
- 목적: 현재 interface만 존재하는 등록자료 조회/부분 바이트 공급을 기존 SEND 소비자에 연결한다. caller가 보낸 임의 ref·경로·bytes를 등록 근거로 채택하지 않는다.
- 기존 근거: `docs/contracts/FN06_FN08_EXECUTION_DISPATCH_PROPOSAL.md` §6.2, `execution-instruction-material-basis.ts`, `execution-instruction-material-store.ts`, `execution-materials.ts`.

## 1. 현재 승인 안에서 다음 구현

`apps/server/modules/executions/execution-instruction-material-parts.ts`에서 기존 `SyntheticRegisteredInstructionParts.current`와 `SyntheticInstructionPartReader.readPart`를 명시 `SYNTHETIC_ONLY` repository/source port에 연결한다. 등록 exact lookup, 현재 source 재검사, 부분 범위/UTF-8/bytes hash와 조회 전후 문맥을 검사한다. 기본 app 주입·SQL·filesystem·실제 보호 reader는 연결하지 않는다. 기존 소비자의 검사를 재작성하거나 낮추지 않는다.

집중 반례는 미등록/교차 command·grant·generation·manifest, origin/bodyRef/partsRef 변경, 격리/제외/접근회수·만료·조회 중 변경, 부분 범위/UTF-8/hash 오류, 다른 scope의 직접 readPart, caller 경로/bytes/AVAILABLE 주장 거절이다. 이는 합성 source 연결이며 실제 지속등록·원문 공급 완료가 아니다.

## 2. 지속 등록을 위한 새 계약 후보

기존 context_items의 JSON을 다른 의미의 등록부로 재해석하지 않는다. 다음 전용 저장 구조를 한 계약으로 검토한다. migration 번호와 실제 SQL은 아직 작성하지 않았다.

| 후보 표 | 불변 식별·결박 | 역할 |
|---|---|---|
| execution_material_manifests | project/id/version1, execution/generation, grant ref, commandId, instructionRef/partsRef, hash, snapshot, createdCommandId, 등록/만료시각 | envelope 생성 전 부분 descriptor 등록 |
| execution_materials | project/id/version1, execution/generation, commandId, manifestRef, commandRef/envelopeHash, bodyRef/sourceBindingHash, snapshot hash | 기존 14필드 material snapshot의 exact 등록 |
| execution_material_proof_bindings | project/proofResultId/version, execution/generation, grant/credentialGeneration, exact target/materialRef, 결박 hash | 이미 소비한 proof 결과와 반환 material 결박 |

`commandId`는 envelope의 UUID이며 내부 commands.id/execution_commands.id와 혼용하지 않는다. 복합 FK와 guard/최소 권한은 기존 표 키와 대조한 SQL 검토에서 확정해야 한다.

### 해시 순환 방지

materialManifestRef는 envelope 전에 필요하지만 최종 material snapshot은 envelopeHash를 포함한다. 따라서 전송 전 manifest에는 발급한 materialId와 sourceKind/sourceRef/bodyRef·partsRef·원문 hash/크기·부분 번호/개수/offset/UTF-8 크기/hash/mediaType만 담는다. 최종 envelopeHash/material hash는 넣지 않는다. envelope 생성 후 기존 wire 형태 그대로 최종 material snapshot을 등록하며 manifestRef/bodyRef 등은 저장 결박 metadata로 둔다. 명령·예약·outbox와 함께 같은 transaction으로 저장한다.

## 3. 실제 원문 연결의 별도 경계

새 평문 bytes 저장은 제안하지 않는다. 허용된 보호 reader의 exact bodyRef에서 재조회하고 project/execution/generation/grant/주체·정책·기한·원문 접근/격리·정정/제외·헌법/지시 basis와 origin을 전후 재검사한다. 원문/부분 hash·범위가 달라지면 최신본으로 치환하지 않고 거절한다. 상태 불명·reader 부재는 AVAILABLE이 아니다.

P1 §6.2의 실제 원문 제외는 유지한다. 연결을 별도 결정받은 source만 보호 reader에 연결하며 DD166F 거절 범위의 대화/USER_INSTRUCTION 원문과 대체 provider는 계속 BLOCKED다. 필수 source가 BLOCKED면 필수 누락을 그대로 남긴다.

## 4. 보존·권한·실행 영향

- 등록과 proof 결박은 append-only다. 만료는 조회를 차단하되 감사/과거 결박을 자동 삭제하지 않는다.
- 현재 기한 중 최솟값을 다시 검사하며 과거 등록 수명을 연장하지 않는다. origin 변경은 거절한다.
- 등록·명령·예약/outbox 실패는 같은 transaction에서 전부 rollback한다. proof 소비/영수증/material 결박도 기존 인증 transaction 안에서 처리한다. COMMIT 불명은 새 명령으로 재실행하지 않는다.
- 일반 app의 범용 조회/직접 DML을 열지 않는다. 본문·실제 경로·Secret·token/key는 snapshot/감사/로그에 저장하지 않는다. ref/hash/범위도 접근 제한한다.
- 기존 connector GET/응답은 유지하는 안이다. 실제 migration/대상 DB·권한·보존/rollback, 실제 원문 읽기 시험/서비스 연결과 실제 Agent 전달은 각각 정확 실행 범위가 정해진 뒤 수행한다.

검토 요청 대상은 위 저장 결박 계약 및 허용 source 종류다. 현재 source-only 구현을 이 결정 대기로 멈추지 않으며, 이 문서 존재를 schema/API/실제 원문 연결 승인으로 취급하지 않는다.
