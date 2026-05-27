/*
  # Create view for pending hearings (public)
  
  1. New Views
    - `view_hearings_pending_public` - A view that joins tribunalhearingschedule with form1112master and workerpersonaldetails
      - Provides a unified view of pending hearings for public organizations
      - Includes worker details and hearing information
      - Used by the PrintListPublic component for generating reports
      
  2. Purpose
    - Simplifies querying of pending hearings
    - Provides a consistent data structure for the frontend
    - Avoids complex joins in application code
*/

CREATE OR REPLACE VIEW view_hearings_pending_public AS
SELECT 
  t."IRN",
  f."DisplayIRN" as "CRN",
  w."WorkerFirstName" as "FirstName",
  w."WorkerLastName" as "LastName",
  t."THSSubmissionDate",
  t."THSSetForHearing",
  t."THSHearingStatus",
  t."THSHearingType"
FROM "tribunalhearingschedule" t
JOIN "form1112master" f ON t."IRN" = f."IRN"
JOIN "workerpersonaldetails" w ON f."WorkerID" = w."WorkerID"
WHERE t."THSHearingStatus" = 'HearingPending'
  AND t."THSWorkerOrganizationType" = 'Public';
