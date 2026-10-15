# Anvil v3 화면 단위 업무 카드

상위 계약: [작업계획서 r7](../WORK_PLAN.md). 설계 기준은 [v3 설계 r8 §11](../design/Anvil_설계서_v3_초안.md)과 P01 REVIEW-02 승인 클릭형 시안이다. 초기 정적 SVG는 배치 참고다. 제품 업무 상태는 전부 시작 전. 버튼 모양만 만들거나 예시 자료로 보여주는 것은 이 카드의 완료가 아니다.

## 공통 화면 계약

- 계획 등록부의 `착수 선행`은 승인 계약에 따른 뷰 작성 조건, `완료·연결검수 선행`과 각 카드의 FN 목록은 실제 연결 포함 수용 조건이다. 카드의 설계/선행 약칭만으로 두 축을 합치지 않는다. 뷰를 먼저 작성해도 부분 구현이며 실제 기능/보안 검수를 생략하지 않는다.

- P01에서 확정한 동작/상태와 P02의 FILE_MAP·API/schema를 사용한다. 각 화면 파일은 `apps/web/src/features/<아래 명칭>/`에 귀속, 실제 파일 목록은 배정 패킷에서 고정한다.
- 공통 shell/UI00 외 다른 화면을 임의 수정하지 않는다. 공통 변경이 필요하면 Main에게 영향·변경 파일을 알리고 writer를 조율한다.
- 실제 기능 전에는 승인된 계약 fixture로 화면 동작만 만들 수 있으나 ‘부분 구현’이며 제품 실행 경로에 목업 fallback을 남기지 않는다. 카드 최종 검수는 실제 연결·재조회까지다.
- PC 1920×1080/1440×900, 본문/폼12px·메뉴14px·제목16px, 설명10px. 모바일430×844, 터치44px·입력16px. 남색/파랑, sans-serif fallback, 설명 i/펼치기, 색+문구 상태.
- 정상/로딩/빈값/오류/권한 없음/로그인 만료/연결 단절/미저장/버전 충돌 중 해당 상태를 포함한다. 실패해도 입력을 보존하고 ‘전송·수신·적용’ 구분. 권한은 서버 판정과 일치해야 한다.
- RED는 해당 카드의 행동/오류를 누락된 상태로 재현하는 시험이다. GREEN은 같은 시험+실제 기능 연결. P03의 해당 UI 명령으로 type/build·화면시험을 실행하고 Network same-origin·콘솔 오류를 확인한다.
- 제출: 선택자/동작 계약, 실제 URL/권한/QA 엔터티, 핵심 전후 캡처·API/저장 재조회 근거·정확 명령·미확인·변경 diff. 예시를 실데이터로 표시하지 않는다.
- 검수자는 해당 카드 ‘독립 검수’ 순서를 그대로 따라 판정한다. 화면 단계 단독 합격은 관련 FN/IX 전체 합격을 의미하지 않는다. rollback은 해당 UI 변경만 대상으로 하고 데이터 삭제는 포함하지 않는다.

## UI00 공통 작업틀·상태 표현

- **설계/목표:** §11.1·12.3, 모든 S화면. 일관된 탐색·현재 프로젝트·권한·오류 표현을 제공하되 Dashboard를 첫 화면으로 만들지 않는다.
- **선행/파일:** P03 / `apps/web/src/shell/`, `styles/`, `api/`, 공통 UI·화면시험. 화면별 업무 내용은 범위 밖.
- **수행:** 프로젝트 목록 진입, 프로젝트 내부 탐색, 현재 역할/단계·제어권, 뒤로/새로고침 유지, 인증 상태, 공통 로딩/오류/오래된 자료/미저장 확인, same-origin client와 서버 오류 연결.
- **인터페이스:** FN01의 프로젝트·접근/최초 client·제어 상태, FN11의 변경 집행, 후속 FN15의 인계 상태, 공통 CommandContext/schema·cursor. 인계 UI 미구현 동안에도 초기 단독 제어를 유지하고 화면만 보고 실행 권한을 부여하지 않는다.
- **검증:** `entry_is_project_list`, `back_keeps_selected_project`, `expired_login_preserves_unsent_input`, `no_internal_api_in_browser`, `keyboard_focus_and_labels`. 실패 응답을 빈 목록이나 성공 toast로 처리하지 않음.
- **가독성 보완:** 기존 글자 표준을 유지하며 200% 확대·줄바꿈/가로 넘침·핵심 정보/행동 유실, 실제 글자/배경 대비와 focus를 확인한다. 작은 보조 글자라는 이유만으로 대비 위반을 단정하거나 미검증 11px 최소값으로 일괄 교체하지 않는다.
- **독립 검수:** 최초 진입→프로젝트→뒤로→새로고침→로그인 만료/접속 실패→재연결을 확인. PC 두 규격과 모바일의 탐색 축소/키보드/focus/상태 문구 확인. 이후 화면을 만드는 데 필요한 공통 구성만 구현.
- **인계:** shell/route/API 오류 contract·공통 컴포넌트 사용법·검증 결과. 소비 화면에서 접근성/오류 처리 재정의가 필요하지 않아야 함.

## UI01 프로젝트 목록

- **설계/선행:** AV3-S01, §11.2 / UI00,FN01. 파일 `features/projects/`.
- **사용자 업무:** 진행 프로젝트를 찾아 현재 위치·필요 결정·다음 행동을 알고 이어가기.
- **필드/동작:** 이름·목적·단계/상태/관측 시각·담당자·최근 작업·다음·결정 건수. 진행/완료/보관 탭, 검색·상태필터·cursor, 행→S04, 생성→S02, 결정→S08, 인수→S12.
- **기능 연결:** `listProjects`, `getProject`. 목록 클릭 자체는 시작 명령을 보내지 않는다. 권한 없는 프로젝트는 이름/건수도 목록에 포함하지 않는다.
- **RED/GREEN:** `filters_preserve_selected_project`, `stale_list_marked_not_fresh`, `open_does_not_start_agent`, `unauthorized_project_not_leaked`. empty/오류를 구분하고 오래된 목록을 현재처럼 표시하지 않는다.
- **독립 검수:** 실제 QA 프로젝트2개→상태 검색→하나 열기→뒤로/재조회→결정 바로 이동. 다른 QA 사용자로 목록 제한 확인. 프로젝트 수와 실제 API 결과·권한이 같아야 한다.
- **산출/인계:** 목록/상세 이동·필터·오류·접근 캡처, 실제 재조회 증거. IX01이 신규 프로젝트 생성 후 재진입해 사용한다.

## UI02 프로젝트 만들기·기존 소스 기준선

- **설계/선행:** AV3-S02, §3·11.3 / UI00,FN01,FN02,FN03. 파일 `features/project-create/`.
- **사용자 업무:** 목적/소스→방법론/자료→총괄/환경→시작 기준을 확인하고 프로젝트를 저장한다.
- **필드/동작:** 이름·왜/기대 결과, 새 빈/기존 소스·Windows 실행기·허가 경로, 시스템 기본/내 방법론/직접 정의, 기본 절차·문서·조건 미리보기·특정 버전 선택/복사수정·문서 가져오기/대화보완, 총괄/환경 선택, 4상태 기능/근거 확인, 중간저장/이전/다음/생성.
- **기능 연결:** `createProject`, `confirmBaseline`, 방법론 적용·문서 import. 도구/환경 조회는 FN06 제공 후 연결; 미연결이어도 준비 필요 프로젝트로 저장하며 실행 가능으로 꾸미지 않음.
- **RED/GREEN:** `purpose_required`, `resume_saved_wizard`, `existing_source_inspection_read_only`, `baseline_unverified_visible`, `create_not_execute`. unsupported 문서·경로 접근 불가·중복 생성·취소에서 원입력 유지.
- **독립 검수:** 빈 프로젝트와 기존 QA 소스 각1건 생성. 중간 저장/재진입, 실패 후 수정, 생성 후 S01/04와 저장값 동일 확인. 기존 소스 diff0, 기준선 미확인/사용자 확인 구분.
- **산출/인계:** 4단계 값/저장/소스무변경·중복0 증거. IX01에서 방법론·문서를 연결한 새 프로젝트로 사용.

## UI03 방법론 흐름도 편집

- **설계/선행:** AV3-S03, §4·11.4 / UI00,FN02,FN03. 파일 `features/methodology-editor/`.
- **사용자 업무:** 순차·병렬·조건·합류·재작업과 사람/Agent 역할을 정의하고 입력 문서·완료/승인 조건을 확정한다.
- **필드/동작:** 이름·시스템기본/사용자공통/전용·버전/복사 출처, 내장본 미리보기/복사→초안 편집·빈 직접 작성, 노드 추가/선택/이동/연결/삭제·확대축소, 우측 목적·입력·임무·문서·담당·환경·결과·조건·한도, 총괄 구체화 요청→diff. 저장/검사/확정/적용은 별도. 내장 원본 덮어쓰기 불가, 업데이트 자동 적용 없음.
- **기능 연결:** FN02의 draft/validate/confirm/apply, FN03의 문서/양식 조회. 총괄 제안이 없을 때 가짜 제안을 만들지 않는다.
- **RED/GREEN:** `rework_and_parallel_edges_roundtrip`, `validation_links_to_node`, `unsaved_graph_warning`, `shared_change_not_auto_applied`, `node_delete_shows_impact`. 키보드로 노드 선택·속성 편집 경로 제공.
- **독립 검수:** 사람 확인→설계→병렬 구현/시험→합류·보완 경로를 작성·저장·새로고침. 오류 노드를 고쳐 확정 후 프로젝트 적용. 공통 개정 때 기존 프로젝트가 유지되는 화면 확인.
- **산출/인계:** 저장된 그래프/버전·조작 영상/캡처·오류별 이동. 실행 순서 판단은 FN10 책임이며 UI에서 독자 scheduler 만들지 않는다.

## UI04 프로젝트 주 작업 화면

- **설계/선행:** AV3-S04, §7·11.5 / UI00,FN08~FN11,FN13. 파일 `features/workspace/`.
- **사용자 업무:** 절차에 따라 총괄/책임자에게 지시하고 실제 수행/자료를 같은 맥락에서 확인한다.
- **필드/동작:** 좌절차/하위 임무, 중앙 총괄 기본·열린 책임세션 탭·대화/실행, 우문서/코드/시험/미확인. 단계 선택 시 세션+자료 함께 전환, 탭 유지. 수신 대상·추가지시/중단후지시·첨부/전송·전송/수신/반영, 자동/건별·범위·시작준비·중지범위·재개.
- **기능 연결:** assignment/RoleBinding, dispatch/관측cursor, startStage, 권한/승인, requestStop/reconcile/resume. Agent 발언과 실행기 관측의 source를 따로 표시한다.
- **RED/GREEN:** `stage_switch_updates_session_and_docs`, `default_coordinator_and_tabs_persist`, `unsent_not_delivered`, `normal_report_not_pause`, `viewer_cannot_command`, `stop_requires_scope_and_actual_state`.
- **독립 검수:** 실제 단계책임자 선택→관련 문서 확인→지시1건 전달→실행/결과 관측→총괄 복귀. 접속 단절/재연결·중지 미확인에서 오표시/중복 실행 없어야 함. 첫 화면을 지표 카드판으로 만들지 않는다.
- **산출/인계:** 실제 임무/세션/이벤트 연결·주 화면 증거, IX02/03의 사용자 진입점.

## UI05 책임자·실행 상세

- **설계/선행:** AV3-S05, §11.6 / UI00,FN09,FN12,FN13. 파일 `features/session-detail/`.
- **사용자 업무:** 누가 무슨 범위로 실제 무엇을 했으며 어디서 멈췄는지 확인한다.
- **필드/동작:** 임무·완료조건·버전/환경·도구/세션, 직접/하위 방법·범위, 하위 목록·상태/최근 관측·결과. 대화/현황파일/변경/검증/원문 탭, 명령/종료·diff·시험 펼치기, 보완/이전/중지.
- **기능 연결:** assignment/result/checkpoint·실제 facts와 evidence 조회. 증거 접근 권한·마스킹을 유지하며 클라이언트에서 임의 파일/명령 실행하지 않음.
- **RED/GREEN:** `reported_vs_observed_both_visible`, `missing_evidence_not_complete`, `child_scope_and_results_visible`, `paged_logs_keep_position`, `evidence_access_denied_safe`.
- **독립 검수:** 실행 하나의 원문→파일 diff→시험→현재 현황을 열고 ID/시각/결과 일치 확인. 결과 일부 누락 시 누락을 드러내고 보완 요청이 원작업에 연결되는지 확인.
- **산출/인계:** 실제 로그/파일/시험·미확인 UI 캡처. IX02가 결과를 검수할 기본 화면.

## UI06 문서·설계·계획 추적

- **문서 불일치 화면/검수:** 설계 §4.3.1대로 서버 확정 version/hash와 연결 소스 blob/commit의 차이·관측 시점·영향을 표시한다. 서버 유지/소스 변경안 수집/별도 분리 선택→이력→재조회를 확인한다. 선택 전 자동 덮기/확정·파일 복원은 금지하며 실패해도 양쪽 내용/입력을 유지한다.
- **공식 산출물 보충 계약:** 프로젝트→방법론/단계→필수 산출물에서 양식·작성 임무·실제 본문/시안·근거·검수/승인·버전 이력을 조회한다. 파일 경로 목록만으로 완료라 하지 않는다. [양식 상세 초안](../design/공식산출물_양식정의.md)과 P02 확정 계약을 따른다. LLM 연결 전 임의 생성 예시를 실제 작성 결과로 표시하지 않는다.
- **설계/선행:** AV3-S06, §5·11.7 / UI00,FN03,FN04. 파일 `features/design-trace/`.
- **사용자 업무:** 문서·화면 위치에서 작업/담당/코드/시험/상태와 변경 이유까지 조회한다.
- **필드/동작:** 좌문서 종류/버전·초안/확정/사용 중, 중앙 Markdown·시안+ID위치 표식, 우화면/기능/연결 작업·진행/사용가능성/검증3축·diff/시험/누락. 직접편집·총괄수정제안→비교→초안반영·변경영향 이동.
- **기능 연결:** document version/proposal/confirm, TraceView/누락목록. 설계 확정 전 실제 계획 실행 금지, 오래된 버전 비교 허용.
- **RED/GREEN:** `screen_hotspot_opens_correct_design_item`, `reverse_trace_from_test`, `no_plan_for_design_visible`, `ui_and_fn_done_not_link_complete`, `stale_edit_keeps_user_content`.
- **독립 검수:** 하나의 설계ID→화면위치→화면/기능/연결 작업→변경/시험→원설계로 왕복. 과거 버전·수정 diff·누락을 확인. 현재 실행 결과가 없으면 미확인임이 보여야 함.
- **산출/인계:** 항목별 trace 캡처·실제 버전/저장·역조회 증거. IX01/04에서 연속 사용.

## UI07 설계 변경·영향·역사

- **설계/선행:** AV3-S07, §5.2·11.8 / UI06,FN04,FN11. 파일 `features/design-change/`.
- **사용자 업무:** 변경 이유/전후/영향을 판단하고 승인한 기준으로 계획을 개정해 이어간다.
- **필드/동작:** 요청자·이유·전후/버전, 화면/계획/실행/완료/시험/권한 영향 표·미확인, 근거, 승인/거절/수정지시, 계획 개정 대기/완료·재개, 시간순 이력/구버전.
- **기능 연결:** proposeDesignChange/analyzeImpact/activateDesignChange와 일회 승인. 승인과 계획개정/작업재개를 한 클릭의 무제한 권한으로 합치지 않는다.
- **RED/GREEN:** `unknown_impact_cannot_look_safe`, `approval_without_plan_not_resume`, `unrelated_work_stays_running`, `old_result_preserved`, `rejected_change_not_active`.
- **독립 검수:** 완료된 항목 하나 변경 요청→영향/미확인 확인→승인→계획개정→영향 업무만 재개. 이전 근거/버전 보존·원결정 이유까지 조회.
- **산출/인계:** 변경ID·전후·사용자 결정·실제 적용 상태·무관작업 유지 증거. IX04에서 실행 중 변경 확인.

## UI08 승인·중요 문제 카드

- **설계/선행:** AV3-S08, §6.3·11.9 / UI00,FN11,FN12. 파일 `features/decisions/`.
- **사용자 업무:** 정확 범위와 영향을 확인해 승인/거절/수정하거나 원인 미확인 실행의 다음 선택을 한다.
- **필드/동작:** 요청자/대상·환경·이유·범위·데이터/보안/비용/중단·복구·버전/만료·근거, 이번만승인/거절/수정. 문제카드는 마지막 요청/수신/수행·빠진기록·읽기확인/교체.
- **기능 연결:** approval request/decision 상태와 IssueClassification. 버튼 비활성은 서버 권한 판정과 동일, 결정된 요청 재클릭 시 기존결정 표시.
- **RED/GREEN:** `double_click_single_decision`, `other_client_decided_refreshes`, `changed_scope_requires_new_request`, `unknown_reason_not_invented`, `notification_click_not_approve`.
- **독립 검수:** 실제 요청1건의 승인/거절/만료는 각각 별도 QA 요청으로 검증. 다른 기기 결정·구버전 재시도·권한없음에서도 범위밖 실행0. 거절이 전체 프로젝트 중지/삭제로 이어지지 않음.
- **산출/인계:** 요청/결정/실행 연결·중요 문제 캡처. IX03/05에서 같은 요청을 교차 확인.

## UI09 새 세션·다른 도구 이전

- **구조화 대조 화면/검수:** 설계 §6.2의 6항목마다 기준 원문/버전·새 응답·일치/불일치/부족·확인 주체/근거를 비교한다. 부족 항목에서 원문 열기→보완→재검토를 확인하며 종합 점수만으로 재개하지 않는다.
- **설계/선행:** AV3-S09, §8.2·11.10 / UI04,FN14. 파일 `features/transfers/`.
- **사용자 업무:** 원본 지식을 잃지 않고 총괄/책임자·세션/도구를 바꿔 미완료 지점에서 잇는다.
- **필드/동작:** 기록·안전→인계내용→대상→이해대조/재개. 목적/헌법/결정이유/완료·미완료/파일차이·공백·원문, 정지 요청/확인, 대상 기능/인증/불일치. 총괄/단계와 확인 주체 명시.
- **기능 연결:** prepareTransfer/manifest/compareUnderstanding/confirmTransfer, 정지 facts. 기존 최종요약 요청에 의존하지 않는다. 연결해제와 원본삭제 UI를 혼합하지 않음.
- **RED/GREEN:** `unknown_stop_blocks_resume_not_reading`, `missing_context_visible_before_target`, `unsupported_target_disabled`, `understanding_mismatch_requires_correction`, `coordinator_needs_user_confirm`.
- **독립 검수:** 무응답 기존 세션→공백 확인→대상 변경→이해 불일치 보완→실제 상태 대조→재개. 완료 작업·결정 유지와 새 writer 조건 확인. 같은 도구/다른 도구 둘 다 IX04에서 실제 증거.
- **산출/인계:** 이전 manifest·정지·이해대조·새 역할 binding·원본 유지 증거. 미확인 항목을 성공 배지로 덮지 않음.

## UI10 헌법·지식·결정 이유

- **설계/선행:** AV3-S10, §6·8.1·11.11 / UI00,FN05. 파일 `features/knowledge/`.
- **사용자 업무:** 목적/헌법/최신 지시와 결정 이유·원문을 찾아 정정하고 이후 작업에 적용한다.
- **필드/동작:** 종류·검색·사실/가설·유효/대체/제외·적용범위, 원문/결정 이유/관련 ID/이력, 정정→diff·이유, 사용제외·공유 대상/승인, 헌법 적용버전·세션 이해대조.
- **기능 연결:** knowledge CRUD/search·source ref·context manifest. 원문 발언 위치로 이동하고 검색은 허용 프로젝트 안에서만 수행.
- **RED/GREEN:** `source_visible_after_summary_edit`, `excluded_label_not_delete`, `hypothesis_not_fact`, `share_requires_target_confirmation`, `constitution_versions_not_confused`.
- **독립 검수:** 실제 결정 원문을 저장·검색→이유/이력→정정→사용 제외→새 임무 맥락에서 제외 확인. 헌법 전달/이해대조 상태와 실제 버전 일치.
- **산출/인계:** 원문·정정·선별·공유범위 증거. IX01/04가 사용할 확정 결정과 실패 사례 준비.

## UI11 코딩 Agent·환경·권한

- **설계/선행:** AV3-S11, §9.1~2·11.12 / UI00,FN06,FN11. 파일 `features/connections/`.
- **사용자 업무:** 도구·실행환경·허용 행동을 등록하고 실제 사용 가능한 능력을 확인한다.
- **필드/동작:** 제품/유형/버전·실행기/계정참조·모델/옵션/한도, 기능별 확인/미확인/미지원·시각. 등록/읽기확인/작은실제시험/해제. 환경 소스/실행위치/대상·명령/비밀참조. 권한 자동/승인/금지·범위/기한.
- **기능 연결:** capability report·환경 CRUD·정책/승인. FN07 완료 뒤 같은 계약으로 두번째 도구 표시, 별도 재설계 금지.
- **RED/GREEN:** `open_page_not_connected_badge`, `unverified_capability_blocks_role`, `secret_reference_only`, `settings_save_not_expand_running_scope`, `test_requests_approval_when_mutating`.
- **독립 검수:** 실제 첫 Agent 등록→기능확인→시험→역할배정 가능/불가 비교. Windows 실행기와 WSL 대상이 따로 보임. 인증실패/한도/미지원·연결해제 때 프로젝트 자료 유지.
- **산출/인계:** 제품버전·지원표·실측·권한 diff·미지원 캡처. IX02의 실제 연결 사용.

## UI12 작업 사용자·클라이언트 인계

- **설계/선행:** AV3-S12, §9.3·11.13 / UI00,FN15. 파일 `features/control-handoff/`.
- **사용자 업무:** 다른 사람 또는 내 다른 기기로 제어권을 안전하게 넘긴다.
- **필드/동작:** 현재담당/기기·동시조회자·인수요청/이유, 진행/미결·정지 확인, 안전대기→요약확인→다음담당수락→권한상태. 조회자는 실행대신 인수요청.
- **기능 연결:** request/prepare/acceptControl·control generation. 접속이 끊긴 옛화면은 승인/수정 버튼과 서버응답에서 차단됨.
- **RED/GREEN:** `request_not_grant`, `old_client_turns_read_only`, `two_accepts_one_owner`, `failed_handoff_not_two_writers`, `same_user_handoff_not_restart`.
- **독립 검수:** QA사용자/클라이언트2개를 열고 조회→요청→안전대기→수락·구기기 권한 차단 확인. 미수락/실패 시 기존 상태를 사실대로 표시.
- **산출/인계:** 제어권전후·요약·세대/직접API 거부 증거, IX05 교차 검수.

## UI13 모바일 대화·지시·승인

- **설계/선행:** AV3-S13, §11.14 / UI04,UI08,FN15,FN17. 파일 `features/mobile/` 및 승인된 반응형 파일.
- **사용자 업무:** 원격에서 총괄/책임자와 대화·지시·중지/재개·승인한다. 상세 설계/흐름도 편집은 PC 안내와 수정 요청.
- **필드/동작:** 프로젝트/역할/현재위치/제어권, 대화 기본·절차/문서결과/승인탭, 추가/중단후지시·대상, 권한인수, PC와 같은 요청상세·범위 확인, 지원/허가 상태·알림 이동.
- **기능 연결:** PC와 같은 command/query/approval/control ID. 모바일 전용 복제 프로젝트나 별도 승인 저장소 금지.
- **RED/GREEN:** `same_request_same_decision_mobile_pc`, `touch_targets_and_input_size`, `hidden_risk_not_approvable`, `push_denied_in_app_fallback`, `network_lost_unsent_preserved`.
- **독립 검수:** 430×844에서 역할 선택→지시→실제 수신→승인→PC결정 반영→중지/재개. 실제 기기 미확인이면 에뮬레이션 범위를 명시하며 둘을 같은 PASS로 쓰지 않음.
- **산출/인계:** 모바일 캡처/입력·터치·인증/기기/브라우저 범위·원격 경로 미확인. 접속 경로 구성·VPN 생성은 범위 밖.

## UI14 설정·백업·한도·중요 알림·보조 조회

- **설계/선행:** AV3-S14, §10.4·11.15 / UI00,FN10,FN16,FN17. 파일 `features/settings/`, `features/overview/`.
- **사용자 업무:** 원본 보관·실행한도·알림을 설정하고 실제 결과/문제를 조회한다. 보조 Dashboard는 원화면 링크만 보조한다.
- **필드/동작:** 백업 위치/주기/보관/암호화참조·최종성공/실패·포함/제외·검증복원·영향비교/확인, 전체/프로젝트 슬롯/대기이유, 중요알림/지원, 현단계·필요결정·오류·다음 링크.
- **기능 연결:** backup/export/restore, policy/queue, notification preference. 설정 저장과 실제 backup/restore를 분리, 복구는 정확 영향/승인 필요.
- **RED/GREEN:** `backup_failure_not_success`, `restore_requires_impact_and_confirmation`, `missing_policy_not_unlimited`, `overview_links_to_source`, `submit_not_project_complete`.
- **독립 검수:** QA백업 설정→실제 결과/manifest→검증용복원·영향비교→원문조회, 한도 초과 대기·푸시 미지원 확인. 보조조회에서 원화면에 같은 상태가 보여야 함.
- **산출/인계:** 실제 설정버전·백업결과·미실행복구·알림/대기·요약일치. 실제 원본을 덮는 복구나 서비스 교체는 별도 승인 없이 검수하지 않음.
