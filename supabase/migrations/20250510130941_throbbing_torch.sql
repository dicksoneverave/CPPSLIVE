/*
  # Create prescreening_approved_view

  1. New Views
    - `prescreening_approved_view` - A view that joins prescreeningreview with form1112master and workerpersonaldetails
      - Provides a unified view of approved prescreening forms
      - Includes worker details and form information
      - Filters for approved status only

  2. Notes
    - Formats dates consistently with other views
    - Maintains column naming conventions for frontend compatibility
    - Joins tables to provide all necessary information in a single query
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
