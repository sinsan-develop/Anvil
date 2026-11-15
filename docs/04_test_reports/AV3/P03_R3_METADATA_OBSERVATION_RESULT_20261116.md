# P03 R3 보존 자원 한정 메타데이터 관측 결과 — 2026-11-16

**UNKNOWN_PRESERVE. 새 신원·마운트 관측 증거가 없다.** 원 복제 NOT_COMPLETE/create-init/IDENTITY_UNKNOWN 판정은 그대로다.

- 직접 승인ID anvil-r3-metadata-f1957b3dc03d4f869dd4ddd5e0a11680, run f1957b3dc03d4f869dd4ddd5e0a11680. 첫 관측16:33:44UTC/만료17:03:44UTC, 후보 SHA256 0ED884E382AB328B6280658485EFACE6EEAABF9E7DD9BDBFC4574CFDE7613C75.
- 승인 JSON SHA256 72AFBA0822F05BD19B07DB1B365B5188BB3403429445D18333026DD4BC5BC1A9, 최종 실행코드 문서 SHA256 316E965F46B4DCDC7F00AFD6ACBF744D1CDEB535DAD9EFE6CA6211B3FC98F0B5. Main과 독립 검수 C0/I0/M0 뒤 동일 bytes의 wrapper만 실행했다.
- 실행자 기존 d2_preflight, Main은 기록·검수·통합. 실제 tool f520eb의 sandbox_permissions=require_escalated. wrapper1/로컬Node1/SSH1, 전체0.7076843초, wrapper exit2/SSH exit255/sshClosed=true. session 없음·로컬 잔여 handle0.
- 유일 반환은 run·sshClosed=true·sshExit255·result=UNKNOWN_PRESERVE 요약이다. 필수14행 중0행이며 원격 도달 여부와 실제 Docker 읽기 횟수는 UNKNOWN이다. 관측이 없음을 Docker0회 또는 원격 장애 확정으로 바꾸지 않는다.
- 원 stderr는 실행코드의 비출력·비보존 설계로 NOT_RETAINED다. 로컬 도구·인증·네트워크·원격 중 어느 원인인지는 확인하지 못했다. 읽기 권한 상향으로 실행됐다는 사실만으로 실행 환경이나 인증이 정상이라고 단정하지 않는다.

정확 명령은 고정 Windows OpenSSH의 -T/BatchMode/StrictHostKeyChecking/UpdateHostKeys=no/ControlMaster=no/ControlPath=none/ConnectTimeout6/ConnectionAttempts1/ForwardAgent=no/ClearAllForwardings와 WSL-server /bin/bash --noprofile --norc -s다. Node·Docker 지문과 지정 대상은 실행코드 문서에 고정돼 있다. 원문·키·실경로·원 stderr를 반환하거나 파일로 저장하지 않았다.

승인된 SSH 1회는 소진됐다. 추가 SSH·도달성 확인·Docker 조회·재실행·정리0, Main/Primary 중복 조회0이다. 원본·사본·init·checkout·원장을 변경/삭제하지 않는 보존 정책을 유지한다. 현장 현재 신원·사용 상태를 재확인했다고 주장하지 않는다. 실제 DB/권한/키/서비스/복제·Agent/SDK 실행으로 확대하지 않았다.

준비 중 독립 I1(행 누락인데 완료 가능)을 14키 완전성 검산으로 해소했고, 최소 환경 전달·유한 입력/종료 감시를 고정했다. 로컬 순수 parser 정상1수용/불완전7거절·구문검사0은 준비 코드 증거이며 실제 관측 성공 증거가 아니다. 다음 실제 관측은 오류를 안전한 고정 분류로 남길 방법과 정확 한도를 검토하고 새 권위를 확인해야 하며, 이번 소진 시도를 재사용하지 않는다. 그동안 독립 승인 범위의 제품 구현은 계속한다.
