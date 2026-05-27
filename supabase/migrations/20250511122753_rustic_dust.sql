-- Function to get all pending hearings for public organizations
CREATE OR REPLACE FUNCTION get_all_pending_hearings_public()
RETURNS TABLE(
  irn text,
  crn text,
  firstname text,
  lastname text,
  submissiondate text,
  setforhearing text,
  status text,
  type text
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    ths."IRN"::text AS irn,
    fm."DisplayIRN" AS crn,
    wpd."WorkerFirstName" AS firstname,
    wpd."WorkerLastName" AS lastname,
    to_char(ths."THSSubmissionDate", 'DD-MM-YYYY') AS submissiondate,
    COALESCE(ths."THSSetForHearing", 'Not Scheduled') AS setforhearing,
    ths."THSHearingStatus" AS status,
    ths."THSHearingType" AS type
  FROM
    "tribunalhearingschedule" ths
  JOIN
    "form1112master" fm ON ths."IRN" = fm."IRN"
  JOIN
    "workerpersonaldetails" wpd ON fm."WorkerID" = wpd."WorkerID"
  WHERE
    ths."THSHearingStatus" = 'HearingPending'
    AND ths."THSWorkerOrganizationType" = 'Public'
  ORDER BY
    ths."THSSubmissionDate" DESC;
END;
$$ LANGUAGE plpgsql;
