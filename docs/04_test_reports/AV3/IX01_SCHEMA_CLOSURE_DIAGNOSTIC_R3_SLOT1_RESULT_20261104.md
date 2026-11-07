# IX01 R3 실제 단발 결과 불명·보존 보고

2026-11-04 · UNKNOWN / QA_RETAINED / 재실행·자동mutation·삭제 금지

신산님call_127843611ef2456ebcf6181b0a8ae06b의새R3단1회승인사용. codefc59c4e8d1f0a56c909ed219fee5e7c0f86ba528,SQL0a647daa66103ada3bd5e949b64f407c3e7b5687,원packet866A67D9502ADAD98655511F88A9B2BA679E0E0AFCF87E55A2417988B68A1CAA 보존. issued16:32:19Z/전체만료17:02:19Z,slot만료16:45:57.310Z. 생성전신원a0ac57/소스343b2a→45717/fda212 exactclean을확인했다. 원packet의publicinstance33자리오기는08976b에서동일code첫32자리fc59c4e8d1f0a56c909ed219fee5e7c0로비의미정정기록했다. 대상·권한·횟수·기한·guard확대0,원문수정0.

## 실제결과
257f26 exit1,2026-11-03T16:36:01.586Z,stageROLE_PRISTINE/statusUNKNOWN/ddlStatusUNKNOWN/cleanupNOT_ATTEMPTED. SQLstate·diagnostic·statementEndLine null,roleEvidence빈객체. 원초기역할질의/검산의원문오류는수집되지않아직접원인미확정. SQL105설치/권한회수의실제증거없음·PG구문/RLS/API/UI인수PASS0. 소스정적단계순서는Primary에게별도분석배정했다. 같은run/slot재시도0·추가DBexec/rolequery/권한mutation0.

planHash a4c40e6a3c425acc94321511ad3950b24dc6aadf6fdec6899644e1660bad19d9. 신규fullID dda0ac772e0618ad143a7aedcb3a4a92c6354f7389d3f8e7e3635fa3c59250ec. resourceMayOutliveDeadline/manualOwnershipReviewRequired true. 실제결과를실패원인확정/정리0/PASS로승격하지않는다.

## 읽기전용소유검산·잔여
2aebf0 16:36:40.850Z:정확fullID/name/image/label의ownerIX01_DDL_20261104_R3·instance32·plan일치,runningtrue/PID1047187(관측값)/start16:35:59.772Z. networknone/port0/readonlyroot/999:999/capdropALL/no-new-privileges/bindsnull/mounts[]/tmpfs3/lognone/pids64/memory512MiB/CPU1일치. Secret/Env·DB본문출력0,read-onlyinspect뿐이며stop/rm0.

eeea55 16:37:47.964Z:신규source /home/daon/anvil-ix01-ddl-20261104-r3-qa UID1000/0700/nonlink/realpath일치/exactfc59clean/사용cwd관측0. 삭제0. 따라서잔여는새PG1·source1이며정리완료아니다. DB·권한의현재내부상태를추정하지않는다. 기존DB/키/서비스/Agent/P03R3변경0.

원격감사root /home/daon/.local/share/anvil-v3-qa-receipts/ix01-ddl-20261104-r3 의directory0700/원장0600/UID1000/단일link/nonlink검산후문서하위IX01/에정확복사했다. owner199B SHA609f190d1fb0cbc8598a5d073ac8f4b185c53bbe2716881eab0a38d8b71c5b2b,intent414B SHAef42cfebcc21ea1fc46911c96595cdb61e5010df4c0913cf5907118132628cce,result821B SHA0b0a8f67eadbb09ac21c6579b2ccef22cc631467c0ca38f9e5c45e68d71756b4. 파일 DDL_R3_SLOT1_OWNER/INTENT/RESULT_20261104.json,읽기metadata DDL_R3_SLOT1_METADATA_20261104.json. 원R1/R2실패·감사보존.

## 조치
UNKNOWN경계에따라자동후속mutation/삭제를멈췄다. 기존Primary는호출선/ready조건의source-only원인분석(쓰기·시험·실환경0)을수행한다. 정리만의구체안을아래별도후보로정의하고직접결정받기전실행하지않는다. 전체작업계획은미완료이며실제추가QA를승인받았다고해석하지않는다.
