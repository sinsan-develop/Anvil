from pathlib import Path

def test_r45c_rework_control_exists_and_is_fail_closed():
    text=(Path(__file__).parents[2]/"scripts/f18_wsl_ops_r45c_rework_overlay.py").read_text(encoding="utf-8")
    assert "F18_WSL_OPS_R45C_REWORK_START" in text
    assert "F-18_WSL_OPS_R45C_REWORK_WORK_INSTRUCTION.md" in text
    assert "product_write_scope" in text
