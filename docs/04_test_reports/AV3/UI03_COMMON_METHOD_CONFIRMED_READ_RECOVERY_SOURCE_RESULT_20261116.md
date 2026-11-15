# UI03/FN02 공통 방법론 저장 확정 뒤 조회 복구 — 2026-11-16

기준 main bda73f035ded566d850e0caa5160804e428c33b7, branch codex/av3-ui03-method-read-recovery. WI SHA256 B85FB7DB5E0B217207BF07970A9767B32BBD5D0CCF68D33D7D86F035A9E0B672. Primary 구현, Main 검수·통합. 기존 계약의 화면 상태 보완이며 새 API/SQL/권한은 없다.

변경 전 공통 저장·복사는 검산된 발급 fullref를 지역변수에만 두어 GET503 뒤 잃고 POST를 다시 보내야 했다. 변경 후 !gateway/USER_COMMON 저장·복사에서만 원 request/name/purpose와 검산 fullref를 같은 화면pending에 보존한다. 왕복 뒤에는 명시 GET만, 원문검산 완료 뒤에만 methodBuffer/onSaved/목록을 반영한다. POST 자체 응답유실은 동일 원명령 재확인으로 유지한다. PROJECT는 pending에 공통 storedRef가 남아 있어도 prepare/write/read를 수행한다.

검증: RED 3f01fd exit1/0P1F(신규 POST1→GET503에서 storedRef undefined). 최종 node --experimental-strip-types --test tests/unit/UI03/project-methodology-review-read.test.ts tests/unit/FN02/common-client.test.ts tests/unit/FN02/project-method-web.test.ts — 179f6c exit0, 23P/0F/0SKIP, 1527.1141ms. 저장/복사 POST1·GET실패·왕복 자동요청0·다른hash거절·일치원문복구, 원POST유실 동일body, user/client/unmount/copy 뒤 늦은200/401 폐기와 교체copy 재클릭GET0, PROJECT 기존순서를 포함했다.

npm run typecheck 7905a4 exit0. 원 Vite config envDir:false/build.write:false의 생산빌드 9a601e exit0, 520모듈·HTML/CSS/JS 메모리 출력. diff 0efb20 exit0. Main 저장·복사 핵심 흐름 8b4e7c 1P/0F/0SKIP exit0.

동결 SHA256:
- CommonMethodEditor.tsx: 0D8E63EBCAF408E67F9F424207E30E6B310803BB0746FC2B3DE074B826B88E0E.
- 공통 명령 모듈 SHA256 지문: 97A2688419DB4C3D2926724A752A192821B0DF02B7B2E08D815B003973E03DAA.
- project-methodology-review-read.test.ts: 55702A2CF416E992406076B6B8A9F499BAD4A74B297EA78A04B6B35723BE6F40.

실제 브라우저/서버/DB는 미검증이며 전체 UI03/FN02·계획 완료가 아니다. 실제 DB/권한/키/서비스/Agent·SDK 조회·실자료·P03 자원 조작0, live0. rollback은 세 파일의 한정 diff 역적용이며 기존 사용자 자료를 변경하지 않는다.

독립 소스 검수 C0/I0/M0. 공통 요청과 fullref 보존·GET검산 전 onSaved0·PROJECT gateway의 공통ref 비사용 및 기존 호출순서·늦은응답과 교체copy 재클릭 차단을 확인했다. 실환경 권한 검증으로 확대하지 않는다.
