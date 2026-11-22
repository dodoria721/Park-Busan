import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import { filterParking, readParkingFilters, parkingFilterParams, parseParkingQuery, distanceMeters } from '../app/src/services/filterParking.ts';

const lots = [
  { id: '1', name: '삼락재첩거리', address: null, availableSpaces: 5, liveStatus: 'available' },
  { id: '2', name: '삼락천로', address: null, availableSpaces: 0, liveStatus: 'full' },
  { id: '3', name: '반송1, 3동 공영', address: null, availableSpaces: null, liveStatus: 'unknown' },
  { id: '4', name: '장산역', address: '부산 해운대구', availableSpaces: 10, liveStatus: 'available' },
];
const defaults = { query: '', available: false, sort: 'name' };

test('searches multiple name tokens and available addresses; missing addresses are safe', () => {
  assert.deepEqual(filterParking(lots, { ...defaults, query: '부산 삼락 주차장' }).map(lot => lot.id), ['1', '2']);
  assert.deepEqual(filterParking(lots, { ...defaults, query: '해운대' }).map(lot => lot.id), ['4']);
  assert.deepEqual(filterParking(lots, { ...defaults, query: '반송1 3동' }).map(lot => lot.id), ['3']);
  assert.deepEqual(filterParking(lots, { ...defaults, query: '없는주차장' }), []);
});
test('available filter excludes full and unknown lots; null counts sort last', () => {
  assert.deepEqual(filterParking(lots, { ...defaults, available: true, sort: 'spaces' }).map(lot => lot.id), ['4', '1']);
  assert.deepEqual(filterParking(lots, { ...defaults, sort: 'spaces' }).map(lot => lot.id), ['4', '1', '2', '3']);
});
test('filtering does not mutate the shared list and route parameters round-trip', () => {
  const previous = structuredClone(lots);
  filterParking(lots, { ...defaults, sort: 'spaces' });
  assert.deepEqual(lots, previous);
  const filters = { query: '삼락', available: true, sort: 'spaces' };
  assert.deepEqual(readParkingFilters(parkingFilterParams(filters)), filters);
  assert.deepEqual(readParkingFilters({ sort: 'invalid', available: 'invalid' }), defaults);
});

test('nearby wording is parsed without damaging station or parking names', () => {
  for (const query of ['범일역 근처 주차장', '범일역근처주차장', '부산 범일역 주변 공영주차장']) {
    assert.deepEqual(parseParkingQuery(query), { term: '범일역', nearby: true });
  }
  assert.deepEqual(parseParkingQuery('부산역 근처'), { term: '부산역', nearby: true });
  assert.deepEqual(parseParkingQuery('주례역주변복개'), { term: '주례역주변복개', nearby: false });
});

test('Beomil searches find Gold Theme Street through official address and actual distance', () => {
  const catalogue = JSON.parse(fs.readFileSync(new URL('../server/src/data/parking-locations.json', import.meta.url), 'utf8'));
  const official = catalogue.locations.find(location => location.officialId === '49');
  assert.equal(official.name, '골드테마거리');
  const gold = { ...official, id: 'A49', availableSpaces: 16, liveStatus: 'available', distanceMeters: null };
  const station = { id: '21160456', name: '범일역 부산1호선', address: '부산 동구 범일로 지하 108', latitude: 35.14080345890983, longitude: 129.0593528545117 };
  assert.deepEqual(filterParking([gold], { ...defaults, query: '범일' }).map(lot => lot.id), ['A49']);
  const others = [
    { ...gold, id: 'far', name: '범일역 이름만 같은 먼 주차장', latitude: 35.18 },
    { ...gold, id: 'missing', latitude: null, longitude: null },
    { ...gold, id: 'full', availableSpaces: 0, liveStatus: 'full' },
  ];
  const results = filterParking([gold, ...others], { ...defaults, query: '범일역 근처 주차장', available: true }, station);
  assert.deepEqual(results.map(lot => lot.id), ['A49']);
  assert.ok(results[0].distanceMeters > 80 && results[0].distanceMeters < 100);
  assert.equal(gold.distanceMeters, null);
  assert.equal(distanceMeters(station, station), 0);
  assert.deepEqual(filterParking([gold], { ...defaults, query: '부산역 근처' }, { ...station, latitude: 35.1152, longitude: 129.0414 }), []);
});

test('a chosen destination survives list-to-map navigation', () => {
  const filters = { query: '범일역 근처', available: true, sort: 'spaces', placeId: '21160456' };
  assert.deepEqual(readParkingFilters(parkingFilterParams(filters)), filters);
});
