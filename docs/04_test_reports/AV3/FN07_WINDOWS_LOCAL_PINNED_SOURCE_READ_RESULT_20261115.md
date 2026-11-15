# FN07 Windows-local 고정 SDK 원문 추가 조회 결과

## 판정

승인된단발공개원문조회완료. SDK/Agent실행과제품연결완료아님. READ2~4실패/소진은보존하며이번새승인한건만소비했다.

## 승인·실행

- 직접승인기록: docs/approvals/anvil-r3-sdk-539e7e7fbe7c4d22805103692a80af6e.json
- 승인기록 SHA256: dc930b60ed4331e259a70d57c8105183bf95db250a01c75132f894a814436e7b
- 고정후보 SHA256: 921FEFEBE76A7FA7F1D4103CCF377C91A27DDE07CC6ABC62C95F5DE2039E5D23
- Main선발행후기존Primary실행1회,45123a exit0/1.3452562초/terminal session없음. attempted=true/getCalls=1/requestClosed=true/WINDOWS_READ_VERIFIED_SOURCE/live0.
- stdoutJSON34635UTF8바이트완전파싱,원문6구간31345B,omittedWindows0. 원SDK파일저장/import/eval/추가GET/기존DB·키·서비스변경/실제Agent0.

## 무결성

고정SDK0.3.224 packed1110841B·SHA512는원후보값일치,해제4056576B. d.ts333809B SHA556277033b15112811922d84ec8dc846d446cce7bd9aa27765c52a9c09869575, mjs1145192B SHA70e00a3ee54a88382ca606893ac3c4acdd9bb83a9e11a9d3e803fa0b63389ed5 각각일치. 공개원문은RAM에만수신했고이결과서는근거위치/판정만보존한다.

## 확인한 기술 사실과 한계

원UTF8바이트offset은0-based [lo,hi)다.
- d.ts[85298,85365): spawnClaudeCodeProcess는SpawnOptions를받아SpawnedProcess를반환한다. mjs[778920,779367): command/args/cwd/env/forwardedAbort.signal객체를hook에전달하고await없이this.process에대입한뒤stdin/stdout을바로사용한다. hook미등록은기본spawnLocalProcess분기다. 이사실이Anvil의프로세스생성권한을주지는않는다.
- mjs[775682,775765): output-format stream-json/verbose/input-format stream-json기본인자. [776169,776336)의일부turn/budget/model조건, [776667,776879)의canUseTool과permissionPromptToolName상호배타/stdio분기, [778360,778435)의선택session-id를확인했다. 전체argv필수조건은미확인이다.
- mjs[1130411,1130577),[778771,778920): 일부env기본표식/ENTRYPOINT·SDK_VERSION설정과NODE_OPTIONS제거/DEBUG조건을확인했다. oye/TM/SS별칭·모든실행분기·필수env allowlist는미확인이다.
- d.ts[87981,88396)의PermissionResult전체선언: allow의선택updatedInput/updatedPermissions/toolUseID/decisionClassification,deny의필수message와선택interrupt/toolUseID/decisionClassification. 타입선언의존재만확인했으며Anvil도구효과허가정책은미정이다.
- CanUseTool전체서명은발췌[6614,10739)끝에서잘렸고,실제도구응답소비분기는선택앵커hits0으로확인하지못했다. 두항목은미확인,추가GET0.

원6구간은[6614,10739),[52000,55431),[82795,89774),[313188,317323),[773231,780106),[1130343,1136143)이다. Main은기존수신결과에서총1781B의한정근거인용을인수했다. 독립기술판정후속은WORK_STATUS에누적한다. 실제실행구성/exe-cwd-argv-env비밀slot/최초SEND소비/Query-child-SID-STOP소유생산은여전히별도미완료다.
