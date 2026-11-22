"""Validate the attached standard parking CSVs and optionally generate SQL."""

import argparse
import csv
import json
import math
from pathlib import Path


SOURCE = "부산 민영주차장 CSV"
PREFIX = "busan-private-csv:"
DAYS = ("평일", "토요일", "공휴일")
REQUIRED = {
    "주차장관리번호", "주차장명", "주차장구분", "소재지도로명주소", "소재지지번주소",
    "위도", "경도", "주차구획수", "운영요일", "요금정보", "주차기본시간", "주차기본요금",
    "추가단위시간", "추가단위요금",
} | {f"{day}운영{edge}시각" for day in DAYS for edge in ("시작", "종료")}


def integer(value, minimum):
    return int(value) if value.isascii() and value.isdecimal() and minimum <= int(value) <= 2147483647 else None


def coordinates(row):
    try:
        lat, lng = float(row["위도"]), float(row["경도"])
    except ValueError:
        return None
    if math.isfinite(lat) and math.isfinite(lng) and 33 <= lat <= 39 and 124 <= lng <= 132:
        return lat, lng
    return None


def read_csvs(directory, report):
    paths = sorted(directory.glob("*_주차장정보.csv"))
    if not paths:
        raise ValueError(f"No *_주차장정보.csv files in {directory}")
    records = {}
    seen = set()
    total = private = 0
    for path in paths:
        with path.open(encoding="utf-8-sig", newline="") as file:
            reader = csv.DictReader(file, strict=True)
            if not REQUIRED.issubset(reader.fieldnames or []):
                raise ValueError(f"{path.name}: required headers missing")
            for raw in reader:
                total += 1
                location = f"{path.name}:{reader.line_num}"
                if None in raw or None in raw.values():
                    raise ValueError(f"{location}: unexpected column count")
                row = {key: value.strip() for key, value in raw.items()}
                if row["주차장구분"] != "민영":
                    continue
                private += 1
                record_id, name = row["주차장관리번호"], row["주차장명"]
                address = row["소재지도로명주소"] or row["소재지지번주소"]
                if not (record_id and name and address) or record_id in seen:
                    raise ValueError(f"{location}: missing required identity fields or duplicate ID {record_id}")
                seen.add(record_id)
                point = coordinates(row)
                if point is None:
                    print(f"Skipped invalid/missing coordinates: {location} {record_id} {name}")
                    continue
                hours = [
                    f"{day} {row[f'{day}운영시작시각']}–{row[f'{day}운영종료시각']}"
                    for day in DAYS
                    if day in row["운영요일"].split("+")
                    and row[f"{day}운영시작시각"] and row[f"{day}운영종료시각"]
                ]
                unit_minutes = integer(row["추가단위시간"], 1)
                unit_fee = integer(row["추가단위요금"], 0)
                free = row["요금정보"] == "무료"
                records[record_id] = {
                    "record_id": record_id, "external_id": PREFIX + record_id,
                    "name": name, "address": address, "lat": point[0], "lng": point[1],
                    "spaces": integer(row["주차구획수"], 0), "hours": " / ".join(hours) or None,
                    "base_minutes": 1 if free else integer(row["주차기본시간"], 1),
                    "base_fee": 0 if free else integer(row["주차기본요금"], 0),
                    "unit_minutes": unit_minutes if unit_fee is not None else None,
                    "unit_fee": unit_fee if unit_minutes is not None else None,
                    "notes": "무료" if free else None,
                    "payload": {"file": path.name, "row": raw},
                }
    report.update(files=len(paths), rows=total, private=private, eligible=len(records))
    return list(records.values())


def generate_sql(records, private_count):
    payload = json.dumps(records, ensure_ascii=False).replace("'", "''")
    return f"""BEGIN;
SET LOCAL standard_conforming_strings = on;
CREATE TEMP TABLE private_parking_input ON COMMIT DROP AS
SELECT * FROM jsonb_to_recordset('{payload}'::jsonb) AS input(
  record_id text, external_id text, name text, address text, lat double precision,
  lng double precision, spaces integer, hours text, base_minutes integer, base_fee integer,
  unit_minutes integer, unit_fee integer, notes text, payload jsonb
);

-- Serialize the existence checks with other writers to these tables.
LOCK TABLE public.parking_lots, public.source_mappings IN SHARE ROW EXCLUSIVE MODE;

WITH inserted AS (
  INSERT INTO public.parking_lots
    (external_id, name, address, latitude, longitude, is_public, total_spaces, operating_hours)
  SELECT input.external_id, input.name, input.address, input.lat, input.lng,
         false, input.spaces, input.hours
  FROM private_parking_input input
  WHERE NOT EXISTS (
    SELECT 1 FROM public.parking_lots lot
    WHERE lot.external_id IN (input.external_id, input.record_id)
  ) AND NOT EXISTS (
    SELECT 1 FROM public.source_mappings mapping
    WHERE mapping.source_name IN ('{SOURCE}', '전국주차장정보표준데이터')
      AND mapping.source_record_id = input.record_id
  )
  RETURNING id, external_id
), run AS (
  INSERT INTO public.import_runs (source_name, status, finished_at, records_read, records_written)
  SELECT '{SOURCE}', 'succeeded', statement_timestamp(), {private_count}, count(*)
  FROM inserted
  RETURNING id, records_read, records_written
), mappings AS (
  INSERT INTO public.source_mappings
    (source_name, source_record_id, parking_lot_id, import_run_id, source_payload)
  SELECT '{SOURCE}', input.record_id, inserted.id, run.id, input.payload
  FROM inserted JOIN private_parking_input input USING (external_id) CROSS JOIN run
), fees AS (
  INSERT INTO public.fee_policies
    (parking_lot_id, base_minutes, base_fee_won, additional_minutes, additional_fee_won, notes)
  SELECT inserted.id, input.base_minutes, input.base_fee, input.unit_minutes, input.unit_fee, input.notes
  FROM inserted JOIN private_parking_input input USING (external_id)
  WHERE input.base_minutes IS NOT NULL AND input.base_fee IS NOT NULL
  RETURNING id
)
SELECT run.id AS import_run_id, records_read, records_written,
       (SELECT count(*) FROM fees) AS fee_policies_written
FROM run;
COMMIT;
"""


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("csv_directory", type=Path)
    parser.add_argument("--output", type=Path, help="Write UTF-8 SQL. Omit for a dry run.")
    args = parser.parse_args()
    report = {}
    try:
        records = read_csvs(args.csv_directory, report)
        if not records:
            raise ValueError("No eligible private parking records found")
        print(", ".join(f"{key}={value}" for key, value in report.items()))
        print(f"fee_policies={sum(r['base_minutes'] is not None and r['base_fee'] is not None for r in records)}")
        if args.output:
            with args.output.open("x", encoding="utf-8", newline="\n") as file:
                file.write(generate_sql(records, report["private"]))
            print(f"SQL written to {args.output}")
    except (OSError, ValueError, csv.Error) as error:
        parser.exit(1, f"{error}\n")


if __name__ == "__main__":
    main()
