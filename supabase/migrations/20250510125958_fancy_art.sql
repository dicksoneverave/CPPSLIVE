/*
  # Create prescreening_approved_view

  1. New Views
    - `prescreening_approved_view` - A view that shows approved prescreening forms
      - Joins prescreeningreview with form1112master and workerpersonaldetails
      - Filters for records with PRStatus = 'Approved'
      - Formats dates for display
      
  2. Purpose
    - Simplifies querying of approved prescreening forms
    - Provides a consistent data structure for the frontend
    - Avoids complex joins in application code
*/

CREATE OR REPLACE VIEW prescreening_approved_view AS
SELECT
  pc."IRN",
  fm."DisplayIRN",
  to_char(pc."PRSubmissionDate", 'DD-MM-YYYY') AS "SubmissionDate",
  pc."PRFormType",
  pc."PRID",
  wpd."WorkerFirstName",
  wpd."WorkerLastName"
FROM "prescreeningreview" pc
JOIN "form1112master" fm ON pc."IRN" = fm."IRN"
JOIN "workerpersonaldetails" wpd ON fm."WorkerID" = wpd."WorkerID"
WHERE pc."PRStatus" = 'Approved';
