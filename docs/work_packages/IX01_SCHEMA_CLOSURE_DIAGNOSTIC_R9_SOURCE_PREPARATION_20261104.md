# IX01 R9 source 준비 지시서

2026-11-04 · SOURCE_ONLY · 실제 QA 실행 승인 아님

R8실행은0074/42601/문장끝110 FAILED/CLEANED·5aac01 별도잔여0/감사보존으로단1회소진됐다.0074한문자/서비스정확checksum보완SQL기준a3a12bd3e4fbf430d997c8d1c764c4de30b27ffb local/private고정.0074raw E3DBD7FA537705C94CB34BC5D93AA643D6CA4B7E4C6E6C5155F186EE88416941/33601B·부모대비-1B/다른guard·ACL불변. 원R1~R7실패UNKNOWN보존.

## 단일 writer·허용3경로

기존Primary만수정·Main동시코드쓰기0. 다른작업자변경/보호3/Backup보존.
1. scripts/qa-ix01-schema-closure.sh
2. tests/unit/IX01/schema-closure-controller.test.ts
3. docs/04_test_reports/AV3/IX01/DDL_SOURCE_ALLOWLIST_20261104_R9.tsv 신규

## 정확 보완

부모R8의고정namespace r8/R8를r9/R9로,SQLbaselinefed86a515561d3f342859367d90d94e26b530248를a3a12bd3e4fbf430d997c8d1c764c4de30b27ffb로교체한다. 직전cwd음성은R8이되고직전fed86음성1개를추가하며원다른음성은보존. 추가음성1개를분리해역치환부모raw동일을증명한다. plan18/owner6/resultshape·provider/0037Tx·role/권한·기한·UNKNOWN·회수정리불변.

새index는R8raw에서headerbaseline만a3a12bd3로,0074행의hash/bytes만e3dbd7fa537705c94cb34bc5d93aa643d6ca4b7e4c6e6c5155f186ee88416941/33601로바꾼다. 다른105행불변/표시106/명시105·중복0031제외/order09d2e7d5cd8715a0ff02540d4397db2d4cb8dcf818d808ce328423d7583f24ef불변·새총2376141B. 기존index/SQL/제품코드변경0. 신규106원문을SQL기준Gitblob과대조한다.

직전cwd/baseline음성·provider선택·actual-controller집중검사와Bash-n/diff만수행. 기존56/noEmit/환경50/native44/회원16은동일로직증거재사용·반복전수0. 정확명령/exit/수량·역치환/index/선택/hash/bytes·오류/미검증/writer반환/live0반환. 실제DB권한키서비스Agent/WSL/Docker/실자료/P03R3·새QA실행/시각발급0,Git/새branch/worktree/thread/자동화/외부메시지0. Main독립인수후정확code/instance·생산SQL/신규자원/기한·UNKNOWN/정리를실행후보로고정하며새실제QA는새직접결정전금지·소진R8재사용0·전체계획미완료.
