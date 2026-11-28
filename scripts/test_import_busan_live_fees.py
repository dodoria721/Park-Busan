import importlib.util
import pathlib
import unittest

spec = importlib.util.spec_from_file_location("live_fees", pathlib.Path(__file__).with_name("import-busan-live-fees.py"))
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)

GRADE_4 = {"gradeInfoName": "4급지", "freeTime": 10, "defaultTime": 0, "defaultAmount": 0,
           "intervalTime": 10, "intervalAmount": 100, "dayParkingAmount": 2400}


def section(grade, day="WEEK"):
    return {"gradeInfoList": [{"dayType": day, "gradeAmount": grade}]}


class LiveFeeTests(unittest.TestCase):
    def test_interval_grade_becomes_unit_policy_with_daily_max(self):
        policy, why = module.policy_from_grade(GRADE_4)
        self.assertIsNone(why)
        self.assertEqual((policy["base_minutes"], policy["base_fee_won"]), (10, 100))
        self.assertEqual((policy["additional_minutes"], policy["additional_fee_won"]), (10, 100))
        self.assertEqual(policy["daily_max_fee_won"], 2400)
        self.assertIn("평일 기준", policy["notes"])

    def test_default_period_is_used_as_base(self):
        policy, _ = module.policy_from_grade({**GRADE_4, "defaultTime": 120, "defaultAmount": 0,
                                              "intervalTime": 60, "intervalAmount": 1000, "dayParkingAmount": 5000})
        self.assertEqual((policy["base_minutes"], policy["base_fee_won"]), (120, 0))
        self.assertEqual(policy["additional_fee_won"], 1000)

    def test_zero_unit_and_no_daily_max(self):
        self.assertIsNone(module.policy_from_grade({**GRADE_4, "intervalTime": 0, "intervalAmount": 0})[0])
        self.assertIsNone(module.policy_from_grade({**GRADE_4, "dayParkingAmount": 0})[0]["daily_max_fee_won"])

    def test_sections_with_different_weekday_fees_are_skipped(self):
        other = {**GRADE_4, "intervalAmount": 300}
        self.assertIsNone(module.weekday_policy([section(GRADE_4), section(other)])[0])
        self.assertIsNotNone(module.weekday_policy([section(GRADE_4), section(GRADE_4), section(other, "SAT")])[0])
        self.assertIsNone(module.weekday_policy([section(GRADE_4, "SAT")])[0])


if __name__ == "__main__":
    unittest.main()
