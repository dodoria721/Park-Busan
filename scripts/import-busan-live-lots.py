"""부산시설공단 실시간 주차장(A코드)을 parking_lots/source_mappings에 연결하는 SQL 생성.

DB에 직접 쓰지 않는다. 기본은 dry run(검증 결과 출력)이고, --output을 주면
Supabase SQL Editor에서 실행할 SQL 파일을 만든다.

- 실시간 API에는 좌표가 없으므로 시설공단 공식 위치 목록과 대조한다.
- 150m 이내에 이름과 총 면수가 일치하는 유일한 기존 공영주차장만 연결한다.
- 가까운 공영주차장이 있지만 일치 여부가 불확실하면 수동 검토로 남긴다.
- 나머지는 새 주차장으로 추가한다. 요금 정보는 API에 없어 fee_policies는 만들지 않는다.

실행: python -X utf8 scripts/import-busan-live-lots.py [--output docs/busan-live-import.sql]
"""
import argparse
import json
import math
import pathlib
import re
import urllib.parse
import urllib.request

ROOT = pathlib.Path(__file__).resolve().parent.parent
SOURCE = "busan_facilities_live"
EXTERNAL_PREFIX = "busan-facilities:"
SAME_LOT_RADIUS_M = 150  # ponytail: 고정 기준, 오매칭이 보이면 조정
CATALOGUE_URL = "https://bsparking.bisco.or.kr/api/parking/realtime/list"


def load_env():
    env = {}
    for line in (ROOT / "server" / ".env.local").read_text(encoding="utf-8-sig").splitlines():
        if "=" in line and not line.lstrip().startswith("#"):
            k, v = line.split("=", 1)
            env[k.strip()] = v.strip()
    return env


def get_json(url, headers=None):
    with urllib.request.urlopen(urllib.request.Request(url, headers=headers or {}), timeout=20) as r:
        return json.load(r)


def dist_m(a_lat, a_lng, b_lat, b_lng):
    p = math.radians
    x = math.sin(p(b_lat - a_lat) / 2) ** 2 + math.cos(p(a_lat)) * math.cos(p(b_lat)) * math.sin(p(b_lng - a_lng) / 2) ** 2
    return 2 * 6371000 * math.asin(math.sqrt(x))


def norm(name):
    return re.sub(r"공영|주차장|주차빌딩|주차|노상|노외|부산시설공단|[\s(),.·\-]", "", name or "")


def read_all(base, table, select, headers, filters=""):
    rows = []
    while True:
        page = get_json(f"{base}/{table}?select={select}&order=id.asc&limit=1000&offset={len(rows)}{filters}", headers)
        if not isinstance(page, list):
            raise ValueError("DB 응답 형식 오류")
        if not page:
            return rows
        rows.extend(page)


def official_locate(name, catalogue):
    matches = [r for r in catalogue if re.sub(r"\s", "", r.get("parkingName", "")) == re.sub(r"\s", "", name)]
    if len(matches) != 1:
        return None
    row = matches[0]
    try:
        lat, lng = float(row["lat"]), float(row["lng"])
    except (KeyError, TypeError, ValueError):
        return None
    if not (34.7 <= lat <= 35.5 and 128.5 <= lng <= 129.5):
        return None
    region = [row.get("sidoName"), row.get("sigunguName") or row.get("addr")]
    building = "-".join(str(row[k]).strip() for k in ("buildingMainNo", "buildingSubNo") if row.get(k) and str(row[k]).strip() != "0")
    address = " ".join(str(v).strip() for v in [*region, row.get("roadName"), building] if v and str(v).strip())
    if not address.startswith("부산"):
        return None
    return {"id": str(row["parkingId"]), "place_name": row["parkingName"], "address": address, "y": lat, "x": lng}


def nearby_public(lots, lat, lng):
    return [(dist_m(lat, lng, lot["latitude"], lot["longitude"]), lot)
            for lot in lots if lot.get("is_public") is True
            and lot.get("latitude") is not None and lot.get("longitude") is not None
            if dist_m(lat, lng, lot["latitude"], lot["longitude"]) <= SAME_LOT_RADIUS_M]


def same_facility(name, total, candidates):
    return [(d, lot) for d, lot in candidates if norm(name) == norm(lot["name"])
            and total is not None and lot.get("total_spaces") == total]


def plan(env):
    response = get_json(env["BUSAN_LIVE_API_URL"] + "?" + urllib.parse.urlencode(
        {"serviceKey": env["BUSAN_LIVE_API_KEY"], "pageNo": 1, "numOfRows": 100, "resultType": "json"}
    ))["response"]
    live = response.get("body", {}).get("items", {}).get("item")
    if response.get("header", {}).get("resultCode") != "00" or not isinstance(live, list) or not live or int(response["body"]["totalCount"]) != len(live):
        raise ValueError("실시간 API 오류 또는 페이지 누락")
    catalogue = get_json(CATALOGUE_URL)
    if catalogue.get("result") is not True or not isinstance(catalogue.get("data"), list) or len(catalogue["data"]) < 40:
        raise ValueError("공식 시설 목록 오류 또는 누락")
    sb = {"apikey": env["SUPABASE_SECRET_KEY"]}
    base = env["SUPABASE_URL"] + "/rest/v1"
    lots = read_all(base, "parking_lots", "id,external_id,name,is_public,total_spaces,latitude,longitude", sb)
    mappings = read_all(base, "source_mappings", "id,source_record_id,parking_lot_id", sb, f"&source_name=eq.{SOURCE}")
    mapped = {m["source_record_id"] for m in mappings}
    by_id = {lot["id"]: lot for lot in lots}
    by_external = {l["external_id"]: l for l in lots if l.get("external_id")}

    link, insert, skip, manual = [], [], [], []
    for item in live:
        code, name = item["parkgcd"], item["parknm"].strip()
        payload = {k: item.get(k) for k in ("parkgcd", "parknm", "maxcnt")}
        total = item.get("maxcnt")
        total = int(total) if str(total).isdecimal() else None
        if code in mapped:
            targets = [by_id.get(m["parking_lot_id"], {}) for m in mappings if m["source_record_id"] == code]
            if any(lot.get("is_public") is not True for lot in targets):
                manual.append((code, name, "민영주차장에 잘못 연결됨: repair-busan-live-mappings.sql 검토 필요"))
                continue
            if len(targets) != 1 or (total is not None and any(lot.get("total_spaces") != total for lot in targets)):
                manual.append((code, name, "기존 실시간 연결의 총 면수 또는 대상 중복 확인 필요"))
                continue
            skip.append((code, name, "이미 연결됨"))
            continue
        if not norm(name) or name == "예비":
            manual.append((code, name, "이름으로 위치를 특정할 수 없음"))
            continue
        place = official_locate(name, catalogue["data"])
        if not place:
            manual.append((code, name, "공식 목록에서 유일한 위치를 확인할 수 없음"))
            continue
        lat, lng = float(place["y"]), float(place["x"])
        address = place["address"]
        payload["official"] = {"id": place["id"], "address": address, "source": CATALOGUE_URL}
        nearby = nearby_public(lots, lat, lng)
        same = same_facility(name, total, nearby)
        owned = by_external.get(EXTERNAL_PREFIX + code)
        if owned and not any(lot["id"] == owned["id"] for _, lot in same):
            manual.append((code, name, "기존 외부 ID 시설의 공영 여부·위치·이름·면수 검토 필요"))
            continue
        if len(same) > 1 or (not same and nearby):
            manual.append((code, name, "인근 공영시설과 동일 여부를 확인할 수 없음"))
            continue
        if same:
            d, lot = same[0]
            if any(m["parking_lot_id"] == lot["id"] and m["source_record_id"] != code for m in mappings) or any(r["lot_id"] == lot["id"] for r in link):
                manual.append((code, name, "동일 DB 시설에 다른 실시간 코드가 연결됨"))
                continue
            link.append({"code": code, "name": name, "lot_id": lot["id"], "lot_name": lot["name"], "distance": round(d), "payload": payload})
        else:
            insert.append({
                "code": code, "external_id": EXTERNAL_PREFIX + code, "name": place["place_name"], "address": address,
                "lat": lat, "lng": lng, "spaces": total, "payload": payload,
            })
    return len(live), link, insert, skip, manual


def sql_literal(obj):
    return "'" + json.dumps(obj, ensure_ascii=False).replace("'", "''") + "'::jsonb"


def generate_sql(read_count, link, insert):
    return f"""-- 부산시설공단 실시간 주차장 연결. 생성: scripts/import-busan-live-lots.py
-- Supabase SQL Editor에서 실행한다. 이미 연결된 코드는 다시 넣지 않는다.
BEGIN;
LOCK TABLE public.parking_lots, public.source_mappings IN SHARE ROW EXCLUSIVE MODE;

CREATE TEMP TABLE live_insert ON COMMIT DROP AS
SELECT * FROM jsonb_to_recordset({sql_literal(insert)}) AS t(
  code text, external_id text, name text, address text, lat double precision,
  lng double precision, spaces integer, payload jsonb
);
CREATE TEMP TABLE live_link ON COMMIT DROP AS
SELECT * FROM jsonb_to_recordset({sql_literal(link)}) AS t(code text, lot_id uuid, payload jsonb);

DO $guard$ BEGIN
  IF EXISTS (SELECT 1 FROM live_insert i JOIN public.parking_lots l USING (external_id)
             WHERE l.is_public IS NOT TRUE) THEN
    RAISE EXCEPTION 'Existing external ID belongs to a private facility';
  END IF;
  IF EXISTS (SELECT 1 FROM live_link k LEFT JOIN public.parking_lots l ON l.id = k.lot_id
             WHERE l.id IS NULL OR l.is_public IS NOT TRUE) THEN
    RAISE EXCEPTION 'Live feeds can only be linked to existing public facilities';
  END IF;
  IF EXISTS (SELECT 1 FROM live_link k JOIN public.source_mappings m ON m.parking_lot_id = k.lot_id
             WHERE m.source_name = '{SOURCE}' AND m.source_record_id <> k.code) THEN
    RAISE EXCEPTION 'Conflicting live facility code';
  END IF;
  IF EXISTS (SELECT 1 FROM live_link k JOIN public.source_mappings m ON m.source_record_id = k.code
             WHERE m.source_name = '{SOURCE}' AND m.parking_lot_id <> k.lot_id) THEN
    RAISE EXCEPTION 'Live code already belongs to another facility';
  END IF;
  IF EXISTS (SELECT lot_id FROM live_link GROUP BY lot_id HAVING count(DISTINCT code) > 1) THEN
    RAISE EXCEPTION 'Multiple live codes for one facility';
  END IF;
END $guard$;

WITH run AS (
  INSERT INTO public.import_runs (source_name, status, finished_at, records_read, records_written)
  VALUES ('{SOURCE}', 'succeeded', statement_timestamp(), {read_count},
          (SELECT count(*) FROM live_insert) + (SELECT count(*) FROM live_link))
  RETURNING id
), inserted AS (
  INSERT INTO public.parking_lots (external_id, name, address, latitude, longitude, is_public, total_spaces)
  SELECT i.external_id, i.name, i.address, i.lat, i.lng, true, i.spaces
  FROM live_insert i
  WHERE NOT EXISTS (SELECT 1 FROM public.parking_lots l WHERE l.external_id = i.external_id)
    AND NOT EXISTS (SELECT 1 FROM public.source_mappings m WHERE m.source_name = '{SOURCE}' AND m.source_record_id = i.code)
  RETURNING id, external_id
), targets AS (
  SELECT i.code, ins.id AS lot_id, i.payload FROM inserted ins JOIN live_insert i USING (external_id)
  UNION ALL
  SELECT i.code, l.id, i.payload FROM live_insert i JOIN public.parking_lots l USING (external_id)
  WHERE l.is_public IS TRUE AND NOT EXISTS (SELECT 1 FROM inserted ins WHERE ins.external_id = i.external_id)
  UNION ALL
  SELECT k.code, k.lot_id, k.payload FROM live_link k
)
INSERT INTO public.source_mappings (source_name, source_record_id, parking_lot_id, import_run_id, source_payload)
SELECT '{SOURCE}', t.code, t.lot_id, run.id, t.payload FROM targets t CROSS JOIN run
ON CONFLICT (source_name, source_record_id) DO NOTHING;

SELECT source_record_id, parking_lot_id FROM public.source_mappings WHERE source_name = '{SOURCE}' ORDER BY 1;
COMMIT;
"""


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=pathlib.Path, help="SQL 파일 경로. 생략하면 dry run.")
    args = parser.parse_args()
    read_count, link, insert, skip, manual = plan(load_env())
    print(f"live={read_count} insert={len(insert)} link_existing={len(link)} skip={len(skip)} manual={len(manual)}")
    for r in link:
        print(f"  LINK   {r['code']:5} {r['name']} -> {r['lot_name']} ({r['distance']}m)")
    for r in insert:
        print(f"  INSERT {r['code']:5} {r['name']} | {r['address']} | {r['spaces']}면")
    for code, name, why in skip + manual:
        print(f"  SKIP   {code:5} {name}: {why}")
    if args.output:
        with args.output.open("x", encoding="utf-8", newline="\n") as f:
            f.write(generate_sql(read_count, link, insert))
        print(f"SQL written to {args.output}")


if __name__ == "__main__":
    assert "''" in sql_literal([{"name": "a'b"}])
    main()
