/*
  # Fix OSMID sequence for owcstaffmaster table

  1. Changes
    - Add sequence for OSMID column
    - Update OSMID to use the sequence as default value
    - Ensure existing records are properly handled

  2. Notes
    - Creates a new sequence starting from the maximum existing OSMID value
    - Sets the sequence as the default for new records
    - Maintains data integrity for existing records
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
