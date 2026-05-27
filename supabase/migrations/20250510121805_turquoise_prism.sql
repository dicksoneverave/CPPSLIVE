/*
  # Remove prescreening_pending_view

  1. Changes
    - Drop the prescreening_pending_view that was previously created
    
  2. Notes
    - This removes the view while preserving the underlying tables
    - The prescreeningreview table remains untouched as it's used by other functions
*/

-- Drop the view if it exists
DROP VIEW IF EXISTS prescreening_pending_view;
