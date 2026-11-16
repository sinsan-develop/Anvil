# P03 WSL-server SSH 단계 진단 결과

**판정은 UNKNOWN이다.** 로컬 OpenSSH 자식의 시작과 종료를 관측했고 종료값은 255였다. 혼합 stderr의 분류 결과로 연결 실패 단계를 식별할 수 없었다.

## 승인과 실행

- 시도 ID `P03-SSH-STAGE-20261116-V1`. Main은 신산님 직접 승인과 발행 소진을 선기록했다. 수행자는 같은 시도 ID의 단발 표식을 도구 호출 전에 기록했다.
- 실행 후보 `docs/work_packages/P03_WSL_SSH_STAGE_DIAGNOSTIC_CANDIDATE_20261116.md`의 SHA-256 `39F4F90BFA29A2DEF7B570AA97D5E1E20F74499964933CF5A4C63CA41094E50E`를 재계산해 일치시켰다. 해당 문서의 PowerShell 블록 한 개에서 UTC 창의 시작·끝 표식만 `2026-11-16T08:57:12Z`, `2026-11-16T09:27:12Z`로 치환했다. 발행 직전 확인한 UTC는 08:58:18이었다.
- 승인 전제의 alias 및 설정 검토는 PMO 전달 기록에 따른다. 수행자는 SSH 설정이나 키 내용을 다시 열지 않았다. 고정 Windows OpenSSH, 대상 `WSL-server`, 요청 명령 `/usr/bin/true`, 배치·strict host key·연결 시도 1회·감독 30초·수거 32KiB 한도를 유지했다. 자격 증명·신뢰·서비스 설정 변경은 수행하지 않았다.
- 실행 도구 `exec_command`, `require_escalated`, `login:false`, `tty:false`, 영속 prefix 없음. 호출은 한 번이며 도구 식별자는 `568713`이다.

## 관측

| 항목 | 결과 |
|---|---|
| 원 로컬 SSH 자식 시작 | true |
| 원 자식 종료 관측 | true |
| 로컬 SSH 종료 범주 | SSH_255 |
| 혼합 stderr 문구 범주 | UNKNOWN |
| 감독 블록 종료 코드 | 2 |
| 도구 보고 실행 시간 | 0.8225138초 |
| 후속 수거할 세션 핸들 | 없음 |

UNKNOWN 결과는 빈 stderr, 특정 실패 문구, DNS 또는 TCP 장애를 뜻하지 않는다. 원 로그는 저장·반환하지 않았다. 접속·원격 신원·인증·원격 명령의 도달이나 완료·실패 원인은 미확인이다. 원격 명령 요청에 Docker·DB·Agent 호출은 없었고, 이 결과로 DB·서비스·기존 사본의 상태는 확인되지 않았다. 발행 1회는 소진됐다. 재접속·후속 조회·정리 명령은 0회다.
