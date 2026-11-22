insert into public.parking_lots (id, external_id, name, address, latitude, longitude, total_spaces, operating_hours, live_status)
values
  ('10000000-0000-0000-0000-000000000001', 'mock-busan-station-1', '부산역 선상 공영주차장', '부산광역시 동구 중앙대로 206', 35.1152, 129.0414, 500, '24시간', 'available'),
  ('10000000-0000-0000-0000-000000000002', 'mock-choryang-1', '초량 공영주차장', '부산광역시 동구 초량동', 35.1191, 129.0384, 82, '06:00–23:00', 'unknown');

insert into public.fee_policies (parking_lot_id, base_minutes, base_fee_won, additional_minutes, additional_fee_won, daily_max_fee_won, notes)
values
  ('10000000-0000-0000-0000-000000000001', 30, 1500, 10, 500, 15000, '초기 개발용 예시이며 실제 요금이 아님'),
  ('10000000-0000-0000-0000-000000000002', 30, 1000, 10, 300, 10000, '초기 개발용 예시이며 실제 요금이 아님');
