/*
  # Create commissioner_approved_view

  1. New Views
    - `commissioner_approved_view` - A view that joins claimsawardedcommissionersreview with form1112master and workerpersonaldetails
      - Provides a unified view of approved commissioner reviews
      - Formats submission date in DD-MM-YYYY format for display
      - Filters for records with status 'CommissionerAccepted' or 'ChiefCommissionerAccepted'

  2. Purpose
    - Simplifies querying of approved commissioner reviews
    - Provides a consistent data structure for the frontend
    - Avoids complex joins in application code
*/

CREATE OR REPLACE VIEW commissioner_approved_view AS
SELECT
  cacr."IRN",
  fm."DisplayIRN",
  to_char(cacr."CACRSubmissionDate", 'DD-MM-YYYY') AS "SubmissionDate",
  cacr."IncidentType",
  cacr."CACRID",
  wpd."WorkerFirstName",
  wpd."WorkerLastName"
FROM "claimsawardedcommissionersreview" cacr
JOIN "form1112master" fm ON cacr."IRN" = fm."IRN"
JOIN "workerpersonaldetails" wpd ON fm."WorkerID" = wpd."WorkerID"
WHERE cacr."CACRReviewStatus" IN ('CommissionerAccepted', 'ChiefCommissionerAccepted');
