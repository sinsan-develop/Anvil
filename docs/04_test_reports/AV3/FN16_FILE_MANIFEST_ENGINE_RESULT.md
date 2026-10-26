# FN16 실제 선택 파일 manifest 내부 엔진 결과

판정: **내부 엔진 구현·핵심 동작 확인, FN16 전체는 부분 구현**. 실제 합성 파일의 포함/제외·정확bytes/SHA256·필수ignored 누락·변조 재검증을 구현했다. 사용자 백업 UI·공적 반출 파일·DB snapshot·archive/복원은 아직 없다.

- 기준 codex/av3-stage-b 04ded287dda0094f80817bf2e9b7e136e4da9c27, WI AB9894B6FAB8714CC72ED08D7EA13407926E7C4EB3F4BD9BEE23847056F1DB58(초기667443B0의독립원선택/기대hash 문구M1보완·재검수C0/I0/M0). 구현 fn16_file_manifest_engine, Main 어울 관리/검수/통합·제품수정0.
- 신규4경로는caller명시선택·유한양수한도·정규화상대경로·중복/case·link검사, 실제fs read/hash·전후stat/handle정리, 명시제외/secret·credential분류미접근, 누락/변조/부분오류와독립원선택/version참조/기대hash를소비한다. .gitignore자동제외/자동삭제0·원문BOM/CRLF/binary변환0. 내부DTO이며공적wire/schema/API/DB/읽기허가계약으로채택하지않았다.

## 실제 검수와 보정

초기 cce3aa 엔진부재assertion RED는기능반례와분리했다. 실제 close.dat handle종료150ms 지연에서한도초과성공이던92e054 1FAIL을동일기대1460d7 1PASS로보정했다. 담당자 최초10PASS537903/type8d99bc exit0·Main37946d 10PASS2359.6222ms를보존했다.

독립검수 초기C0/I2/M0:

1. 전체제외와최종지문계산후budget누락. Main b3a306 actual excluded.dat/통제clock limit100·다음200에서complete=true반례exit1. 담당자54fc92 두추가반례(부모포함3FAIL)로재현.
2. verify await전해시검사뒤원mutable manifest를다시비교하는독립기준TOCTOU. 담당자714f69 actual파일v1→v2/검수중manifest·baseline변경1FAIL재현.

같은writer fixround1은제외루프·최종hash후budget과최종payload재지문, await전canonical복사/기대hash primitive/원선택고정으로해소했다. 신규4PASS8634b1, 최종14PASS70d746(3567.3995ms)/type3c275f exit0. Node단위명령은 node --test tests/unit/FN16/file-manifest.test.ts, type은 node node_modules/typescript/bin/tsc --noEmit -p tsconfig.base.json. **Main82f6ed fresh14PASS/0FAIL/0SKIP/3446.1123ms/exit0**, 독립scoped ACCEPT C0/I0/M0. payload hash를표준JSON/SHA로검사하며기존기대·한도완화0.

## 자원·한계·다음 연결

사전등록 D:/tmp/anvil-v3-stage-b/fn16-file-manifest-20261027-01/fixtures만fresh exclusive·부모owner SINSAN\cyhuh/nonlink/realpath검사후생성했다. 각실행30분내file별unlink·빈폴더rmdir로즉시회수, unknown자료recursive삭제0. Main최종실행의생성→정리UTC는2026-10-26 19:43:18.859→.960(binary.dat/bom.txt/ignored.txt),19:43:19.544→.712(close.dat),19:43:20.363→.372(junction/source.dat),19:43:20.978→.985(excluded.dat),19:43:21.563→.585(mutable.dat),각residual=false. 이후별도부재를확인했다. 제품함수는파일을쓰지않고시험fixture만생성/회수한다.

문서추정경로1·Node strip-only 문법1·legacy PowerShell ACL선행1은정정했고제품기능실패와분리했다. 정식FAILURE_REPORT0·fixround1·동일원인3회0. 기존자료/Backup·DB/Secret/권한·서비스·Agent/native/외부전송변경0.

OS 타프로세스TOCTOU/hardlink출처·특수reparse/FS·권한sandbox·진행중OS I/O강제중단은보장하지않는다. budget은협력적기한판정이며전체프로젝트완료/복원가능·secret-free판정아니다. complete는선택파일처리결과이며DBsnapshot/프로젝트일관성을인증하지않는다. 생산caller는별도권한·신뢰원선택/원문version/기대hash와OS보호를결박해야한다.

다음은승인FN16의반출/백업생성·검증복원소비경계를구체화해이엔진을연결한다. 공적형식/영속API·실제자료는이번부분구현에포함하지않는다. rollback은소유source checkpoint 정상revert·기존자료변경0.

## 최종 working 지문

- apps/server/modules/backups/file-manifest-input.ts — 37851A436BFB688A912787133169402BDEC6F3D00B9621DE7A7A45B170E2DA30
- apps/server/modules/backups/file-manifest.ts — 301558A84F57D3011488FA165BD11479726C9BB4D98BD14A764C69AB9409E379
- tests/unit/FN16/file-manifest.test.ts — C005F38B7024BD1409BBCABF4F89D20249EC0EE8B263BDAEA26BC78783B21C9B
- tests/unit/FN16/file-manifest-fixture.ts — 0BFF4C5EA1B930042CEF483D452955C18A1C66D62F0E22A10D0156A458E658E6
