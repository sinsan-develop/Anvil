# P03 R3 보존 자원 단발 메타데이터 관측 결과

판정: UNKNOWN_PRESERVE. 자원 상태와 원인은 미확인이다.

## 승인과 실행

- 사용자 직접 세 번째 승인에 따라 후보 E1CD69F64D1DCAC75DFFC1EE110EBBC26D41DA283274FB5B40A5649613A4F447을 기존 d2_preflight가 실행했다.
- 시도 b3645a193d704fa38c61a12b44d1f74b, 승인JSON SHA256 935BB04D2B9F3C122D65FEEE324F5D58CD4AC9FDA82991CB96645169371ADFAC, 유효창2026-11-16T07:20:41.000Z~07:50:41.000Z다. Main과 수행자는 단발 발행을 소진했다.
- 고정 PowerShell wrapper를 require_escalated로1회 실행한 도구 근거는76192f다. 전체 감독 종료는exit2, 경과1.3477832초다.

## 관측된 요약

sshClosed=true, sshExit=255, sshSpawnError=NONE, sshStderrClass=NONE, sshCapturedBytes=0, result=UNKNOWN_PRESERVE.

0/14행이다. SSH 프로세스가 종료됐다는 사실만 확인했다. 원격 Docker 도달/호출수·daemon/볼륨/init의 현재 상태·SSH255 원인은 확인하지 못했다. NONE을 오류 부재나 원격 미실행의 증거로 해석하지 않는다. 실패를 DB·복제 PASS로 계산하지 않는다.

## 제외와 보존

후속 SSH·재접속·추가조회·자동정리0이며 살아 있는 실행handle0을 수행자가 확인했다. DB 접속·데이터내용 조회·재복제·컨테이너/볼륨 삭제·권한/키/서비스/Agent 변경 실행은 하지 않았다. 원격 자원은 변경/정리 명령 없이 보존하며 실제 잔존 상태를 새로 관측했다고 주장하지 않는다. 이번 승인은 소진됐고 재사용하지 않는다. 원 stderr·사용자 파일·Secret은 결과에 보관하지 않는다.

실행 종료 후 Git 보관본의 CRLF를 LF로 정규화했다. 현재 보관본 SHA256은55B1C352CD53BC3BFACB0AD34DB3D10BDCBB65EF97EDD0EB104A992B7A4B2A3E 이다. 실행 당시 원본은935BB04D2B9F3C122D65FEEE324F5D58CD4AC9FDA82991CB96645169371ADFAC이며 내부 개행CRLF/최종 개행LF로 역치환한 문자열의 원본 일치를 검산했다. JSON 값은 불변이고 소진된 실행 승인을 재발급하지 않는다.
