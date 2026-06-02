'use client';

import { useEffect, useRef, useState } from 'react';
import { Camera, Loader2, AlertCircle, Smartphone } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface CameraCaptureProps {
  onFrame: (canvas: HTMLCanvasElement) => void;
  width?: number;
  height?: number;
  facingMode?: 'user' | 'environment';
  mirrored?: boolean;
}

export function CameraCapture({
  onFrame,
  width = 640,
  height = 480,
  facingMode = 'user',
  mirrored = true,
}: CameraCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error' | 'denied' | 'unavailable'>('loading');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    initCamera();
    return () => stopCamera();
  }, []);

  const initCamera = async () => {
    setStatus('loading');
    if (!navigator.mediaDevices?.getUserMedia) {
      setStatus('unavailable');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode, width: { ideal: width }, height: { ideal: height } },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setStatus('ready');
    } catch (err) {
      if (err instanceof DOMException && err.name === 'NotAllowedError') {
        setStatus('denied');
      } else if (err instanceof DOMException && err.name === 'NotFoundError') {
        setStatus('unavailable');
      } else {
        setStatus('error');
        setErrorMsg(err instanceof Error ? err.message : 'Camera error');
      }
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  };

  const capture = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    if (mirrored) {
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(video, 0, 0);
    onFrame(canvas);
  };

  if (status === 'loading') {
    return (
      <div className="aspect-[4/3] bg-muted rounded-lg flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (status === 'denied') {
    return (
      <div className="aspect-[4/3] bg-muted rounded-lg flex flex-col items-center justify-center gap-3 p-6 text-center">
        <Camera className="h-8 w-8 text-destructive" />
        <p className="text-sm font-medium">Camera access denied</p>
        <p className="text-xs text-muted-foreground">Please enable camera access in your browser settings.</p>
        <Button size="sm" onClick={initCamera}>Retry</Button>
      </div>
    );
  }

  if (status === 'unavailable') {
    return (
      <div className="aspect-[4/3] bg-muted rounded-lg flex flex-col items-center justify-center gap-3 p-6 text-center">
        <Smartphone className="h-8 w-8 text-muted-foreground" />
        <p className="text-sm font-medium">Camera not available</p>
        <p className="text-xs text-muted-foreground">No camera found on this device.</p>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="aspect-[4/3] bg-muted rounded-lg flex flex-col items-center justify-center gap-3 p-6 text-center">
        <AlertCircle className="h-8 w-8 text-destructive" />
        <p className="text-sm font-medium">Camera error</p>
        <p className="text-xs text-muted-foreground">{errorMsg}</p>
        <Button size="sm" onClick={initCamera}>Retry</Button>
      </div>
    );
  }

  return (
    <div className="relative aspect-[4/3] bg-muted rounded-lg overflow-hidden">
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className={`w-full h-full object-cover ${mirrored ? 'scale-x-[-1]' : ''}`}
      />
      <canvas ref={canvasRef} className="hidden" />
      <Button
        size="sm"
        variant="secondary"
        className="absolute bottom-3 right-3"
        onClick={capture}
      >
        <Camera className="h-4 w-4 mr-1" /> Capture
      </Button>
    </div>
  );
}
