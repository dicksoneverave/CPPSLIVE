/*
  # Create prescreening_view for claim decisions
  
  1. New Views
    - `prescreening_view` - A view that joins prescreeningreview with form1112master and workerpersonaldetails
      - Provides consolidated information about prescreening reviews
      - Formats submission date in DD-MM-YYYY format
      - Includes all necessary fields for the claim decisions component
      
  2. Purpose
    - Simplifies querying of prescreening reviews
    - Provides a consistent data structure for the frontend
    - Avoids complex joins in application code
*/

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
JOIN "form1112master" fm ON pr."IRN" = fm."IRN"
JOIN "workerpersonaldetails" wpd ON fm."WorkerID" = wpd."WorkerID";
