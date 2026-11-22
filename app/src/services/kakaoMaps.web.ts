export interface KakaoPlace {
  id: string;
  place_name: string;
  address_name: string;
  road_address_name: string;
  x: string;
  y: string;
}

interface MapPoint { getLat(): number; getLng(): number; }
interface MapBounds { extend(point: MapPoint): void; }
export interface KakaoMap {
  setBounds(bounds: MapBounds): void;
  setCenter(point: MapPoint): void;
  setLevel(level: number): void;
  relayout(): void;
}
export interface KakaoMarker { setMap(map: KakaoMap | null): void; }

interface KakaoMaps {
  load(callback: () => void): void;
  Map: new (element: HTMLElement, options: { center: MapPoint; level: number }) => KakaoMap;
  LatLng: new (latitude: number, longitude: number) => MapPoint;
  LatLngBounds: new () => MapBounds;
  Marker: new (options: { map: KakaoMap; position: MapPoint; title: string }) => KakaoMarker;
  event: {
    addListener(target: KakaoMarker, name: 'click', callback: () => void): void;
    removeListener(target: KakaoMarker, name: 'click', callback: () => void): void;
  };
  services: {
    Places: new () => {
      keywordSearch(query: string, callback: (places: KakaoPlace[], status: string) => void, options: { category_group_code?: string; size: number }): void;
    };
    Status: { OK: string; ZERO_RESULT: string };
  };
}

let pending: Promise<KakaoMaps> | undefined;

export function loadKakaoMaps(): Promise<KakaoMaps> {
  if (pending) return pending;
  const key = process.env.EXPO_PUBLIC_KAKAO_MAP_KEY?.trim();
  if (!key) return Promise.reject(new Error('카카오 JavaScript 키가 없습니다. app/.env의 EXPO_PUBLIC_KAKAO_MAP_KEY를 설정해 주세요.'));
  const loading = new Promise<KakaoMaps>((resolve, reject) => {
    const script = document.createElement('script');
    const timer = setTimeout(() => fail(), 20000);
    const fail = () => {
      clearTimeout(timer);
      script.remove();
      reject(new Error(`카카오맵을 불러오지 못했습니다. JavaScript 키와 카카오맵 사용 설정을 확인하고, 허용 도메인에 ${window.location.origin}을 등록해 주세요.`));
    };
    script.async = true;
    script.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${encodeURIComponent(key)}&autoload=false&libraries=services`;
    script.onerror = fail;
    script.onload = () => {
      const sdk = (window as unknown as { kakao?: { maps?: KakaoMaps } }).kakao?.maps;
      if (!sdk?.load) { fail(); return; }
      sdk.load(() => {
        if (!sdk.Map || !sdk.services?.Places) { fail(); return; }
        clearTimeout(timer);
        resolve(sdk);
      });
    };
    document.head.appendChild(script);
  });
  pending = loading.catch((error: unknown) => { pending = undefined; throw error; });
  return pending;
}
