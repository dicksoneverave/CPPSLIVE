/*
  # Create timebarred_forward_to_tribunal_view

  1. New Views
    - `timebarred_forward_to_tribunal_view` - A view that joins timebarredclaimsregistrarreview with form1112master and workerpersonaldetails
      - Provides consolidated information about time-barred claims forwarded to tribunal
      - Formats submission date in DD-MM-YYYY format
      - Filters for records with TBCRRReviewStatus = 'ForwardToTribunal'

  2. Purpose
    - Simplifies querying of time-barred claims forwarded to tribunal
    - Provides a consistent data structure for the frontend
    - Avoids complex joins in application code
*/

CREATE OR REPLACE VIEW timebarred_forward_to_tribunal_view AS
SELECT
  tbcrr."IRN",
  fm."DisplayIRN",
  to_char(tbcrr."TBCRRSubmissionDate", 'DD-MM-YYYY') AS "SubmissionDate",
  tbcrr."TBCRRFormType",
  tbcrr."TBCRRID",
  tbcrr."TBCRRReviewStatus",
  wpd."WorkerFirstName",
  wpd."WorkerLastName"
FROM "timebarredclaimsregistrarreview" tbcrr
JOIN "form1112master" fm ON tbcrr."IRN" = fm."IRN"
JOIN "workerpersonaldetails" wpd ON fm."WorkerID" = wpd."WorkerID"
WHERE tbcrr."TBCRRReviewStatus" = 'ForwardToTribunal';
