/*
  # Create view for Chief Commissioner pending reviews
  
  1. New Views
    - `chief_commissioner_pending_view` - A view that shows claims pending Chief Commissioner review
      - Joins claimsawardedcommissionersreview with form1112master and workerpersonaldetails
      - Filters for records with CACRReviewStatus = 'ChiefCommissionerReviewPending'
      - Formats dates for display
      
  2. Purpose
    - Simplifies querying of claims pending Chief Commissioner review
    - Provides a consistent data structure for the frontend
    - Avoids complex joins in application code
*/

CREATE OR REPLACE VIEW chief_commissioner_pending_view AS
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
WHERE cacr."CACRReviewStatus" = 'ChiefCommissionerReviewPending';
