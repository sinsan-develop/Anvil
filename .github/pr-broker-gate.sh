#!/usr/bin/env bash
set -euo pipefail

python -B scripts/check_project_progress.py .
git diff --check refs/remotes/origin/main...HEAD
