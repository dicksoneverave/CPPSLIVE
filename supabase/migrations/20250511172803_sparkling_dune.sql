/*
  # Create or replace registrar_review_view

  1. Changes
    - Drop the view if it already exists to avoid "relation already exists" error
    - Create the view that joins registrarreview with form1112master and workerpersonaldetails
    - Use LEFT JOIN to ensure all registrarreview records are included
    
  2. Purpose
    - Provides a unified view for claim decisions
    - Simplifies frontend queries by handling the joins at the database level
    - Fixes the relationship error in ListClaimDecisions component
*/

-- Drop the view if it already exists
DROP VIEW IF EXISTS registrar_review_view;

-- Create the registrar review view
CREATE VIEW registrar_review_view AS
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

-- Note: Views cannot have RLS policies directly applied to them.
-- Access control should be handled at the table level for the underlying tables.
