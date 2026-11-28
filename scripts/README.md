# Data import utilities

## 실시간 주차장 연결과 오류 복구

`python -X utf8 scripts/import-busan-live-lots.py`는 DB를 읽고 등록 계획만 출력합니다. `--output <새 SQL 파일>`을 지정하면 검토용 SQL을 생성하며 직접 실행하지 않습니다. 시설공단 공식 위치 목록을 사용하고 기존 시설 연결은 공영 여부·이름·총 면수·위치를 확인합니다. 후보가 여러 개거나 근처 시설과 동일 여부를 확인할 수 없으면 수동 검토로 남깁니다. 민영주차장은 연결 대상에서 제외하며 기존에 민영시설에 연결된 코드도 경고합니다.

기존 A24(중동역), A25(미포공영)의 민영시설 오연결은 [복구 SQL](../docs/repair-busan-live-mappings.sql)로 수정할 수 있습니다. 공식 공영시설 행을 별도로 만들고 매핑만 옮기며 기존 민영시설과 요금은 보존합니다. 변경 전후 충돌 검사를 포함합니다. SQL은 검토와 DB 변경 승인 후 적용해야 합니다. 적용 전에도 서버는 민영시설의 공영 실시간 정보를 차단합니다. 기존 `docs/busan-live-import.sql`에서도 검증되지 않은 기존 시설 연결 4건을 제거했습니다. A02·A23의 총 면수 차이는 별도 확인이 필요합니다.

```powershell
python -X utf8 -m unittest discover -s scripts -p test_import_busan_live_lots.py
```

앱에서는 예산이 있어도 실시간 제공·요금 미확인 시설을 결과 상단에 표시합니다. 해당 시설을 예산 충족 추천으로 취급하지 않으며, 요금 확인이 필요한 시설만 있어도 빈 검색 결과로 표시하지 않습니다.

`npm run sync:locations`는 부산시설공단의 공개 주차장 목록에서 주소·좌표만 추출해 `server/src/data/parking-locations.json`에 출처와 수집 시각을 기록합니다. 실시간 주차 면수는 이 파일에 저장하지 않으며 기존 Supabase 함수 응답을 사용합니다. 이 스크립트는 DB를 변경하지 않습니다. 최소 건수와 유효 좌표를 검증하며 검증 실패 시 기존 snapshot을 유지합니다.

부산 공영주차장 원천 데이터의 형식과 라이선스가 확정되면 이 폴더에 CLI 적재 도구를 둡니다. 적재 도구는 `import_runs`에 실행 결과를 남기고 `source_mappings`를 통해 외부 ID와 내부 주차장 ID를 연결해야 합니다.

## 부산 민영주차장 적재

실행 명령과 Supabase 검증 방법은 [저장소 README](../README.md#부산-민영주차장-적재)를 참고하세요.
