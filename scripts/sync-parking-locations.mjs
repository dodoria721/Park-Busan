import fs from 'node:fs/promises';

const source = 'https://bsparking.bisco.or.kr/api/parking/realtime/list';
const response = await fetch(source, { signal: AbortSignal.timeout(20000) });
if (!response.ok) throw new Error(`Official parking catalogue HTTP ${response.status}`);
const body = await response.json();
if (body.result !== true || !Array.isArray(body.data)) throw new Error('Invalid official parking catalogue');
const text = value => typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : '';
const locations = body.data.flatMap(row => {
  const latitude = Number(row.lat), longitude = Number(row.lng);
  if (!text(row.parkingName) || !row.lat || !row.lng || !Number.isFinite(latitude) || !Number.isFinite(longitude) || latitude < 34.7 || latitude > 35.5 || longitude < 128.5 || longitude > 129.5) return [];
  const region = [text(row.sidoName), text(row.sigunguName || row.addr)].filter(Boolean).join(' ');
  const building = [text(row.buildingMainNo), text(row.buildingSubNo)].filter(value => value && value !== '0').join('-');
  const address = [region, text(row.roadName), building].filter(Boolean).join(' ');
  const landAddress = [region, text(row.addrDetail)].filter(Boolean).join(' ');
  return [{ officialId: String(row.parkingId), name: text(row.parkingName), address, landAddress, latitude, longitude }];
});
if (locations.length < 40) throw new Error('Unexpectedly incomplete official parking catalogue; existing snapshot preserved');
const target = new URL('../server/src/data/parking-locations.json', import.meta.url);
await fs.mkdir(new URL('../server/src/data/', import.meta.url), { recursive: true });
await fs.writeFile(target, JSON.stringify({ source, retrievedAt: new Date().toISOString(), locations }, null, 2) + '\n');
console.log(`Saved ${locations.length} official parking locations`);
