/*
  # Create compensation_calculation_cpm_rejected_view

  1. New Views
    - `compensation_calculation_cpm_rejected_view` - A view that joins compensationcalculationcpmreview with form1112master and workerpersonaldetails
      - Provides consolidated information about rejected CPM reviews
      - Formats submission date in DD-MM-YYYY format
      - Filters for records with CPMRStatus = 'Rejected'
      
  2. Purpose
    - Simplifies querying of rejected CPM reviews
    - Provides a consistent data structure for the frontend
    - Avoids complex joins in application code
*/

CREATE OR REPLACE VIEW compensation_calculation_cpm_rejected_view AS
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
WHERE cpmr."CPMRStatus" = 'Rejected';
