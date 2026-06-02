'use client';

import { useEffect, useRef } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import type { Geofence, Site } from '@/types';

interface EmployeeLocation {
  user_id: string;
  display_name: string;
  latitude: number;
  longitude: number;
  accuracy_m?: number;
  status: string;
  occurred_at?: string;
}

interface LiveMapProps {
  employees: EmployeeLocation[];
  geofences: Geofence[];
  sites: Site[];
  onMarkerClick?: (employee: EmployeeLocation) => void;
}

function createCirclePolygon(lat: number, lng: number, radiusMeters: number, points = 48): [number, number][] {
  const coords: [number, number][] = [];
  for (let i = 0; i <= points; i++) {
    const angle = (i / points) * 2 * Math.PI;
    const dx = radiusMeters * Math.cos(angle);
    const dy = radiusMeters * Math.sin(angle);
    const dLat = dy / 111320;
    const dLng = dx / (111320 * Math.cos(lat * Math.PI / 180));
    coords.push([lng + dLng, lat + dLat]);
  }
  return coords;
}

const ACC_SOURCE_ID = 'accuracy-circles';

function formatLocationAge(occurredAt?: string): string {
  if (!occurredAt) return '';
  const ageMs = Date.now() - new Date(occurredAt).getTime();
  const ageMin = Math.floor(ageMs / 60000);
  if (ageMin < 1) return 'Just now';
  if (ageMin < 60) return `${ageMin}m ago`;
  const ageHr = Math.floor(ageMin / 60);
  return `${ageHr}h ${ageMin % 60}m ago`;
}

export function LiveMap({ employees, geofences, sites, onMarkerClick }: LiveMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<maplibregl.Marker[]>([]);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: 'https://tiles.openfreemap.org/styles/liberty',
      center: [28.0473, -26.2041],
      zoom: 15,
      maxZoom: 19,
      minZoom: 3,
      touchZoomRotate: true,
      touchPitch: true,
      dragRotate: true,
    });

    map.addControl(new maplibregl.NavigationControl({ showCompass: true, showZoom: true }), 'top-right');
    map.addControl(new maplibregl.ScaleControl({ unit: 'metric' }), 'bottom-left');
    mapRef.current = map;

    map.on('load', () => {
      if (!map.getSource(ACC_SOURCE_ID)) {
        map.addSource(ACC_SOURCE_ID, {
          type: 'geojson',
          data: { type: 'FeatureCollection', features: [] },
        });
        map.addLayer({
          id: 'accuracy-circles-fill',
          type: 'fill',
          source: ACC_SOURCE_ID,
          paint: { 'fill-color': '#22c55e', 'fill-opacity': 0.08 },
        });
        map.addLayer({
          id: 'accuracy-circles-outline',
          type: 'line',
          source: ACC_SOURCE_ID,
          paint: { 'line-color': '#22c55e', 'line-opacity': 0.25, 'line-width': 1 },
        });
      }
    });

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    const validEmployees = employees.filter(e => e.latitude !== 0 && e.longitude !== 0);
    const bounds = new maplibregl.LngLatBounds();

    validEmployees.forEach((emp) => {
      const el = document.createElement('div');
      el.className = 'cursor-pointer';
      const statusColor = emp.status === 'clocked_in' ? '#22c55e' : emp.status === 'late' ? '#f59e0b' : '#6b7280';
      el.innerHTML = `
        <div style="
          width: 24px; height: 24px; border-radius: 50%;
          background: ${statusColor};
          border: 3px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3);
          display: flex; align-items: center; justify-content: center;
          font-size: 10px; color: white; font-weight: bold;
        ">${emp.display_name.charAt(0).toUpperCase()}</div>`;

      el.addEventListener('click', () => onMarkerClick?.(emp));

      const marker = new maplibregl.Marker({ element: el })
        .setLngLat([emp.longitude, emp.latitude])
        .addTo(map);

      markersRef.current.push(marker);
      bounds.extend([emp.longitude, emp.latitude]);

      const ageStr = formatLocationAge(emp.occurred_at);
      const popupLines = [
        `<div style="font-weight: 500; font-size: 13px;">${emp.display_name}</div>`,
        `<div style="font-size: 11px; color: #666;">${emp.status.replace('_', ' ')}</div>`,
      ];
      if (ageStr) {
        popupLines.push(`<div style="font-size: 11px; color: #999;">Location: ${ageStr}</div>`);
      }
      if (emp.accuracy_m && emp.accuracy_m > 0) {
        popupLines.push(`<div style="font-size: 11px; color: #999;">Accuracy: ±${emp.accuracy_m.toFixed(0)}m</div>`);
      }
      const popup = new maplibregl.Popup({ offset: 25 }).setHTML(popupLines.join(''));
      marker.setPopup(popup);
    });

    const circles = validEmployees
      .filter(e => e.accuracy_m && e.accuracy_m > 0)
      .map(e => ({
        type: 'Feature' as const,
        properties: {},
        geometry: {
          type: 'Polygon' as const,
          coordinates: [createCirclePolygon(e.latitude, e.longitude, e.accuracy_m!)],
        },
      }));
    try {
      const source = map.getSource(ACC_SOURCE_ID) as maplibregl.GeoJSONSource | undefined;
      if (source) {
        source.setData({ type: 'FeatureCollection', features: circles });
      }
    } catch { /* source not ready yet */ }

    geofences.forEach((gf) => {
      if (gf.type === 'circle' && gf.latitude && gf.longitude && gf.radius_m) {
        const border = gf.active ? '#3b82f6' : '#9ca3af';
        new maplibregl.Marker({ color: border })
          .setLngLat([gf.longitude, gf.latitude])
          .addTo(map);
        bounds.extend([gf.longitude, gf.latitude]);
      }
    });

    sites.forEach((site) => {
      const el = document.createElement('div');
      el.innerHTML = `<div style="
        width: 16px; height: 16px; border-radius: 2px;
        background: #f59e0b; border: 2px solid white;
        box-shadow: 0 1px 3px rgba(0,0,0,0.3);
      "></div>`;
      new maplibregl.Marker({ element: el })
        .setLngLat([site.longitude, site.latitude])
        .setPopup(new maplibregl.Popup().setHTML(`<strong>${site.name}</strong>`))
        .addTo(map);
      bounds.extend([site.longitude, site.latitude]);
    });

    if (!bounds.isEmpty()) {
      map.fitBounds(bounds, { padding: 50, maxZoom: 17 });
    }
  }, [employees, geofences, sites, onMarkerClick]);

  return <div ref={containerRef} className="w-full h-full min-h-[400px]" />;
}
