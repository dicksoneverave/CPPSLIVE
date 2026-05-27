/*
  # Add OSMID sequence and update owcstaffmaster table

  1. Changes
    - Create sequence for OSMID if it doesn't exist
    - Set sequence to start from max existing OSMID
    - Modify OSMID column to use sequence as default
    - Add CPPSID column for user reference

  2. Security
    - No changes to RLS policies
*/

-- Create sequence for OSMID if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_sequences WHERE schemaname = 'public' AND sequencename = 'owcstaffmaster_osmid_seq') THEN
    -- Get the maximum existing OSMID value
    CREATE SEQUENCE IF NOT EXISTS owcstaffmaster_osmid_seq;
    
    -- Set the sequence to start from the maximum existing OSMID + 1
    PERFORM setval('owcstaffmaster_osmid_seq', COALESCE((SELECT MAX("OSMID") FROM owcstaffmaster), 0));
  END IF;
END $$;

-- Modify the OSMID column to use the sequence
ALTER TABLE owcstaffmaster 
  ALTER COLUMN "OSMID" SET DEFAULT nextval('owcstaffmaster_osmid_seq');

-- Add CPPSID column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'owcstaffmaster' 
    AND column_name = 'cppsid'
  ) THEN
    ALTER TABLE owcstaffmaster ADD COLUMN CPPSID uuid;
  END IF;
END $$;
