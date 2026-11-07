# FN06 최신 Ownership source compile-only 실행 준비 WI

2026-10-27 · Main 어울 · source64bb7ab2db534e66d66bf150529df3017e4bd70e. 실행 준비 코드/시험만. 실제 compiler/QA 생성 허가가 아니다.

## 근거·목표

기존 D2는 CS4014/exit1 단발 소진, 이후 faultObserver 보정과 partial source 확대12파일은 재compile 미확인이다. D1 명시 compile 제외는 유지한다. PMO 한정 재개는 FN16/PG 두 지원만이므로 FN06 새 실행을 승인하지 않았다. 새 exact 실행안·hash·원인/영향/정리·직접 사용자 결정을 받기 전에 compiler/출력QA/DLL/Agent를 실행하지 않는다. 이 준비는 승인된 계획의 미검증 native 선행을 구체화하는 source/시험이며 새 연결권한이나 OS writer를 활성화하지 않는다.

## 허용4경로·담당

- scripts/fn06-ownership-compile-only-input.ts 신규
- scripts/run-fn06-ownership-compile-only.ts 신규
- tests/unit/FN06/ownership-compile-only-preparation.test.ts 신규
- docs/work_packages/FN06_OWNERSHIP_COMPILE_ONLY_EXECUTION_PLAN_20261027.md 신규

단일 fresh 담당만 작성한다. 제품 C#12/기존helper/미추적보호8·Main현황/manifest·다른경로 변경0. 새branch/사용자채팅/자동화/자식/Git commit/push0. Main 관리·독립검수·통합. 실제 DB/권한/Secret/TLS·서비스·DLL load/reflection/Add-Type/initializer/helper/worker/Job/PInvoke/Agent/외부비용·compiler/새QA는 모두 실행0.

## 입력·불변

Main 고정 manifest docs/work_packages/FN06_OWNERSHIP_COMPILE_ONLY_SOURCE_MANIFEST_20261027.json SHA D6DE65F1226575736CCF65AC951C44FE632012D1EBA9D25D2CF276ACDFF08A57의 source12/tool4 rawbytes만 대상으로 한다. wildcard/추가source/다른compiler·참조/다른출력/root/옵션/경고완화/다운로드/설치/restore0. 옛ProviderHandle3파일 후보·D2/A3 소비허가/시간창 재사용0.

새 root D:/Project/Anvil/.av3-data/fn06-ownership-compile-20261027-01만 검토용 literal이다. 현재부재·부모owner SINSAN/cyhuh와SYSTEM만ACL·nonlink를Main cb6eee metadata로확인했으나실제실행직전fresh재검사한다. 부모ACL변경0. 준비코드/시험에서는root·소비기록 생성0.

## 안전한 준비/실행 분리

기본 --plan만 source/tool/부모의 읽기metadata와 exactargv/범위를 출력하는 준비경로다. --apply는 별도 고정 결정기록 docs/approvals/FN06_OWNERSHIP_COMPILE_ONLY_20261027_01.json이 없거나 상태/정확source·runnerhash·manifesthash·commit/기한/수명/한도/단발run·직접승인종류가 불일치하면 compiler/QA생성 전 거절한다. 아직 결정기록은 만들지 않는다. 내부binding검사는외부사용자승인을인증하지않으며Main이원문/플랫폼승인을별도대조해야함을명시한다. caller boolean/currenttime로허가/창을만들지않는다.

actual 허용이 생기면 신규소비marker의CreateNew와정확고정root/source12rawcopy/hash·기존csc/3BCL서명·owner/nonlink/ACL·freshGit/private체크→library1회만. 새허가없이재시도0. max전체30분/compiler15초/진단합16KiB, 출력 DLL1개 존재/길이/hash만·load0. sourcecopy/diagnostic은공개secret원문없으며진단은유한코드/line/column·hash/bytecount 중심으로보존,경로/소스본문dump0.

프로세스는고정실행파일·argv만 UseShellExecute=false 상당으로수행한다. 기존검토된bounded캡처·정확본인PID/exe/start확인/중단·정리패턴을필요부분만재사용하되oldrun guard우회/기존파일수정0. timeout/상한초과시이번compiler root만정확신원대조후종료·추가child불명은광역kill0/예외보존. stdout/stderr를무제한ReadToEnd로모으지않는다. capturedbytes/EOF/exit/불명·메모리소거한계를분리한다.

정리는등록QA내source12/DLL1/temp예상파일만 owner/nonlink/절대prefix·관련process0후개별회수,소비marker는보존. 예상밖/불명process·metadata·cleanup실패는자동삭제0·근거보존보고. root부재를별도확인한다. 성공의의미는PASS_COMPILE_ONLY이며6능력/OS/키/실Agent/전체기능과분리한다.

## 시험·검수

1. 먼저 신규 unit만 TEST_ONLY로작성·실행하지않고Main에보고한다. pure exactsource/tool/argv/strictdecision/만료·소진/다른root·옵션·상한·메타불명거절, 승인기록없는apply가실행factory0/FSmutation0인계약을검사한다. 테스트용주입은실제호출경로와분리된순수함수/함수인자만,실제compiler/child/QA생성0.
2. Main RED뒤같은담당구현. pureunit/type/Node구문·PS가있으면ASTparse만. 실제--apply/컴파일/QA/Key/OS검증0. 구현완성후동결·hash/정확명령/결과/미검증을보고한다.
3. 독립Critical/Important0와실제소스/도구지문·정확실행계획/hash가갖춰진뒤Main이필요한새직접결정을1회요청한다. 자동심사거절은우회하지않고원인/범위를보고한다. 이문서/단위PASS자체는실행승인이아니다.
