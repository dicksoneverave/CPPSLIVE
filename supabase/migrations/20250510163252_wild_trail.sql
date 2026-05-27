/*
  # Create view for pending awarded claims for registrar review
  
  1. New Views
    - `pending_awarded_claims_registrar_view` - A view that joins claimsawardedregistrarreview with form1112master and workerpersonaldetails
      - Provides a unified view of pending awarded claims for registrar review
      - Formats submission date in DD-MM-YYYY format
      - Filters for records with CARRReviewStatus = 'RegistrarReviewPending'
      
  2. Notes
    - Simplifies querying by handling the joins at the database level
    - Maintains consistent date formatting with other views
    - Used by the ListPendingAwardedClaimsForRegistrarReview component
*/

CREATE OR REPLACE VIEW pending_awarded_claims_registrar_view AS
SELECT
  carr."IRN",
  fm."DisplayIRN",
  to_char(carr."CARRSubmissionDate", 'DD-MM-YYYY') AS "SubmissionDate",
  carr."IncidentType",
  carr."CARRID",
  wpd."WorkerFirstName",
  wpd."WorkerLastName"
FROM "claimsawardedregistrarreview" carr
JOIN "form1112master" fm ON carr."IRN" = fm."IRN"
JOIN "workerpersonaldetails" wpd ON fm."WorkerID" = wpd."WorkerID"
WHERE carr."CARRReviewStatus" = 'RegistrarReviewPending';
