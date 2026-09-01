# Public Host Security Fix 진행현황
- 단계: C-21 공개 Host 검증 보완
- 담당: Main Agent takeover
- 상태: LOCAL_VERIFIED_NOT_DEPLOYED
- 변경: runtime app이 ANVIL_PUBLIC_HOST/ANVIL_CONSOLE_BASE_URL을 WebSecurityConfig에 연결
- 테스트: python -m pytest tests/api/test_runtime_app.py -q => 4 passed; git diff --check PASS
- 미검증: ysna-server 이미지 재빌드/배포 및 공개 SSE 실검증
- 오류: subagent 무응답 1회, runtime 변수 삽입 실패 2회 후 수정
- 다음 조치: main 병합 후 이미지 재배포, /api/runs/run-1/events가 401(Host 통과)인지 확인