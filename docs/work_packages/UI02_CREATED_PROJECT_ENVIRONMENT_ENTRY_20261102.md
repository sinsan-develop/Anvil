# UI02 생성 후 환경 설정 진입 보완 작업지시서

2026-11-02 / Main 어울 / 기존 승인 계획 내 내부 연결 보완

## 기준과 목표
기준 commit9d3ed9a8980b2e2ba1366ba3f1a6e394b5744919, 기존 branch codex/av3-stage-b.
SCREEN_WORK UI02는 미연결이어도 준비 필요 프로젝트로 저장하고 FN06 제공 후 환경 조회를 연결하도록 정한다. 기존 생성 후 보호된 프로젝트 ID가 있는 두 화면에서 기존 UI11 연결·환경 설정 화면으로 명시 이동하는 링크 누락만 보완한다. 생성 전 환경/총괄 선택·귀속 계약이나 실행 적합성은 추가하지 않는다.

Main 확인: ProjectCreatePage.tsx의 생성 직후 nav와 소비된 저장 초안의 생성 프로젝트 nav는 documents/workspace만 제공한다. 기존 직접 승인 FN06 소스 기능과 이어지는 명시 이동이 목적이며 별도 DTO/API·SQL·권한 변경은 없다.

## 담당·정확 허용
기존 Primary 단일 writer, Main 관리·검수·통합, 기존 Reviewer 읽기 검토.
제품/시험 허용3:
- apps/web/src/features/project-create/ProjectCreatePage.tsx
- tests/unit/UI02/draft-wizard-screen.test.ts
- tests/browser/UI02/consumed-draft-resume.spec.ts

Main만 이 WI·WORK_STATUS·필요한 결과 기록을 작성한다. 위 경로 밖 변경은 하지 않는다.

## 구현과 최소 검증
두 기존 nav 안에 같은 프로젝트의 #/projects/{id}/connections 명시 링크를 추가한다. ID는 기존 생성 결과 또는 현재 조회 문맥에 검산된 consumedProjectId만 사용한다. 생성 전/다른 사용자/다른 초안/미확인 읽기에는 새 링크를 만들지 않는다. 원문·입력·기존 링크·pending/UNKNOWN·제어 세대·라우팅 보호를 바꾸지 않는다. 링크 표시/이동으로 POST·자동 환경 선택·복사·권한·Agent 실행을 하지 않는다.

기존 실제 Page SSR 정상 반례에서 새 링크/기존 route를 확인해 RED를 먼저 얻고 구현한다. 같은 SSR의 생성 전/다른 사용자/미확인 명령·원버퍼 보존 음성을 보강한다. SSR Vite 옵션에 envDir:false를 명시해 실제 환경 파일을 읽지 않으며 미들웨어 모드/hmr:false/watch:null/명시 close는 유지한다. 새 공통 도구/DOM 복제/무관 리팩토링0.

소비 초안 동적 보호는 기존 검수 증거와 불변 호출선을 재사용한다. 기존 browser spec에 새 링크 기대를 추가하되 이번에 실제 브라우저/QA서버/서비스/계정은 실행하지 않는다. 새 링크의 실제 클릭 미실행과 SSR·pure GET 검산을 구분한다. 필요한 타입 검사·diff만 실행하며 전체 FN06/모든 브라우저 회귀는 반복하지 않는다.

## 제출·경계
정확 변경·지문·RED/GREEN·명령/exit·오류·미실행·live handle을 반환하고 writer를 돌려준다. 기존 기능 완료나 생성 전 환경 선택 완료로 표시하지 않는다. 실제 DB·권한·키·서비스·Agent·실자료 조사·P03 R3·main 병합·배포·새 agent/branch/예약은 제외한다. commit/push는 Main이 검수 뒤 기존 branch에서 수행한다.

## 검수 결과 — 2026-11-02

SOURCE_ONLY_PARTIAL_ACCEPTED. 제품 commit d2595b9856863423df3a7c911b16885d67636325는 기준7e4a2c4e 직접 자식·정확3경로다. 두기존nav에 같은검산projectId connections링크만 추가했고 역치환은 시작Page4A1FD959를 정확 복원한다.

- 최초0d8bae 실제Page SSR href부재 RED0PASS/1FAIL/native1 → 수행자5311b1 SSR9PASS/type0.
- 독립3파일 C0/I0, 기존버퍼/사용자·초안문맥/pending·UNKNOWN/호출선·시험단언 보존, 실제브라우저 실행0.
- Main26d061 SSR9PASS/FAIL0/SKIP0/CANCEL0/TODO0/native0·949.5567ms,0901e1 type0,03b566/3fd369 diff0,889498 Git blob3경로와검증바이트 mismatch0.
- Main sandbox09b7b1은 시험 entry 준비에서 실패했다. d86485 원인은 node_modules/.vite-temp/vite.config.ts.timestamp-*.mjs를 쓰는 EPERM이며 제품 동작 실패가 아니다. ACL/config/제품 변경 없이 같은 검사만 승인된 개발 실행 범위에서26d061로 확인했다. 기본 기대값/합격 기준 완화0.
- Main의 이전 read-only 완료 담당자에게 send_message만 보내 실제 구현 턴을 시작하지 않은 배정 오류1은 WORK_STATUS에 별도 기록했다. completed 상태/diff0 확인 후 기존 담당자 followup_task로 바로잡았고 실제SSR RED→GREEN을 확인했다.

최종 SHA256:
- ProjectCreatePage.tsx 4100C441CE1A7D421606DEDDC7287FB9DD52FB9449BE5571803B485E3419A61D
- draft-wizard-screen.test.ts 66464D8B6F482C1C7B5E830229CE9D8EB722FA623BEC1C8CE6D588DFF1F8BE9B
- consumed-draft-resume.spec.ts D76BEB6D8DB6351EB98BB41A20C0546D869603F0DD27452194D02C6D367D0289

정확 명령:
```powershell
& 'C:\Program Files\nodejs\node.exe' --test tests/unit/UI02/draft-wizard-screen.test.ts
& 'C:\Program Files\nodejs\node.exe' node_modules/typescript/bin/tsc --noEmit -p tsconfig.base.json
git diff --check
```

SSR은 envDir:false/middleware/hmr:false/watch:null/close이며 render API0·buffer불변·생성전/다른owner/미확인생성음성과 route검산을 확인했다. 소비초안 동적 문맥 보호의 기존 증거는 유지하며 spec 기대만 추가했다. 새링크 실제브라우저 클릭·served·DB·사용자인수는 미실행이다. live handle0·새전용QA자원0·실DB/권한/키/서비스/Agent/실자료조사0. 기존 Vite 캐시를 일괄 삭제하거나 사용자 자료를 정리하지 않았다.

사용자 확인 경로는 프로젝트 생성 완료 또는 저장초안의 생성프로젝트 재진입→'도구·환경 설정 열기'다. 현재는 소스/SSR 확인이며 실제서비스반영 전 사용가능으로보고하지 않는다. 생성전 환경/총괄선택·자동귀속·실행적합성·전체UI02/계획완료를 의미하지 않는다. 복구는 해당3파일 source commit의 정상되돌리기 검토이며 기존자료/보호파일/실환경 변경0이다.
