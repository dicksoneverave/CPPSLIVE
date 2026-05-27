/*
  # Create registrar_rejected_view

  1. New Views
    - `registrar_rejected_view` - A view that joins registrarreview with form1112master and workerpersonaldetails
      - Provides a unified view of rejected registrar reviews
      - Formats submission date in DD-MM-YYYY format
      - Filters for records with RRStatus = 'Rejected'

  2. Security
    - View inherits security from underlying tables
*/

CREATE OR REPLACE VIEW registrar_rejected_view AS
SELECT
  rr."IRN",
  fm."DisplayIRN",
  to_char(rr."RRSubmissionDate", 'DD-MM-YYYY') AS "SubmissionDate",
  rr."IncidentType",
  rr."RRID",
  rr."RRStatus",
  wpd."WorkerFirstName",
  wpd."WorkerLastName"
FROM "registrarreview" rr
JOIN "form1112master" fm ON rr."IRN" = fm."IRN"
JOIN "workerpersonaldetails" wpd ON fm."WorkerID" = wpd."WorkerID"
WHERE rr."RRStatus" = 'Rejected';
