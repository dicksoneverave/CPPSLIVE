/*
  # Fix duplicate IRN values in approvedclaimscporeview table
  
  1. Changes
    - Identify and handle duplicate IRN values
    - Create a temporary table to store unique records
    - Recreate the table with unique IRN values
    - Add unique constraint to IRN column only if it doesn't exist
    
  2. Purpose
    - Resolves the error: "could not create unique index "approvedclaimscporeview_irn_key" - Key ("IRN")=(8049) is duplicated"
    - Ensures data integrity by keeping only one record per IRN
    - Maintains the highest CPORID value for each IRN
    - Avoids error when constraint already exists
*/

-- Create a temporary table to store unique records
CREATE TEMP TABLE temp_approvedclaimscporeview AS
SELECT DISTINCT ON ("IRN") *
FROM approvedclaimscporeview
ORDER BY "IRN", "CPORID" DESC;

-- Delete all records from the original table
DELETE FROM approvedclaimscporeview;

-- Insert the unique records back into the original table
INSERT INTO approvedclaimscporeview
SELECT * FROM temp_approvedclaimscporeview;

-- Drop the temporary table
DROP TABLE temp_approvedclaimscporeview;

-- Now add the unique constraint only if it doesn't exist
DO $$
BEGIN
  -- Check if the constraint already exists
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'approvedclaimscporeview_irn_key'
  ) THEN
    -- Add the constraint if it doesn't exist
    EXECUTE 'ALTER TABLE approvedclaimscporeview 
             ADD CONSTRAINT approvedclaimscporeview_irn_key UNIQUE ("IRN")';
  END IF;
END $$;
