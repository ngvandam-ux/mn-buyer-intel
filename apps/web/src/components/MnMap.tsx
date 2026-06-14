import type { EntityListItem } from '@mn/core';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { useEffect, useRef } from 'react';
import { entityTypeLabel } from './ui.tsx';

/**
 * Minnesota buyer map. Plots entities that have coordinates. Geocoding entities to
 * county/city centroids is a roadmap item, so today most entities have no coords and the
 * map shows the state with an explanatory overlay — the Explorer table is the workhorse.
 */
export function MnMap({ entities }: { entities: EntityListItem[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const withCoords = entities.filter((e) => e.lat != null && e.lng != null);

  useEffect(() => {
    if (!ref.current || mapRef.current) return;
    const map = new maplibregl.Map({
      container: ref.current,
      style: 'https://demotiles.maplibre.org/style.json',
      center: [-94.3, 46.3],
      zoom: 4.6,
      attributionControl: { compact: true },
    });
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const markers: maplibregl.Marker[] = [];
    for (const e of withCoords) {
      const popup = new maplibregl.Popup({ offset: 16 }).setHTML(
        `<strong>${e.name}</strong><br/><span style="color:#64748b">${entityTypeLabel(e.entityType)}</span>`,
      );
      const m = new maplibregl.Marker({ color: '#1e4e8c' }).setLngLat([e.lng!, e.lat!]).setPopup(popup).addTo(map);
      markers.push(m);
    }
    return () => {
      for (const m of markers) m.remove();
    };
  }, [withCoords]);

  return (
    <div style={{ position: 'relative' }}>
      <div className="map" ref={ref} />
      {withCoords.length === 0 && (
        <div
          style={{
            position: 'absolute', left: 12, bottom: 12, right: 12,
            background: 'rgba(255,255,255,0.94)', border: '1px solid var(--line)',
            borderRadius: 8, padding: '8px 12px', fontSize: 12.5, color: 'var(--muted)',
          }}
        >
          {entities.length} buyers loaded. None are geocoded yet — geocoding entities to county/city
          centroids is on the roadmap. Use the Explorer below to drill into any buyer.
        </div>
      )}
    </div>
  );
}
