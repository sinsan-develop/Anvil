import unittest

from src.calc import add


class CalcTests(unittest.TestCase):
    def test_known_baseline_failure(self) -> None:
        self.assertEqual(add(2, 3), 5)


if __name__ == "__main__":
    unittest.main()
