/*
  # Create prescreening_onhold_view

  1. New Views
    - `prescreening_onhold_view` - A view that joins prescreeningreview with form1112master and workerpersonaldetails
      - Provides consolidated information for on-hold prescreening reviews
      - Includes worker names, submission dates, and form types
      
  2. Notes
    - Filters records where PRStatus = 'OnHold'
    - Formats dates in DD-MM-YYYY format for consistent display
    - Joins with related tables to provide complete information
*/

CREATE OR REPLACE VIEW prescreening_onhold_view AS
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
WHERE pc."PRStatus" = 'OnHold';
