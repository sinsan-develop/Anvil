# normal 코딩 Agent 생산자 잔여 경계 대조 (2026-11-15)

읽기 전용 대조 결과이며 새 계약 채택·제품 구현 지시가 아니다. 기준 main3c457c901aeab6f4f85ba11452e05c94f20585bd. 기존 FN07_CLAUDE_DRIVER_PROCESS_TOOL_BOUNDARY_CANDIDATE_20261106.md 및 FN07_CLAUDE_EXECUTION_ADMISSION_PRODUCER_CANDIDATE_20261106.md의 원본/hash는 수정하지 않는다.

## 이미 구현된 부분
현재 normal START 부모·자료·permit, SEND 원문/parts·명령별permit·내구dispatch·관측ACK, STOP target/page·역사소비ACK가 존재한다. Nov6 후보의 해당 부재 문구를 현재 근거로 사용하거나 동일 구현을 반복하지 않는다. 별도 admission/endpoint/서명을 새로 만드는 것이 필수라고 가정하지 않는다.

## 남은 실제 연결
claude-process-profile-selector는 보호 저장된 선언만 대조하고 executionEligible:false/ownership:UNVERIFIED를 반환한다. normal-start-wire 및 normal-instruction-wire는 injected driver.send와 관측참조까지만 제공한다. sdk-query-factory의 create 역시 주입 포트이며 Query/iterator/takeOwner는 SYNTHETIC_ONLY다. 실제 SDK 생성/Query·child·논리session owner는 아직 생산하지 않는다. STOP GET은 현재성 생산자 부재412, 새STOP소비도 owner부재 거절을 유지한다.

다음 최소 생산자 경계는 기존 profile 선택·normal START/선택 첫SEND·기존permit을 검산된 실행 구성과 같은 Query/child에 일회 연결하는 부분이다. 기존 permit 재사용을 먼저 대조하며 새 admission 체계를 전제하지 않는다. 미정 의미는 선언→실제exe/cwd/argv/env·계정/Secret 전달 보호근거, 첫SEND 중복없는소비, 계획/관측SID·논리sessionBinding·원Query/child·privateSTOP 소유 결박이다. 참조/합성표식변경으로 대체하지 않는다.

## SDK 증거 경계
기존 확인값은 SDK0.3.224·spawnClaudeCodeProcess 이름·SpawnOptions/SpawnedProcess 필드와 stderr포트 없음·hook signal 종료유예 의미다. hook전체서명/동기반환·실제호출처리·SDK argv생성문법·필수env/출처·tool결정callback 상세는 아직 미확인이다. READ3는 ENOTFOUND/bytes0이므로 새로운 공개사실을 확인한 것으로 표시하지 않는다. 별도 추가고정읽기질문 답변 전 재실행0. SDK 사실이 exe/cwd/env/Secret/계정/tool효과에 대한 제품허가를 자동으로 결정하지 않는다.

## 현재 보존할 상태
본 대조는 전체계획완료·전체독립작업부재 판정이 아니다. 현재 core 정상생산자에는 미정계약/SDK증거가 남는다. FN03 e59592e3 상세출처 질문은 PMO가 이미발행했고 미응답이므로 중복질문0/해당구현0이다. UI03/06/05/08/14/FN17 소비누락을 좁혀 조사한 부분은 이미연결 또는 새원천/계약미채택으로 구분했고 실제DB·서비스·인수는 여전히미완료다. SDK/Agent·DB·권한·키·서비스·실자료·설치실행0, Primary쓰기/실행handle0. Main은 WORK_STATUS/WORK_CHECK와 이 근거를 보존한다.
