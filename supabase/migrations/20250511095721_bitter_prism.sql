/*
  # Create get_yearly_claim_counts function
  
  1. New Functions
    - `get_yearly_claim_counts` - A function that returns yearly counts of injury and death claims
      - Returns a table with year, injury_count, and death_count columns
      - Handles all years from start_year to current year
      - Ensures all years are included even if no claims exist
      
  2. Purpose
    - Provides accurate historical data for the "Total Claims Last 7 Years" chart
    - Ensures consistent data format for frontend visualization
    - Replaces client-side data processing with server-side aggregation
*/

CREATE OR REPLACE FUNCTION get_yearly_claim_counts(start_year integer)
RETURNS TABLE(year integer, injury_count bigint, death_count bigint) AS $$
DECLARE
    current_year integer := date_part('year', CURRENT_DATE)::integer;
    y integer;
BEGIN
    -- Create a temporary table to hold all years in range
    CREATE TEMPORARY TABLE temp_years (year integer) ON COMMIT DROP;
    
    -- Populate with all years from start_year to current_year
    FOR y IN start_year..current_year LOOP
        INSERT INTO temp_years VALUES (y);
    END LOOP;
    
    -- Return data for all years, joining with actual counts
    RETURN QUERY
    SELECT 
        ty.year,
        COALESCE(counts.injury_count, 0::bigint) AS injury_count,
        COALESCE(counts.death_count, 0::bigint) AS death_count
    FROM 
        temp_years ty
    LEFT JOIN (
        SELECT 
            date_part('year', "FirstSubmissionDate")::integer AS year,
            COUNT(CASE WHEN "IncidentType" = 'Injury' THEN 1 ELSE NULL END)::bigint AS injury_count,
            COUNT(CASE WHEN "IncidentType" = 'Death' THEN 1 ELSE NULL END)::bigint AS death_count
        FROM 
            form1112master 
        WHERE 
            "FirstSubmissionDate" IS NOT NULL
        GROUP BY 
            date_part('year', "FirstSubmissionDate")
    ) counts ON ty.year = counts.year
    ORDER BY 
        ty.year ASC;
END;
$$ LANGUAGE plpgsql;
