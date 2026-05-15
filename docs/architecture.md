# Architecture Overview

## System Architecture

FaceAttend is a multi-tenant facial recognition attendance system built on Next.js + Supabase.

```
┌─────────────────────────────────────────────────┐
│                   Browser (PWA)                  │
│  ┌──────────┐ ┌──────────┐ ┌──────────────────┐ │
│  │  Employee │ │  Admin   │ │  Super Admin     │ │
│  │  App     │ │  Panel   │ │  Panel           │ │
│  └────┬─────┘ └────┬─────┘ └────────┬─────────┘ │
│       │            │                │            │
│       └────────────┴────────────────┘            │
│                      │                           │
│        Camera · Location · Face Detection        │
└──────────────────────┬──────────────────────────┘
                       │ HTTPS
┌──────────────────────▼──────────────────────────┐
│              Vercel (Next.js)                    │
│  ┌──────────────────────────────────────────┐   │
│  │  Pages · API Routes · Server Actions     │   │
│  │  Middleware (Auth) · PWA Service Worker   │   │
│  └──────────────────────┬───────────────────┘   │
└─────────────────────────┬────────────────────────┘
                          │
┌─────────────────────────▼────────────────────────┐
│                 Supabase                          │
│  ┌──────────┐ ┌──────────┐ ┌──────────────────┐  │
│  │   Auth   │ │ Postgres │ │   Edge Functions  │  │
│  │          │ │ + PostGIS│ │   (Deno)          │  │
│  │          │ │ + pgvec  │ │                    │  │
│  └──────────┘ └────┬─────┘ └────────┬───────────┘  │
│  ┌──────────┐ ┌────┴─────┐ ┌───────┴───────────┐  │
│  │ Storage  │ │ Realtime │ │      Cron          │  │
│  └──────────┘ └──────────┘ └───────────────────┘  │
└───────────────────────────────────────────────────┘
```

## Key Design Decisions

### Server Authority
The browser is never trusted as the final authority. All sensitive decisions (face verification, liveness, geofence validation, duplicate clock prevention, risk scoring) are made server-side in Supabase Edge Functions.

### Append-Only Ledger
Clock events are append-only. History is never mutated directly; corrections create adjustment events with full audit trails.

### Layered Anti-Spoofing
Geolocation spoofing is detected through multiple layers: accuracy analysis, impossible travel detection, coordinate analysis, device fingerprint consistency, and optional WebAuthn/passkey verification.

### Privacy-First
- Location tracked at clock events by default (not continuously)
- Live tracking requires explicit policy configuration
- Biometric media stored in private buckets with retention limits
- Face embeddings never exposed to browser after enrollment

## Data Flow: Clock Event

1. Employee taps Clock In/Out
2. Browser captures face frame + gets high-accuracy location
3. Client performs preliminary checks (quick feedback)
4. Client sends event to Supabase Edge Function
5. Edge Function validates: auth, role, device, geofence (PostGIS), face scores, liveness, risk
6. Edge Function writes append-only clock_event, updates attendance_session
7. Edge Function returns decision: accepted / rejected / review_required
8. Client displays result

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 14 App Router, React 18, TypeScript |
| Styling | Tailwind CSS, shadcn/ui |
| State | React hooks, Supabase Realtime |
| Maps | MapLibre GL JS, Turf.js, OSM tiles |
| Face Detection | MediaPipe Tasks Vision (browser) |
| Face Embeddings | ONNX Runtime Web (browser) |
| Database | Supabase Postgres + PostGIS + pgvector |
| Auth | Supabase Auth |
| Storage | Supabase Storage (private buckets) |
| Edge Functions | Supabase Edge Functions (Deno) |
| Cron | Supabase Cron (pg_cron) |
| Hosting | Vercel (frontend) + Supabase (backend) |
