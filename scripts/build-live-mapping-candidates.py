"""부산시설공단 실시간 주차장(A코드) ↔ DB parking_lots 매핑 후보표 생성.

읽기 전용: DB에 쓰지 않는다. 결과 CSV를 담당자가 검토해 confirmed 열에 Y를 표시한다.
실시간 API에는 좌표가 없으므로 카카오 키워드 검색으로 위치를 추정하고,
그 근처 DB 주차장과 이름 유사도를 함께 보여 준다.

실행: python -X utf8 scripts/build-live-mapping-candidates.py
"""
import csv
import difflib
import json
import math
import pathlib
import re
import urllib.parse
import urllib.request

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / "docs" / "live-mapping-candidates.csv"
RADIUS_M = 500  # ponytail: 고정 반경, 오매칭이 많으면 조정
TOP_N = 3


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
    return re.sub(r"공영|주차장|주차빌딩|노상|노외|[\s(),.·\-]", "", name or "")


def similarity(a, b):
    return round(difflib.SequenceMatcher(None, norm(a), norm(b)).ratio(), 2)


def kakao_locate(name, key):
    q = urllib.parse.urlencode({"query": f"부산 {name} 주차장", "size": 1})
    docs = get_json(f"https://dapi.kakao.com/v2/local/search/keyword.json?{q}", {"Authorization": f"KakaoAK {key}"})["documents"]
    return docs[0] if docs else None


def main():
    env = load_env()
    live_url = env["BUSAN_LIVE_API_URL"] + "?" + urllib.parse.urlencode(
        {"serviceKey": env["BUSAN_LIVE_API_KEY"], "pageNo": 1, "numOfRows": 100, "resultType": "json"}
    )
    live = get_json(live_url)["response"]["body"]["items"]["item"]
    lots = get_json(
        env["SUPABASE_URL"] + "/rest/v1/parking_lots?select=id,name,address,latitude,longitude&limit=10000",
        {"apikey": env["SUPABASE_SECRET_KEY"]},
    )

    rows = []
    for item in live:
        place = kakao_locate(item["parknm"], env["KAKAO_REST_API_KEY"])
        cands = []
        for lot in lots:
            d = None
            if place and lot.get("latitude") is not None:
                d = round(dist_m(float(place["y"]), float(place["x"]), lot["latitude"], lot["longitude"]))
            s = similarity(item["parknm"], lot["name"])
            if (d is not None and d <= RADIUS_M) or s >= 0.6:
                cands.append((d if d is not None else 10**9, -s, lot, d, s))
        cands.sort(key=lambda c: (c[0], c[1]))
        base = {
            "live_code": item["parkgcd"],
            "live_name": item["parknm"],
            "live_total": item.get("maxcnt"),
            "kakao_place": place["place_name"] if place else "",
            "kakao_address": (place.get("road_address_name") or place.get("address_name")) if place else "",
        }
        if not cands:
            rows.append({**base, "rank": "", "db_id": "", "db_name": "(후보 없음: DB 미적재 가능)", "db_address": "", "distance_m": "", "name_similarity": "", "confirmed": ""})
        for rank, (_, _, lot, d, s) in enumerate(cands[:TOP_N], 1):
            rows.append({**base, "rank": rank, "db_id": lot["id"], "db_name": lot["name"], "db_address": lot.get("address") or "",
                         "distance_m": "" if d is None else d, "name_similarity": s, "confirmed": ""})

    OUT.parent.mkdir(exist_ok=True)
    with OUT.open("w", encoding="utf-8-sig", newline="") as f:
        w = csv.DictWriter(f, fieldnames=list(rows[0].keys()))
        w.writeheader()
        w.writerows(rows)

    codes = {r["live_code"] for r in rows}
    no_cand = {r["live_code"] for r in rows if r["rank"] == ""}
    print(f"live lots {len(codes)}, with candidates {len(codes - no_cand)}, without {len(no_cand)} -> {OUT}")


if __name__ == "__main__":
    assert similarity("동래시장 공영주차장", "동래시장공영주차장") == 1.0
    assert round(dist_m(35.0, 129.0, 35.0, 129.0)) == 0
    main()
