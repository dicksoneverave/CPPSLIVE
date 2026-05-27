/*
  # Create registrar_review_view
  
  1. New Views
    - `registrar_review_view` - A view that joins registrarreview with form1112master and workerpersonaldetails
      - Provides consolidated information about registrar reviews
      - Includes worker details and form information
      
  2. Purpose
    - Simplifies querying of registrar reviews
    - Provides a consistent data structure for the frontend
    - Avoids complex joins in application code
*/

-- Create the registrar review view
CREATE OR REPLACE VIEW registrar_review_view AS
SELECT
  rr."RRID",
  rr."IRN",
  rr."RRStatus" as "Status",
  rr."RRDecisionDate" as "DecisionDate",
  rr."RRDecisionReason" as "DecisionReason",
  rr."IncidentType",
  f."DisplayIRN",
  f."IncidentDate",
  f."IncidentLocation",
  f."IncidentProvince",
  f."IncidentRegion",
  w."WorkerFirstName",
  w."WorkerLastName"
FROM registrarreview rr
LEFT JOIN form1112master f ON rr."IRN" = f."IRN"
LEFT JOIN workerpersonaldetails w ON f."WorkerID" = w."WorkerID";
