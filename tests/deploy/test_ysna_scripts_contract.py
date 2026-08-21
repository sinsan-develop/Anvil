from pathlib import Path
import unittest
ROOT=Path(__file__).parents[2]; DEPLOY=ROOT/'deploy'/'ysna'
class ScriptContractTests(unittest.TestCase):
 def test_external_secret_refs(self):
  text=(DEPLOY/'compose.internal.yml').read_text(); self.assertIn('../../runtime/anvil.env',text); self.assertNotIn('OPENAI_API_KEY=',text)
 def test_redacted_evidence(self):
  text=(DEPLOY/'verify.sh').read_text(); self.assertIn('secret_values',text); self.assertIn('127.0.0.1:4173',text); self.assertIn('git status --porcelain',text)
