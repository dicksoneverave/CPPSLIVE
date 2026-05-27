/*
  # Create chief_commissioner_approved_view

  1. New Views
    - `chief_commissioner_approved_view` - A view that joins claimsawardedcommissionersreview with form1112master and workerpersonaldetails
      - Provides consolidated information about approved chief commissioner reviews
      - Formats submission date in DD-MM-YYYY format
      - Filters for records with 'ChiefCommissionerAccepted' status

  2. Notes
    - Similar structure to chief_commissioner_pending_view but with different status filter
    - Used by the ListApprovedClaimsForChiefCommissionerReview component
    - Maintains column naming conventions for frontend compatibility
*/

CREATE OR REPLACE VIEW chief_commissioner_approved_view AS
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
WHERE cacr."CACRReviewStatus" = 'ChiefCommissionerAccepted';
