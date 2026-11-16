# UI00 모바일 메뉴 선택 후 본문 초점 복귀

기준은 main fedf6631e37c745c6e2534e0a3e3554f85bf11ff(PR156), 기존 승인 WORK_PLAN UI00 및 SCREEN_WORK의 keyboard_focus_and_labels다. 사용자에게 같은 기능 구현 승인을 다시 요청하지 않는다.

기존 Primary 한 명은 apps/web/src/shell/AppShell.tsx와 tests/unit/UI00/project-shell-access.test.ts 및 결과서 docs/04_test_reports/AV3/UI00_MOBILE_MENU_FOCUS_RESULT_20261116.md만 소유한다. Main은 현황/Git·검수·통합을 맡는다. 혼자 작업하는 저장소가 아니므로 다른 담당자의 변경을 되돌리지 않는다. 필요한 추가 경로는 정확 이유를 Main에게 반환한다.

이미 확인한 누락: 폭650px 이하에서 열린 메뉴의 현재 화면 링크를 Enter로 선택하면 menuLink는 메뉴만 닫는다. 같은 hash에서는 App 경로 변경 처리가 없고 숨겨진 탐색 영역에 초점이 남는다. 기존 main은 tabIndex=-1이고 본문 이동 링크가 활용한다. 기존 소스를 다시 설계하거나 새 탐색체계를 만들지 않는다.

정상 목표: 열린 모바일 메뉴의 일반 화면 링크를 선택해 닫은 경우에만, 닫힘 및 선택한 경로의 반영 뒤 해당 화면의 기존 본문으로 초점을 옮긴다. 동일 화면과 다른 화면 모두 aria-expanded=false, 올바른 제목, activeElement===main을 RAM에서 확인한다. 초기 로딩·일반 재렌더·메뉴 열기·다른 입력 편집 중에는 초점을 빼앗지 않는다. 데스크톱 탐색·기존 본문 이동 링크·프로젝트 문맥·뒤로가기를 유지한다. 기존 입력 보존·권한·API·키·DB는 바꾸지 않는다.

기존 실제 React 메모리 시험의 focus 구현을 재사용하여 누락을 먼저 재현하고 최소변경 후 정상/실패·직접 영향 회귀를 검증한다. root 타입과 필요한 메모리 빌드만 수행한다. 검사 기준·기대값을 낮추지 않는다. 실제 서비스/브라우저·DB·권한·키·설치·CLI/SDK/Agent 실행·실자료 조사는 제외하며 source/RAM을 실제 브라우저 인수로 승격하지 않는다. 완료 뒤 정확 명령·exit·파일hash·오류이력·미검증·rollback을 결과서에 기록하고 코드 쓰기를 반환한다. Main 독립 검수/PR/Broker/병합본 smoke 전에는 전체 UI00/계획 완료가 아니다.
