# FN08 START 맥락·옵션 자료 지속등록 계약 후보

상태: DRAFT / NOT_ADOPTED / SOURCE_GO0. 2026-11-06 Main 어울.
기준: codex/av3-stage-b, 소스 checkpoint 6c1b938684bdbba667b66ddda2a4de5d15441f0b.
이 문서는 새 영속 의미의 검토안이다. 구현·DB 적용·권한·실제 실행 승인이 아니다.

## 1. 기존 승인과 실제 차이

- SEND 직접승인 부모: docs/work_packages/FN08_MATERIAL_REGISTRATION_SOURCE_DIRECT_APPROVAL_20261031.md.
- r2 결정안 SHA256: 2F04BB32F37C2968F1B1570B1792C27649C44D3E956DA5328C0FE1466F1401D5.
- 원 SEND 제안 SHA256: F379F60DD4BC5322B6EFB5694C3D4DEAA283F338C4808D6F2966753089FA349A.
- 기존 구현 WI SHA256: 490C5E0D839EC380B54CCD2870FC2CDD133AC0290CB7E8B2FCF5A4ECFC36D7F6.
- r2는 START/STOP을 자동 등록 대상으로 확대하지 않는다. 기존 0062는 SEND_INSTRUCTION/SYNTHETIC_INSTRUCTION_QUEUED와 단일 partsRef, 명령당 manifest 1개에 결박돼 있다.
- START는 START_SESSION/SYNTHETIC_QUEUED이며 contextBundleRef와 optionsRef 두 자료가 필요하다. 실제 START 등록 producer와 그 부분 보호조회가 없다.
- 기존 START 입력·봉투·부분조회 wire·14필드 material은 유지할 수 있다. 새로운 START descriptor의 저장 의미·등록 필수성·SQL 완결 대상이 이번 결정 차이다.
- 기존 ContextBundle 저장·HUMAN 고정조회는 있다. manifest는 원문 text를 복제하지 않는다. 이를 executor 원문 접근 허가로 전용하지 않는다.
- optionsRef의 실제 불변 옵션 원문 생성·보관·보호조회 producer는 현재 확인되지 않았다. 환경 metadata나 합성 resolver를 그 producer라고 부르지 않는다.

## 2. 대안과 권장

A 권장: 기존 세 등록표를 재사용하면서 START 전용 descriptor 1개에 두 payload 그룹을 저장한다. 기존 SEND 원형·0062 파일은 보존하고 새 forward 정의·분리 parser/producer/reader로 구현한다. 코드·미적용 SQL·합성 검수만 포함한다.
B: SEND만 유지하고 START 등록은 미구현으로 남긴다. 새 등록 의미는 생기지 않지만 최초 실행 자료의 선행은 계속 빠진다.

A도 실제 원문 source·옵션 원문 producer·SDK/Agent 연결을 완료하는 결정이 아니다. 누락 source는 미연결로 거절한다. 새 source 원문 권위·Options 작성 API·tool permission 정책·실제 DB 실행은 별도 미포함이다.

## 3. A안 exact descriptor

```ts
{
 schemaVersion: 1,
 purpose: "START_CONTEXT_OPTIONS_MATERIAL_V1",
 id: Uuid,
 sourceKind: "SYNTHETIC_REFERENCE_ONLY_V1",
 scope: {
  mode: "EXECUTION", projectId: Uuid, connectorId: Uuid,
  executionId: Uuid, executionGeneration: PositiveInteger,
  grantRef: Ref, credentialGeneration: PositiveInteger
 },
 commandId: Uuid,
 payload: { contextBundleRef: Ref, optionsRef: Ref },
 groups: [
  {
   kind: "CONTEXT_BUNDLE", payloadRef: Ref,
   source: { sourceRef: Ref, bodyRef: Ref, originRef: Ref,
    contentHash: Sha256, sourceBytes: PositiveInteger,
    mediaType: "text/plain" | "application/json" },
   parts: [{ materialId: Uuid, partIndex: PositiveInteger,
    byteOffset: NonnegativeInteger, utf8Bytes: PositiveInteger,
    contentHash: Sha256 }]
  },
  {
   kind: "START_OPTIONS", payloadRef: Ref,
   source: { sourceRef: Ref, bodyRef: Ref, originRef: Ref,
    contentHash: Sha256, sourceBytes: PositiveInteger,
    mediaType: "application/json" },
   parts: [{ materialId: Uuid, partIndex: PositiveInteger,
    byteOffset: NonnegativeInteger, utf8Bytes: PositiveInteger,
    contentHash: Sha256 }]
  }
 ],
 expiresAt: StrictUtcIso
}
```

- 추가키·누락·중복 JSON key·잘못된 UTF-8/숫자/Ref/hash는 거절한다. Ref는 기존 원형을 재사용한다.
- groups는 위 순서의 정확 2개다. 각 payloadRef는 원 payload의 해당 fullref와 같고 두 fullref는 서로 달라야 한다.
- 각 source는 명시 SYNTHETIC_ONLY 공급 포트의 exact source/current에서 검산한다. caller의 경로·bytes·ref/AVAILABLE 선언만으로 등록하지 않는다. 원문 권위나 실제 보호 reader를 이번에 추가하지 않는다.
- group 내 partIndex는 1부터 연속, offset은 0부터 빈틈·중첩 없이 연결된다. 합계는 sourceBytes와 같다. materialId는 두 그룹 전체에서 중복이 없다.
- descriptor canonical UTF-8은 2MiB 이하, 두 그룹 부분 합계는 200개 이하다. 각 source/부분은 기존 2MiB 상한을 넘지 않는다.
- A의 새 START 명령 자료 합계 상한은 두 source 합계 2MiB로 제안한다. 두 그룹 각각 2MiB를 더해 총량을 늘리지 않는다. 이 한도는 새 정책이며 초과는 명시 거절한다. 기존 receiver의 더 작은 설정 한도도 그대로 적용한다.
- bytes SHA와 descriptor/material snapshot의 canonical SHA를 혼동하지 않는다. 새 metadata에 본문·경로·Secret을 저장하지 않는다.
- 준비 descriptor에는 최종 receipt/envelope hash를 넣지 않는다. manifestRef는 descriptor id/version1/canonical hash다. 최종 material은 기존 14필드를 유지하며 payloadRef는 소속 그룹 ref, sourceRef는 소속 source ref다.

## 4. 원 명령·Tx와 생산 순서

1. 기존 HUMAN 로그인/회원·단독 제어·정책·원 command·등록·START basis·예산을 검산한다. DENY와 미연결 REQUIRE_APPROVAL은 계속 거절한다.
2. 계획 grant와 정확 두 source/current를 같은 Tx에서 검산하고 descriptor를 고정한다. source가 없거나 불명·격리·회수·기한 불일치면 효과 없이 거절한다.
3. 기존 receipt→authorizationRef→START envelope를 만든다. 원 START payload나 queueIntent/ProjectResult의 exact 키를 늘리지 않는다.
4. 같은 authenticated Tx에 실행/grant/예약/writer claim/START command/outbox·manifest 1개·각 material을 저장한다.
5. 원 source·현재성·원 최소기한·합산 한도를 다시 검사하고 deferred 완결 후 COMMIT한다. 중간 실패는 전체 rollback, COMMIT 불명은 원명령 UNKNOWN으로 보존한다.
6. 원 사용자/session/client→project 잠금 순서와 project부터 잠그는 기존 한도 검산을 보존한다. grant→project 역전·별도 Tx 등록·사후 보충은 하지 않는다.

새 producer의 입력은 원 START 명령과 원 보호 참조다. 일반 caller가 prepared descriptor·할당량 charge·최종 source 상태를 권위로 제출하는 통로는 추가하지 않는다.

## 5. 저장·완결과 과거 이력

- 기존 execution_material_manifests / execution_materials / execution_material_proof_bindings 세 표를 재사용한다. 명령당 manifest 1개 제약을 풀지 않고 그 manifest 안에 두 그룹을 둔다.
- SEND exact parser·원형·정상/거절 조건은 그대로 유지한다. START purpose는 실제 저장 START 행·원 command/receipt/grant/예약/outbox/audit 관계와 함께 검산한다. purpose 문자열만으로 권위를 만들지 않는다.
- 새 START 등록에 그룹/부분 누락·중복·다른 payload 재사용·원 scope/hash 불일치가 있으면 Tx 전체를 거절한다.
- 신규 START 생산에는 등록이 필수다. 과거 행은 자동 보충·수정하지 않는다. 기존 과거 조회/원명령 replay가 원 증빙을 읽는 것은 유지하되, 미등록 과거 행을 새 등록/전달 준비로 승격하지 않는다.
- 역완결 대상은 실제 원행을 기준으로 판정한다. operation/result 변조나 manifest 삭제로 새 START 대상 검사를 우회하지 못해야 한다.
- 기존 check_initial_execution_graph는 생성 시 그대로 유지한다. 그 함수의 execution_queue_authorized는 원 HUMAN GUC·현재 정책을 요구하므로 후행 connector proof에서 과거 검산 목적으로 재호출하지 않는다.
- 새 불변 저장 관계 검산과 후행의 현재 grant/proof/source 접근 검산을 분리한다. 원 HUMAN GUC를 복제하거나 current 검사를 생략하지 않는다.

## 6. 부분 조회·proof

- 기존 connector GET·target·proof/receipt·14필드 snapshot·오류 wire는 유지한다.
- START의 정확 등록 group/material만 선택하고 원 payloadRef·source·scope·명령·envelope를 대조한다. prefix나 caller 선언으로 허용하지 않는다.
- 기존 receipt→exact material binding→challenge consumption→최종 현재성/bytes 검사→COMMIT 순서를 유지한다.
- 새 START의 proof 소비와 binding은 같은 Tx에서 전수 결박한다. 이미 소비됐는데 binding이 없으면 사후 생성하지 않는다.
- HISTORY의 저장 완결과 fresh 권위는 별개다. 옛 receipt/descriptor는 새 실행 허가가 아니다.
- 실제 source 원문·USER_INSTRUCTION·DD166F 차단·대체 provider는 부모 제외를 유지한다. source 미구성·불명은 SOURCE_UNAVAILABLE이며 빈 목록·AVAILABLE·가짜 bytes로 바꾸지 않는다.

## 7. 합산 한도·보존·불명

- 세 표 전체의 SEND+START canonical snapshot 논리 UTF-8 bytes와 행 수를 함께 센다. caller가 준 charge를 신뢰하지 않고 source와 SQL에서 재계산한다.
- 프로젝트 누적: 100,000행·1GiB. 같은 grant ID의 모든 버전/credential 세대 합산: 10,000행·64MiB.
- 만료·회수 이력과 proof binding도 산입한다. 자동 삭제·상한 초기화/상향은 없다.
- 동일 원입력/명령 replay는 새 manifest/material/binding·charge0이다. 다른 원문·scope·source·명령 재사용은 거절한다.
- 기존 queue/예약·challenge·grant·SEND·spool·호출/비용 한도를 별도로 유지한다. 전체 프로젝트 저장량 coverage를 확보했다고 하지 않는다.
- 물리 PG 페이지·index, 실제 경합/교착·내구성을 합성 검수로 보장하지 않는다.

## 8. 구현 범위와 검수

채택 뒤 Main이 실제 최신 파일/SQL 목록과 hash를 대조해 정확 WI를 고정한다. 기존 Primary가 server START queue/등록 parser/store·부분 reader/proof의 최소 접점, 새 미적용 forward SQL, 단위/메모리 여정·SQL 정적 검수를 작성한다. Main은 검수·통합·현황만 담당한다. 기존 0062나 과거 SQL을 수정하지 않는다.

검수는 실제 제품 모듈의 source/current→두 그룹 descriptor→원 receipt/envelope/START queue·등록→부분 보호조회/proof binding→기존 receiver.startOptions를 합성 메모리 Tx에서 연결한다. options 원문/실제 source 공급자가 없으면 그 경로는 미연결이고 테스트 source를 실제 producer로 세지 않는다.

정상·두 fullref/그룹 오염·부분 누락/중복·hash/UTF-8·권한/기한·HUMAN 생성 Tx와 connector 후행 Tx 구분·입력/operation 우회·누적 count/bytes 경계·replay charge0·중간 rollback·COMMIT 불명·과거 무수정을 검산한다. 기존 SEND 직접 회귀·type/diff·정적 SQL을 선택한다. 필수 거절/기대값을 느슨하게 하거나 무관한 전수 회귀로 확대하지 않는다.

## 9. 실제 실행 제외·복구

실제 DB 접속/DDL/GRANT·권한/회원/정책 변경·키/Secret·파일/실자료 조사·실제 보호 원문·서비스·SDK/Agent/유료 호출·컴파일·J3/P03 R3·Oracle/운영·기존 프로젝트 차단 해제·Git 인증 복구는 제외한다. 기본 app 등록/실제 provider 활성화는 하지 않는다.

코드·미적용 SQL·합성검수만 완료해도 최초 Agent 실행·실제 DB/Tx/RLS/원문·전체 FN08/계획 완료가 아니다. rollback은 새 소유 source/미적용 SQL delta의 정상 revert이며 실제 데이터/계정/원문 삭제가 아니다.

## 10. 필요한 결정

A: 위 새 START descriptor·두 그룹 등록 필수성·합산 한도·양방향 완결의 영속 계약과 코드·미적용 SQL·합성 구현을 채택한다.
B: 기존 SEND만 유지하고 START 등록은 미구현으로 남긴다.

검토 완료·채택 전 SOURCE_GO0을 유지한다. PMO가 이 정확 영속 의미 delta를 위임 범위에서 결정할 수 있는지 확인하고, 직접 판단 사항이면 이 고정 후보만 신산님께 요청한다. 기존 작업계획 전체의 재승인을 요청하는 것이 아니다.
