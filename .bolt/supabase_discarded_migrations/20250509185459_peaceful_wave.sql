/*
  # Create workerirn view

  1. New Views
    - `workerirn` - A view that joins form1112master and workerpersonaldetails tables
      - Provides consolidated worker information including incident details
      - Used by various forms for searching and displaying worker data

  2. Security
    - Enable RLS on the view
    - Add policy for public read access
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

-- Enable RLS on the view
ALTER VIEW workerirn ENABLE ROW LEVEL SECURITY;

-- Create policy for reading the view
CREATE POLICY "Allow read access to everyone" 
  ON workerirn
  FOR SELECT
  TO PUBLIC
  USING (true);
