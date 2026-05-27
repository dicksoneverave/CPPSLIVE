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
  AND ths."THSWorkerOrganizationType" = 'Private'
ORDER BY ths."THSSubmissionDate" DESC;
