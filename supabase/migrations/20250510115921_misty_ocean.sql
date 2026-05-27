/*
  # Create prescreening pending view
  
  1. New Views
    - `prescreening_pending_view` - A view that joins prescreeningreviewhistory with form1112master and workerpersonaldetails
      - Provides a unified view of pending prescreening reviews
      - Formats dates in DD-MM-YYYY format for display
      - Includes worker details for easier querying
      
  2. Notes
    - Uses lowercase table names to match actual database schema
    - Filters for only pending status records
    - Joins tables based on IRN and WorkerID relationships
*/

CREATE OR REPLACE VIEW prescreening_pending_view AS
SELECT
  pc."IRN",
  fm."DisplayIRN",
  to_char(pc."PRHSubmissionDate", 'DD-MM-YYYY') AS "SubmissionDate",
  pc."PRHFormType",
  pc."PRHID",
  wpd."WorkerFirstName",
  wpd."WorkerLastName"
FROM prescreeningreviewhistory pc
JOIN form1112master fm ON pc."IRN" = fm."IRN"
JOIN workerpersonaldetails wpd ON fm."WorkerID" = wpd."WorkerID"
WHERE pc."PRHDecisionReason" = 'Pending';
