/*
  # Create prescreening review history view
  
  1. New View
    - Creates a view joining prescreeningreviewhistory with related tables
    - Combines data from form1112master and workerpersonaldetails
    - Provides a unified view of prescreening review data
  
  2. Purpose
    - Simplifies data access by encapsulating complex joins
    - Resolves relationship issues between tables
    - Maintains data consistency across the application
*/

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
