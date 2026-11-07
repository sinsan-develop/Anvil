# FN16 보관본 독립 검증·새 위치 파일 검증복원

기준 codex/av3-stage-b 5b17f3d1e0a41c344ef74b07108f816d9c92a5fa. 기존승인FN16의별도검증복원단계이며보관본생성과중복아니다. 원source가없어도보관된metadata/payload를독립기준으로검사하고새빈검증위치에원bytes복사·재검증한다. 실제프로젝트/원본위치복원·업무자동재개0,공적RestoreReport/외부형식/API/DB채택0.

## 단일 writer 허용4신규경로

- apps/server/modules/backups/file-restore-validation-input.ts — 내부입력/결과.
- apps/server/modules/backups/file-restore-validation.ts — 보관metadata와payload검증·별도새위치파일검증복원.
- tests/unit/FN16/file-restore-validation.test.ts — 실제합성보관본/검증위치의정상/손상·범위·부작용검수.
- tests/unit/FN16/file-restore-validation-fixture.ts — 아래exactroot만fresh생성/명시회수.

기존manifest/builder8파일은소비만수정0. 본문다운로드·다른기능/문서·Git수정0.

## 동작·필수 경계

1. 호출자가별도보존한원선택/version참조·기대manifest hash와보호bundle root·유한선택byte/file/time/metadata한도·새검증목적지/취소를첫await전에고정한다. 원Signal의실행중abort는관측, 외부객체변경은채택0. 보관본자체의hash만읽어그보관본을인증하지않는다. 독립기준부재는읽기/목적지생성전거절.
2. bundle의manifest.json을일반파일/link거절·정확root/전후stat·boundedread/한도·handle정리로읽는다. 불완전/잘린/크기초과/잘못된JSON/기준불일치/조작은검증실패. metadata자체를재실행/신뢰상승하지않는다. metadata와payload의unknown/추가파일·예상밖dir/link는열거나따라가지않고불일치로보고한다. inventory는한도내로순회하고허용prefix안만내려간다. Secret/제외경로의payload는검수에서미확인내용으로허용하지않는다.
3. 기존verifyFileManifest를payload root/독립선택·기대hash로소비해실제누락/변조·버전참조불일치를검출한다. 원source는필요하지않으며원source에접근하지않는다. 정상검증과DBsnapshot/전체관계·내용진위/현재권한은구분한다.
4. 검증된payload를기존createFileBundle로별도보호parent하의새검증목적지에복사·재읽기한다. 기존목적지(빈것포함)/source또는보관본중첩·link/경로이탈은거절한다. 기존원본/보관본을변경하지않고자동업무재개/실제restore적용0. 새복사뒤원보관metadata/선택payload기준이달라졌는지다시검사하고처음고정한기준으로끝까지비교한다. 단순마커존재/직전검증만으로최종완료0.
5. 전체inspect→copy→재검증/모든close→최종반환에단일협력적deadline/원Signal을유지하고하위호출에잔여시간만전달한다. 유한metadata한도는caller명시입력으로두고새보관정책수치/공적schema를확정하지않는다. logical선택데이터크기와다중검수IO를혼동해기존정상파일에불시N배quota를요구하지않는다.
6. 실패/취소/손상/변경/정리불가를정확히구분하고검증기준·실패사유/소유정리결과를잃지않는다. 실패회수는이호출이배타생성한현재identity확인되는검증복사본만. 사용자bundle/원본/기존목적지/unknown삭제0. builder성공뒤후속검증실패시소유증거로안전회수할수없으면보존·미확인으로명시한다. recursive/임의wipe·retention0.
7. 내부임시보관구성소비일뿐공적Export/Backup/Restore형식/버전채택아니다. productioncaller의권한·신뢰원선택/보호root·DB일관성·OS경쟁/hardlink/reparse/specialFS·강제I/O중단/전원장애durability는보장0. 전체프로젝트복원가능/Secret-free/사용자인수로승격하지않는다.

## TDD·검수·정리

의미있는실제fs반례RED→GREEN. 원source삭제후보관본만검증/새복사bytes·BOM/CRLF/binary동일,metadata손상/잘림/크기/독립기준변조·payload누락/변조/extra·link,기존목적지/중첩보존,중간metadata/원선택변경·늦은취소/기한/close실패·새검증파일소유정리를선택검수. 기존21/14전수반복0·기대/한도완화0. Node집중/type/diff·독립리뷰,Main제품수정0/단일codewriter.

사전등록 QA exact D:/tmp/anvil-v3-stage-b/fn16-file-restore-validation-20261027-01, owner SINSAN\cyhuh, fixtures/source·backup-parent·validation-parent 이하합성case만. 생성전fresh부재/부모owner·nonlink/realpath,각생성최대30분·종료/실패즉시등록소유파일/빈dir명시회수·unknown시험자료도소유증거확인뒤마지막명시회수·별도잔류0. 기존2QAroot/사용자자료재사용0. ACL조회는확인된PowerShell7만,실제DB/권한·Secret/인증서·서비스/Agent·네트워크/native/의존설치0.

제출은4hash·정확명령/exit·실제fs/원RED·자원시각/목록·실패/정리·미검증·writer해제이며문서/Git쓰기0. rollback은해당source checkpoint정상revert·실자료변경0. 다음은정확servercaller/화면/프로젝트전체DB보존·권한과연결하되미구현을남기고전체완료라고하지않는다.
