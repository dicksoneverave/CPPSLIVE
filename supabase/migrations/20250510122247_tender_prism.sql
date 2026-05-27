/*
  # Create prescreening_pending_view

  1. New Views
    - `prescreening_pending_view` - A view that joins prescreeningreview with form1112master and workerpersonaldetails
      - Provides consolidated information about pending prescreening reviews
      - Formats submission date in DD-MM-YYYY format
      - Filters for records with "PRStatus" = 'Pending'

  2. Security
    - No explicit RLS policies needed as the view inherits permissions from underlying tables
*/

CREATE OR REPLACE VIEW prescreening_pending_view AS
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
WHERE pc."PRStatus" = 'Pending';
