# FN16 r2 A — 기존 export 승인 요청 fixture 한정 부록

상태 MAIN_RECONFIRMED_NON_SEMANTIC. 직접승인00B3FC72B8B85FD1EACEB143C8DC42B4686561768FD8D214413F5B82DB693902/WI03094CEDBABAF1AD937CD0B42379F38117D5461729989EDE6C7A690BF8FF802F와 operation 시험부록46A57939D5787257FC8654E341988A8BE5745B6A4DF46AFFD22A99994AF6BF8C를 보존한다. 새 계약·권한·제품 guard 변경이 아니다.

추가24번째 경로는 tests/unit/FN16/export-approval-consumption.test.ts, 시작 SHA256 027FCD05FA84D6E225BD7D56C9B2DCD4B4094960601BDA29B0B0D72CA503F47D이다. 현재 인접4파일47조건 중 이 단일 export 승인 요청 조건이 PROJECT_OPERATION_DENIED403으로 실패했다. 8c787b는 원 project-command/project-approvals 두 모듈만 control945b6932의 정확 BF791925/552B86FC 원문으로 메모리 공급해 같은 실패1을 확인했다. 시험/나머지 의존성은 현 파일이므로 전체 과거 환경 재현이라고 하지 않는다. wrapper exit0은 마지막 hash 조회 결과이며 Node 실패코드를 따로 출력하지 않았으므로 PASS로 취급하지 않는다.

Main0e74bf가 실제 fixture의 rules가 exportProject만 허용하고 원 requestApproval의 명시 정책을 누락한 것을 확인했다. 35행 'export 승인 요청은 details/hash만 보관...' 단일 시험의 db.query permission policy 응답에 requestApproval 전용 AUTO rule과 그 원문에 맞는 policy hash/ref만 보강한다. 기존 exportProject 규칙·다른 모든 시험과 소비/거절 기대는 보존한다. 함수/파일 전체 재작성·제품 current policy guard 수정·권한 자동 부여는 허용하지 않는다.

기존 INSERT4, details/hash 보관, 후보 원문·job·새 소비0의 단언을 그대로 검사한다. 실패했던 조건부터 GREEN을 확인하고 원 FAIL을 이력으로 보존한다. 추가 fixture 부족이 드러나면 정확 원인과 최소 구간을 Main에 먼저 보고하고 임의 확장하지 않는다. 동일 기존 Primary만 writer, Main 코드쓰기0. 실제 DB·권한·키·사용자 파일 조사·서비스·Agent·기존 프로젝트 차단 해제0이다.
