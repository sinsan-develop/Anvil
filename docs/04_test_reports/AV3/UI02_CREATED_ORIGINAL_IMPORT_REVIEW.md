# UI02 귀속 원문 가져오기 독립 소스 검수

판정: REWORK — C0/I2/M0. 실제 읽기 검수가 재개되어 WI와 manifest13/13을 확인했다. 이전 config 오류는 당시 미실행 이력이며 이번 검수를 막지 않았다. 제품·문서·시험·브라우저·자원·DB/서비스 실행 및 변경은0이다.

고정 대상은 UI02_CREATED_ORIGINAL_IMPORT_IMPLEMENTATION.md SHA DBADEC7D26F25BF4940BD152E8915EDC8F6821EBBB1736996AD221F2736F1181와 SOURCE_MANIFEST의13개 working SHA다. 기준d938c00e→소스WIP68ddf524, 검수현재HEAD816f34f1은문서후속뿐이다. Main의38PASS/타입0/합성DOM1·첫빈문서정상1과별개인소스검수이며후자의성공으로아래반례를PASS로바꾸지않는다.

## I1 확정 거절을 미확인으로 고정

- 위치: apps/web/src/features/design-trace/DocumentImport.tsx:109, import-api.ts:61.
- 최초후보POST전checkpoint가uncertain=true를저장한다. 유효JSON409/422거절을받아도현재b.importState.uncertain을OR하여true가유지된다.
- rejectedDocumentImport가false가되어후보선택닫기/편집복귀가막힌다. 원입력보존과사용자복귀가능은별개다.
- 최소보완: 과거시도의실제불확실성과이번전송중표시를구분해최초확정거절을기존UPLOAD의의미대로처리한다. 이미결과유실된시도는뒤거절만으로해소하지않고원명령을보존한다.
- 반례: 최초POST명확거절→원입력불변·uncertain=false·명시닫기가능. 기존결과유실→같은명령재확인반례는유지한다.

## I2 실제 버퍼 객체 교체와 같은 값 ABA

- 위치: DocumentImport.tsx:73–84,91,103.
- 표시승인은필드JSON/scope/importState객체만대조한다. 보호조회후같은필드와같은importState를가진새buffer객체로교체하면옛hash/본문이재조회없이표시된다.
- 지연조회중원buffer→같은값clone→원buffer의ABA는scope/generation을바꾸지않고WeakSet이원객체를다시허용하여늦은결과를받는다. 서버권한우회로판정한것은아니다.
- 최소보완: 컴포넌트내부checkpoint에서생성한허용buffer와외부교체를구분한다. 미등록객체를관측하는즉시표시·동의·비동기시도를영구무효화하며원입력/pending/history는보존한다.
- 반례: 같은값객체교체직후표시숨김,지연GET의같은값객체ABA후늦은결과폐기. 새보호조회성공전표시를복원하지않는다.

## 유지 범위와 다음 조치

기존UPLOAD/PNG 본문·명령·target 검사와시험기대완화는발견하지않았다. 새DOM은합성응답/명시채택까지만확인하며실제저장PASS를주장하지않는다.

Main은두지적을승인범위의실제기능오류로접수했다. 현재N4담당만codewriter이므로그작업단위해제후원UI담당에게round1을순차전달한다. 원반례를먼저고정해실제RED를확인하고최소수정후같은반례GREEN·직접인접/타입·한정재검수를진행한다. 제품범위/서버/SQL/권한/실DB/서비스/Agent 실행은변경하지않는다.

## round1 실제 반례 고정

기존spec11063bytes/prefix EF3FDBC0불변에round1을append한A3F00C4E를Main이실행했다. d70ff5 실제exit1: 6tests/1PASS/5FAIL(부모1·4subcase)/0skip, FIRST409/422·같은값clone·객체ABA실패,LOSS뒤거절과같은명령정상복구PASS다. 이전positive선택제외는명시했다. f07b05수명내정리·147ee0별도root/process0확인후원담당DocumentImport.tsx1파일보완으로넘긴다. 원실패를GREEN으로소급하지않으며자세한고정값은ROUND1_RED_RESOURCE.json이다.

## round1 scoped 재검수와 새 I3

원I1/I2는ADDRESSED다. 115행에서priorUncertain만과거불명으로유지하고,74–87행scope발급/관측순번이외부교체/과거객체를감지한다. 제품/시험/harness고정13/13·기존UPLOAD불변·원11063prefix·추가90초/기대불변을확인했다. 새판정은C0/I1/M0 REWORK이며변경/실행0이다.

I3 위치DocumentImport.tsx:103: importState가없는최초보호GET중화면이탈/CSRF변경→이전응답종료→보존버퍼재진입에서준비잠금이남는다. 98행의importPreparationId 해제에scopeRef동일/mounted조건을추가한것이원인이다. 이전표시권한이폐기됐다는것과자기준비잠금의정리는분리해야한다. 같은작업이소유한버퍼/준비ID만안전하게해제하고옛metadata/본문/동의는복구하지않는다. 반례는최초준비GET지연→이탈→응답완료→재진입과최초준비중CSRF변경이다.

Main bc72a2의전체7PASS/0skip(15233.4198ms)는기존positive와round1/5반례범위이며I3를덮지않는다. fe8d40수명내정리/d5a434별도root·process0을확인했고기존RED를소급하지않는다. ROUND1_GREEN_RESOURCE.json에범위와새REWORK를함께보존했다. 다음은원담당round2의새반례고정→실제RED→최소수정→같은반례GREEN이다.
## round2 한정 인수

원 I3 ADDRESSED·C0/I0/M0 소스 검수 ACCEPT다. DocumentImport.tsx:104가 자기 준비 ID와 동일 사용자/프로젝트/문서/기준 버전/hash만 대조해 현재 버퍼의 잠금만 해제한다. 새 ID·다른 대상·현재 입력/pending/history를 보존하고 표시/비동기 권한은 복구하지 않는다. 직전 원문으로 역대치한 SHA D43445D8 일치로 나머지 코드 불변을 확인했다. 검수자 변경/실행0이다.

Main d05d1c→fc015d 전체 고정 spec 실제 exit0·12PASS/0FAIL/0skip·13119.6472ms다. 정상 흐름과 round1/round2 모든 반례가 통과했다. 제품6D0B9AED/spec6ED05897에 한정한다. 949058 정리·74dce9 독립 root/process0 확인을 ROUND2_GREEN_RESOURCE.json에 보존했다. 원 RED를 소급하지 않는다. 실제 DB/서비스 제공 화면·사용자 인수·Agent 실행은 NOT_RUN이며 전체 UI02/FN03/Stage 완료가 아니다.
