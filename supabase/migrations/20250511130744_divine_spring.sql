CREATE OR REPLACE VIEW view_hearings_pending_private AS
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
  AND t."THSWorkerOrganizationType" = 'Private';
