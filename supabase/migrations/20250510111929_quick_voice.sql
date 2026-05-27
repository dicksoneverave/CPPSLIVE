/*
  # Remove incorrect prescreening_review_history_joined view
  
  1. Changes
    - Drops the existing prescreening_review_history_joined view
    - This view had incorrect column references and mapping
  
  2. Notes
    - A new, corrected view will be created in a separate migration
*/

-- Drop the existing view
DROP VIEW IF EXISTS prescreening_review_history_joined;
