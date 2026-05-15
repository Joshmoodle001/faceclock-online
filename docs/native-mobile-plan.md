# Native Mobile Hardening Plan

## Overview
FaceAttend is designed as a PWA-first application with future native mobile support via Capacitor. This document outlines the hooks and architecture for native hardening.

## Current State
- PWA works on Android (Chrome), iOS (Safari), and desktop browsers
- Camera and geolocation work via Web APIs
- Device attestation at `web` level
- Face detection via MediaPipe in browser

## Native Integration Path

### Phase 1: Capacitor Wrapper
- Wrap the Next.js PWA in a Capacitor shell
- Benefits: native app store distribution, full-screen experience, push notifications
- No code changes needed; the PWA works as-is inside Capacitor WebView

### Phase 2: Native Camera Performance
- Replace browser `getUserMedia` with Capacitor Camera plugin for higher resolution
- Reduce face capture latency
- Better low-light performance
- File: `src/lib/capacitor/camera.ts`

### Phase 3: Google Play Integrity (Android)
- Use `@capacitor/device` and custom native plugin for Play Integrity API
- Server-side verification of device integrity (not just client report)
- Attestation level: `play_integrity`
- Rooted device detection
- File: `src/lib/native/android-integrity.ts`
- Edge Function: `verify-device-attestation` (placeholder exists)

### Phase 4: Apple App Attest (iOS)
- Use `@capacitor/device` and custom native plugin for App Attest
- Server-side verification of attestation object
- Attestation level: `app_attest`
- File: `src/lib/native/ios-attestation.ts`
- Edge Function: `verify-device-attestation` (placeholder exists)

### Phase 5: Native Biometric Authentication
- Use platform biometric APIs (Face ID / Fingerprint) as additional factor
- Combined with face verification for defense in depth
- File: `src/lib/native/biometrics.ts`

### Phase 6: Offline Support Enhancement
- Background sync for queued clock events
- Local storage of pending events when offline
- Auto-submit when connectivity restored

## Architecture Hooks (Already in Place)

### Device Attestation
```typescript
// src/types/index.ts
export type AttestationLevel = 'web' | 'passkey_verified' | 'play_integrity' | 'app_attest';

// src/lib/device.ts
// attestation_level stored with each device record
```

### Edge Function
```typescript
// supabase/functions/verify-device-attestation/index.ts
// Placeholder for Play Integrity and App Attest verification
```

### Device Risk Scoring
```typescript
// src/lib/device.ts tracks attestation level
// Native devices get lower risk scores
```

## Required Capacitor Packages
```json
{
  "@capacitor/core": "^6.0.0",
  "@capacitor/cli": "^6.0.0",
  "@capacitor/android": "^6.0.0",
  "@capacitor/ios": "^6.0.0",
  "@capacitor/camera": "^6.0.0",
  "@capacitor/geolocation": "^6.0.0",
  "@capacitor/device": "^6.0.0"
}
```

## Implementation Priority
1. Phase 1 (Capacitor shell) — low effort, high value
2. Phase 3 + 4 (attestation) — most security impact
3. Phase 2 (native camera) — UX improvement
4. Phase 5 (native biometrics) — defense in depth
5. Phase 6 (offline) — reliability
