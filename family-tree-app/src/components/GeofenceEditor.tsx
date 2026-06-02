'use client';

import { useEffect, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Circle, Hexagon, MousePointerClick } from 'lucide-react';

interface GeofenceEditorProps {
  initialType?: 'circle' | 'polygon';
  initialLatitude?: number;
  initialLongitude?: number;
  initialRadius?: number;
  initialPolygon?: [number, number][];
  onChange?: (data: {
    type: 'circle' | 'polygon';
    latitude?: number;
    longitude?: number;
    radius_m?: number;
    polygon_coordinates?: [number, number][];
  }) => void;
}

export function GeofenceEditor({
  initialType = 'circle',
  initialLatitude = -26.2041,
  initialLongitude = 28.0473,
  initialRadius = 500,
  initialPolygon,
  onChange,
}: GeofenceEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const [type, setType] = useState<'circle' | 'polygon'>(initialType);
  const [lat, setLat] = useState(initialLatitude);
  const [lng, setLng] = useState(initialLongitude);
  const [radius, setRadius] = useState(initialRadius);
  const [polygonPts, setPolygonPts] = useState<[number, number][]>(initialPolygon || []);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: 'https://tiles.openfreemap.org/styles/liberty',
      center: [initialLongitude, initialLatitude],
      zoom: 14,
    });
    map.addControl(new maplibregl.NavigationControl(), 'top-right');
    mapRef.current = map;

    map.on('click', (e) => {
      if (type === 'polygon') {
        setPolygonPts((prev) => {
          const next: [number, number][] = [...prev, [e.lngLat.lng, e.lngLat.lat]];
          onChange?.({
            type: 'polygon',
            polygon_coordinates: next,
          });
          return next;
        });
      } else {
        setLat(e.lngLat.lat);
        setLng(e.lngLat.lng);
        onChange?.({ type: 'circle', latitude: e.lngLat.lat, longitude: e.lngLat.lng, radius_m: radius });
      }
    });

    return () => { map.remove(); mapRef.current = null; };
  }, []);

  useEffect(() => {
    onChange?.({
      type,
      latitude: type === 'circle' ? lat : undefined,
      longitude: type === 'circle' ? lng : undefined,
      radius_m: type === 'circle' ? radius : undefined,
      polygon_coordinates: type === 'polygon' ? polygonPts : undefined,
    });
  }, [type, lat, lng, radius, polygonPts]);

  const clearPolygon = () => {
    setPolygonPts([]);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Select value={type} onValueChange={(v) => setType(v as 'circle' | 'polygon')}>
          <SelectTrigger className="w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="circle">
              <span className="flex items-center gap-2"><Circle className="h-3 w-3" /> Circle</span>
            </SelectItem>
            <SelectItem value="polygon">
              <span className="flex items-center gap-2"><Hexagon className="h-3 w-3" /> Polygon</span>
            </SelectItem>
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground flex items-center gap-1">
          <MousePointerClick className="h-3 w-3" /> Click map to set points
        </p>
      </div>

      <div ref={containerRef} className="w-full h-[300px] rounded-lg border overflow-hidden" />

      {type === 'circle' && (
        <div className="grid grid-cols-3 gap-4">
          <div className="space-y-1">
            <Label className="text-xs">Latitude</Label>
            <Input type="number" step="any" value={lat} onChange={(e) => setLat(parseFloat(e.target.value) || 0)} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Longitude</Label>
            <Input type="number" step="any" value={lng} onChange={(e) => setLng(parseFloat(e.target.value) || 0)} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Radius (m)</Label>
            <Input type="number" value={radius} onChange={(e) => setRadius(parseInt(e.target.value) || 0)} />
          </div>
        </div>
      )}

      {type === 'polygon' && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">{polygonPts.length} points</span>
            {polygonPts.length > 0 && (
              <Button variant="ghost" size="sm" onClick={clearPolygon}>Clear</Button>
            )}
          </div>
          <div className="text-xs text-muted-foreground space-y-1 max-h-24 overflow-auto">
            {polygonPts.map((pt, i) => (
              <div key={i}>
                {i + 1}. {pt[1].toFixed(4)}, {pt[0].toFixed(4)}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
