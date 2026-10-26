# FN16 선택 파일 manifest 생성·재검증 내부 엔진

기준 codex/av3-stage-b 04ded287dda0094f80817bf2e9b7e136e4da9c27. 승인 FUNCTION_WORK FN16/INTERFACES §14.1/TECH_DECISIONS의 수동생성·포함제외·실bytes/hash·누락/변조검수 의미를 구현한다. Main ruling: 모듈 부재는 재승인 사유가 아니다. 기존 계획의 내부 생성/검증 엔진을 먼저 완성하고 공적 ExportManifest/wire/schema·새API/DB·실제자료 반출/복원은 별도로 남긴다.

## 단일 writer 허용4경로

- 신규 apps/server/modules/backups/file-manifest-input.ts: 내부 typed 입력과 결과 검사. 외부 wire/schema/catalog/generated-types 변경0.
- 신규 apps/server/modules/backups/file-manifest.ts: 선택한 실제 파일의 포함/제외·정확bytes/SHA256·재검증 구현. 실제fs를소비하며 합성객체만검사하는stub0.
- 신규 tests/unit/FN16/file-manifest.test.ts: 제품 함수를실제합성파일에실행하는 정상/누락/변조/불안정/제외/한도·경로반례.
- 신규 tests/unit/FN16/file-manifest-fixture.ts: 사전등록exact일회합성root만생성/회수. 다른테스트나도구수정0.

## 구현·위험 경계

1. 입력은 호출자가명시한root·선택상대경로·자료/원문version참조·required/ignored여부·포함/제외선택과이유·유한양수자원한도다. 임의전체디스크탐색·자동.gitignore제외/자동보존정책수치0. 내부DTO구현선택은가능하되외부durable형식으로채택하지않는다.
2. 실제file bytes를읽어안정된정렬/중복거절·정확bytes/hash·포함제외사유·필수ignored미포함을보존한다. 원문UTF8/BOM/CRLF/binary변환0. 파일불가/누락/기한·한도초과·변경중관측은문제/부분결과로분리하며성공빈목록으로숨기지않는다. secret/credential로분류된입력은열거나hash하지않고명시제외한다. 이엔진이비밀자동탐지완전/신뢰가능분류·권한허가라고주장하지않는다.
3. 상대경로의절대/상위/drive·ADS/혼합구분자/중복·case충돌·root이탈·link/reparse를거절, 현재root/segment/열린파일stat와읽기전후안정성을검사한다. 보장못하는OS경쟁·hardlink출처/특수fs안전은정확히공개한다. 이함수자체가보안샌드박스/일반사용자파일권한승인아니다. 생산caller/읽기허가·OS보호연결전에는API등록0.
4. 내부manifest의누락/bytes/hash/경로·중복/참조변조를재검증한다. 재검증은 호출자가 별도 보존한 원선택·자료 version참조·기대 manifest hash와 대조한다. manifest 안의 hash 재계산 일치만으로 출처·진위·현재 권한을 인증하지 않는다. 입력원본을수정하지않고함수종료/오류/취소시모든handle을정리한다. 실제아카이브/출력파일/backup삭제/retention/복원·실행재개0. DBsnapshot과의일관성은현재미확인으로명시하고개별파일검증만으로project전체COMPLETE/복원가능·Secret-free판정0.
5. 정상엔진/재검증은실제fs를소비하지만현재허가는아래새합성QA만이다. 기존원문·프로젝트/Backup/DB/Secret·임의OS경로읽기0. 새dependencies/network·native/PowerShell compiler·Agent/서비스/권한변경0.

## 검수·QA

먼저의미있는RED→최소구현GREEN, 실제binary/BOM/CRLF·required ignored 포함/미포함·제외이유·missing/tamper·변경관측·한도·경로탈출/중복·Secret분류미읽기·handle정리를확인. 기존전체회귀반복0·기대완화0. Node집중/typecheck/diff/독립리뷰를선택한다.

사전등록 QA root D:/tmp/anvil-v3-stage-b/fn16-file-manifest-20261027-01, owner SINSAN\cyhuh, fixtures/ 이하에합성파일/선택case만. 각실행시root부재/부모owner·nonlink를확인하고생성시각부터최대30분, 종료/실패즉시소유case/handle정리와exactroot회수·별도잔류0를확인한다. 현재생성0이며구체fixture생성/삭제구현은Main preflight뒤실행. 기존자료는어떤경우에도시험회수대상아니다.

단일구현subagent만code수정, Main은관리·검수·통합/제품수정0. commit/push0. 결과는실제파일엔진의부분구현이며화면백업버튼·공적반출파일/DBsnapshot·검증복원/사용자백업완료아님. 보고에정확경로/hash·실행명령/exit·원RED/최종·오류횟수/미검증·다음연결/rollback(정상revert·기존자료변경0)을기록한다.
