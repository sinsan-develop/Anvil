# UI11 N4 한정 개발 서비스 전환 결과

판정: **한정 서비스 전환·익명 기본 페이지 확인 PASS. 전체 FN06/FN08/UI11·Stage 완료나 사용자 인수가 아니다.** 담당 Main 어울, 2026-10-18.

## 승인·정확 실행본

- PMO가 수신/전달한 신산님 직접 ‘서비스 교체 승인해’, 실제 수신 UTC 2026-10-17T18:36:50Z. 권장A의 짧은 Windows 개발 중단/API-Web 교체·known 9bade63e 일반 detached 복구만 승인했다. 무응답 위임/이전 SERVED02 재시도가 아니다.
- 기존 codex/av3-stage-b의 local/private·WSL exact clean **6781703a8fd7d258aa7f972bb5f81acaf5c3d388**, 이전4a47ebfd의 직접 자식 정확10파일. private main f976ed5e29e14b13e12729d5b1ccf98f050f2210 불변. PR/병합/새 branch0.
- 실행: PowerShell7의 `scripts/transition-ui11-development.ps1 -Apply`, **단1회 exit0**. 환경 binding marker AV3-PMO-N4-SERVICE-TRANSITION, runId d72144e4-c5c9-49d9-9013-3f6c9ab009ee, 고정 UTC 2026-10-17T19:06:48Z~21:06:48Z. 최종 packet/사전후 gate는 WORK_STATUS와 PMO에 실행 전 전달했다. 이번 단1회는 소진됐고 남은 창 재사용/자동 retry/연장0이다.
- operator SHA256 774C2E987185BF3E709F657DD0D699F9A0EABD47C51F69D68146402D48EC899A; flow8302D6503EA66197A778EBC9ACAFC8F7286429BC3A52CA732D362256CE747061; probe573D9B8DDFB98CC43708864C2675CA08BE7395BA3A8D96493E0851FDF93E8698.
- 원 Node23836/exe/시작 UTC2026-10-17T10:02:29.4487470Z·3830 소유를 재대조해 종료했다. 원 PID/메모리 복원이 아니라 새 Node **54212**, exe C:\Program Files\nodejs\node.exe, 시작 UTC **2026-10-17T19:08:16.5819440Z**, title anvil-ui11-n4-d72144e4-c5c9-49d9-9013-3f6c9ab009ee-new, 현재 사용자 소유·단일127.0.0.1:3830을 확인했다.
- 실제 receipt D:\Project\Anvil\.av3-data\runtime-ui11-n4-01\receipt.json, SHA256 **50459C537F84E4E9DB8B1DD35F3301638B1843EAB05A8928B7DEAEE1B5F74F92**. status PASS/phase DONE/originalStopped true/receiptFailure false/failure·rollbackFailure·probeFailure null/rollbackProcess null.

## 실제 확인 범위

| 경계 | 실제 결과 |
|---|---|
| HTTPS/서비스 | 기존 CA·엄격 TLS 유지, /api/v1/health 200·process 계약 적합 |
| 새 화면/asset | index1AFC88C707C3678A2BD6CE849E6D4C25CE66B47B188FB05EF12DF1A269BE9216 / JS923D30230B13D436BAD57153A9E2308148686AC57F49BEBE94E1CD7C71F0B3A9 / CSS034435504A3650CD6024E9AF5C9BE6797EFBB4CAA2C3587CC287F778DB5E9A56, 실제 응답200/hash 일치 |
| 새 보호 API | /api/v1/projects/00000000-0000-4000-8000-000000000000/source-read-grants 무자격401, 인증 우회0 |
| 익명 browser | Edge155.0.4283.45·새 profile·실제 암호입력 UI 표시, GET5/비GET0/off-origin0/pageerror0/asset·API·기타HTTP오류0/인증cookie0, 로그인0 |
| DB 무변경 | 기존 app의 READ ONLY repeatable snapshot81표/46migration 전후 동일 **81e953e18eea00f4be7ee2e54de1e7b986f08be45fbb658df57635defab8597c**, DB쓰기0 |
| WSL/PG | exact6781703a clean, fullID e6f798c3a2a3bdb2be533dd4c024d76f34d19fcfbbe4bf2acbe0437fb0cf32ba·image sha256:594290e91b09c09728ed945ff89db65cd0fafff251f7c03c3d99c00ae5d9442f·StartedAt2026-10-15T18:53:33.435483583Z/runningtrue/restart0 불변 |
| 보호 참조 | 기존 보호10hash·relay26052 exe/시각 유지, 기존6개 참조/NO_ARTIFACT_ROOT child 구성. 계정/정책/키/인증서/기존ACL·원문 저장 변경0 |

별도 후검사에서 새 PID/CIM owner/exe/start·3830, 원 PID 부재, receipt 전후 DBhash·HTTP/browser/WSL 증거, 새 runtime의 owner SINSAN\cyhuh/상속차단·현재 사용자+SYSTEM SID만, 보호10hash/구·신·backup 정적6hash·relay를 확인했다. 원 프로세스 메모리 전체 동일성·로그인 이후 기능/실제 사용자 여정은 이 증거의 범위가 아니다.

## 준비 검수·정리

- 최초 독립 C0/I3의 기록 실패→복구 방해·rollback PID/포트 신원 누락·UUID검증지연을 재현 RED→GREEN, flow14/Node entry3+probe4 최종7 PASS4143.4857ms·문법/type/diff0, scoped 독립 C0/I0(정적)다.
- 새 공개 atomic fixture3건·HiddenNode fake6환경 소비시험 PASS·각 exact정리/독립 부재는 앞선 증거로 재사용, 반복0.
- exact후보 build122module/744ms/exit0, >500k chunk 경고1은 최적화 이월·기준완화0.
- 등록 candidate-ui11-n4-02의3파일/빈폴더2, browser/ui11-n4-served-01의174파일/폴더56를 현재 사용자 owner/nonlink/실경로·관련 process0/후보3hash·정확목록 대조 후 제거했다. 별도 root 부재2·앞선 두 fixture 부재도 확인했다. 이들은 재생성 가능한 일회성 QA이며 기존 실패자료는 보존한다.
- 새 runtime receipt/server.out.log/server.err.log3파일·개발 PID54212·old index backup·기존 asset은 복구용 보존한다. 기존 전체 dist/실패 UI06 root·옛 receipt/log/PG자료는 삭제하지 않았다.
- 후검사 첫 SafeGetValue는 PowerShell AST 상수 평가 제한으로 exit1(읽기만/변경0), 고정 AST에서 literal 경로/hash만 추출하는 읽기로 수정해 보호10/정적6/relay/부재 PASS를 별도 확인했다. 잘못 추정한 문서 경로3건 읽기 실패는 rg --files로 정본 work_packages 경로를 확인했다. ACL 변경/실전환 재실행0이다.

## 미검증·다음

- 실제 로그인/프로젝트·자료 저장/새 HUMAN read grant·회수/서명보고/OS source 관측·정책 UI/실제 Agent 호출·계정교체·전체 통합·Oracle·사용자 인수는 미완료/미확인이다. 원 ANVIL_ARTIFACT_ROOT 미설정이므로 UI06 원문 저장 가능으로 표시하지 않는다.
- 성공 경로였으므로 실제 실패복구/old Git checkout·rollback 새 PID·서버 복구 실성공은 미실행이다. 순수/atomic 시험과 구분한다.
- 실패시 승인 known9bade63e 기준선 새PID·oldindex/asset/원6환경 복구 계획을 보존하되 새 실행/새 위험에 자동 재사용하지 않는다. 실제 root/Secret/서비스 범위 확대는 PMO에 정확 결정만 요청한다.
- Main은 이 연결을 전체 완료로 닫지 않고 승인 계획의 다음 미완료(실제 코딩 Agent 제어에 필요한 현재권한·임무/맥락·관측 경계)를 자체 선정해 이어간다. PMO 다음 작업 배정 대기0.
