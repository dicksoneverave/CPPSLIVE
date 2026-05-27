/*
  # Create pending_cpor_claims view

  1. New Views
    - `pending_cpor_claims` - A view that joins approvedclaimscporeview with form1112master and workerpersonaldetails
      - Provides consolidated information about pending CPO reviews
      - Includes all necessary fields for the ListPendingRegisteredClaimsCPOReview component
      - Filters for records with CPORStatus not equal to 'CompensationCalculated'

  2. Purpose
    - Simplifies querying of pending CPO reviews
    - Provides a consistent data structure for the frontend
    - Avoids complex joins in application code
*/

CREATE OR REPLACE VIEW pending_cpor_claims AS
SELECT
  pc."IRN",
  fm."DisplayIRN",
  wpd."WorkerFirstName",
  wpd."WorkerLastName",
  pc."CPORSubmissionDate",
  pc."IncidentType",
  pc."CPORID",
  pc."CPORStatus",
  fm."IncidentRegion"
FROM
  "approvedclaimscporeview" pc
JOIN
  "form1112master" fm ON pc."IRN" = fm."IRN"
JOIN
  "workerpersonaldetails" wpd ON fm."WorkerID" = wpd."WorkerID"
WHERE
  pc."CPORStatus" != 'CompensationCalculated';
