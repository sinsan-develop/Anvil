# FN08 SEND 자료 지속 등록 — r2 한정 결정안

상태 CANDIDATE / NOT_ADOPTED. 기준 codex/av3-stage-b / bfc2ed014a52a9bc4394a482dad8a2830eb22b8f. 원 docs/contracts/FN08_SEND_MATERIAL_REGISTRATION_PROPOSAL.md SHA F379F60DD4BC5322B6EFB5694C3D4DEAA283F338C4808D6F2966753089FA349A의 §2·4·5를 동결한 채 아래 누적 한도·source 종류·생산 접점을 보완한다. 원 §1의 이미 구현한 합성 조회를 재개발하지 않는다.

## 실제 공백과 이번 결정 차이

현재 parts의 repository는 clock/findByCommand/findByRef 읽기 port만 있고, 기존 basis/material-store와 인증 material 소비자는 등록 원형·proof binding을 요구한다. 명령을 재시작 후에도 검산하려면 manifest/material 등록과 proof 결박의 지속 생산자가 필요하다. 조회 wrapper나 항상 AVAILABLE을 돌려주는 제공자 추가로 해결하지 않는다.

새3표 execution_material_manifests/execution_materials/execution_material_proof_bindings와 해당 append/read/bind·같은 Tx·양방향 완결·상한 source/미적용 SQL이 이번 신규 계약이다. 기존 connector GET·14필드 material snapshot·명령/인증/중지·원문 거절 계약은 보존한다. 이 저장 계약을 구현해도 실제 SEND나 실제 원문 공급은 완료되지 않는다.

## A안 권장 — 현재 합성 참조 경계의 실제 저장 producer

1. **등록 종류·입력 권위**: 새 manifest의 허용 sourceKind는 SYNTHETIC_REFERENCE_ONLY_V1 하나다. 기존 SYNTHETIC_ONLY 내부 source port의 exact sourceRef/bodyRef/partsRef/originRef·hash/크기/mediaType·부분 descriptor와 현재 source/basis를 같은 Tx에서 검산한다. transport/mediaType/태그 하나만 보고 source 권위를 추론하지 않는다. caller의 임의 경로·bytes·ref/AVAILABLE 주장을 등록하지 않는다. 해당 source port가 없으면 미연결 거절을 유지한다. 실제 보호 원문·USER_INSTRUCTION·DD166F 거절 자료/대체 provider는 계속 BLOCKED다.
2. **해시 순서**: envelope 전 manifest는 고정 materialId/descriptor와 참조·범위/hash만 가진다. envelopeHash/material 최종hash를 역참조해 순환시키지 않는다. 같은 보호 source에서 계산한 manifestRef를 현재 queue 사실과 비교하고, receipt/envelope 생성 후 기존14필드 snapshot의 exact material을 완성한다. body bytes/실제 경로/Secret/token은 새3표·감사/로그에 저장하지 않는다.
3. **등록 종단**: 기존 instruction store.append가 같은 PoolClient에서 예약·명령·HELD_SYNTHETIC_ONLY outbox와 manifest/material을 함께 저장한다. 새 repository가 기존 parts의 읽기 port와 material results.bind/read를 구현하여 proof receipt→binding→challenge consumption을 같은 인증 Tx에 결박한다. proof 소비 후 binding이 없다고 사후 생성하지 않는다. 기본 app/실제 provider를 새로 주입·활성화하지 않는다.
4. **정확 FK·불변·완결**: 원 §5의 실제 기존 키와 내부 commands.id/execution_commands.id 대 envelope commandId를 구분한다. 필요한 결합 UNIQUE가 이미 있다고 가정하지 않는다. 기존 부모 표의 제약/GRANT는 바꾸지 않고 새3표의 복합 FK·row guard·deferred 양방향 complete guard로 같은 project/execution/generation/grant·명령/fullref/receipt/challenge/소비1회를 대조한다. UPDATE/DELETE·raw DML 우회·반쪽성공은 거절한다. SQL helper·키/UUID/text·정수/시각은 실제 기존 DDL과 대조한다.
5. **같은 명령·불명**: 정확 동일 입력/명령 replay는 원형을 검산하고 새 등록·charge0이다. 다른 입력/명령/대상 재사용은 거절한다. 등록/예산/명령/outbox 또는 receipt/binding/소비 중 하나라도 실패하면 같은 Tx 전체 rollback이다. COMMIT 불명은 새 명령으로 재실행하지 않고 원명령/원proof 재조회로만 확인한다. 원증빙이 없거나 모순이면 새로 보충해 성공시키지 않는다.

## 누적 저장 한도·보존

- 새3표에 저장한 JSON snapshot의 canonical UTF-8 논리 바이트 합계와 행 수를 함께 산정한다. 원문 bytes를 새로 저장/중복 charge하지 않으며 SQL 물리 페이지·index 용량을 측정했다고 주장하지 않는다. caller가 준 charge를 신뢰하지 않고 source와 SQL guard에서 재계산한다.
- 프로젝트별 누적 상한은 새3표 합산100,000행·1GiB, 같은 grant ID별 누적은 합산10,000행·64MiB다. grant의 다른 버전/credential generation으로 과거 사용량을 초기화하지 않는다. 만료·회수된 자료와 과거 binding도 보존·산입하고 자동삭제·상한 자동상향은 없다. 초과하면 해당 등록/소비 Tx를 rollback한다. 기존 challenge/grant 발급10000·SEND100·queue/예약2MiB·호출/spool/비용 한도도 별도로 그대로 검사한다.
- 이 metadata 한도는 기존0059의 ARTIFACT/CHECKPOINT 원본 저장량과 다른 범위다. 그 원장에 MATERIAL을 임의 추가하거나 전체 프로젝트10GiB coverage를 확보했다고 말하지 않는다. 기존 프로젝트의 quota/준비 차단도 해제하지 않는다. 실제 전체 저장량 통합·활성화는 별도 결정/검증 범위다.
- 현재 두 정상 경로의 user/session/client→project 잠금 순서를 보존한다. Queue의 currentProjectController 뒤 append와 proof의 current 검사 뒤 bind는 이미 project 잠금을 보유한 경로에서만 소비하며 그 아래 count/byte 검사·삽입을 직렬화한다. challenge transaction callback 진입만으로 잠금 완료라고 가정하지 않는다. 새 SQL도 project부터 잠그고 grant→project 역전이나 별도 transaction을 만들지 않는다. 실제 경합/교착 부재는 합성 결과로 주장하지 않는다.
- 내부 상한 거절은 비밀 없는 원인으로 구분하고, 외부 connector wrapper가 기존412로 닫는 층은 보존한다. malformed/불일치·미등록/만료/회수는 기존 소비자의 거절을 성공/빈 목록/새 발급으로 바꾸지 않는다. 상세 오류코드/정확키는 채택한 의미 안에서 WI에 고정한다.

## source·검수와 실행 제외

범위는 기존 execution-instruction-store.ts와 필요한 queue의 최소 조립 접점, 신규 등록 repository/validator·미적용 forward SQL·단위/메모리 통합/SQL정적 시험이다. 기존 parts/basis/material-store 인터페이스를 재사용하고, 필요 경로와 시작 SHA·migration 번호는 실제 목록을 대조한 정확 WI로 고정한다. 기존Primary 단일writer, Main 검수·통합, 기존Reviewer 읽기검수다. 새 source 종류·공개 endpoint·권한/API/전체 provider 체계를 추가하지 않는다.

정상 manifest→envelope→material 등록/부분 읽기→proof binding·소비→동일 명령 재확인, 각 실패의 전체 rollback·원형손상·교차scope/claim·hash순환·부분누락/중복·권한/기한·caller bytes거절·누적 count/byte 경계·만료산입·replay charge0를 실제 제품 producer와 메모리 원장으로 TDD한다. 기존 직접 인접 회귀·type/diff·pending SQL의 실제 DDL 키/guard 대조를 수행한다. 실PG 문법/trigger/FK/원자성·경합/교착·서비스/Agent 결과는 NOT_RUN이다.

실제 DB/SQL 적용·사용자 권한/GRANT·키/Secret·사용자 파일 조사·실제 보호 원문·서비스·Agent 실행·기존 프로젝트 일반 차단 해제는 제외한다. 실제 source provider/실app 주입·서명/OS 동작·유료 호출은 없다. 새3표 합성 구현을 실제 SEND/실행 준비 완료로 표시하지 않는다.

## 요청 결정

A: 원F379F60D+r2의 명시 sourceKind·같은Tx 지속등록/결박·누적 한도 계약과 코드·미적용 SQL·합성 구현을 채택한다. B: 현재 읽기port·합성 연결만 유지하고 지속등록은 미구현으로 남긴다. 실제DB·원문/Agent 실행 승인을 요청하는 문서가 아니다. PMO 위임 밖이면 이 정확 신규 계약만 신산님께 판단 요청할 지원을 구한다. Main은 작업계획 완료 책임과 다음 미완료 선정·검수/통합을 유지한다.
