# UI05/FN13 확정 저장 뒤 원문 조회 복구 — 소스 검수 결과

## 판정과 범위

기존 FN13 r2 A 계약 내 화면 오류를 제품1/시험1로 보완했다. 실제 기능 전체 인수는 미완료다. 기준 main f34786666976a67d8fad3a293f236f06bc0969fb, branch codex/av3-ui05-checkpoint-read-recovery, WI SHA256 1475896B76A74810BBA26CF239E18E8B3C2360434E97C3AFF454180560ED44DC.

담당은 developer_primary, Main은 어울의 검수·통합이다. 서버/API/DB/SQL/권한/영수증 계약은 변경하지 않았다.

## 변경 이유와 동작

변경 전에는 APPLIED/CHECKPOINT_RECORDED 영수증 검산 뒤 고정 GET만 실패해도 공통 catch가 원 pending 명령을 복원해 storedRef를 잃고 uncertain=true로 되돌렸다. 변경 후 POST 오류 처리만 기존 원명령 재확인 분기에 두었다. 검산 영수증 이후에는 pending=null/uncertain=false와 전체 storedRef(id/version/contentHash)를 먼저 보존한다. 후속 조회 실패는 조회 오류로 표시하며 같은 fullref의 명시 GET 버튼으로 복구한다. 화면 왕복 중 자동 GET/POST는 없다.

POST 응답 자체가 유실된 경우에는 원명령 body/ID/hash와 uncertain 상태를 보존하고 기존 명시 재확인만 허용한다. 주체·클라이언트·화면 종료 후 늦은 원문/인증 응답은 채택하지 않는다. 기준 기록 선택·실행·안전 재개 권한을 자동 변경하지 않는다. 오래된 공급자 미연결 단정 안내 두 곳을 현재 서버 응답으로 결과를 확인하는 설명으로 바꿨다.

## 검증

- 수정 전 RED 2c920d exit1/1F: 유효 영수증→GET503 뒤 원 pending/uncertain=true/storedRef=null의 실제 React 상태를 재현했다.
- 수정 후 50e48a: 직접 React RAM 시험 + checkpoint-api 인접 시험 21P/0F/0SKIP, exit0, 1700.7758ms. 기존18+신규3이다.
- 신규 흐름: POST1→GET503→화면 왕복(자동요청0)→명시 같은 ref GET200→검산 원문 표시. 사용자/client 교체·화면 종료별 늦은200/401 폐기 및 onUnavailable0, POST유실→동일 원명령 수동 재확인을 구분했다.
- root npm run typecheck: 0f09ec exit0. 원 웹 Vite config에 envDir:false/build.write:false로 생산 빌드: f50c65 exit0, 520모듈·HTML/CSS/JS 메모리 출력. 실제 served는 아니다.
- 최종 diffcheck 5f1015 exit0. 시험 EOF 빈행 경고1건은 내용 변경 없이 정리했다.
- Main 핵심 반례 재확인 58c195: 저장 확정→GET503→왕복→명시GET, 1P/0F/0SKIP, exit0.

## 동결과 미검증

- apps/web/src/features/session-detail/CheckpointEditor.tsx SHA256 67CBC776AD879DD79B4DC27DF83224668F875F99F67204E6379B7B547B3AF82D.
- tests/unit/UI05/session-detail-read-context.test.ts SHA256 A853B2555C0FFF6CC26EA3D38E555C1D9CC4558FB9EBC1D28950EF202285E228.

실제 브라우저/레이아웃·네트워크·서버·DB는 미검증이다. RAM React/합성 응답을 실제 DB 저장 증거로 표시하지 않는다. 실제 DB/권한/키/서비스/Agent·SDK 조회·P03 자원 조작은 0회다. 전체 UI05/FN13·계획 완료 체크는 올리지 않는다. rollback은 두 파일의 한정 diff 역적용이며 기존 저장 기록 변경을 포함하지 않는다.

독립 동결 검수 C0/I0/M0. 영수증 확정/조회 실패 분리·원명령 유실 보존·늦은 200/401 차단·baseRef 명시 선택 불변을 확인했다. 독립 검수는 소스·시험 본문 대조이며 실제 브라우저/DB 미검증은 유지한다.
