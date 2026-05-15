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
}

interface LiveMapProps {
  employees: EmployeeLocation[];
  geofences: Geofence[];
  sites: Site[];
  onMarkerClick?: (employee: EmployeeLocation) => void;
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
      zoom: 10,
    });

    map.addControl(new maplibregl.NavigationControl(), 'top-right');
    mapRef.current = map;

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

    const bounds = new maplibregl.LngLatBounds();

    employees.forEach((emp) => {
      const el = document.createElement('div');
      el.className = 'cursor-pointer';
      el.innerHTML = `
        <div style="
          width: 24px; height: 24px; border-radius: 50%;
          background: ${emp.status === 'clocked_in' ? '#22c55e' : '#6b7280'};
          border: 3px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3);
          display: flex; align-items: center; justify-content: center;
          font-size: 10px; color: white; font-weight: bold;
        ">${emp.display_name.charAt(0).toUpperCase()}</div>`;

      el.addEventListener('click', () => onMarkerClick?.(emp));

      const marker = new maplibregl.Marker({ element: el })
        .setLngLat([emp.longitude, emp.latitude])
        .addTo(map);

      if (emp.accuracy_m && emp.accuracy_m > 0) {
        const accEl = document.createElement('div');
        accEl.style.cssText = `
          position: absolute; top: 50%; left: 50%; translate: -50% -50%;
          width: ${emp.accuracy_m * 2}px; height: ${emp.accuracy_m * 2}px;
          border-radius: 50%; background: rgba(34, 197, 94, 0.1);
          border: 1px solid rgba(34, 197, 94, 0.3); pointer-events: none;
        `;
        el.appendChild(accEl);
      }

      markersRef.current.push(marker);
      bounds.extend([emp.longitude, emp.latitude]);

      const popup = new maplibregl.Popup({ offset: 25 })
        .setHTML(`<div style="font-weight: 500; font-size: 13px;">${emp.display_name}</div>
          <div style="font-size: 11px; color: #666;">${emp.status.replace('_', ' ')}</div>`);
      marker.setPopup(popup);
    });

    geofences.forEach((gf) => {
      if (gf.type === 'circle' && gf.latitude && gf.longitude && gf.radius_m) {
        const color = gf.active ? 'rgba(59, 130, 246, 0.2)' : 'rgba(156, 163, 175, 0.2)';
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
      map.fitBounds(bounds, { padding: 50, maxZoom: 15 });
    }
  }, [employees, geofences, sites]);

  return <div ref={containerRef} className="w-full h-full min-h-[400px]" />;
}
