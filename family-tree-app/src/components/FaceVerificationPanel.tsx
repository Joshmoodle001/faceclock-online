'use client';

import { useEffect, useRef, useState } from 'react';
import { Camera, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface FaceVerificationPanelProps {
  matchScore?: number;
  livenessScore?: number;
  autoCapture?: boolean;
  onCapture?: (canvas: HTMLCanvasElement) => void;
}

export function FaceVerificationPanel({
  matchScore,
  livenessScore,
  autoCapture = false,
  onCapture,
}: FaceVerificationPanelProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [faceDetected, setFaceDetected] = useState(false);
  const [lighting, setLighting] = useState<'good' | 'fair' | 'poor'>('good');
  const [blur, setBlur] = useState<'good' | 'fair' | 'poor'>('good');

  useEffect(() => {
    startCamera();
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
    };
  }, []);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setStatus('ready');
      simulateQualityChecks();
    } catch {
      setStatus('error');
    }
  };

  const simulateQualityChecks = () => {
    setFaceDetected(true);
    setLighting('good');
    setBlur('good');
  };

  const qualityColor = (val: string) => {
    switch (val) {
      case 'good': return 'text-emerald-500';
      case 'fair': return 'text-amber-500';
      case 'poor': return 'text-destructive';
      default: return 'text-muted-foreground';
    }
  };

  return (
    <div className="space-y-3">
      <div className="relative aspect-[4/3] bg-muted rounded-lg overflow-hidden">
        {status === 'loading' && (
          <div className="absolute inset-0 flex items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        )}
        {status === 'error' && (
          <div className="absolute inset-0 flex items-center justify-center flex-col gap-2">
            <Camera className="h-8 w-8 text-destructive" />
            <p className="text-sm text-muted-foreground">Camera unavailable</p>
          </div>
        )}
        <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover scale-x-[-1]" />
        {status === 'ready' && faceDetected && (
          <div className="absolute inset-0 border-2 border-emerald-500/50 rounded-lg pointer-events-none" />
        )}
      </div>

      <div className="grid grid-cols-3 gap-2">
        <div className="flex items-center gap-1 text-xs">
          <span className="text-muted-foreground">Face:</span>
          {faceDetected ? <CheckCircle2 className="h-3 w-3 text-emerald-500" /> : <AlertCircle className="h-3 w-3 text-muted-foreground" />}
        </div>
        <div className="flex items-center gap-1 text-xs">
          <span className="text-muted-foreground">Lighting:</span>
          <span className={qualityColor(lighting)}>{lighting}</span>
        </div>
        <div className="flex items-center gap-1 text-xs">
          <span className="text-muted-foreground">Blur:</span>
          <span className={qualityColor(blur)}>{blur}</span>
        </div>
      </div>

      {(matchScore !== undefined || livenessScore !== undefined) && (
        <div className="flex gap-2">
          {matchScore !== undefined && (
            <Badge variant={matchScore >= 0.7 ? 'success' : 'warning'}>
              Match: {Math.round(matchScore * 100)}%
            </Badge>
          )}
          {livenessScore !== undefined && (
            <Badge variant={livenessScore >= 0.7 ? 'success' : 'warning'}>
              Liveness: {Math.round(livenessScore * 100)}%
            </Badge>
          )}
        </div>
      )}
    </div>
  );
}
