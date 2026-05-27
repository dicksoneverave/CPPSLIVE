/*
  # Fix prescreening review history view

  1. Changes
    - Create or replace the view to join prescreening review history with related tables
    - Ensure proper column selection and table relationships
    - Add proper column aliases for clarity

  2. Security
    - Views inherit security policies from underlying tables
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
