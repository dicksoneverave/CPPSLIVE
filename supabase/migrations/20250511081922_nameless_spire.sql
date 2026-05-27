/*
  # Create functions for claims data aggregation
  
  1. New Functions
    - `get_claims_received_by_month` - Aggregates compensation amounts by month for the current year
    - `get_claims_settled_by_month` - Aggregates settled claims compensation amounts by month
    
  2. Purpose
    - Provides server-side aggregation for chart data
    - Reduces client-side processing
    - Ensures consistent data formatting
*/

-- Function to get claims received by month
CREATE OR REPLACE FUNCTION get_claims_received_by_month(current_year integer)
RETURNS TABLE(submission_month text, total_compensation numeric) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    to_char(cccpmr."CPMRSubmissionDate", 'Month') AS submission_month,
    COALESCE(SUM(ccwd."CCWDCompensationAmount"::numeric), 0) AS total_compensation
  FROM 
    claimcompensationworkerdetails ccwd
  INNER JOIN 
    compensationcalculationcpmreview cccpmr
  ON 
    ccwd."IRN" = cccpmr."IRN"
  WHERE 
    EXTRACT(YEAR FROM cccpmr."CPMRSubmissionDate") = current_year
  GROUP BY 
    submission_month
  ORDER BY
    to_date(submission_month, 'Month');
END;
$$ LANGUAGE plpgsql;

-- Function to get claims settled by month
CREATE OR REPLACE FUNCTION get_claims_settled_by_month(current_year integer)
RETURNS TABLE(submission_month text, total_compensation numeric) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    to_char(cacr."CACRSubmissionDate", 'Month') AS submission_month,
    COALESCE(SUM(ccwd."CCWDCompensationAmount"::numeric), 0) AS total_compensation
  FROM 
    claimcompensationworkerdetails ccwd
  INNER JOIN 
    claimsawardedcommissionersreview cacr
  ON 
    ccwd."IRN" = cacr."IRN"
  WHERE 
    EXTRACT(YEAR FROM cacr."CACRSubmissionDate") = current_year 
    AND cacr."CACRReviewStatus" = 'ChiefCommissionerAccepted'
  GROUP BY 
    submission_month
  ORDER BY
    to_date(submission_month, 'Month');
END;
$$ LANGUAGE plpgsql;
