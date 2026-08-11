# Budget · Quota · Deployment Monitoring

Budget은 `FORECAST → RESERVED → PROVIDER_REQUESTED → FINAL_USAGE_RECORDED → RECONCILED → REMAINDER_RELEASED` 순서다. reserve 실패 후 provider call과 unknown usage의 0 처리, quota failure의 success 승격을 금지한다.

Deployment는 `PENDING → APPROVED → DEPLOYING → SMOKE_TEST → MONITORING` 뒤 monitoring window, critical alert 0, Owner confirmation이 모두 있을 때만 `RELEASED`다. data-loss rollback은 자동 실행하지 않는다.
