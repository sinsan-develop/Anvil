import importlib.util
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
S=importlib.util.spec_from_file_location("c30r5_final_overlay",ROOT/"scripts/c30r5_final_overlay.py"); O=importlib.util.module_from_spec(S); S.loader.exec_module(O)
def test_c30r5_final_exact15():
    assert len(O.paths())==len(set(O.paths()))==15
    assert set(O.paths())-set(O.controls())=={O.PRODUCT}
def test_c30r5_final_bindings():
    assert O.WI2H=="B14F3A0A253F5BE74194F2B4BC38483E855B62B0C7070D6614F061D19234B000"
    assert O.PRODUCTH=="02C99791E43DBFFEEECA823A6725EBE32C17BFDDCA8B347FF510F4A094855E3E"
