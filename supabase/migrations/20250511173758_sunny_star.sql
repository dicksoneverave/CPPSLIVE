/*
  # Create views for claim decisions
  
  1. New Views
    - `timebarredclaimsregistrarreview_view` - A view that joins timebarredclaimsregistrarreview with form1112master and workerpersonaldetails
    - `prescreeningreviewhistory_view` - A view that joins prescreeningreviewhistory with form1112master and workerpersonaldetails
      
  2. Purpose
    - Simplifies querying of claim decisions
    - Provides a consistent data structure for the frontend
    - Avoids complex joins in application code
*/

-- Create view for timebarred claims
CREATE OR REPLACE VIEW timebarredclaimsregistrarreview_view AS
SELECT
  t."TBCRRID",
  t."IRN",
  t."TBCRRReviewStatus" as "Status",
  t."TBCRRDecisionDate" as "DecisionDate",
  t."TBCRRDecisionReason" as "DecisionReason",
  t."TBCRRFormType" as "FormType",
  f."DisplayIRN",
  f."IncidentType",
  f."IncidentDate",
  f."IncidentLocation",
  f."IncidentProvince",
  f."IncidentRegion",
  w."WorkerFirstName",
  w."WorkerLastName"
FROM timebarredclaimsregistrarreview t
LEFT JOIN form1112master f ON t."IRN" = f."IRN"
LEFT JOIN workerpersonaldetails w ON f."WorkerID" = w."WorkerID";

-- Create view for prescreening review history
CREATE OR REPLACE VIEW prescreeningreviewhistory_view AS
SELECT
  p."PRHID",
  p."IRN",
  p."PRHDecisionReason" as "Status", -- Fixed: using PRHDecisionReason instead of PRHDecisionStatus
  p."PRHDecisionDate" as "DecisionDate",
  p."PRHDecisionReason" as "DecisionReason",
  p."PRHFormType" as "FormType",
  f."DisplayIRN",
  f."IncidentType",
  f."IncidentDate",
  f."IncidentLocation",
  f."IncidentProvince",
  f."IncidentRegion",
  w."WorkerFirstName",
  w."WorkerLastName"
FROM prescreeningreviewhistory p
LEFT JOIN form1112master f ON p."IRN" = f."IRN"
LEFT JOIN workerpersonaldetails w ON f."WorkerID" = w."WorkerID";
