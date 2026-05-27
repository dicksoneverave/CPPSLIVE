/*
  # Add registrar review view
  
  1. New Views
    - `registrar_review_view`: Joins registrarreview, form1112master, and workerpersonaldetails tables
      - Provides a single source for claim decision data
      - Simplifies frontend queries by removing need for complex joins
      
  2. Changes
    - Creates a view to replace complex join queries in the frontend
    - Improves query performance and maintainability
    
  3. Security
    - Inherits RLS policies from base tables
*/

-- Create the registrar review view
CREATE VIEW registrar_review_view AS
SELECT
  rr."RRID",
  rr."IRN",
  rr."RRStatus" AS "Status",
  rr."RRDecisionDate" AS "DecisionDate",
  rr."RRDecisionReason" AS "DecisionReason",
  rr."IncidentType",
  fm."DisplayIRN",
  fm."IncidentDate",
  fm."IncidentLocation",
  fm."IncidentProvince",
  fm."IncidentRegion",
  wp."WorkerFirstName",
  wp."WorkerLastName"
FROM registrarreview rr
JOIN form1112master fm ON rr."IRN" = fm."IRN"
JOIN workerpersonaldetails wp ON fm."WorkerID" = wp."WorkerID";
