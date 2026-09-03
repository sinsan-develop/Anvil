# ysna canonical deployment runtime

The only production entrypoint is `anvil.sinsan.kr → anvil-web:3770`.
`compose.production.yml` defines that single FastAPI runtime on the external
`proxy-network`; it serves the frontend, `/api/*`, `/health/*`,
`/integrations/*`, `/auth/*`, OpenAPI, and SSE through one boundary.

Run the versioned bootstrap with an approved full release SHA:

```sh
./deploy/ysna/bootstrap-deploy.sh "$ANVIL_RELEASE_COMMIT"
```

The bootstrap extracts the target commit's `deploy.sh` and verifies its Git
blob before execution. `deploy.sh` copies the server-owned `.env` to
`runtime/anvil.env` with mode `0600`, requires database revision
`0012_run_authority`, and applies only `0013_task_bootstrap_authority` before
starting `anvil-web`. `verify.sh` confirms the running container and the
public live, ready, and OpenAPI endpoints. `rollback.sh` rolls back the
application image only; it never performs a schema downgrade and retains the
runtime secret file.

`ReleaseManifest.C21.DRAFT.json` is a control-document draft. It is not an
approved deployment manifest and has no assigned release commit or tag.
