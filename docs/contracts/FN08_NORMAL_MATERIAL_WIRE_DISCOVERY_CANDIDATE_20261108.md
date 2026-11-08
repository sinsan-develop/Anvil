# FN08 정상 START 자료 전달·발견 최소 계약 후보 r1

상태: 직접 채택 전 후보. 기존 구현 승인이나 PMO 검색 지원만으로 새 공개 응답을 적용하지 않는다.

## 1. 필요한 차이와 근거

D071 §6.2는 command/materialId 보호 GET과 원본 부분 2MiB·해시를 정의한다. START envelope는 contextBundleRef/optionsRef 두 참조로 고정되고, 0083은 별도 random materialId를 생성한다. 현재 GET commands는 sequence/commandRef/envelope만 반환해 실행기가 그 ID를 발견할 수 없다. bytes의 HTTP JSON 표현도 정해지지 않았으며 기존 in-process 값은 Uint8Array다. 기존 envelope·등록·권한·원문 범위를 변경하지 않고 아래 두 차이만 제안한다.

## 2. A안: 명령 페이지의 자료 descriptor

기존 GET /api/v1/connectors/:cid/executions/:eid/commands item의 sequence/commandRef/envelope를 보존하고 materials를 추가한다.

```ts
materials: {
  manifestRef: Ref; // 기존 exact {id,version,contentHash}
  groups: Array<{
    kind: 'CONTEXT_BUNDLE' | 'START_OPTIONS';
    payloadRef: Ref;
    sourceRef: Ref;
    sourceBytes: number;
    contentHash: string; // 원본 전체 SHA256
    mediaType: 'application/json';
    parts: Array<{
      materialId: string; // 서버가 기존 원장에 등록한 UUID
      partIndex: number; byteOffset: number; utf8Bytes: number;
      contentHash: string; // 해당 부분 SHA256
    }>;
  }>;
}
```

- 현재 normal START만 두 그룹을 정확히 전달한다. 기존 미지원 SEND/STOP을 START로 해석하거나 임의 활성화하지 않는다. 후속 명령은 해당 계약을 별도로 충족해야 한다.
- 기존 manifest/material·원 command/outbox·grant/credential/실행세대와 현재 접근·회수·기한을 검산한 metadata만 전달한다. 파일 경로·본문·Secret·임의 문서 목록은 포함하지 않는다.
- 페이지 최대50, 전체 canonical JSON UTF-8 2MiB, 페이지 합계 parts200 및 기존 영수증 byte 상한을 동시에 지킨다. 두 그룹을 가진 명령은 한 단위이며 쪼개거나 자료를 생략하지 않는다. 다음 명령이 어느 상한이든 초과하면 그 명령 전에서 페이지를 닫고 hasMore=true, cursor는 실제 마지막 반환 명령을 가리킨다. 단일 첫 명령도 담지 못하면 명시 거절한다.
- 고정 page receipt에 materialDiscoveryVersion:1을 추가하고 entries 각각에 materialsManifestRef:Ref 및 materialsDescriptorHash:SHA256을 추가해 exact 출력 metadata를 결박한다. 전체 descriptor는 불변 manifest에서 재구성하되 두 hash/ref와 원 command 관계를 매번 재검산한다. nonce 소비·고정 receipt는 같은 거래다.
- 응답 유실·재조회는 최초 metadata/hash/순서/cursor/기한만 반환한다. 옛 receipt에 필수 결박이 없거나 manifest/material이 없으면 새 metadata를 사후 덧붙이지 않고 MATERIAL_DISCOVERY_BINDING_REQUIRED로 거절한다. 새 nonce/명령의 자동 발급은 하지 않는다.
- 기존 exact 소비자는 추가키를 거절할 수 있어 무조건 하위호환은 아니다. 서버와 새 normal 소비자를 같은 후보에서 검수한다. 기존 synthetic 응답·envelope·과거 영수증을 보존하고 새 forward에서 목적별 검산을 추가한다. 구 migration/원장 재작성은 하지 않는다.

## 3. A안: 부분 bytes의 HTTP JSON 표현

기존 보호 material GET의 bytes 필드만 canonical unpadded base64url 문자열로 정한다. encoding 필드나 새 endpoint는 추가하지 않는다. 내부 보호 읽기와 기존 synthetic transport는 Uint8Array를 유지한다.

- 원본 bytes 최대2,097,152, SHA256·UTF-8·부분 길이는 디코드한 원본 기준이다. 전송 문자열은 최대2,796,203자이고 decode→encode roundtrip이 정확히 같아야 한다.
- material 응답 metadata는 canonical UTF-8 최대16KiB, 전체 HTTP JSON 응답은 최대2,812,587 bytes다. 이는 base64 팽창의 별도 유한 상한이며 원본 2MiB·명령 페이지 2MiB·요청 body 기존 상한을 늘리지 않는다.
- 원문은 검산·동일 거래의 nonce 소비/receipt·확정 COMMIT 후에만 no-store로 반환한다. 회수/정정/격리/hash 불일치/COMMIT 불명은 bytes 반환0이며 자동 재전송0이다.

## 4. 반영·검수·복구 범위

채택 범위는 코드·화면 필요 접점·미적용 forward SQL·RAM/가짜 DB 합성 검증이다. 실제 DB 접속/적용·권한 부여·키/서비스·Agent 실행·실사용 자료 읽기는 제외한다.

예상 영향: normal-command-pages와 집중/SQL/제품여정 시험, normal-start-materials와 집중/SQL/여정 시험, 새 forward의 exact receipt·manifest/proof 완결, 새 normal 실행기 응답 소비 codec. 현재 materialId 보호 GET의 독립 승인 구현은 이 후보 채택 대기 때문에 전체 중단하지 않는다. 정확 source 소유목록은 기존 branch 단위 종료 후 Main이 고정한다.

검수: 실제 제품 START가 생성한 manifest/ID가 GET commands metadata로 전달되고 소비자가 그 ID로 두 보호 부분을 요청해 bytes/hash를 대조한다. fixture가 몰래 ID를 공급하는 것으로 이 발견 검증을 대체하지 않는다. 다른 실행/명령/세대·metadata 변조/누락/과거 receipt·상한 경계·cursor 마지막 실제행·동일 요청 replay·회수/만료·base64 비정규/UTF-8/hash 오류를 거절한다. 실제 DB/Agent 검증은 별도 미검증으로 남긴다.

복구: source commit 일반 revert, 구 envelope/synthetic/원장·과거 receipt 보존. 새 기록을 구 형식으로 재작성하거나 자동 삭제하지 않는다. 실제 DB를 적용하지 않으므로 현재 실제 데이터 rollback은 없다.

## 5. 다른 대안

B안은 별도 보호 manifest 조회 endpoint를 추가하는 방식이다. 새 경로·proof/nonce·응답·호환 계약이 늘어나므로 A안을 권장한다. 아무 보완도 하지 않는 경우 자료 ID를 서버 밖에서 알아내야 하므로 실제 실행기 연결은 미완료로 남는다.
