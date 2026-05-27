/*
  # Add test data for prescreening pending view

  1. New Data
    - Adds test records to prescreeningreviewhistory table
    - Ensures there's data with 'Pending' status to show in the view
    - Uses existing IRNs from form1112master to maintain referential integrity

  2. Purpose
    - Verifies the prescreening_pending_view is working correctly
    - Provides sample data for testing the UI
*/

-- First, check if there are any existing records in form1112master
DO $$
DECLARE
    v_irn bigint;
    v_worker_id bigint;
BEGIN
    -- Get a valid IRN and WorkerID from form1112master
    SELECT "IRN", "WorkerID" INTO v_irn, v_worker_id FROM form1112master LIMIT 1;
    
    -- If we found a valid IRN, insert test data
    IF v_irn IS NOT NULL THEN
        -- Insert a test record with 'Pending' status
        INSERT INTO prescreeningreviewhistory ("PRHID", "IRN", "PRHSubmissionDate", "PRHFormType", "PRHDecisionReason")
        VALUES 
            (1001, v_irn, CURRENT_DATE, 'Form11', 'Pending'),
            (1002, v_irn, CURRENT_DATE - INTERVAL '1 day', 'Form11', 'Pending'),
            (1003, v_irn, CURRENT_DATE - INTERVAL '2 days', 'Form11', 'Pending')
        ON CONFLICT ("PRHID") DO NOTHING;
    END IF;
END $$;
