-- Add JSONB column for storing face-api.js 128-dim descriptors
ALTER TABLE face_enrollments
ADD COLUMN face_descriptor jsonb;

COMMENT ON COLUMN face_enrollments.face_descriptor IS '128-dimensional face descriptor from face-api.js stored as JSON array';
