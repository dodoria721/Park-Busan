-- REVIEW BEFORE EXECUTION: moves A24/A25 off the two incorrectly linked private lots.
-- Private lots, their UUIDs, and fee policies are preserved. No vacancy counts are stored.
-- Official identity/coordinates: https://bsparking.bisco.or.kr/api/parking/realtime/list
BEGIN;
LOCK TABLE public.parking_lots, public.source_mappings IN SHARE ROW EXCLUSIVE MODE;

CREATE TEMP TABLE live_repairs (
  code text PRIMARY KEY, old_id uuid, external_id text, name text, address text,
  latitude double precision, longitude double precision, total_spaces integer,
  official_id text
) ON COMMIT DROP;
INSERT INTO live_repairs VALUES
  ('A24', '4eac79e1-c56a-422a-9f6a-426d511c4001', 'busan-facilities:A24',
   '중동역 공영주차장', '부산 해운대구 해운대로 731',
   35.167077752598345, 129.17018583252286, 167, '24'),
  ('A25', 'a3e558d8-79e1-4b0f-a427-3ffde3803792', 'busan-facilities:A25',
   '미포공영주차장', '부산 해운대구 달맞이길 43',
   35.161675, 129.170088, 97, '25');

DO $guard$ BEGIN
  IF EXISTS (
    SELECT 1 FROM live_repairs r JOIN public.source_mappings m
      ON m.source_name = 'busan_facilities_live' AND m.source_record_id = r.code
    LEFT JOIN public.parking_lots target ON target.external_id = r.external_id
    WHERE m.parking_lot_id <> r.old_id AND m.parking_lot_id IS DISTINCT FROM target.id
  ) THEN
    RAISE EXCEPTION 'Mapping changed since review; abort repair and inspect current data';
  END IF;
  IF EXISTS (
    SELECT 1 FROM live_repairs r JOIN public.parking_lots l ON l.id = r.old_id
    WHERE l.is_public IS NOT FALSE
  ) THEN
    RAISE EXCEPTION 'Original private lot identity changed; inspect before repair';
  END IF;
END $guard$;

INSERT INTO public.parking_lots (external_id, name, address, latitude, longitude, is_public, total_spaces)
SELECT external_id, name, address, latitude, longitude, true, total_spaces FROM live_repairs
ON CONFLICT (external_id) DO NOTHING;

DO $guard$ BEGIN
  IF EXISTS (
    SELECT 1 FROM live_repairs r JOIN public.parking_lots l ON l.external_id = r.external_id
    WHERE l.is_public IS NOT TRUE OR l.total_spaces IS DISTINCT FROM r.total_spaces
       OR abs(l.latitude - r.latitude) > 0.000001 OR abs(l.longitude - r.longitude) > 0.000001
  ) THEN
    RAISE EXCEPTION 'Target facility differs from reviewed official facility';
  END IF;
  IF EXISTS (
    SELECT 1 FROM live_repairs r JOIN public.parking_lots l ON l.external_id = r.external_id
    JOIN public.source_mappings m ON m.parking_lot_id = l.id
    WHERE m.source_name = 'busan_facilities_live' AND m.source_record_id <> r.code
  ) THEN
    RAISE EXCEPTION 'Target already has another live code';
  END IF;
END $guard$;

WITH run AS (
  INSERT INTO public.import_runs (source_name, status, records_read, records_written, finished_at)
  VALUES ('busan_facilities_live_repair', 'succeeded', 2, 2, now()) RETURNING id
)
INSERT INTO public.source_mappings (source_name, source_record_id, parking_lot_id, import_run_id, source_payload)
SELECT 'busan_facilities_live', r.code, l.id, run.id,
  jsonb_build_object('parkgcd', r.code, 'officialId', r.official_id,
    'source', 'https://bsparking.bisco.or.kr/api/parking/realtime/list',
    'correctedFrom', r.old_id, 'address', r.address)
FROM live_repairs r JOIN public.parking_lots l ON l.external_id = r.external_id CROSS JOIN run
ON CONFLICT (source_name, source_record_id) DO UPDATE
SET parking_lot_id = EXCLUDED.parking_lot_id, import_run_id = EXCLUDED.import_run_id,
    source_payload = EXCLUDED.source_payload, last_seen_at = now();

SELECT m.source_record_id, l.id, l.name, l.is_public, l.total_spaces
FROM public.source_mappings m JOIN public.parking_lots l ON l.id = m.parking_lot_id
WHERE m.source_name = 'busan_facilities_live' AND m.source_record_id IN ('A24', 'A25');
COMMIT;
