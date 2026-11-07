# UI00 공통 상단 프로젝트 접근 조회 검수 — 2026-11-07

판정: **기존 보호 조회를 실제 App 공통 상단에 연결한 소스·합성 단위 인수**. 실제 개발 서비스에 반영되거나 전체 UI00/계획이 완료된 것은 아니다.

- 기준 9c1530e00d385bcdb364ce52e5552f1dabf61d37, UI00 카드와 지시서 UI00_SHELL_PROJECT_ACCESS_READ_SOURCE_WI_20261107.md / E9E149F08DC9325812B4FA328DD9A27BF91900CCB87E91AAEC9101988560AC7F. 기존 Primary 단일 writer, 별도 독립 검토, Main 검수·통합.
- 로그인하고 프로젝트를 선택한 뒤 상단 ‘프로젝트 접근 상태 확인’을 누르면 기존 보호 GET으로 본인의 참여 역할·제어 기록과 응답 수신 시각을 확인한다. 같은 프로젝트 내 화면 이동은 결과를 유지한다. 다른 프로젝트/세션/전송 문맥, 권한 거절이나 오류는 오래된 자료를 표시하지 않는다. 명령 권한은 원 서버 검사를 따른다. 자동 조회·POST·새 공개/데이터/권한 계약·제어 획득/실행0이다.
- 응답의 제어 주체 식별자나 준비 상태 원문을 노출하지 않는다. 401은 현재 요청의 경우 기존 인증 복구 흐름에 전달하고 미전송 입력을 보존한다. 늦은 401은 인증을 바꾸지 않는다.

| 정확 경로 | 바이트 | SHA256 |
|---|---:|---|
| apps/web/src/App.tsx | 71066 | 876B88D229E70F84B38D601694055A06FB7E95FBDF4020613ED936FAD22EE0FC |
| apps/web/src/shell/AppShell.tsx | 6658 | B5A76F8005CC833E75482C19A9DA2130561705975F8FE40210FBA8D3A1EFF707 |
| tests/unit/UI00/project-shell-access.test.ts | 17857 | 2A365C27D7FAC054ABD297508022A5AE83CACDE0271EB55275125F426B74AF58 |

- Primary ca5ade 실제 App 버튼 부재 RED→19f75b GREEN. 앞선 준비 오류 location.href 1건은 실제 제품 실패와 분리했다. 하위 package.json 추정 실패1은 루트 파일로 바로잡았다.
- Primary cc4504 및 Main 44df19: node --test tests/unit/UI00/project-shell-access.test.ts tests/unit/UI00/control-access-page.test.ts tests/unit/UI00/routes.test.ts tests/unit/FN01/project-access-summary.test.ts. Main 신규5+인접17=22PASS/0fail/0skip·1020.4588ms·exit0. 13e717 type0·0c47cd Vite write:false/517modules·diff0는 Primary 제출이며 실제 서비스 배포 증거가 아니다.
- 독립 C0/I0/M2 중 M1은 동일 렌더에서 세션 스칼라가 바뀌었을 때 원 결과는 폐기되나 자기 loading이 남는 문제였다. 4dc487 RED→5f29ca GREEN, 같은 live scope·latest ticket·자기 loading만 해제. Primary 83514c 신규5·8f8b4f type0·62d1c2 diff0. Main 6672d6 node --test tests/unit/UI00/project-shell-access.test.ts: 5PASS/0fail/0cancel/0skip/0todo·979.9127ms·exit0, 2d93a2 최종 raw3·diff0. 독립 M1 재검수 C0/I0/M0. 인접 불변17은 다시 실행하지 않았다.
- M2는 불명 제어 명령의 원 ID/body 보존을 실제 App 여정으로 직접 검산하지 않았다는 한계다. 기존 명령 버퍼 코드는 변경하지 않았고 미전송 이름·추가 POST0은 확인했다. 실제 브라우저 화면/확대·키보드·서비스·DB, 실제 Agent 실행은 미검증이다. 코드 3경로의 역패치로 원 표시를 복구할 수 있으며 DB 변경은 없다.
