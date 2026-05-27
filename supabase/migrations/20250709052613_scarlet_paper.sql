/*
  # Create prescreening_view for claim decisions
  
  1. New Views
    - `prescreening_view` - A view that joins prescreeningreview with form1112master and workerpersonaldetails
      - Provides consolidated information about prescreening reviews
      - Includes all necessary fields for the claim decisions component
      - Ensures records are properly linked by IRN
      
  2. Purpose
    - Simplifies querying of prescreening reviews
    - Provides a consistent data structure for the frontend
    - Avoids complex joins in application code
*/

-- Drop the view if it exists to avoid errors
DROP VIEW IF EXISTS prescreening_view;

-- Create the view with all necessary fields
CREATE OR REPLACE VIEW prescreening_view AS
SELECT
  pr."IRN",
  pr."PRID",
  pr."PRStatus",
  pr."PRDecisionReason",
  pr."PRFormType",
  pr."PRSubmissionDate",
  fm."DisplayIRN",
  wpd."WorkerFirstName",
  wpd."WorkerLastName"
FROM "prescreeningreview" pr
LEFT JOIN "form1112master" fm ON pr."IRN" = fm."IRN"
LEFT JOIN "workerpersonaldetails" wpd ON fm."WorkerID" = wpd."WorkerID";
