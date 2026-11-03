# IX01 R3 UNKNOWN QA 수동 정리 결과

2026-11-04 · Main 어울 · CLEANUP_VERIFIED / 원 R3 진단 UNKNOWN 유지

신산님call_28d64e850d4a4068bf1ee13008152fa8 ‘이번 R3 QA만 정리 승인’을 적용했다. 정리안 SHA0920C8302201FD317547DCADC89F202E50BE670BE69C607ED3CEEB374B787DE5,새정리창2026-11-03T16:47:23Z~17:17:23Z다. 대상은fullID dda0ac772e0618ad143a7aedcb3a4a92c6354f7389d3f8e7e3635fa3c59250ec/name anvil-ix01-ddl-pg-20261104-r3-a1와신규source /home/daon/anvil-ix01-ddl-20261104-r3-qa뿐이다.

## 결과와 증거
- 최초기록명령g5:1270은자동승인심사시간초과로CreateProcess전중단됐다. d45721기록부재확인뒤허용된한번재시도ac95e5로기록했다. 실제정지시도와구분한다.
- 05a439에서소유/daemon/image/label/starttime/격리·감사·source를확인하고stop5를단1회시도했다. 응답판정에서UNKNOWN이되어rm/source삭제0으로멈췄다. 이최초원장UNKNOWN은덮어쓰지않았다. 당시stop응답본문은수집하지않아원인을추정하지않는다.
- 317363읽기래퍼는문자열구문오류로원격본문평가전중단했다. 문자열전달을별도구조화하고로컬vm구문검사후SSH로전달하는방식으로바꿨다. 같은실패명령을실행하거나신호를다시보내지않았다.
- 749c2f 읽기2026-11-03T16:58:10.888Z에서동일fullID/starttime·runningfalse/status exited/PID0/exitCode0/error빈값/finished16:55:47.064997392Z를확인했다. source존재/관측분모240·경로일치0을확인했다. events는빈배열이며없던이벤트를발명하지않는다. 정지실제상태가확정돼같은승인내남은제거만재개했다.
- 09c109 16:59:30.344Z는원UNKNOWN감사hash·동일신원·정상종료/현재daemon·source실제241프로세스목록의cwd관측/clean/exactfc59를다시대조했다. stop재시도0,rm최초1회·등록source만제거,상태CLEANED. 응답텍스트가아닌정상반환과fullID/name부재로효과를검산했다. 원실행R3의SQL/role질의를다시하지않았다.
- 7735be 17:00:25.409Z(한국2026-11-04 02:00:25+09:00) 별도조회exit0:정확fullID부재/name0/source부재·원격감사보존. 새QA실행자원잔여0. source초기cwd0의분모없는관측을삭제권위로재사용하지않고마지막수동검산의분모241/일치0을사용했다.

## 감사 보존
원격root /home/daon/.local/share/anvil-v3-qa-receipts/ix01-ddl-20261104-r3 는삭제하지않았다. 원owner/slot-a1의UNKNOWN·원R1/R2기록도보존한다. 아래파일은원격0600/UID1000/단일link/nonlink를확인한정확사본과읽기metadata다(이문서와같은AV3의IX01/하위).

| 파일 | bytes | SHA256 |
|---|---:|---|
|DDL_R3_MANUAL_CLEANUP_INTENT_20261104.json|541|c3791630ab6972295885cc2c536f47cd67bb37178d1958c33e1eeda4c23ba3fa|
|DDL_R3_MANUAL_CLEANUP_RESULT_20261104.json|592|5f71bc63904fb37e8d8e8905b18de35f9352a74cb3e1f82cecdcccbe3ede2b6c|
|DDL_R3_MANUAL_CLEANUP_RECONCILED_INTENT_20261104.json|510|1914583f46681067c0a782201d19bd011131ef3deaa81e15640ab825745abd19|
|DDL_R3_MANUAL_CLEANUP_RECONCILED_RESULT_20261104.json|515|7a6d1937a1dffa3cacb4fe46bf7f6fcadda4f46509d5442bc2f5fb8f36faef3a|

추가읽기metadata DDL_R3_MANUAL_CLEANUP_METADATA_20261104.json 및 DDL_R3_MANUAL_CLEANUP_FINAL_METADATA_20261104.json을보존했다. 실제SQL재실행/DB접속/role조회·권한변경/기존DB·키·서비스·Agent/P03R3변경0. 새정리승인은이번정리에만사용됐으며새QA승인으로전환하지않는다.

## 다음 작업
최종서버준비source2를Main독립검수중이다. 최초44PASS는pure범위이며실actual정제·오류분류호출선불일치I2를발견해같은Primary에게반례TDD보정을지시했다. 원R3직접원인은미확정이고SQL105의실제설치는여전히미검증이다. 전체계획완료가아니다.
