/*
  # Create function to get yearly claim counts
  
  1. New Functions
    - `get_yearly_claim_counts` - A function that returns yearly counts of injury and death claims
      - Takes a start_year parameter to limit the results
      - Returns a table with year, injury_count, and death_count columns
      - Groups data by year and incident type
      
  2. Purpose
    - Provides an efficient way to get claim statistics for charts
    - Encapsulates the SQL logic for consistent reuse
    - Improves performance by handling aggregation at the database level
*/

CREATE OR REPLACE FUNCTION get_yearly_claim_counts(start_year integer)
RETURNS TABLE(year integer, injury_count bigint, death_count bigint) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    date_part('year', "FirstSubmissionDate")::integer AS Year,
    COUNT(CASE WHEN "IncidentType" = 'Injury' THEN 1 ELSE NULL END)::bigint AS InjuryCount,
    COUNT(CASE WHEN "IncidentType" = 'Death' THEN 1 ELSE NULL END)::bigint AS DeathCount
  FROM 
    form1112master 
  WHERE 
    "FirstSubmissionDate" IS NOT NULL AND
    date_part('year', "FirstSubmissionDate")::integer >= start_year
  GROUP BY 
    date_part('year', "FirstSubmissionDate")
  ORDER BY 
    Year ASC;
END;
$$ LANGUAGE plpgsql;
