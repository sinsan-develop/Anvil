# FN16 파일 검증 참조 공급 — 한정 계약 결정 후보

2026-10-29 / Main 어울 / 기준938cf357fa19aa02adf40de7588e54e781850ffb / 상태: PMO 결정 전, 구현0

## 문제와 승인 범위 차이
보호 참조 R2는 VERIFICATION spec `{checks,limitsRef}`를 정의했지만 실제 공급 전 저장을412 REFERENCE_UNAVAILABLE로 닫도록 했다. 현재 backup-reference-store.ts는 그 차단을 유지한다. 이번 설치 자원·이식키5A6819 계약§67도 이 미정 부분을 풀지 않았다. 따라서 아래는 기존 검사기 존재를 새 공개 선택/저장 계약으로 연결하는 추가 의미 결정이며, 기존 승인만으로 임의 적용하지 않는다.

기존 createFileManifest/verifyFileManifest/validateFileRestore는 선택 파일의 manifest·실제 bytes/hash·독립 기대 기준 대조를 구현했다. DB snapshot/schema/관계·암호화된 전체 bundle의 검증 형식은 아직 미정/미구현이다. 이 후보가 전체 백업을 준비 완료로 만들지 않는다.

## 대안과 권장
- A(권장): 현재 구현된 선택 파일 범위의 검사 프로필만 공급한다. 검증 기준 선택→정확 불변 참조 저장·조회·현재성 연결을 source로 완성하고, 전체 백업 정책/job에서는 범위 부족을 계속 거절한다. 실제 공급 설정·DB는 만들지 않는다.
- B: 전체 DB/관계/암호화 bundle 계약을 먼저 확정한 뒤 모든 검사 프로필을 함께 공급한다. 전체 여정 정합이 빠르지만 이미 구현된 파일 검사 연결도 더 큰 계약 결정에 종속된다.

권장 A는 부분 범위를 숨기지 않고 독립 사용 가능한 파일 검증 기준을 준비하는 순서다. 전체 FN16 완료·검사 기준 완화·미지원 검사의 PASS가 아니다.

## A안 정확 계약
1. 보호된 설치 공급자의 불변 프로필은 `{ref,displayName,scope:'SELECTED_FILES_V1',checks,limits,current}`. 서버 내부 원본에는 installationId·버전 출처와 현재성 근거를 결박하며 path/키/handle은 공개하지 않는다. source 구현에서는 신뢰된 내부 공급 port로만 주입하고 기본 실제 catalog는 부재다. 파일/설정 생성·자동 숫자 발급·환경변수 fallback0.
2. checks는 순서가 고정된 세 항목 전체다: `FILE_MANIFEST_V1`, `FILE_BYTES_SHA256_V1`, `FILE_RESTORE_COMPARE_V1`. 기존 manifest/verifyFileManifest/validateFileRestore에 각각 연결한 지원 목록이며 등록 시 이 검사들을 실행하거나 결과 PASS를 만들지 않는다. 하나 누락/임의 ID/중복/순서 불일치는400, 실제 공급 부재나 정확 버전 불일치는412다. 기능 일부가 미지원이면 프로필을 사용 가능으로 공급하지 않는다.
3. limits는 기존 검토서§5의 `{inputBytes,outputBytes,stagingBytes,metadataBytes,fileCount,deadlineMs,retainedFailureBytes}` 모두 양의 안전정수이며 생략·무제한0이다. 기본값을 임의 생성하지 않는다. 이번에는 값/Ref를 공급·조회·고정하는 코드만 만들며 실제 수치 설정/발급은0이다. 실제 job 연결 시에는 프로젝트/FN10/저장공간/선택 실행 한도와 이 프로필 중 더 좁은 값을 전 필드에 적용해야 한다. 기존 자료10GiB·파일20MiB를 백업 전용 수치로 자동 전용하지 않는다. 이 후보가 job 실행 한도 상세 결정을 대체하지 않는다.
4. ref는 기존 VersionRef. canonical hash는 `{installationId,id,version,scope,checks,limits}`로 고정한다. displayName·현재 관측은 지문 밖의 표시/현재성이고 임의 다른 본문을 같은 ref로 공급하지 않는다. 고정 과거 ref 조회가 없거나 현재 선택 허용을 확인할 수 없으면 거절한다. 단순 hash 일치를 설치 출처 인증으로 취급하지 않고 필수 현재성/출처 공급자가 없으면UNVERIFIED다.
5. 조회 한 개 추가: `GET P/backup-verification-profiles` (P=/api/v1/projects/:projectId), query limit?/cursor?만, 기존 OWNER+민감자료 접근/no-store·조회는제어권불필요·다른project404를유지한다. 기본50/최대200, 기존서명cursor30분/4096자에 새domain·project/actor/client/limit/order를결박한다. 반환 `{state:CONFIGURED|UNCONFIGURED|UNVERIFIED,page:{items:Profile[],nextCursor,hasMore,observedAt}}`. 공급부재는UNCONFIGURED+빈목록이며 허위 READY0. Profile.current는 기존 eligible/reasonCodes/observedAt형식과 기존VERIFICATION_NOT_CONNECTED 또는RESOURCE_VERSION_UNAVAILABLE만 사용한다.
6. 기존 `saveBackupReference` VERIFICATION 외피/spec/승인·정책·CSRF·현재control·정확version·receipt/audit/replay는 유지한다. 선택한limitsRef에 체크 세트 전체가 정확히 결박되어 있을 때만 저장의선검사와쓰기후commit전재검사에서 같은공급자를대조한다. 바뀜/회수/불명은transaction실패이며 새성공/승인소비로보고0. 과거 reference조회도원문은보존하고현재사용가능여부만거절표시한다. 과거 참조/파일/키 삭제0. 기존R2 테이블/미적용SQL은이snapshot을이미보관하므로새migration은이번범위0.
7. UI14는검사프로필의범위·검사3개·유한한도·현재가능성·정확ref를조회해명시선택한다. ‘선택 파일 검증 기준’으로표시하고‘전체백업 준비완료’로표시하지않는다. 선택으로저장/실행하지않고기존원명령→별도승인→복귀/명시저장→재조회동선을사용한다. unsupported/현재성불명/목록변경은저장불가,기존원UNKNOWN/과거조회보존.
8. 전체 DB/schema/관계/키가용성·암호화bundle 검사는 이scope에포함하지않는다. 이후saveBackupPolicy/createBackup/전체복원연결은필수검사coverage가부족하면계속차단해야하며이파일프로필로묵시대체하지않는다. 실제검사실행API/job/자동정리/백업형식은추가하지않는다.

## 채택 후 구현·검수 경계
정확 source 목록은 위계약을현재route/store/UI소비선에대조한WI로고정한다. 단일기존primary가provider/store/route·클라이언트/화면·합성검증을연결하고Main은관리·독립검수·통합한다. 정상프로필조회→원승인결박→기존저장/replay→현재성조회,임의checks/타project/정확ref불일치/commit전회수/한도누락·비유한/oldcursor·원오류비노출을검사한다. 실제PG/브라우저served·사용자인수는소스검수로대신하지않는다.

이번 결정 요청은 위 A안의 공개 조회·검사ID·scope·limitsRef 의미와 source/화면/합성 구현 채택이다. 실제 profile 설정/한도값 발급·DB 적용·사용자정책/권한·키·서비스·Agent·전체백업/복원·P03재실행은 제외한다. 미채택이면 기존412를유지하고이후범위의제품수정은하지않는다.
## 참조·정렬 명시
Profile.ref가 저장 spec.limitsRef에 그대로 들어가는 정확 전체 Ref다. checks와7필드limits·scope를함께결박하는프로필ref이며한도만분리한별도임의ref를만들지않는다. 목록정렬은 ref.id 오름차순·같은id의version내림차순, 같은id/version의다른hash는공급자불명으로거절한다. cursor는이마지막키와기존query결박을보존하고새공개createdAt필드를추가하지않는다. 목록전체시점snapshot을보장하지않으며최종선택/저장은정확ref현재성을재검사한다.