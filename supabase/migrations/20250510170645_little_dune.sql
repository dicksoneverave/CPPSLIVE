/*
  # Create approved_awarded_claims_registrar_view

  1. New Views
    - `approved_awarded_claims_registrar_view` - A view that joins claimsawardedregistrarreview with form1112master and workerpersonaldetails
      - Provides a unified view of approved awarded claims for registrar review
      - Formats submission date in DD-MM-YYYY format
      - Filters for records with CARRReviewStatus = 'RegistrarAccepted'

  2. Purpose
    - Simplifies querying of approved awarded claims
    - Provides a consistent data structure for the frontend
    - Avoids complex joins in application code
*/

CREATE OR REPLACE VIEW approved_awarded_claims_registrar_view AS
SELECT
  carr."IRN",
  fm."DisplayIRN",
  to_char(carr."CARRSubmissionDate", 'DD-MM-YYYY') AS "SubmissionDate",
  carr."IncidentType",
  carr."CARRID",
  carr."CARRReviewStatus",
  wpd."WorkerFirstName",
  wpd."WorkerLastName"
FROM "claimsawardedregistrarreview" carr
JOIN "form1112master" fm ON carr."IRN" = fm."IRN"
JOIN "workerpersonaldetails" wpd ON fm."WorkerID" = wpd."WorkerID"
WHERE carr."CARRReviewStatus" = 'RegistrarAccepted';
