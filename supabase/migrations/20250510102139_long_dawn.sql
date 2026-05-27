/*
  # Create prescreening review history joined view

  1. New Views
    - `prescreening_review_history_joined` - Joins prescreeningreviewhistory with form1112master and workerpersonaldetails
      - Provides a single view that combines worker details with prescreening review data
      - Simplifies querying by handling the relationships at the database level

  2. Notes
    - Uses LEFT JOIN to ensure all prescreening records are included even if related data is missing
    - Includes all necessary fields for displaying prescreening review lists
    - Maintains original column names for compatibility with existing code
*/

-- Create or replace the view to join prescreening review history with related tables
CREATE OR REPLACE VIEW prescreening_review_history_joined AS
SELECT
  prh."PRHID",
  prh."IRN",
  prh."PRHSubmissionDate",
  prh."PRHFormType",
  prh."PRHDecisionReason",
  f1112."DisplayIRN",
  f1112."WorkerID",
  wp."WorkerFirstName",
  wp."WorkerLastName"
FROM prescreeningreviewhistory prh
LEFT JOIN form1112master f1112 ON prh."IRN" = f1112."IRN"
LEFT JOIN workerpersonaldetails wp ON f1112."WorkerID" = wp."WorkerID";
