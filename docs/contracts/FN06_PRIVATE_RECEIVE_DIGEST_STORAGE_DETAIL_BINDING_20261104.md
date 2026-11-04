# FN06 receive credential digest private 저장 상세 보완 binding

2026-11-04 · Main 어울 · MAIN_INTERNAL_DETAIL_COMPLETION · SOURCE_GO1 / ACTUAL_EXECUTION_GO0

## 1. 원 직접 채택과 근거

부모 직접 승인: call_453a800c6ef74f0c8b723fea57ed2100의 “패킷 source-only 채택”. 원 adoption은 FN06_NATIVE_FIRST_RECEIVE_SOURCE_ADOPTION_20261104.md SHA256 0c5f030118405c6d917cdae31fc6f876a4357fd1f431b96160cd5a9efeca57e6이고 패킷은682a51daca51fad9525b4db34ab62dcdd99b0d5dc63a2b1bca1acc211f2ca24e다. 허용56경로와 모든 실제 실행 제외를 그대로 상속한다.

wire6d1a727fb60298c4adcc37ce5066b4032f144e6f42b8a0b74f023d8af56e83f4의 §7은 새 receive credential은 한 번 반환하고 digest만 DB에 저장하도록 이미 정한다. 계상f8667e17830b60791d769a288ec77c82e34649a952bff9faf4ae688bb32c1597의 exact records 열에는 그 슬롯이 누락됐다. Primary가 발견했고 독립 읽기 담당자가 같은 요구·누락과 byte 식을 확인했다. 원 채택 문서는 수정하지 않고 이 보완을 추가 기준으로 고정한다.

판정은 기존에 명시 승인된 데이터의 누락 private 저장 슬롯 보완이다. 새로운 공개 입력/응답·인증 허용·user 권한·기한·보관 연장·평문 저장은 추가하지 않는다. 물리 schema는 한 열 늘어나는 명시 차분이므로 byte 동일한 변경이라고 주장하지 않는다. 실제 키/DB/GRANT/정책/서비스/Agent/컴파일/QA 실행 권한은 계속0이다. 기존 승인 범위 내 내부 구현 상세를 Main이 확정하며 재승인을 요청하지 않는다.

## 2. 정확 source 차분

허용0076의 native_receive_records에 private receive_credential_digest text NULL 한 열을 추가한다. record_kind=SESSION이면 lowercase64hex가 필수이고 다른 kind는 NULL만 허용한다. SQL은 다음 의미를 명시해 NULL의 UNKNOWN 통과를 막는다.

```sql
CHECK (
 (record_kind = 'SESSION'
  AND receive_credential_digest IS NOT NULL
  AND receive_credential_digest ~ '^[0-9a-f]{64}$')
 OR
 (record_kind <> 'SESSION' AND receive_credential_digest IS NULL)
)
```

SESSION insert와 같은 Tx에서 서버가 발급한 새 receive credential의 canonical base64url43 실제 ASCII bytes를 SHA256 lowercase hex로 저장한다. 인증에서도 같은43B 표현을 사용하며 JSON 따옴표/decoded32B와 혼용하지 않는다. 기존 native opaque/digest/purpose 값은 재사용하지 않는다. 평문·credential을 저장하거나 새 signing key를 생성하는 변경이 아니다. 같은 SESSION 불변행은 나중에 digest를 바꾸지 않는다.

값은 공개 payload가 지정할 수 없다. public ReceiveSession exact7·ref/hash, 공개 response/조회/IPC·오류/로그에는 새 열을 반환하지 않는다. private 인증 조회/계상 projection만 소비한다. public snapshot_canonical/record_json에는 추가하지 않고 request_hash/content_hash 의미도 전용하지 않는다. 원문 hash는 그대로다.

## 3. 실제·미래 비용

비어 있지 않은 P(record)의 새 key 공통 비용은 comma1+quotes2+key25+colon1=29B다. SESSION은29+quoted64hex66=95B, 다른 kind는29+null4=33B씩 증가한다. records45 중 SESSION1/다른44의 정상 전체 증분은95+44×33=1547B다. 새 행/slot은0이며 R54 전체에 곱하지 않는다. public JSONB/text 병행 원문에도 넣지 않으므로 두 배 계상0이다.

미생성 SESSION의 최대예약에는95B, 다른 미생성record에는33B를 포함하고 생성되면그정확분을actual로옮긴다. fn76_projection의exact key와actual/typed max·remaining·summary 검산에같이반영한다. 예약summary수치변화의자기행비용은기존self projection에서재검산한다. 다른프로젝트/기존범위를일괄수정하거나전계정재계산으로오염을덮지않는다.

## 4. Primary 실제 구현 지시

기존 단독 Primary는 이 상세 보완을 승인된56경로 안에서 TDD로 구현한다. 최소 음성은 SESSION missing/null/잘못된hash, 다른kind nonNULL, 공개payload의digest 지정/공개반환, 발급/인증 표현혼용이다. 정상 저장·조회는 실제제품producer/인증소비·private projection을소비하며counter값만맞춘대역으로증명하지않는다. SQL CHECK/역완결과source test는실PG실행과구분한다.

현재quota/guard구현을중단하지않고같은단독writer가적절한S2/S3접점에반영한다. Main은코드동시수정0이며독립재검수·필요집중검증후통합한다. source/private한열외의새의미가필요하면정확delta를먼저반환한다. 실제실행은계속제외다.
