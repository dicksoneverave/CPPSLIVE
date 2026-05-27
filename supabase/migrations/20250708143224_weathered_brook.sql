/*
  # Fix duplicates and add unique constraint to IRN in approvedclaimscporeview
  
  1. Changes
    - Identifies duplicate IRN values in approvedclaimscporeview table
    - Keeps only the most recently updated record for each duplicate IRN
    - Adds a unique constraint on the IRN column after removing duplicates
    
  2. Purpose
    - Resolves the error: "Key (IRN)=(8049) is duplicated"
    - Enables upsert operations with onConflict: 'IRN'
    - Maintains data integrity by keeping the most relevant records
*/

-- First, identify and remove duplicate IRN values
-- We'll keep the record with the highest CPORID (assuming this is the most recent/important)
DO $$
DECLARE
  duplicate_irn RECORD;
BEGIN
  -- Find all IRNs that have duplicates
  FOR duplicate_irn IN 
    SELECT "IRN", COUNT(*) as count
    FROM approvedclaimscporeview
    GROUP BY "IRN"
    HAVING COUNT(*) > 1
  LOOP
    -- For each duplicate IRN, delete all but the record with the highest CPORID
    DELETE FROM approvedclaimscporeview
    WHERE "IRN" = duplicate_irn."IRN"
    AND "CPORID" NOT IN (
      SELECT MAX("CPORID")
      FROM approvedclaimscporeview
      WHERE "IRN" = duplicate_irn."IRN"
    );
    
    RAISE NOTICE 'Removed duplicates for IRN: %, keeping record with highest CPORID', duplicate_irn."IRN";
  END LOOP;
END $$;

-- Now add the unique constraint
ALTER TABLE approvedclaimscporeview 
ADD CONSTRAINT approvedclaimscporeview_irn_key UNIQUE ("IRN");
