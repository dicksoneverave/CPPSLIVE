/*
  # Create prescreening_pending_view

  1. New Views
    - `prescreening_pending_view` - A view that joins prescreeningreviewhistory with form1112master and workerpersonaldetails
      - Provides a simplified view of pending prescreening reviews
      - Formats submission date in DD-MM-YYYY format
      - Includes worker information for display purposes

  2. Notes
    - Filters for records where PRStatus = 'Pending'
    - Used by the ListPendingFormsPrescreeningReview component
*/

CREATE OR REPLACE VIEW prescreening_pending_view AS
SELECT
  pc."IRN",
  fm."DisplayIRN",
  to_char(pc."PRHSubmissionDate", 'DD-MM-YYYY') AS "SubmissionDate",
  pc."PRHFormType",
  pc."PRHID",
  wpd."WorkerFirstName",
  wpd."WorkerLastName"
FROM prescreeningreviewhistory pc
JOIN form1112master fm ON pc."IRN" = fm."IRN"
JOIN workerpersonaldetails wpd ON fm."WorkerID" = wpd."WorkerID"
WHERE pc."PRHDecisionReason" = 'Pending';
