# 기존 전역 설정 패널의 React key 충돌 최소 수정

기준 main ab8b2a2ea94dbac2ecaaaf710a64df4ddd2c6332(PR158). 기존 UI11 설정 화면과 공통 UI00 상태 보존·회귀 방지 범위다. 새 공개 API·권한·자료 계약은 변경하지 않는다. FN07 관측 추가 결정과 독립적으로 진행한다.

기존 Primary 한 명은 apps/web/src/App.tsx, tests/unit/UI00/project-shell-access.test.ts, 결과서 docs/04_test_reports/AV3/UI11_GLOBAL_SETTINGS_PANEL_KEYS_RESULT_20261116.md만 소유한다. Main은 현황/Git·독립검수/통합을 맡는다. 다른 담당자의 변경을 되돌리지 않는다. 필요한 추가 경로는 정확 근거를 Main에게 반환한다.

기존 App의 global #/settings에서 backupReferenceKey·installationResourceKey가 모두 빈 값이고 형제 BackupReferencePanel·InstallationResourcePanel에 동일한 ':'+session.csrfToken key가 생긴다. PR157 병합 smoke 4PASS 중 두 경합 사례에서 기존 duplicate-key 경고2건이 관측됐다. 실제 브라우저 영향은 미검증이다.

두 JSX key에 각각 backup-reference:와 installation-resource: 종류 접두사만 분리한다. 원 project/session/CSRF 접미사와 기존 부모 저장소 키·scope/CAS·컴포넌트 props·자식 코드는 보존한다. 키 생성 체계 전면 개편·새공통화·데이터/권한/설정 동작 변경은 하지 않는다.

기존 실제 App의 메모리 React 시험으로 global settings 중복-key 경고를 먼저 재현한다. 경고 포맷만 계수하고 원 console.error를 그대로 호출하며 인자 원문·토큰을 추가 저장하거나 모든 경고를 억제하지 않는다. 수정 후 해당 경고0·각 패널1, 같은 scope의 각 선택 상태 보존과 다른 프로젝트의 두 패널 초기화·기존 접미사 의미를 확인한다. 실제 POST/수신/권한 변경은 호출하지 않는다. 필요한 직접·인접 회귀·root 타입/메모리 빌드만 수행하고 기대값을 낮추지 않는다.

실제 브라우저/DB/권한/키/서비스/설치/CLI·SDK·Agent·실자료/백업 조사는 제외한다. source/RAM을 사용자 인수나 전체UI11/계획 완료로 표시하지 않는다. 결과서에 정확 명령/exit·원경고와 보완·지문·미검증·rollback을 기록하고 제품/시험 쓰기를 반환한다. Main이 독립검수·정확PR/Broker·병합본smoke·완료branch정리한다.
