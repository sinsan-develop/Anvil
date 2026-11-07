# FN03 native 내용 해시 관측 소스 작성·정적 검수 결과 — 2026-11-07

판정: **소스 구현·시험 소스 작성 및 정적 검수 완료, 동작 미확인**. 컴파일·실행시험 PASS는 0이며 전체 FN03/계획 완료가 아니다.

- 기준1867bdcd950ee69be162b4a29a39714e99e41a6c, WI FN03_NATIVE_CONTENT_OBSERVER_SOURCE_WI_20261107.md / 1FAB29355E659CE7C8F1FC4D1DA124BD07F29C9DC58F0BB24BA37A8F691361CA(부모4EA0D7B2).
- 채택 B §5·§11의 source-only 범위. 기존 Primary 단일 writer, Main·별도 담당자 정적 검수. 기존 A3/서명2·host/route/signer/SQL은 변경하지 않았다.

| 신규 경로 | bytes | SHA256 |
|---|---:|---|
| apps/connector/native/SourceContentObserver.cs | 39004 | C714C4C16DFF65794D9B7B40D7D0B3DCDFA34849E33ACF211EB1A06CD04E4482 |
| tests/native/FN03/SourceContentObserverSourceTests.cs | 17557 | 8806E2A72C35449429E07BFA217D06D10B3FE25345E8D97473A3257B5723AB08 |

## 작성된 처리

private CONTENT factory가 상대 root/dir/leaf handle을 보유하고 leaf에만 데이터 읽기를 요청한다. ShareRead·reparse/volume/link/파일종류·identity/경로를 검사한다. 같은 leaf에서 ≤64KiB raw SHA256·최초 크기2MiB/누적20MiB·부분 읽기/EOF probe·전후 identity/size/time·root pins를 검사하고, 첫 실패 뒤 suffix를 미시도로 둔다. 고정 단조30초/최초 permit 최소와 UTC 역행·취소 뒤 채택/새 작업을 차단한다.

pending open은 모든 unmanaged args/IOSB/fileSlot/ancestor pins를 실제 완료까지 보유한다. 미확증 NtCancelIoFileEx ABI를 사용하지 않으며 이 open의 OS 취소/유한반환은 보장하지 않는다. pending ReadFile은 정확 OVERLAPPED의 취소를 요청하고 실제 completion 뒤에만 buffer/event/handle을 회수한다. 늦은 bytes/hash는 버리고 원 자원이 미정착인 동안 완료·안전회수로 표시하지 않는다.

## 정적 증거와 보완

- 폴더 생성 도구 오류1: 최초 apply_patch 실패,01316a의 승인된 동일 tests/native/FN03 생성으로 해소. ACL/경로 우회0이다.
- 부분 source87DD2649의 정적 I1: terminal CRC 오류를 영구 pending으로 보아 회수하지 못했다. 실행 RED가 아니다.
- 최종 NativeRead가 공유 ClassifyReadCompletion을 실제 소비한다. 원 event·IOSB·조회 결과로 CRC/일반 terminal 실패를 UNVERIFIED/OBSERVER_UNAVAILABLE로 정착시키고 access/cancel/EOF와 pending/불명 조회를 나눈다. 시험 소스는 같은 분류와 관측 core를 소비해 CRC/다른 실패·후속open0·READ→FILE→ROOT 정리 순서를 단언한다.
- 독립 재검수: 정적 C0/I0/M0, 기존 I1 해소. Main0ac495 final raw2·분류/실제 호출·diff0 및 a226d4 시험의 core 소비·호스트 entry 부재/변경 경로 확인. Primary c5f9e0은 raw/공백/문자 정적 점검 exit0이다.
- memory seam과 private concrete factory를 분리했다. 시험 소스에는 raw empty/BOM/CRLF/경계·short/EOF/변경·누적한도·중단·HOLD/late·소유 정착 사례를 작성했다. 실행한 것으로 세지 않는다.
- 공식 문서 읽기 근거: [CancelIoEx](https://learn.microsoft.com/en-us/windows/win32/api/ioapiset/nf-ioapiset-cancelioex), [NtCreateFile](https://learn.microsoft.com/windows/win32/api/winternl/nf-winternl-ntcreatefile), [GetOverlappedResult](https://learn.microsoft.com/en-us/windows/win32/api/ioapiset/nf-ioapiset-getoverlappedresult). 문서 조회는 OS 실행/ABI 검증이 아니다.

## 미실행·다음 선행

C# compile·RunAll·하네스·PInvoke·실제 파일/Windows ABI/지원·pending/취소/Close·writable mapping/악성 ABA는 전부 NOT_RUN이다. 실제 키/권한/DB/서비스/Agent/SDK·실자료/외부 실행0·별도 process/임시파일/키0·live/pending0이다.

보호 permit→approved observer·서명/등록·현재 verification receipt 및 host등록/LINK도 미연결이다. source 제출물은 검토 가능한 정확 manifest로 보존하며 실제 컴파일/합성 하네스·OS 검증은 각각 현재 승인 범위와 대조한 뒤에만 가능하다. FN09 A안5579A6E9는 별도 미채택이다. 복구는 신규2만 정상 역패치/제거하는 범위이며 다른 원자료를 삭제하지 않는다.
