# FaceAttend — Facial Recognition Attendance System

Multi-tenant workforce time and attendance platform with facial verification, geofencing, liveness detection, and integrated payroll.

## Architecture

| Layer | Technology |
|-------|-----------|
| **Frontend** | Next.js 14 App Router, React 18, TypeScript |
| **Styling** | Tailwind CSS, shadcn/ui |
| **Mapping** | MapLibre GL JS + OSM free tiles |
| **Face Detection** | MediaPipe Tasks Vision (browser) |
| **Face Embeddings** | ONNX Runtime Web (browser — model files not included) |
| **Database** | Supabase Postgres + PostGIS + pgvector |
| **Auth** | Supabase Auth |
| **Storage** | Supabase Storage (private buckets) |
| **Backend Logic** | Supabase Edge Functions (Deno) |
| **Scheduled Jobs** | Supabase Cron (pg_cron) |
| **Hosting** | Vercel (frontend) + Supabase (backend) |

## Features

- **Facial Verification**: 1:1 face match against enrolled employee
- **Passive Liveness Detection**: Anti-spoofing via liveness scoring
- **Challenge Liveness**: Blink, head-turn, smile (optional)
- **Geofence Validation**: Circle and polygon geofences with PostGIS
- **Location Anti-Spoofing**: Multi-layer risk scoring (accuracy, impossible travel, stale data, coordinate analysis)
- **Device Trust**: Fingerprinting, WebAuthn/passkey support, attestation levels
- **Append-Only Clock Events**: Immutable attendance ledger
- **Role-Based Access**: Employee, Manager, Org Admin, Finance Admin, Super Admin
- **Live Admin Map**: Real-time employee locations with MapLibre GL
- **Payroll Board**: Calculate, approve, and export payroll from approved attendance
- **Audit Logs**: Every sensitive action tracked
- **PWA**: Installable on mobile and desktop
- **Dark Mode**: System-preference-aware theme
- **Mobile-First**: Responsive design for all devices

## Project Structure

```
├── docs/                          # Architecture, security, testing docs
├── public/                        # PWA manifest, service worker, icons
├── src/
│   ├── app/
│   │   ├── (public)/              # Landing, login, privacy, terms
│   │   ├── app/                   # Employee app (clock, enroll, history, pay)
│   │   └── admin/                 # Admin panel (dashboard, sites, employees, etc.)
│   ├── components/
│   │   ├── ui/                    # shadcn/ui base components (22 files)
│   │   └── *.tsx                  # Shared components (21 files)
│   ├── hooks/                     # useUser, useClock, useLocation, useFace, useDebounce
│   ├── lib/
│   │   ├── face/                  # Face detection, embedding, liveness abstraction layer
│   │   ├── location/              # Geofence checks, risk scoring
│   │   ├── payroll/               # Calculator, CSV export
│   │   ├── supabase/              # Client, server, admin, middleware helpers
│   │   ├── audit.ts               # Audit logging
│   │   ├── device.ts              # Device fingerprinting, WebAuthn
│   │   ├── risk-scoring.ts        # Combined risk scoring engine
│   │   └── utils.ts               # cn(), formatCurrency(), etc.
│   ├── middleware.ts               # Auth + role-based route protection
│   └── types/                     # TypeScript type definitions
├── supabase/
│   ├── migrations/                # SQL migrations (7 files)
│   │   ├── 00001_extensions.sql   # PostGIS, pgvector, pgcrypto
│   │   ├── 00002_schema.sql       # 18 tables with constraints
│   │   ├── 00003_indexes.sql      # B-tree, GIST, IVFFlat indexes
│   │   ├── 00004_rls.sql          # Row-level security policies
│   │   ├── 00005_storage.sql      # Private storage buckets
│   │   ├── 00006_functions.sql    # Database functions + triggers
│   │   └── 00007_seed.sql         # Demo seed data
│   ├── functions/                 # Edge Functions (6 functions)
│   │   ├── submit-clock-event/    # Server-side clock validation
│   │   ├── calculate-payroll/     # Payroll calculation engine
│   │   ├── export-payroll/        # CSV export to storage
│   │   ├── cleanup-sensitive-media/ # Biometric media retention
│   │   ├── stale-session-check/   # Auto-close stale sessions
│   │   └── verify-device-attestation/ # App attestation placeholder
│   └── cron/                      # pg_cron job definitions
├── .env.example
├── package.json
├── next.config.ts
├── tailwind.config.ts
└── tsconfig.json
```

## Prerequisites

- Node.js 18+
- npm or pnpm
- Supabase CLI (`npm install -g supabase`)
- A Supabase project (free tier works for development)
- A Vercel account (free Hobby tier works for development)

## Local Development Setup

### 1. Clone and install

```bash
git clone <repo-url> face-attend
cd face-attend
npm install
```

### 2. Set up Supabase

```bash
# Start local Supabase
supabase start

# Or link to existing project
supabase link --project-ref <your-project-ref>

# Run migrations
supabase db push

# Seed data (replace placeholder UUIDs in seed file first)
supabase db execute --file supabase/migrations/00007_seed.sql
```

### 3. Configure environment

Copy `.env.example` to `.env.local` and fill in your Supabase project values:

```bash
cp .env.example .env.local
# Edit .env.local with your Supabase URL, anon key, and service role key
```

### 4. Start development

```bash
npm run dev
```

Visit `http://localhost:3000`

### 5. Deploy Edge Functions

```bash
supabase functions deploy submit-clock-event
supabase functions deploy calculate-payroll
supabase functions deploy export-payroll
supabase functions deploy cleanup-sensitive-media
supabase functions deploy stale-session-check
supabase functions deploy verify-device-attestation
```

### 6. Set up Cron Jobs

Run the SQL in `supabase/cron/setup.sql` via Supabase SQL Editor or `supabase db execute`.

## Deployment

### Vercel (Frontend)

```bash
# Install Vercel CLI
npm install -g vercel

# Deploy
vercel --prod
```

Set environment variables in Vercel dashboard:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (keep secret, server-side only)

### Supabase (Backend)

Migrations, functions, and cron are deployed via Supabase CLI:

```bash
supabase link --project-ref <your-project-ref>
supabase db push
supabase functions deploy <function-name>
```

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Supabase anonymous key (public) |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Supabase service role key (server-only) |
| `NEXT_PUBLIC_APP_URL` | No | App URL for callbacks |
| `BIOMETRIC_MEDIA_RETENTION_DAYS` | No | Days to retain biometric media (default: 7) |
| `RISK_HIGH_THRESHOLD` | No | Risk score to reject (default: 80) |
| `RISK_REVIEW_THRESHOLD` | No | Risk score to flag for review (default: 60) |

## Face Recognition Model Setup

FaceAttend uses a model abstraction layer that supports hot-swappable ONNX models. Currently:

1. **MediaPipe Tasks Vision** — Face detection and landmarks (loaded from CDN)
2. **ONNX Runtime Web** — Face embedding extraction and liveness (model files must be added)

To add face recognition models:

1. Place your ONNX model files in `public/models/`
2. Update `src/lib/face/index.ts` to load the correct model paths
3. The abstraction layer handles embedding extraction, comparison, and liveness scoring

See `src/lib/face/types.ts` for the adapter interface if integrating an external service.

## Payroll Configuration

Payroll uses configurable policies per organization:

- **Overtime thresholds**: Configurable daily/weekly limits
- **Overtime multipliers**: Configurable per threshold tier
- **Deduction rules**: Configurable placeholders (not hardcoded tax law)
- **Rounding rules**: Configurable minute rounding

Tax calculations must be configured for your specific jurisdiction. The system stores calculation snapshots for auditability.

## Compliance

This application handles sensitive biometric and location data. Before production use:

- Review against local employment, biometric, and privacy laws
- For South Africa: POPIA compliance review required
- Ensure proper consent flows are in place
- Configure appropriate data retention policies
- Limit biometric data access based on role

## License

Proprietary. All rights reserved.
