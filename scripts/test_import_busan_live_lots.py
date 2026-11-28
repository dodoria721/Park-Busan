import importlib.util
import pathlib
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location("live_import", pathlib.Path(__file__).with_name("import-busan-live-lots.py"))
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class LiveImportTests(unittest.TestCase):
    def run_plan(self, lots, mappings):
        item = {"parkgcd": "A25", "parknm": "미포공영", "maxcnt": 97}
        official = {"parkingId": 25, "parkingName": "미포공영", "lat": 35.16, "lng": 129.17,
                    "sidoName": "부산", "sigunguName": "해운대구", "roadName": "달맞이길", "buildingMainNo": "43"}
        feed = {"response": {"header": {"resultCode": "00"}, "body": {"totalCount": 1, "items": {"item": [item]}}}}
        catalogue = {"result": True, "data": [official] + [{"parkingName": "다른 시설"}] * 39}
        env = {"BUSAN_LIVE_API_URL": "https://example.test", "BUSAN_LIVE_API_KEY": "test", "SUPABASE_SECRET_KEY": "test", "SUPABASE_URL": "https://example.test"}
        with patch.object(module, "get_json", side_effect=[feed, catalogue]), patch.object(module, "read_all", side_effect=[lots, mappings]):
            return module.plan(env)

    def test_existing_external_id_without_mapping_is_linked_instead_of_skipped(self):
        lot = {"id": "existing", "external_id": "busan-facilities:A25", "name": "미포공영주차장",
               "is_public": True, "total_spaces": 97, "latitude": 35.16, "longitude": 129.17}
        _, link, insert, skip, manual = self.run_plan([lot], [])
        self.assertEqual(link[0]["lot_id"], "existing")
        self.assertEqual((insert, skip, manual), ([], [], []))

    def test_existing_private_mapping_is_flagged_for_repair(self):
        lot = {"id": "private", "external_id": None, "name": "미포주차장", "is_public": False}
        _, link, insert, skip, manual = self.run_plan([lot], [{"source_record_id": "A25", "parking_lot_id": "private"}])
        self.assertEqual((link, insert, skip), ([], [], []))
        self.assertIn("민영", manual[0][2])

    def test_private_lot_is_not_a_link_candidate(self):
        lot = {"id": "private", "name": "미포주차장", "is_public": False,
               "latitude": 35.16, "longitude": 129.17, "total_spaces": 15}
        self.assertEqual(module.nearby_public([lot], 35.16, 129.17), [])

    def test_name_and_capacity_must_both_match(self):
        lot = {"name": "미포 공영주차장", "total_spaces": 15}
        self.assertEqual(module.same_facility("미포공영", 97, [(10, lot)]), [])
        lot["total_spaces"] = 97
        self.assertEqual(len(module.same_facility("미포공영", 97, [(10, lot)])), 1)
        self.assertEqual(module.same_facility("미포공영", None, [(10, lot)]), [])

    def test_official_location_must_be_unique_and_valid(self):
        row = {"parkingId": 1, "parkingName": "미포공영", "lat": 35.16, "lng": 129.17,
               "sidoName": "부산", "sigunguName": "해운대구", "roadName": "중동 1778-2"}
        self.assertIsNotNone(module.official_locate("미포공영", [row]))
        for rows in ([], [row, row], [{**row, "lat": None}], [{**row, "lat": 0}]):
            self.assertIsNone(module.official_locate("미포공영", rows))

    def test_db_pagination_does_not_rely_on_requested_limit(self):
        with patch.object(module, "get_json", side_effect=[[{"id": "a"}], [{"id": "b"}], []]) as request:
            self.assertEqual(len(module.read_all("https://example.test", "parking_lots", "id", {})), 2)
            self.assertIn("offset=1", request.call_args_list[1].args[0])

    def test_sql_guards_public_facilities_and_recovers_existing_unmapped_rows(self):
        sql = module.generate_sql(1, [], [])
        self.assertIn("l.is_public IS NOT TRUE", sql)
        self.assertIn("JOIN public.parking_lots l USING (external_id)", sql)
        self.assertIn("RAISE EXCEPTION", sql)


if __name__ == "__main__":
    unittest.main()
