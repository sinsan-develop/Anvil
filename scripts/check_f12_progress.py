"""F-12 G-05 entrypoint; preserve the large historical checker byte-for-byte."""

import check_project_progress as base
from f12_progress_overlay import collect_git, validate

_previous_git = base._validate_git_projection
_previous_bundle = base.validate_bundle
_modes = {"F12_START_EXACT11_PRODUCT_EXACT8", "F12_ACTIVE_R2_EXACT11_PRODUCT_EXACT10",
          "F12_FINAL_ACCEPTANCE_EXACT22"}


def _git(bundle):
    if bundle.get("progress", {}).get("repository", {}).get("projection_mode") in _modes:
        return collect_git(bundle["_root"])
    return _previous_git(bundle)


def _bundle(bundle):
    if bundle.get("progress", {}).get("repository", {}).get("projection_mode") in _modes:
        return validate(bundle["_root"], bundle)
    return _previous_bundle(bundle)


base._validate_git_projection = _git
base.validate_bundle = _bundle

if __name__ == "__main__":
    raise SystemExit(base.main())
