/*
  # Create prescreening_resubmitted_view

  1. New Views
    - `prescreening_resubmitted_view` - A view that shows resubmitted forms for prescreening
      - Joins prescreeningreview with form1112master and workerpersonaldetails
      - Filters for records with PRStatus = 'Resubmitted'
      - Formats submission date for display

  2. Security
    - View inherits security from underlying tables
*/

CREATE OR REPLACE VIEW prescreening_resubmitted_view AS
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
WHERE pc."PRStatus" = 'Resubmitted';
