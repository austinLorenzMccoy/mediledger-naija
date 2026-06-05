-- MediLedger Nigeria — Storage Buckets
-- Migration 006: Create private storage buckets for medical records

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'medical-records',
  'medical-records',
  FALSE,
  52428800,  -- 50 MB per file
  ARRAY['application/pdf', 'image/jpeg', 'image/png', 'application/dicom', 'application/json']
)
ON CONFLICT (id) DO NOTHING;
