/*
  # Create function to get injury cases by month
  
  1. New Functions
    - `get_injury_cases_by_month` - A stored procedure that returns injury cases grouped by month
      - Takes current_year as a parameter
      - Returns month name and count of incidents
      - Formats dates using PostgreSQL's to_char function
      
  2. Purpose
    - Provides a server-side implementation of the SQL query:
      SELECT DATE_FORMAT(FirstSubmissionDate, "%M") AS Month, COUNT(*) AS IncidentCount
      FROM Form1112Master 
      WHERE IncidentType = "Injury"
      AND YEAR(FirstSubmissionDate) = YEAR(CURDATE())
      GROUP BY DATE_FORMAT(FirstSubmissionDate, "%M")
    - Optimizes data retrieval by performing aggregation on the server
*/

CREATE OR REPLACE FUNCTION get_injury_cases_by_month(current_year integer)
RETURNS TABLE(month text, count bigint) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    to_char("FirstSubmissionDate", 'Month') AS month,
    COUNT(*) AS count
  FROM 
    form1112master
  WHERE 
    "IncidentType" = 'Injury'
    AND EXTRACT(YEAR FROM "FirstSubmissionDate") = current_year
  GROUP BY 
    to_char("FirstSubmissionDate", 'Month')
  ORDER BY
    to_date(to_char("FirstSubmissionDate", 'Month'), 'Month');
END;
$$ LANGUAGE plpgsql;
