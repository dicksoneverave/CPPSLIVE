/*
  # Create view for tribunal hearings pending (private)
  
  1. New Views
    - `view_hearings_pending_private` - A view that joins tribunalhearingschedule with form1112master and workerpersonaldetails
      - Provides consolidated information about pending private tribunal hearings
      - Includes worker details and hearing information
      - Filters for records with THSHearingStatus = 'HearingPending' and THSWorkerOrganizationType = 'Private'
      
  2. Purpose
    - Simplifies querying of pending private tribunal hearings
    - Provides a consistent data structure for the frontend
    - Avoids complex joins in application code
*/

CREATE OR REPLACE VIEW view_hearings_pending_private AS
SELECT 
  ths."IRN",
  f."DisplayIRN" as "CRN",
  w."WorkerFirstName" as "FirstName",
  w."WorkerLastName" as "LastName",
  ths."THSSubmissionDate",
  ths."THSSetForHearing",
  ths."THSHearingStatus",
  ths."THSHearingType"
FROM tribunalhearingschedule ths
JOIN form1112master f ON ths."IRN" = f."IRN"
JOIN workerpersonaldetails w ON f."WorkerID" = w."WorkerID"
WHERE ths."THSHearingStatus" = 'HearingPending'
  AND ths."THSWorkerOrganizationType" = 'Private';
