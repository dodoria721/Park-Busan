"""부산시설공단 실시간 주차장(A코드)을 parking_lots/source_mappings에 연결하는 SQL 생성.

DB에 직접 쓰지 않는다. 기본은 dry run(검증 결과 출력)이고, --output을 주면
Supabase SQL Editor에서 실행할 SQL 파일을 만든다.

- 실시간 API에는 좌표가 없으므로 카카오 키워드 검색으로 위치를 찾는다.
  장소명이 시설공단 이름을 포함하고 부산 주소인 결과만 채택한다.
- 150m 이내에 이름이 매우 비슷한 기존 주차장이 있으면 매핑만 추가한다.
- 나머지는 새 주차장으로 추가한다. 요금 정보는 API에 없어 fee_policies는 만들지 않는다.

실행: python -X utf8 scripts/import-busan-live-lots.py [--output docs/busan-live-import.sql]
"""
import argparse
import difflib
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
SAME_LOT_SIMILARITY = 0.75


def load_env():
    env = {}
    for line in (ROOT / "server" / ".env.local").read_text(encoding="utf8").splitlines():
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


def similarity(a, b):
    return difflib.SequenceMatcher(None, norm(a), norm(b)).ratio()


def place_matches(live_name, place):
    address = place.get("road_address_name") or place.get("address_name") or ""
    key = norm(live_name)
    return bool(key) and key in norm(place["place_name"]) and address.startswith("부산")


def kakao_locate(name, key):
    for query in (f"{name} 공영주차장", f"부산 {name} 주차장"):
        q = urllib.parse.urlencode({"query": query, "size": 5})
        docs = get_json(f"https://dapi.kakao.com/v2/local/search/keyword.json?{q}", {"Authorization": f"KakaoAK {key}"})["documents"]
        for doc in docs:
            if place_matches(name, doc):
                return doc
    return None


def plan(env):
    live = get_json(env["BUSAN_LIVE_API_URL"] + "?" + urllib.parse.urlencode(
        {"serviceKey": env["BUSAN_LIVE_API_KEY"], "pageNo": 1, "numOfRows": 100, "resultType": "json"}
    ))["response"]["body"]["items"]["item"]
    sb = {"apikey": env["SUPABASE_SECRET_KEY"]}
    base = env["SUPABASE_URL"] + "/rest/v1"
    lots = get_json(base + "/parking_lots?select=id,external_id,name,latitude,longitude&limit=10000", sb)
    mapped = {m["source_record_id"] for m in get_json(base + f"/source_mappings?select=source_record_id&source_name=eq.{SOURCE}&limit=1000", sb)}
    external_ids = {l["external_id"] for l in lots if l.get("external_id")}

    link, insert, skip, manual = [], [], [], []
    for item in live:
        code, name = item["parkgcd"], item["parknm"].strip()
        payload = {k: item.get(k) for k in ("parkgcd", "parknm", "maxcnt")}
        if code in mapped or EXTERNAL_PREFIX + code in external_ids:
            skip.append((code, name, "이미 연결됨"))
            continue
        if not norm(name) or name == "예비":
            manual.append((code, name, "이름으로 위치를 특정할 수 없음"))
            continue
        place = kakao_locate(name, env["KAKAO_REST_API_KEY"])
        if not place:
            manual.append((code, name, "카카오에서 일치하는 장소 없음"))
            continue
        lat, lng = float(place["y"]), float(place["x"])
        address = place.get("road_address_name") or place.get("address_name")
        payload["kakao"] = {"id": place["id"], "place_name": place["place_name"], "address": address}
        same = [
            (d, l) for l in lots if l.get("latitude") is not None
            for d in [dist_m(lat, lng, l["latitude"], l["longitude"])]
            if d <= SAME_LOT_RADIUS_M and similarity(name, l["name"]) >= SAME_LOT_SIMILARITY
        ]
        if same:
            d, lot = min(same, key=lambda x: x[0])
            link.append({"code": code, "name": name, "lot_id": lot["id"], "lot_name": lot["name"], "distance": round(d), "payload": payload})
        else:
            total = item.get("maxcnt")
            insert.append({
                "code": code, "external_id": EXTERNAL_PREFIX + code, "name": place["place_name"], "address": address,
                "lat": lat, "lng": lng, "spaces": int(total) if str(total).isdecimal() else None, "payload": payload,
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
    assert place_matches("동백사거리", {"place_name": "동백사거리 공영주차장", "road_address_name": "부산 해운대구 ..."})
    assert not place_matches("두산위브 뒤", {"place_name": "남구종합사회복지관 주차장", "road_address_name": "부산 남구 ..."})
    assert not place_matches("중앙공원", {"place_name": "중앙공원 주차장", "road_address_name": "서울 중구 ..."})
    assert "''" in sql_literal([{"name": "a'b"}])
    main()
