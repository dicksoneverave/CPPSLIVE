/*
  # Create workerirn view

  1. New Views
    - `workerirn` - A view that joins form1112master and workerpersonaldetails
      - Provides consolidated worker information with incident details
      - Includes worker names, incident types, and reference numbers
      
  2. Notes
    - Views cannot have RLS policies directly applied to them
    - Access control should be handled at the table level
*/

-- Create the workerirn view
CREATE OR REPLACE VIEW workerirn AS
SELECT 
  a."IncidentType" AS "INCIDENTTYPE",
  a."IRN" AS "IRN",
  a."DisplayIRN" AS "DisplayIRN",
  a."WorkerID" AS "WorkerID",
  CONCAT(b."WorkerFirstName", ' ', b."WorkerLastName") AS "Name",
  b."WorkerFirstName" AS "FirstName",
  b."WorkerLastName" AS "LastName"
FROM 
  public.form1112master a
JOIN 
  public.workerpersonaldetails b
ON 
  a."WorkerID" = b."WorkerID";

-- Note: Views cannot have RLS policies directly applied to them.
-- Access control should be handled at the table level for the underlying tables.
