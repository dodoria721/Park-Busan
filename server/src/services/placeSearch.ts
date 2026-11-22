import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const query = new URL(request.url).searchParams.get('query')?.trim();
  if (!query || query.length > 100) return NextResponse.json({ error: '검색 장소를 100자 이내로 입력하세요.' }, { status: 400 });
  const key = process.env.KAKAO_REST_API_KEY?.trim();
  if (!key) return NextResponse.json({ error: 'Place search is not configured' }, { status: 503 });
  try {
    if (!/역$/.test(query)) {
      const addressUrl = new URL('https://dapi.kakao.com/v2/local/search/address.json');
      addressUrl.searchParams.set('query', `부산 ${query}`);
      addressUrl.searchParams.set('size', '5');
      const addressResponse = await fetch(addressUrl, { headers: { Authorization: `KakaoAK ${key}` }, signal: AbortSignal.timeout(10000), cache: 'no-store' });
      if (!addressResponse.ok) throw new Error('Address lookup failed');
      const addressBody = await addressResponse.json() as { documents: Array<{ address_name: string; x: string; y: string }> };
      if (!Array.isArray(addressBody.documents)) throw new Error('Invalid address response');
      const addresses = addressBody.documents.filter((place) => /^부산/.test(place.address_name)).map((place) => ({ id: `address:${place.address_name}`, name: place.address_name, address: place.address_name, latitude: Number(place.y), longitude: Number(place.x) })).filter((place) => Number.isFinite(place.latitude) && Number.isFinite(place.longitude));
      const exactAddresses = addresses.filter((place) => place.name.endsWith(` ${query}`));
      if (addresses.length) return NextResponse.json({ data: exactAddresses.length ? exactAddresses : addresses });
    }
    const url = new URL('https://dapi.kakao.com/v2/local/search/keyword.json');
    url.searchParams.set('query', `부산 ${query}`);
    url.searchParams.set('size', '5');
    if (/역$/.test(query)) url.searchParams.set('category_group_code', 'SW8');
    const response = await fetch(url, { headers: { Authorization: `KakaoAK ${key}` }, signal: AbortSignal.timeout(10000), cache: 'no-store' });
    if (!response.ok) throw new Error('Place lookup failed');
    const body = await response.json() as { documents: Array<{ id: string; place_name: string; address_name: string; road_address_name: string; x: string; y: string }> };
    if (!Array.isArray(body.documents)) throw new Error('Invalid place response');
    const data = body.documents.filter((place) => /^부산/.test(place.address_name)).map((place) => ({ id: place.id, name: place.place_name, address: place.road_address_name || place.address_name, latitude: Number(place.y), longitude: Number(place.x) })).filter((place) => Number.isFinite(place.latitude) && Number.isFinite(place.longitude));
    // Kakao also returns similarly named stations; prefer the exact station name.
    const exactStations = /역$/.test(query) ? data.filter((place) => place.name.split(/\s+/)[0] === query) : [];
    return NextResponse.json({ data: exactStations.length ? exactStations : data });
  } catch { return NextResponse.json({ error: '장소의 위치를 확인하지 못했습니다.' }, { status: 502 }); }
}
