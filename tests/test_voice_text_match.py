import sys
import unittest
from pathlib import Path


sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "voxcpm"))
import server_openai as voice  # noqa: E402


class VoiceTextMatchTests(unittest.TestCase):
    def test_chinese_punctuation_does_not_break_match(self):
        self.assertTrue(voice.texts_match(
            "重启后实际语音合成验证。",
            "重启后，实际语音合成验证。",
        ))

    def test_real_content_mismatch_is_rejected(self):
        self.assertFalse(voice.texts_match(
            "重启后实际语音合成验证。",
            "重启后实际语音播放测试。",
        ))

    def test_normalize_text_strips_full_width_punctuation(self):
        self.assertEqual(
            voice.normalize_text("重启后，实际语音合成验证。"),
            voice.normalize_text("重启后实际语音合成验证"),
        )


if __name__ == "__main__":
    unittest.main()
