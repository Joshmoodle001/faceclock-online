'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, MapPin, Crosshair, Circle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PlaceResult {
  display_name: string;
  lat: string;
  lon: string;
}

interface LocationMapPickerProps {
  latitude: number;
  longitude: number;
  radius?: number;
  showRadius?: boolean;
  onLocationChange: (lat: number, lng: number) => void;
  onRadiusChange?: (radius: number) => void;
  height?: string;
}

export function LocationMapPicker({
  latitude,
  longitude,
  radius = 100,
  showRadius = false,
  onLocationChange,
  onRadiusChange,
  height = '400px',
}: LocationMapPickerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markerRef = useRef<maplibregl.Marker | null>(null);
  const circleRef = useRef<{ remove: () => void } | null>(null);
  const radiusRef = useRef(radius);
  radiusRef.current = radius;
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<PlaceResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);

  const drawCircle = useCallback((map: maplibregl.Map, lat: number, lng: number, r: number) => {
    if (circleRef.current) {
      circleRef.current.remove();
      circleRef.current = null;
    }
    const metersPerDegree = 111320;
    const radiusDeg = r / metersPerDegree;
    const steps = 64;
    const coords: [number, number][] = [];
    for (let i = 0; i <= steps; i++) {
      const angle = (i / steps) * 2 * Math.PI;
      const dx = radiusDeg * Math.cos(angle) / Math.cos((lat * Math.PI) / 180);
      const dy = radiusDeg * Math.sin(angle);
      coords.push([lng + dx, lat + dy]);
    }
    coords.push(coords[0]);

    if (map.getSource('geofence-circle')) {
      (map.getSource('geofence-circle') as maplibregl.GeoJSONSource).setData({
        type: 'Feature',
        properties: {},
        geometry: { type: 'Polygon', coordinates: [coords] },
      });
    } else {
      map.addSource('geofence-circle', {
        type: 'geojson',
        data: { type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [coords] } },
      });
      map.addLayer({
        id: 'geofence-circle-fill',
        type: 'fill',
        source: 'geofence-circle',
        paint: { 'fill-color': '#3b82f6', 'fill-opacity': 0.15 },
      });
      map.addLayer({
        id: 'geofence-circle-outline',
        type: 'line',
        source: 'geofence-circle',
        paint: { 'line-color': '#3b82f6', 'line-width': 2, 'line-dasharray': [2, 2] },
      });
    }
  }, []);

  const removeCircle = useCallback(() => {
    if (mapRef.current) {
      try {
        if (mapRef.current.getLayer('geofence-circle-fill')) mapRef.current.removeLayer('geofence-circle-fill');
        if (mapRef.current.getLayer('geofence-circle-outline')) mapRef.current.removeLayer('geofence-circle-outline');
        if (mapRef.current.getSource('geofence-circle')) mapRef.current.removeSource('geofence-circle');
      } catch {}
    }
    circleRef.current = null;
  }, []);

  const updatePosition = useCallback((lat: number, lng: number) => {
    onLocationChange(lat, lng);
    if (markerRef.current) {
      markerRef.current.setLngLat([lng, lat]);
    }
    if (showRadius && mapRef.current) {
      drawCircle(mapRef.current, lat, lng, radius);
    }
    if (mapRef.current) {
      mapRef.current.flyTo({ center: [lng, lat], zoom: 15, duration: 800 });
    }
  }, [onLocationChange, showRadius, radius, drawCircle]);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: 'https://demotiles.maplibre.org/style.json',
      center: [longitude || 28.0473, latitude || -26.2041],
      zoom: 13,
    });
    map.addControl(new maplibregl.NavigationControl(), 'top-right');

    const marker = new maplibregl.Marker({ draggable: true, color: '#ef4444' })
      .setLngLat([longitude || 28.0473, latitude || -26.2041])
      .addTo(map);

    marker.on('dragend', () => {
      const lngLat = marker.getLngLat();
      onLocationChange(lngLat.lat, lngLat.lng);
      if (showRadius) {
        drawCircle(map, lngLat.lat, lngLat.lng, radiusRef.current);
      }
    });

    map.on('click', (e) => {
      marker.setLngLat(e.lngLat);
      onLocationChange(e.lngLat.lat, e.lngLat.lng);
      if (showRadius) {
        drawCircle(map, e.lngLat.lat, e.lngLat.lng, radiusRef.current);
      }
    });

    map.on('load', () => {
      if (showRadius && latitude && longitude) {
        drawCircle(map, latitude, longitude, radius);
      }
    });

    mapRef.current = map;
    markerRef.current = marker;

    return () => {
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (showRadius && mapRef.current && latitude && longitude) {
      drawCircle(mapRef.current, latitude, longitude, radius);
    }
    if (!showRadius && mapRef.current) {
      removeCircle();
    }
  }, [radius, showRadius]);

  const doSearch = useCallback(async (q: string) => {
    if (!q || q.length < 3) { setSearchResults([]); return; }
    setSearching(true);
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}&limit=5&countrycodes=za`,
        { headers: { 'Accept-Language': 'en' } }
      );
      const data = await res.json();
      setSearchResults(data.map((d: PlaceResult) => ({ display_name: d.display_name, lat: d.lat, lon: d.lon })));
      setShowResults(true);
    } catch { setSearchResults([]); }
    setSearching(false);
  }, []);

  const selectPlace = (place: PlaceResult) => {
    const lat = parseFloat(place.lat);
    const lng = parseFloat(place.lon);
    updatePosition(lat, lng);
    setSearchQuery(place.display_name);
    setShowResults(false);
  };

  return (
    <div className="space-y-3">
      <div className="relative">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search for a place or address..."
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); doSearch(e.target.value); }}
              onFocus={() => searchResults.length > 0 && setShowResults(true)}
              className="pl-9"
            />
          </div>
          <Button
            variant="outline"
            size="icon"
            onClick={() => {
              if ('geolocation' in navigator) {
                navigator.geolocation.getCurrentPosition((pos) => {
                  updatePosition(pos.coords.latitude, pos.coords.longitude);
                });
              }
            }}
            title="Use my location"
          >
            <Crosshair className="h-4 w-4" />
          </Button>
        </div>
        {showResults && searchResults.length > 0 && (
          <div className="absolute z-50 top-full mt-1 w-full bg-popover border rounded-lg shadow-lg max-h-60 overflow-auto">
            {searchResults.map((place, i) => (
              <button
                key={i}
                className="w-full text-left px-3 py-2 text-sm hover:bg-accent flex items-start gap-2 border-b last:border-0"
                onClick={() => selectPlace(place)}
              >
                <MapPin className="h-4 w-4 mt-0.5 shrink-0 text-muted-foreground" />
                <span className="line-clamp-2">{place.display_name}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      <div ref={containerRef} className="w-full rounded-lg border overflow-hidden" style={{ height }} />

      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <MapPin className="h-3 w-3" />
        <span>
          {latitude.toFixed(6)}, {longitude.toFixed(6)}
          {showRadius && radius ? ` \u00B7 ${radius}m radius` : ''}
        </span>
      </div>
    </div>
  );
}
