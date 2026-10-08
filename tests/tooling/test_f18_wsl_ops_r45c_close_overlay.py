from pathlib import Path


def test_r45c_close_overlay_exports_close_mode():
    source = Path(__file__).parents[2] / "scripts" / "f18_wsl_ops_r45c_close_overlay.py"
    text = source.read_text(encoding="utf-8")
    assert "F18_WSL_OPS_R45C_ROLLBACK_REHEARSAL_CLOSE" in text
    assert "WORKER_LEASE_REVOKED" in text
