# Anvil Decisions

## G-03 — repository scaffold

- The initial branch is `main`; G-03 creates no commit, remote, tag, or deployment artifact.
- The scaffold fixes `apps → packages → domain` as a mechanically checked dependency direction.
- `packages/domain` remains independent of framework, persistence, provider, and Docker SDK imports.
- Runtime dependencies and product behavior remain outside G-03 and require later approved work packages.
