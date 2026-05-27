/*
  # Create claim details views
  
  1. New Views
    - `cpo_review_claim_details_view` - Joins approvedclaimscporeview with form1112master and workerpersonaldetails
    - `cpm_review_claim_details_view` - Joins compensationcalculationcpmreview with form1112master and workerpersonaldetails
    - `commissioner_review_claim_details_view` - Joins claimsawardedcommissionersreview with form1112master and workerpersonaldetails
    - `registrar_award_review_claim_details_view` - Joins claimsawardedregistrarreview with form1112master and workerpersonaldetails
    
  2. Purpose
    - Resolves relationship errors in the ListClaimDecisions component
    - Provides pre-joined views for efficient data access
    - Maintains consistent column naming across views
*/

-- Create CPO Review Claim Details View
CREATE OR REPLACE VIEW public.cpo_review_claim_details_view AS
SELECT
    acpr."IRN",
    acpr."CPORID",
    acpr."CPORStatus",
    acpr."CPORSubmissionDate",
    acpr."CPORApprovedDate",
    acpr."LockedByCPOID",
    acpr."IncidentType",
    f1112."DisplayIRN",
    f1112."IncidentDate",
    f1112."IncidentLocation",
    f1112."IncidentProvince",
    f1112."IncidentRegion",
    f1112."WorkerID",
    wpd."WorkerFirstName",
    wpd."WorkerLastName"
FROM
    public.approvedclaimscporeview AS acpr
JOIN
    public.form1112master AS f1112 ON acpr."IRN" = f1112."IRN"
JOIN
    public.workerpersonaldetails AS wpd ON f1112."WorkerID" = wpd."WorkerID";

-- Create CPM Review Claim Details View
CREATE OR REPLACE VIEW public.cpm_review_claim_details_view AS
SELECT
    ccmr."IRN",
    ccmr."CPMRID",
    ccmr."CPMRStatus",
    ccmr."CPMRSubmissionDate",
    ccmr."CPMRDecisionDate",
    ccmr."CPMRDecisionReason",
    ccmr."IncidentType",
    f1112."DisplayIRN",
    f1112."IncidentDate",
    f1112."IncidentLocation",
    f1112."IncidentProvince",
    f1112."IncidentRegion",
    f1112."WorkerID",
    wpd."WorkerFirstName",
    wpd."WorkerLastName"
FROM
    public.compensationcalculationcpmreview AS ccmr
JOIN
    public.form1112master AS f1112 ON ccmr."IRN" = f1112."IRN"
JOIN
    public.workerpersonaldetails AS wpd ON f1112."WorkerID" = wpd."WorkerID";

-- Create Commissioner Review Claim Details View
CREATE OR REPLACE VIEW public.commissioner_review_claim_details_view AS
SELECT
    cacr."IRN",
    cacr."CACRID",
    cacr."CACRReviewStatus",
    cacr."CACRSubmissionDate",
    cacr."CACRDecisionDate",
    cacr."CACRDecisionReason",
    cacr."IncidentType",
    f1112."DisplayIRN",
    f1112."IncidentDate",
    f1112."IncidentLocation",
    f1112."IncidentProvince",
    f1112."IncidentRegion",
    f1112."WorkerID",
    wpd."WorkerFirstName",
    wpd."WorkerLastName"
FROM
    public.claimsawardedcommissionersreview AS cacr
JOIN
    public.form1112master AS f1112 ON cacr."IRN" = f1112."IRN"
JOIN
    public.workerpersonaldetails AS wpd ON f1112."WorkerID" = wpd."WorkerID";

-- Create Registrar Award Review Claim Details View
CREATE OR REPLACE VIEW public.registrar_award_review_claim_details_view AS
SELECT
    carr."IRN",
    carr."CARRID",
    carr."CARRReviewStatus",
    carr."CARRSubmissionDate",
    carr."CARRDecisionDate",
    carr."CARRDecisionReason",
    carr."IncidentType",
    f1112."DisplayIRN",
    f1112."IncidentDate",
    f1112."IncidentLocation",
    f1112."IncidentProvince",
    f1112."IncidentRegion",
    f1112."WorkerID",
    wpd."WorkerFirstName",
    wpd."WorkerLastName"
FROM
    public.claimsawardedregistrarreview AS carr
JOIN
    public.form1112master AS f1112 ON carr."IRN" = f1112."IRN"
JOIN
    public.workerpersonaldetails AS wpd ON f1112."WorkerID" = wpd."WorkerID";
