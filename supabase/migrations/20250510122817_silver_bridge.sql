/*
  # Create prescreening_pending_view

  1. New Views
    - `prescreening_pending_view` - A view that joins prescreeningreview with form1112master and workerpersonaldetails
      - Provides consolidated information about pending prescreening reviews
      - Formats submission date in DD-MM-YYYY format
      - Filters for records with 'Pending' status

  2. Notes
    - Uses exact table and column names as specified
    - Maintains lowercase table names in the actual SQL for compatibility
    - Preserves the original query structure
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
