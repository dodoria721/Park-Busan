import { useCallback, useEffect, useRef, useState } from 'react';
import type { ParkingLot } from '@/types/parking';
import { loadKakaoMaps, type KakaoMap, type KakaoMarker, type KakaoPlace } from '@/services/kakaoMaps.web';

export interface ParkingMapProps { parking: ParkingLot | null; }

export function ParkingMap({ parking }: ParkingMapProps) {
  return <MapPanel key={parking?.id ?? 'empty'} parking={parking} />;
}

function MapPanel({ parking }: ParkingMapProps) {
  const parkingName = parking?.name;
  const parkingId = parking?.id;
  const latitude = parking?.latitude;
  const longitude = parking?.longitude;
  const address = parking?.address;
  const official = Boolean(parking?.locationSource && latitude != null && longitude != null);
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<KakaoMap | null>(null);
  const markers = useRef<{ marker: KakaoMarker; click: () => void }[]>([]);
  const requestId = useRef({ value: 0 });
  const [query, setQuery] = useState(parking ? `부산 ${parking.name}` : '부산 공영주차장');
  const [places, setPlaces] = useState<KakaoPlace[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [status, setStatus] = useState('카카오 지도를 불러오는 중입니다.');
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [ready, setReady] = useState(false);
  const [showingOfficial, setShowingOfficial] = useState(official);

  const search = useCallback(async (keyword: string) => {
    const current = ++requestId.current.value;
    setStatus('위치 후보를 검색하고 있습니다.');
    setShowingOfficial(false);
    setPlaces([]);
    setSelected(null);
    const sdk = await loadKakaoMaps();
    if (current !== requestId.current.value || !map.current) return;
    markers.current.forEach(({ marker, click }) => {
      sdk.event.removeListener(marker, 'click', click);
      marker.setMap(null);
    });
    markers.current = [];
    new sdk.services.Places().keywordSearch(keyword, (results, resultStatus) => {
      if (current !== requestId.current.value || !map.current) return;
      if (resultStatus !== sdk.services.Status.OK) {
        setStatus(resultStatus === sdk.services.Status.ZERO_RESULT ? '검색 결과가 없습니다. 지역명과 주차장 이름을 바꿔 검색해 주세요.' : '장소 검색에 실패했습니다. 카카오맵 사용 설정과 네트워크를 확인한 뒤 다시 검색해 주세요.');
        return;
      }
      // Keep only Busan candidates; a name match does not establish identity.
      const candidates = results.filter((place) => /^부산/.test(place.address_name) && Number.isFinite(Number(place.x)) && Number.isFinite(Number(place.y)));
      setPlaces(candidates);
      setStatus(candidates.length ? `위치 후보 ${candidates.length}곳 · 이름과 주소를 확인해 주세요.` : '부산 지역 위치 후보가 없습니다. 검색어를 바꿔 주세요.');
      const bounds = new sdk.LatLngBounds();
      candidates.forEach((place) => {
        const point = new sdk.LatLng(Number(place.y), Number(place.x));
        const marker = new sdk.Marker({ map: map.current!, position: point, title: place.place_name });
        const click = () => { setSelected(place.id); map.current?.setCenter(point); map.current?.setLevel(3); };
        sdk.event.addListener(marker, 'click', click);
        markers.current.push({ marker, click });
        bounds.extend(point);
      });
      if (candidates.length === 1) {
        map.current.setCenter(new sdk.LatLng(Number(candidates[0].y), Number(candidates[0].x)));
        map.current.setLevel(3);
      } else if (candidates.length > 1) map.current.setBounds(bounds);
    }, { category_group_code: 'PK6', size: 15 });
  }, []);

  useEffect(() => {
    const requests = requestId.current;
    let active = true;
    let observer: ResizeObserver | undefined;
    loadKakaoMaps().then((sdk) => {
      if (!active || !container.current) return;
      map.current = new sdk.Map(container.current, { center: new sdk.LatLng(35.1796, 129.0756), level: 8 });
      observer = new ResizeObserver(() => map.current?.relayout());
      observer.observe(container.current);
      setReady(true);
      if (official && latitude != null && longitude != null) {
        const point = new sdk.LatLng(latitude, longitude);
        map.current.setCenter(point);
        map.current.setLevel(3);
        const marker = new sdk.Marker({ map: map.current, position: point, title: parkingName ?? '주차장' });
        const click = () => { setSelected(parkingId ?? 'official'); map.current?.setCenter(point); };
        sdk.event.addListener(marker, 'click', click);
        markers.current = [{ marker, click }];
        setPlaces([{ id: parkingId ?? 'official', place_name: parkingName ?? '주차장', address_name: address ?? '', road_address_name: address ?? '', x: String(longitude), y: String(latitude) }]);
        setShowingOfficial(true);
        setStatus('부산시설공단 공식 주소·좌표로 표시한 주차장입니다.');
        return;
      }
      return search(parkingName ? `부산 ${parkingName}` : '부산 공영주차장');
    }).catch((reason: unknown) => { if (active) setError(reason instanceof Error ? reason.message : '지도를 불러오지 못했습니다.'); });
    return () => {
      active = false;
      requests.value++;
      observer?.disconnect();
      markers.current.forEach(({ marker }) => marker.setMap(null));
      markers.current = [];
      map.current = null;
    };
  }, [parkingName, parkingId, latitude, longitude, address, official, attempt, search]);

  return (
    <section aria-label="카카오 지도" style={{ padding: 16, color: '#15323f' }}>
      {parking ? <p style={{ marginTop: 0 }}><strong>{parking.name}</strong> · 잔여 {parking.availableSpaces ?? '미확인'}면</p> : null}
      <p>{official ? '부산시설공단의 공식 위치 정보를 사용합니다. 다른 장소를 찾으려면 아래에서 검색하세요.' : '공식 좌표가 없어 이름으로 위치 후보를 검색합니다. 후보 주소와 실제 주차장을 확인해 주세요.'}</p>
      <form onSubmit={(event) => { event.preventDefault(); if (query.trim()) void search(query.trim()); }} style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <input aria-label="지도 위치 검색어" value={query} onChange={(event) => setQuery(event.target.value)} style={{ flex: 1, minWidth: 0, padding: 12, border: '1px solid #b8cbd3', borderRadius: 8 }} />
        <button disabled={!ready || !query.trim()} type="submit">위치 검색</button>
      </form>
      {error ? <div role="alert"><p>{error}</p><button onClick={() => { setError(null); setAttempt((value) => value + 1); }}>지도 다시 시도</button></div> : <p role="status">{status}</p>}
      <div ref={container} data-testid="kakao-map" style={{ width: '100%', height: 340, borderRadius: 12, background: '#d9edf2' }} />
      {places.length ? <ul aria-label={showingOfficial ? '공식 주차장 위치' : '지도 위치 후보'} style={{ listStyle: 'none', padding: 0, maxHeight: 160, overflowY: 'auto' }}>{places.map((place) => (
        <li key={place.id} style={{ padding: 8, background: selected === place.id ? '#d9edf2' : 'white', marginTop: 6 }}>
          <button onClick={() => { setSelected(place.id); void loadKakaoMaps().then((sdk) => { map.current?.setCenter(new sdk.LatLng(Number(place.y), Number(place.x))); map.current?.setLevel(3); }); }}>{place.place_name}</button>
          <span style={{ display: 'block', marginTop: 4 }}>{place.road_address_name || place.address_name}</span>
          <a href={`https://map.kakao.com/link/map/${encodeURIComponent(place.place_name)},${place.y},${place.x}`} target="_blank" rel="noopener noreferrer">카카오맵에서 보기</a>
        </li>
      ))}</ul> : null}
    </section>
  );
}
