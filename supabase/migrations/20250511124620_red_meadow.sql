/*
  # Create view for tribunal hearings pending list - public
  
  1. New Views
    - `view_hearings_pending_public` - A view that joins tribunalhearingschedule with form1112master and workerpersonaldetails
      - Provides consolidated information about pending tribunal hearings for public organizations
      - Includes worker details and hearing information
      - Filters for records with THSHearingStatus = 'HearingPending' and THSWorkerOrganizationType = 'Public'
      
  2. Purpose
    - Simplifies querying of pending tribunal hearings
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
  AND t."THSWorkerOrganizationType" = 'Public'
ORDER BY t."THSSubmissionDate" DESC;
