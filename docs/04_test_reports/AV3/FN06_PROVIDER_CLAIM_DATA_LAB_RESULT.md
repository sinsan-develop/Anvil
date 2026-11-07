# FN06 claim 영속 검증 결과

판정: 한정 실DB 핵심 검증 확인. 전체 FN06·Stage·작업계획 완료가 아니다.

## 기준과 변경

- 실행 source: f55bb3b6401153af6492d3a87afe1ea3dd754958 / codex/av3-stage-b.
- 원 base59와 pending0037 SHA EB4CC66E8D682F08225823E39BAE5AD40F7AF62B529D3774291E855F34536097, pending manifest 등록0.
- PMO의 정확 새빈1회 위임. caller49F3FCCD…/helperFD06B41F…/fixture5ACF8603…/runner4E6A254C…는 후보 문서의 fullSHA와 같다.
- QA의 basisRefs 두 참조 중 checks.basis에서 확정 임무가 누락되어 원 validator가 거절했다. 실제계산 추출 뒤 원누락 반례 SERVER_EXECUTION_FACT_INVALID를 재현하고 basisRefs 전체를 연결한 한곳만 보완했다. 직접5PASS368.6195ms/type/diff0·한정독립C0/I0/M0·독립실행0.
- 제품 validator·권한·SQL·서명·기한·성공 기준은 변경하지 않았다.

## 실제 명령과 결과

private exact Git checkout에서 새 전용 root/UID/daemon/image/Node/lock·부재를 대조한 뒤 다음 runner를 외부 bootstrap240초/TERM50초·runner180초로 1회 실행했다.

```text
ANVIL_FN06_CLAIM_DATA_QA=1
ANVIL_FN06_CLAIM_DATA_SHA=f55bb3b6401153af6492d3a87afe1ea3dd754958
node scripts/provider-claim-data-isolated-qa.ts --run
```

실제 고정 Node의 전체 경로·SHA와 리소스/정리 가드는 후보§3~4를 따른다. 원출력 exec-4ea214는 phase DONE / exit0이다. 이 출력의 case 표식 수는 별도 독립 시험 개수라는 뜻이 아니다.

|확인 경로|결과|
|---|---|
|기존 정상 API 후보·역할/예약·서명 등록·합성 HUMAN 확인·새 nonce status-only 교환|새 lab에서 저장 선행 도달|
|현재 HUMAN/session·정책/한도·context/preparation·grant/queue·서명 START permit|원 검사·정상 소비 유지|
|보호 claim flush 성공 직후 의도적 실패|필수 함수 도달1과 nonce/claim/proof mapping/receipt/감사 포함 6원장 snapshot 동일로 rollback 확인|
|같은 proof의 정상 저장|실제 claim/receipt COMMIT과 원문/hash 확인|
|같은 proof 재확인|추가 행0|
|새 proof로 같은 claim 재확인|원 claim/receipt 보존·새 nonce/매핑만 추가|
|별도 app-role 연결|정확 원문/내용hash/receipt 재조회|

이것은 **실DB 원자성 + 명시 합성 source/OS 전제**다. source/OS/capability·Provider 응답과 암호문 metadata는 합성이다. 실제 Provider/현재 OS/DPAPI/명령 실행·증거 진위·Agent 호출·THREAD/TURN 부모 전체·정식 적용 ready·전체 FN06/UI·사용자 인수는 미검증이다. executionAuthorized/dispatchPerformed/workAccepted/formalApplyReady는 false이고 실제 Agent 호출0이다.

## 정리와 기존 자원 불변

- PG fullID: 733804a8c6e21f9184feb81943b847dff3eea4339f63b8bc62608042a4773215.
- network fullID: dc659667f50f798867ff98cdf96f7d3c92099b6fbfbfa0762716c0e75a46282e.
- run label: 79825c4ee4d82abbba946d90371d1fee.
- 원문 files2/dirs5, closeFailures0/rootCleanupFailedfalse, runner failurefalse/cleanupFailurefalse, bootstrap status0 safe1 path_exists0.
- 독립 SSH exec-2ad07c exit0: exact ID·run/owner label·등록 root/관련cwd 잔여0. 새 합성 역할/DB·키/code/status credential은 일회 process/tmpfs와 함께 폐기했다. JS 문자열 완전 메모리 소거를 보장하지 않는다.
- daemon/image/Node SHA 불변. 정식 PG/API/Web의 기존 fullID/image/StartedAt와 runningfalse3을 대조했다. 정식 DB접속/서비스 변경0이다.

## 원실패·미검증·다음 작업

앞선 exact4a1c4b03·51efd29b·10b497b0의 3FAIL은 후보§6~8/WORK_STATUS에 보존한다. 첫 실패의 상세/자원fullID 미포착과 각 진단의 한계를 숨기거나 소급 PASS하지 않는다. 최종 새 후보의 성공은 QA 근거 누락 보정과 한정 경로만 증명한다.

다음 미완료는 저장된 claim의 현재 OWNER 인증 API·화면 조회 연결의 실제 소비 및 실제 로컬 Agent/native 연결이다. 이미 확인한 schema-only·원자성 시험을 완료 진도로 반복하지 않는다. 후속은 기존 승인 범위에서 source를 준비하고 필요한 actual 범위만 정확히 분리한다.

rollback은 후속 source의 일반 revert이며 정식 DB 자료 복구 작업은 없다. main 병합/배포/사용자 인수는 이 한정 결과에 포함하지 않는다.
