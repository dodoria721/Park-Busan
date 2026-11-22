# Data import utilities

`npm run sync:locations`는 부산시설공단의 공개 주차장 목록에서 주소·좌표만 추출해 `server/src/data/parking-locations.json`에 출처와 수집 시각을 기록합니다. 실시간 주차 면수는 이 파일에 저장하지 않으며 기존 Supabase 함수 응답을 사용합니다. 이 스크립트는 DB를 변경하지 않습니다. 최소 건수와 유효 좌표를 검증하며 검증 실패 시 기존 snapshot을 유지합니다.

부산 공영주차장 원천 데이터의 형식과 라이선스가 확정되면 이 폴더에 CLI 적재 도구를 둡니다. 적재 도구는 `import_runs`에 실행 결과를 남기고 `source_mappings`를 통해 외부 ID와 내부 주차장 ID를 연결해야 합니다.
