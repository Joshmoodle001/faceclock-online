-- Enable required PostgreSQL extensions for the attendance system.

CREATE EXTENSION IF NOT EXISTS postgis WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA extensions;

COMMENT ON EXTENSION postgis IS 'Geospatial support for location-based attendance features';
COMMENT ON EXTENSION vector IS 'pgvector support for facial recognition embeddings (512-dim)';
COMMENT ON EXTENSION pgcrypto IS 'Cryptographic functions for gen_random_uuid() and secure hashing';
COMMENT ON EXTENSION pg_trgm IS 'Trigram text search for employee lookups and matching';
