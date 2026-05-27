/*
  # Update prescreening review history joined view
  
  1. Changes
    - Drop existing view if it exists
    - Recreate the view with the PRStatus column included
    - Fix column references to match actual database schema
    - Maintain all existing functionality
    
  2. Purpose
    - Add missing PRStatus column needed by frontend components
    - Fix column reference errors in the original view
*/

-- Drop the existing view
DROP VIEW IF EXISTS prescreening_review_history_joined;

-- Recreate the view with the PRStatus column
CREATE OR REPLACE VIEW prescreening_review_history_joined AS
SELECT 
    prh."PRHID",
    prh."IRN",
    prh."PRHSubmissionDate",
    prh."PRHFormType",
    prh."PRHDecisionReason",
    prh."PRHDecisionReason" as "PRStatus", -- Using PRHDecisionReason as PRStatus
    f1112."DisplayIRN",
    f1112."WorkerID",
    wp."WorkerFirstName",
    wp."WorkerLastName"
FROM 
    prescreeningreviewhistory prh
    LEFT JOIN form1112master f1112 ON prh."IRN" = f1112."IRN"
    LEFT JOIN workerpersonaldetails wp ON f1112."WorkerID" = wp."WorkerID";

-- Grant necessary permissions
GRANT SELECT ON prescreening_review_history_joined TO public;
