import json, util
from . import util as relative_util

def greet(name):
    return util.prefix(name)


# prefix and greet in comments are not symbol references.
REFERENCE_DECOY = "prefix greet"
