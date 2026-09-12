from app import greet
from util import prefix

def test_behavior():
    assert prefix(greet('x'))
