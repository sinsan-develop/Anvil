# FN06 compile-only 원 승인 범위의 비의미 파서 보완 대조

2026-10-27 · Main 어울 · MAIN_RECONFIRMED_NON_SEMANTIC.

부모 직접 승인: call_ed1ed8eac53848b68e70c595604a2fdc / ‘위 범위 컴파일 1회 승인’. 최초 게시본 a8a1c17bfd300fcac05d9cbdfc175bfd5b9f98d2, 실행계획SHA38ACE796B2CB99B3E885158210036CE23CB15E53B1CFD3A64CB711858EDD6946, 최초결정SHA9ED533B51F5CB73036FD4ADE910BBF4EF2A25E347A42FEB76D756D22546BCC0E.

## 원 실패·미사용 근거

9e45c6 --apply는 OUTER_RESULT_UNKNOWN/exit1로 보존한다. 이 원 실행의 PS stderr 원문은 회수하지 못했으므로 원인 직접 관측이나 성공으로 고치지 않는다. 936734/c0a5a6은 QA/소비marker부재·관련csc0, 원source의expiryParse가marker/csc보다앞임을 확인했다. 50d3f3 및 같은exportedprefix를실행한 d24379는 PowerShell7.6.9 기본JSON변환의System.DateTime이ParseExact에서실패함을 재현했다. 독립 검수는 이 증거를 결합한 컴파일 전 wrapper 실패/소비0·NOT_EXECUTED 구분이 타당하다고 판정했다. 새로운 재컴파일 허가나 실행 횟수를 생성한 것이 아니다.

## 국소 변경

runner의 payload 해석 한 줄에 -DateKind String만 추가했다. 원SHA92BA1A25BB0460B30E484348F0758ADFDE940EDF821797370213257D216795D0→새SHA1414DF1742DAB290C4BC7797AE4021AFE41D3019123D83B1B89629A2CAC90B6C. 이 추가를 제거하면 원바이트/지문이 정확 일치함을 독립 확인했다. unit은 실제prefix 회귀를 추가했고 기존9본문은 보존했다. 새unitSHA4378C0687BC83EDF8CEE19B48DA241EE9E08A53E665EC232FB66E4257F062A56.

Main ac863a 신규회귀1 PASS/skip0/1041.5767ms·type/구문0. 담당은 신규+기존10PASS/926.2656ms·ASTparse0, 독립국소C0/I0다. 신규회귀는 실제PS의literal해석만 실행한 시험이며 pure모의9와 구분한다. compiler/state초기화/Preflight/FS/body실행은 아니다.

원 native12/tool4/manifestD6DE65F1/input4748D7A3/실행계획38ACE796·argv27·출력/root·단발1·compiler15초/진단16KiB·DLLload0·Agent/Job/PInvoke/키/DB/서비스0은 불변이다. 원 approvedAt 2026-10-27T05:02:17.000Z/expiresAt2026-10-27T05:32:17.000Z는 연장/변경하지 않는다. 의도된 원 ISO 문자열·기한/허용 효과를 정확하게 지키는 내부 기술 보완이므로 Main은 새 기능/요구/중요위험 확대가 없는 비의미 보완으로 분류한다.

## 재결박 조건

처음 승인된 실제compiler1회는미사용이며원범위그대로다. 새sourcefix를기존branch에검수/게시한뒤 actualexecutionCommit·runnerHash 두값만새exact지문으로다시결박한다. 최초결정파일은이checkpoint의Gitblob에원문을보존해부모승인/변경전후를추적한다. 현재동결결정의다른필드·시각·runId·maximumRuns·source/tool/nativebytes는절대바꾸지않는다. 이문서의분류나JSON이새사람승인을인증하지않고플랫폼심사를우회하지않는다. 플랫폼이원승인을인정하지않으면실제실행을하지않고정확차이와거절이유를보고한다.

실행직전남은창/privateexact·freshsource/tool/owner/nonlink·QA/marker부재를다시검사한다. marker가생성되었거나실제compiler가시작된후에는원결정으로재시도하지않는다. 범위확대/기한연장/다른compiler·참조·옵션·root추가0이며실행결과/정리/미검증은별도기록한다.

기술근거: [Microsoft ConvertFrom-Json의 DateKind](https://learn.microsoft.com/en-us/powershell/module/microsoft.powershell.utility/convertfrom-json?view=powershell-7.5). 문자열보존이실제실행안의엄격한ISOparse를가능하게한다. 문서열람/준비PASS는실제컴파일PASS가아니다.
