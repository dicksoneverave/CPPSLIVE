/*
  # Create compensation_calculation_cpm_pending_view

  1. New Views
    - `compensation_calculation_cpm_pending_view` - A view that joins compensationcalculationcpmreview with form1112master and workerpersonaldetails
      - Provides consolidated information about pending compensation calculation CPM reviews
      - Formats submission date in DD-MM-YYYY format
      - Filters for records with CPMRStatus = 'Pending'
      - Includes IncidentRegion for filtering by user's assigned region

  2. Purpose
    - Simplifies querying of pending compensation calculation CPM reviews
    - Provides a consistent data structure for the frontend
    - Enables filtering by user's assigned region
    - Avoids complex joins in application code
*/

CREATE OR REPLACE VIEW compensation_calculation_cpm_pending_view AS
SELECT
  cpmr."IRN",
  fm."DisplayIRN",
  to_char(cpmr."CPMRSubmissionDate", 'DD-MM-YYYY') AS "SubmissionDate",
  cpmr."IncidentType",
  cpmr."CPMRID",
  cpmr."CPMRStatus",
  wpd."WorkerFirstName",
  wpd."WorkerLastName",
  fm."IncidentRegion"
FROM "compensationcalculationcpmreview" cpmr
JOIN "form1112master" fm ON cpmr."IRN" = fm."IRN"
JOIN "workerpersonaldetails" wpd ON fm."WorkerID" = wpd."WorkerID"
WHERE cpmr."CPMRStatus" = 'Pending';
