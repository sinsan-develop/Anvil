# FN08 SEND 자료 지속등록 r2 A — 구현 WI

상태 MAIN_GO / DIRECT_HUMAN_APPROVED. 기준 codex/av3-stage-b / 25735248869b3458da992d217956c284cc616936. 직접승인 FN08_MATERIAL_REGISTRATION_SOURCE_DIRECT_APPROVAL_20261031.md SHA FB59E8C7A040D69CF9D11D8E753A3F5573647BE430E8A95E950EC2BABACABE6C → r2 2F04BB32F37C2968F1B1570B1792C27649C44D3E956DA5328C0FE1466F1401D5 + 원 F379F60DD4BC5322B6EFB5694C3D4DEAA283F338C4808D6F2966753089FA349A. 통제 문서 commit 뒤 실제 HEAD를 시작 기록으로 남긴다. 기존 Primary 단일 코드 writer, Main은 문서·관리·fresh 검수·통합만, 기존 Reviewer는 읽기 검수다.

## 정확 8경로

기존2 시작 SHA256:
1. apps/server/modules/executions/execution-instruction-store.ts / C63A06F07501611A46DB96A54AC0797BB222CB5584C999296DC69019E99CD6F1
2. apps/server/modules/executions/execution-instruction-queue.ts / 21FCC2907B266DA82622B28F2B01D619264E15A58C3BFA37F6891EF378417275
신규6(Primary가 부재 확인):
3. apps/server/modules/executions/execution-material-registration-input.ts
4. apps/server/modules/executions/execution-material-registration-store.ts
5. tests/unit/FN08/execution-material-registration.test.ts
6. tests/unit/FN08/execution-material-registration-store.test.ts
7. tests/unit/FN08/execution-material-registration-schema.test.ts
8. db/migrations/0062_execution_material_registration.sql.pending

0062 prefix 부재를 확인했다. 변경 직전 충돌만 확인하고 완료 조사/검증은 반복하지 않는다. 꼭 필요한 기존 인접 시험/fixture 적응은 경로·시작 hash·변경 사유를 Main에 먼저 보고한다. 새 dependency/일반 framework·전수 재작성·기존 SQL/부모표 GRANT·전역 quota·UI/connector/public API 변경0, 보호3·원복구본·다른 dirty/역사 자료를 보존한다. 새 branch/worktree/chat/자동화0이다.

## 구현 목표·조립

- 새3표는 execution_material_manifests/execution_materials/execution_material_proof_bindings만이다. 조회 wrapper가 아니라 실제 manifest/material 등록과 proof결박 생산자를 같은 PoolClient의 기존 queue/인증 Tx에 연결한다. 새 repository는 기존 parts의 clock/findByCommand/findByRef와 기존 material results.bind/read를 구현한다. 기존14필드 material snapshot/connectorGET·parts/basis/material-store의 소비 의미를 보존한다. 기본app/실provider를 주입하지 않는다.
- 등록 전 descriptor 공급용 한정 내부 port를 신규 repository 안에 고정한다. sourceKind는 SYNTHETIC_REFERENCE_ONLY_V1만 허용한다. 현재 source/basis와 exact scope·sourceRef/bodyRef/partsRef/originRef·hash/sourceBytes/mediaType·부분 descriptor를 검산하고 input module에서 정확키/정수/범위/정렬·중복·전체 크기·시각·hash를 고정한다. caller의 경로/bytes/AVAILABLE·추가키·다른 sourceKind는 거절한다. source 태그/transport/mediaType만으로 권한을 추론하지 않는다. 실제 port 부재면 미연결 거절, 실제 USER_INSTRUCTION/DD166F/대체provider 원문 차단은 유지한다.
- envelope 전 고정 material ID·참조·parts descriptor로 manifestRef를 계산하고 현재 queue 사실의 materialManifestRef와 정확 비교한다. manifest에는 최종 envelopeHash/material hash를 넣지 않아 해시 순환을 피한다. 검산 준비본은 불변 복제해 append까지 명시 전달하며 공유 mutable cache·ambient last-value로 권위를 전달하지 않는다. receipt/envelope 후 old14필드 exact material을 완성한다. input의 내부형식/에러명은 후보의 의미 안에서 구현하되 새 source/API·권한 의미가 필요하면 Main에 먼저 보고한다.
- append는 같은 선택/원참조/source 현재성을 같은 db에서 재검사하고 예약·명령·HELD_SYNTHETIC_ONLY outbox·manifest/material을 같은 Tx로 저장한다. 새 지속 어댑터에서 producer가 없을 때 등록을 생략하고 성공시키지 않는다. 기존 순수 합성 시험의 대역을 실제 지속 저장 증거로 승격하지 않는다. 기존 정상 단위가 새 준비 port를 필요로 하면 fixture를 실제 producer로 적응시켜 기존 반례가 같은 검사까지 도달하게 한다. guard/기대값을 느슨하게 하지 않는다.
- results.bind/read는 proof receipt와 exact materialRef/명령/실행 세대/grant/credentialGeneration·현재 source/proof target을 결박한다. receipt→bind→challenge consumption 순서를 유지하고 COMMIT에서 양방향 완결을 검산한다. 이미 소비했는데 binding이 없는 것을 사후 생성하지 않는다. 원형이 같은 replay는 새 등록/charge0, 다른 입력·scope 재사용/원증빙 손상은 닫는다. 별도 pool/COMMIT·부분성공·불명 자동 재전송/새명령/재발급0이다.

## 한도·현재 보호

- 새3표 합산 canonical JSON snapshot UTF-8 논리 바이트/행 수를 산정한다. project100000행/1073741824bytes, 같은 grant ID의 모든 버전·credential generation 합산10000행/67108864bytes다. 만료/회수 이력도 산입하고 자동삭제/수명연장/한도초기화0. caller charge를 신뢰하지 않고 source/SQL guard에서 재계산한다. 원문 bytes/실경로/Secret/token은 저장/감사/로그에 넣지 않으며 SQL물리페이지/index나 전체10GiB coverage라고 말하지 않는다.
- 기존0059 ARTIFACT/CHECKPOINT quota에 새 kind를 넣지 않고 기존 준비/coverage·기존 project 차단을 해제하지 않는다. SEND100/queue+예약2MiB/challenge 발급10000·실행 budget/spool/cost 한도는 별도로 유지한다. 등록/소비 실패·상한 초과는 같은 Tx 전체 rollback이고 원형 replay는 그 행/바이트를 다시 과금하지 않는다.
- 두 실제 진입의 기존 user/session/client→project 순서를 보존한다. Queue currentProjectController 뒤 append, proof current 검사 완료 뒤 bind가 보유한 project 잠금 아래 누적 검사·삽입을 직렬화한다. callback 진입=잠금 완료라고 가정하지 않는다. 새SQL은 project부터 잠그고 grant→project 역전/별도 Tx를 만들지 않는다. 저장 직전/대기 후 현재 grant·세션/권한·stop/IDLE/basis·최소기한을 재검사한다. source와 SQL 시각·UTC ms/DB microseconds 차이를 실제 기존 계약과 맞춘다.
- 외부 connector wrapper의 기존412 등 층별 거절은 보존한다. 내부 미등록/손상/만료/회수/상한을 비밀 없는 원인으로 구분하되 성공/빈 자료/AVAILABLE로 바꾸지 않는다. 실제 원문·Agent·C1/허가/기본app 활성화는 없다.

## 미적용 SQL 보호

- 기존0011/0017/0018/0024와 실제 source DDL의 PK/UNIQUE/FK/UUID·text·정수/JSON/시각을 대조한다. commands.id 내부 FK와 envelope의 외부 commandId를 구분하고 존재하지 않는 project_id/command_id UNIQUE나 grant결합 UNIQUE를 가정하지 않는다. FK 밖 fullref/hash·scope·같은행 명령/grant/receipt/challenge 관계는 guard로 대조한다. 기존 부모표 제약/권한 확대0.
- 기존 execution_authority_canonical/execution_json_hash 의미에 맞춰 hash/논리 bytes를 계산한다. jsonb::text로 대체하거나 임의GUC/태그로 검산을 생략하지 않는다. 새표 immutable row guard·deferred 양방향 complete guard를 만들고 정확1/cross-scope/반쪽/삭제·UPDATE 우회와 원command·receipt·challenge소비 누락/중복을 닫는다.
- reverse 검사는 새 원행의 존재/종류를 먼저 분류해 command.operation/result flag 변조·한쪽행 제거가 guard 대상 제외를 만들지 못하게 한다. 정상 무관 operation·DRAFT nullproject·과거 무관행은 보존한다. 신규 SEND의 실제 고정 envelope/등록근거와 원명령 결박으로 등록 필수 대상을 검사하며 다른 START/STOP 등 operation을 무조건 새registry 대상으로 만들지 않는다. rawDML/단순GUC로 정상등록을 가장할 수 없어야 한다. 기존0018의challenge/receipt·0024 permit완결만으로새결박보호가끝났다고말하지않는다.
- 실행하지 않는다. 실제PG구문/trigger/FK/rollback/경합·교착은NOT_RUN이며 정적 구조/JS 모델과 구분한다. 실 migration·계정/GRANT·키/DB·데이터·서비스 변경0이다.

## TDD·검수·제출

1. 작은 실제 producer RED→GREEN부터 시작한다. 실제 queue/store/새등록repository·기존parts/basis/material/proof소비를 같은 메모리 원장으로 연결해 descriptor→manifest→receipt/envelope→material 저장·정확 재조회→부분읽기→proof binding/소비·재확인을 검증한다. 원 source/fact/DB 쿼리 대역은 명시하고 fake AVAILABLE 제공만으로 완료하지 않는다.
2. 미연결source/다른종류/경로·bytes·scope/grant/세대·부분누락/중복/offset/hash·manifest순환/조립불일치·원행/receipt/audit/outbox/challenge 손상·현재권한/기한/stop 변화·대기 후 source변경을 반례로 둔다. 오류 중간마다 전체 memoryTx rollback을 확인하되 실제 PG 원자성 증거로 부르지 않는다.
3. 누적 행/byte 각 cap-1/cap/cap+1·같은grant다른버전/credentialGeneration·만료산입·proof replay charge0·상한초과/COMMIT불명·소비완료/binding없음·무관명령/기존DRAFT 호환을 검증한다. raw command/result 분류 우회·source type tag만 바꾼 위장도 닫는다. SQL 정적검사에서는 실제 기존 키·canonical helper·reverse guard 연결을 의미 있게 대조하고 token 존재만으로 SQL 합격을 주장하지 않는다.
4. 기존 직접 인접은 instruction-queue/material-parts/materials 관련 unit 중 실제 실행/파일/OS 없는 항목을 내용 확인 후 최소 선택한다. file-store/receiver/PG/실process 시험은 이번실행0. 완료FN13/FN09 불변검사 반복0. type/noEmit·diff/stagedcheck·기존2외 code변경/보호3/원문 hash 보존을 확인한다. UI변경 없으므로 Web/browser/detect 반복0.
5. 정확 명령·exit/REDGREEN·오류횟수/범위·source/SQL 최종hash·미실행·한계/rollback을 제출하고 writer를 반환한다. Main fresh·독립 C/I0 뒤 소유경로만 기존privatebranch 통합한다. 실제SEND/원문공급/Agent/전체FN08·계획완료로 source 합격을 승격하지 않는다. 같은 실패3회는 정식 보고와 원인으로 분류하고 일상적인 수정/fixture오류를 허위 FAILURE_REPORT로 세지 않는다.
