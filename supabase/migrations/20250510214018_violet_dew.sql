/*
  # Create timebarred_rejected_view

  1. New Views
    - `timebarred_rejected_view` - A view that joins timebarredclaimsregistrarreview with form1112master and workerpersonaldetails
      - Provides consolidated information about rejected time-barred claims
      - Formats submission date in DD-MM-YYYY format
      - Filters for records with TBCRRReviewStatus = 'Rejected'

  2. Security
    - View inherits security from underlying tables
*/

CREATE OR REPLACE VIEW timebarred_rejected_view AS
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
WHERE tbcrr."TBCRRReviewStatus" = 'Rejected';
