/*
  # Create function for pending hearings (private)

  1. New Functions
    - `get_pending_hearings_private` - A stored procedure that retrieves pending hearings for private organizations
      - Joins tribunalhearingschedule with form1112master and workerpersonaldetails
      - Supports filtering by IRN, first name, and last name
      - Includes pagination support
      - Returns formatted dates for display

  2. Purpose
    - Provides a consistent interface for retrieving pending hearings data
    - Handles complex joins and filtering in the database
    - Improves performance by reducing the number of queries needed
*/

CREATE OR REPLACE FUNCTION get_pending_hearings_private(
  p_limit integer,
  p_offset integer,
  p_search_irn text DEFAULT NULL,
  p_search_first_name text DEFAULT NULL,
  p_search_last_name text DEFAULT NULL
)
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
    AND ths."THSWorkerOrganizationType" = 'Private'
    AND (p_search_irn IS NULL OR fm."DisplayIRN" ILIKE '%' || p_search_irn || '%')
    AND (p_search_first_name IS NULL OR wpd."WorkerFirstName" ILIKE '%' || p_search_first_name || '%')
    AND (p_search_last_name IS NULL OR wpd."WorkerLastName" ILIKE '%' || p_search_last_name || '%')
  ORDER BY
    ths."THSSubmissionDate" DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$ LANGUAGE plpgsql;
