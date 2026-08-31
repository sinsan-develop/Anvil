import tempfile
import unittest
from pathlib import Path

from packages.tool_gateway import ReadToolGateway, ToolGatewayRejected


class GatewayTests(unittest.TestCase):
    def test_list_and_metadata_are_sorted_and_read_only(self):
        with tempfile.TemporaryDirectory() as name:
            root = Path(name); (root / "b.txt").write_text("b", encoding="utf-8"); (root / "a.txt").write_text("a", encoding="utf-8")
            gateway = ReadToolGateway(root)
            self.assertEqual(gateway.list_files().result, ("a.txt", "b.txt"))
            self.assertEqual(gateway.metadata("a.txt").result["size"], 1)

    def test_traversal_and_symlink_are_rejected(self):
        with tempfile.TemporaryDirectory() as name:
            root = Path(name); outside = Path(name).parent / (Path(name).name + "-outside"); outside.mkdir(); (outside / "secret").write_text("x")
            try:
                (root / "link").symlink_to(outside, target_is_directory=True)
            except OSError:
                self.skipTest("symlink unavailable")
            gateway = ReadToolGateway(root)
            with self.assertRaises(ToolGatewayRejected): gateway.metadata("../secret")
            with self.assertRaises(ToolGatewayRejected): gateway.list_files("link")


if __name__ == "__main__":
    unittest.main()
