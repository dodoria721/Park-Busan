import { Component, useMemo, type ReactNode } from 'react';
import { Text, View } from 'react-native';
import type { Candidate, ParkingLot } from '@parkbusan/shared';
import ResultMap from './ResultMap';
import { s } from '../ui';

const NO_ITEMS: Candidate[] = [];
const ignoreSelection = () => {};

class MapBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    if (this.state.failed) return <Text style={s.sub}>지도를 표시하지 못했습니다. 아래 길찾기 버튼으로 위치를 확인해 주세요.</Text>;
    return this.props.children;
  }
}

/** Separate from the detail data/refresh flow so map failures stay local. */
export default function LotLocation({ lot }: { lot: ParkingLot }) {
  const destination = useMemo(() => {
    if (lot.lat == null || lot.lng == null || !Number.isFinite(lot.lat) || !Number.isFinite(lot.lng)
      || Math.abs(lot.lat) > 90 || Math.abs(lot.lng) > 180) return null;
    return { id: lot.id, name: lot.name, address: lot.address ?? '', lat: lot.lat, lng: lot.lng };
  }, [lot.address, lot.id, lot.lat, lot.lng, lot.name]);

  if (!destination) return <Text style={s.sub}>좌표 정보가 없어 지도를 표시할 수 없습니다.</Text>;

  return (
    <View accessibilityLabel="주차장 위치 지도">
      <MapBoundary key={`${lot.id}:${lot.lat}:${lot.lng}`}>
        <ResultMap dest={destination} items={NO_ITEMS} selectedId={null} onSelect={ignoreSelection} height={200} destinationLabel="주차장" />
      </MapBoundary>
    </View>
  );
}
