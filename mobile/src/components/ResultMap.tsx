// UI-03 지도 (iOS/Android): react-native-maps. 웹은 ResultMap.web.tsx를 사용한다.
import MapView, { Marker } from 'react-native-maps';
import type { MapProps } from './map-props';

export default function ResultMap({ dest, items, onSelect, height = 360, destinationLabel }: MapProps) {
  return (
    <MapView
      style={{ height, borderRadius: 20 }}
      initialRegion={{ latitude: dest.lat, longitude: dest.lng, latitudeDelta: items.length ? 0.04 : 0.006, longitudeDelta: items.length ? 0.04 : 0.006 }}
    >
      <Marker coordinate={{ latitude: dest.lat, longitude: dest.lng }} title={destinationLabel ?? `목적지: ${dest.name}`} pinColor="navy" />
      {items.map((c) =>
        c.lot.lat == null || c.lot.lng == null ? null : (
          <Marker
            key={c.lot.id}
            coordinate={{ latitude: c.lot.lat, longitude: c.lot.lng }}
            title={c.lot.name}
            pinColor="#3B7BE8"
            onPress={() => onSelect(c.lot.id)}
          />
        ),
      )}
    </MapView>
  );
}
