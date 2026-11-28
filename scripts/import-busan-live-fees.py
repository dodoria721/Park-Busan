"""부산시설공단 공식 요금 등급을 실시간 연결 주차장의 fee_policies SQL로 변환.

DB에 직접 쓰지 않는다. 기본은 dry run이고, --output을 주면 Supabase SQL Editor용 SQL을 만든다.

- 대상: source_mappings(busan_facilities_live)로 연결됐고 fee_policies가 없는 공영 주차장
- 공식 목록과의 대응: 시설공단 이름(source_payload.parknm)이 공식 parkingName과 같아야 한다.
  이름이 없는 매핑(복구 SQL로 만든 A24·A25)만 코드 번호와 공식 parkingId로 찾는다.
- 평일(WEEK) 등급만 사용한다. 앱 요금 계산은 요일을 구분하지 않으므로 notes에 기록한다.
- 구역별 평일 요금이 다르거나 0원·0분 등 의미가 불분명한 등급은 계산 불가로 남긴다.

실행: python -X utf8 scripts/import-busan-live-fees.py [--output docs/busan-live-fees.sql]
"""
import argparse
import json
import pathlib
import re
import urllib.request

ROOT = pathlib.Path(__file__).resolve().parent.parent
SOURCE = "busan_facilities_live"
CATALOGUE_URL = "https://bsparking.bisco.or.kr/api/parking/realtime/list"


def load_env():
    env = {}
    for line in (ROOT / "server" / ".env.local").read_text(encoding="utf8").splitlines():
        if "=" in line and not line.lstrip().startswith("#"):
            k, v = line.split("=", 1)
            env[k.strip()] = v.strip()
    return env


def get_json(url, headers=None):
    with urllib.request.urlopen(urllib.request.Request(url, headers=headers or {}), timeout=30) as r:
        return json.load(r)


def norm(name):
    return re.sub(r"[\s(),.·\-]", "", name or "")


def policy_from_grade(grade):
    """공식 등급 → fee_policies 행. 표현할 수 없으면 (None, 사유)."""
    default_t, default_a = grade.get("defaultTime") or 0, grade.get("defaultAmount") or 0
    unit_t, unit_a = grade.get("intervalTime") or 0, grade.get("intervalAmount") or 0
    if unit_t <= 0 or unit_a <= 0:
        return None, "단위 요금이 0이라 의미 불분명"
    if default_t > 0:
        base_t, base_a = default_t, default_a
    else:
        base_t, base_a = unit_t, unit_a
    daily = grade.get("dayParkingAmount") or None
    notes = f"부산시설공단 공식 요금({grade.get('gradeInfoName')}), 평일 기준"
    if grade.get("freeTime"):
        notes += f", 최초 {grade['freeTime']}분 무료(회차) 미반영"
    return {
        "base_minutes": base_t, "base_fee_won": base_a,
        "additional_minutes": unit_t, "additional_fee_won": unit_a,
        "daily_max_fee_won": daily, "notes": notes,
    }, None


def weekday_policy(sections):
    grades = {
        json.dumps(g["gradeAmount"], sort_keys=True)
        for s in sections for g in s.get("gradeInfoList", []) if g.get("dayType") == "WEEK" and g.get("gradeAmount")
    }
    if not grades:
        return None, "평일 요금 등급 없음"
    if len(grades) > 1:
        return None, "구역별 평일 요금이 서로 다름"
    return policy_from_grade(json.loads(grades.pop()))


def plan(env):
    sb = {"apikey": env["SUPABASE_SECRET_KEY"]}
    rows = get_json(
        env["SUPABASE_URL"] + "/rest/v1/source_mappings?select=source_record_id,source_payload,"
        "parking_lots(id,name,is_public,fee_policies(id))"
        f"&source_name=eq.{SOURCE}&limit=1000", sb)
    catalogue, by_id = {}, {}
    for item in get_json(CATALOGUE_URL)["data"]:
        catalogue.setdefault(norm(item.get("parkingName")), []).append(item)
        by_id.setdefault(str(item.get("parkingId")), []).append(item)

    insert, skip = [], []
    for row in sorted(rows, key=lambda r: r["source_record_id"]):
        code, lot = row["source_record_id"], row["parking_lots"] or {}
        live_name = (row.get("source_payload") or {}).get("parknm") or ""
        code_id = str(int(code[1:]))
        # 복구 SQL로 다시 만든 매핑은 이름 없이 공식 ID만 쓴다: 이름이 없을 때만 ID로 찾는다.
        sections = catalogue.get(norm(live_name)) if live_name else by_id.get(code_id)
        if not lot.get("is_public"):
            skip.append((code, lot.get("name"), "공영 주차장이 아님"))
        elif lot.get("fee_policies"):
            skip.append((code, lot["name"], "이미 요금 정책 있음"))
        elif not sections:
            skip.append((code, lot["name"], f"공식 목록에서 찾지 못함({live_name or 'ID ' + code_id})"))
        else:
            ids = {str(s.get("parkingId")) for s in sections}
            policy, why = weekday_policy(sections)
            if not policy:
                skip.append((code, lot["name"], why))
            else:
                insert.append({"code": code, "lot_id": lot["id"], "lot_name": lot["name"],
                               "id_matches": ids == {code_id}, **policy})
    return insert, skip


def sql_literal(obj):
    return "'" + json.dumps(obj, ensure_ascii=False).replace("'", "''") + "'::jsonb"


def generate_sql(insert):
    payload = [{k: v for k, v in r.items() if k not in ("code", "lot_name", "id_matches")} for r in insert]
    return f"""-- 부산시설공단 공식 요금(평일 기준) 적재. 생성: scripts/import-busan-live-fees.py
-- Supabase SQL Editor에서 실행한다. 이미 요금 정책이 있는 주차장은 건너뛴다.
BEGIN;
LOCK TABLE public.fee_policies IN SHARE ROW EXCLUSIVE MODE;
INSERT INTO public.fee_policies
  (parking_lot_id, base_minutes, base_fee_won, additional_minutes, additional_fee_won, daily_max_fee_won, notes)
SELECT f.lot_id, f.base_minutes, f.base_fee_won, f.additional_minutes, f.additional_fee_won, f.daily_max_fee_won, f.notes
FROM jsonb_to_recordset({sql_literal(payload)}) AS f(
  lot_id uuid, base_minutes integer, base_fee_won integer, additional_minutes integer,
  additional_fee_won integer, daily_max_fee_won integer, notes text
)
WHERE NOT EXISTS (SELECT 1 FROM public.fee_policies p WHERE p.parking_lot_id = f.lot_id);
SELECT count(*) AS fee_policies_for_live_lots FROM public.fee_policies p
JOIN public.source_mappings m ON m.parking_lot_id = p.parking_lot_id AND m.source_name = '{SOURCE}';
COMMIT;
"""


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=pathlib.Path, help="SQL 파일 경로. 생략하면 dry run.")
    args = parser.parse_args()
    insert, skip = plan(load_env())
    print(f"insert={len(insert)} skip={len(skip)}")
    for r in insert:
        daily = f"{r['daily_max_fee_won']}원" if r["daily_max_fee_won"] else "없음"
        warn = "" if r["id_matches"] else "  [공식 ID와 코드 번호 불일치: 확인 필요]"
        print(f"  FEE  {r['code']:5} {r['lot_name']}: 기본 {r['base_minutes']}분 {r['base_fee_won']}원, "
              f"{r['additional_minutes']}분당 {r['additional_fee_won']}원, 1일 최대 {daily}{warn}")
    for code, name, why in skip:
        print(f"  SKIP {code:5} {name}: {why}")
    if args.output:
        with args.output.open("x", encoding="utf-8", newline="\n") as f:
            f.write(generate_sql(insert))
        print(f"SQL written to {args.output}")


if __name__ == "__main__":
    main()
