# ParkBusan 민영주차장

이 브랜치는 부산 민영주차장을 기존 검색 결과에 포함합니다. 앱 실행과 전체 프로젝트 구조는 [main 브랜치 README](https://github.com/dodoria721/Park-Busan/blob/main/README.md)를 참고하세요.

## 부산 민영주차장 적재

이 브랜치의 `private-parking/` 폴더에 원본 CSV 17개가 있습니다. 별도로 전달할 때는 [적재 스크립트](scripts/import-private-parking.py), 이 문서, [CSV 폴더](private-parking/)를 함께 전달합니다. 저장소 루트에서 아래 명령을 실행합니다. Python 3 표준 라이브러리만 사용하며 아래 명령은 DB에 접속하지 않습니다.

```powershell
python -X utf8 scripts/import-private-parking.py private-parking
python -X utf8 scripts/import-private-parking.py private-parking --output private-parking.sql
```

첫 명령은 건수와 제외된 관리번호를 출력합니다. 두 번째 명령은 같은 검증을 거쳐 SQL 파일을 생성합니다. 첨부본 기준 UTF-8 CSV 17개에서 전체 638행, 민영 230행(강서구 87, 해운대구 143), 적재 가능 225행, 기본요금 정책 30건입니다. 해운대구의 좌표 누락 5행은 건너뜁니다. 주소는 도로명 우선으로 사용하고, 운영시간은 요일별 원본 시각을 기록합니다. CSV의 1일주차권요금은 일 최대요금으로 사용하기에 근거가 부족해 원본 데이터에만 보관합니다.

DB 권한이 있는 팀원이 팀 Supabase 프로젝트에서 초기 주차장 스키마가 적용되어 있는지 확인한 뒤 **SQL Editor**에서 생성된 `private-parking.sql` 전체를 한 번 실행합니다. SQL은 한 트랜잭션으로 실행되며 신규 행에만 주차장, 출처 매핑, 요금 정책을 추가합니다. CSV 관리번호나 전용 외부 ID가 이미 등록되어 있거나 동일 관리번호의 표준데이터 출처 매핑이 있으면 기존 정보를 유지합니다. 이름이나 주소만으로는 동일 주차장을 합치지 않습니다. 같은 SQL을 다시 실행하면 적재 이력은 한 건 남고 신규 주차장과 요금 정책은 0건입니다.

SQL Editor에서 다음 쿼리로 최근 실행 건수와 실제 연결을 확인합니다.

```sql
select id, status, records_read, records_written, finished_at
from public.import_runs
where source_name = '부산 민영주차장 CSV'
order by finished_at desc
limit 5;

select count(*) as imported_lots,
       count(distinct lot.id) as distinct_lots,
       count(*) filter (where lot.is_public) as public_lots,
       count(*) filter (where exists (
         select 1 from public.fee_policies fee where fee.parking_lot_id = lot.id
       )) as lots_with_fees
from public.source_mappings mapping
join public.parking_lots lot on lot.id = mapping.parking_lot_id
where mapping.source_name = '부산 민영주차장 CSV';
```

동일 주차장이 미리 등록되어 있지 않으면 첫 실행에서 `records_read=230`, `records_written=225`, `fee_policies_written=30`이 나옵니다. 두 번째 쿼리는 각각 `225, 225, 0, 30`입니다. 재실행 뒤에는 최근 이력의 `records_written=0`과 두 번째 쿼리의 동일한 건수를 확인합니다.

팀 Supabase에 연결된 앱에서는 강서구 명지동의 화인종합주차장 좌표(35.1090313, 128.9297095)를 중심으로 예산 없이 검색해 결과를 확인할 수 있습니다. API로 확인할 경우 아래 JSON을 `POST /api/recommend`에 보냅니다.

```json
{"destination":{"lat":35.1090313,"lng":128.9297095},"durationMinutes":30,"budget":null}
```

응답의 `all`에서 `화인종합주차장`을 확인합니다. 앱에서 같은 조건으로 검색하면 기존 결과 목록과 표시 방식을 사용합니다. 요금을 계산할 수 없는 주차장은 예산이 있을 때 기존 ‘요금 확인 필요’ 목록에 표시됩니다. 생성 SQL, 비밀 키와 `.env.local`은 커밋 대상에서 제외합니다.
