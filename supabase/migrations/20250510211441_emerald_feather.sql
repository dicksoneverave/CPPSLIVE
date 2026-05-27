/*
  # Fix date formatting in all views
  
  1. Changes
    - Update all views to consistently format dates using to_char with 'DD-MM-YYYY' format
    - Ensures consistent date display across the application
    - Prevents JavaScript date parsing issues
    
  2. Views Updated
    - prescreening_pending_view
    - prescreening_onhold_view
    - prescreening_resubmitted_view
    - prescreening_approved_view
    - chief_commissioner_pending_view
    - chief_commissioner_approved_view
    - commissioner_pending_view
    - commissioner_approved_view
    - registrar_pending_view
    - registrar_approved_view
    - registrar_rejected_view
    - pending_awarded_claims_registrar_view
    - approved_awarded_claims_registrar_view
    - timebarred_pending_view
*/

-- Update prescreening_pending_view
DROP VIEW IF EXISTS prescreening_pending_view;
CREATE OR REPLACE VIEW prescreening_pending_view AS
SELECT
  pc."IRN",
  fm."DisplayIRN",
  to_char(pc."PRSubmissionDate", 'DD-MM-YYYY') AS "SubmissionDate",
  pc."PRFormType",
  pc."PRID",
  wpd."WorkerFirstName",
  wpd."WorkerLastName"
FROM "prescreeningreview" pc
JOIN "form1112master" fm ON pc."IRN" = fm."IRN"
JOIN "workerpersonaldetails" wpd ON fm."WorkerID" = wpd."WorkerID"
WHERE pc."PRStatus" = 'Pending';

-- Update prescreening_onhold_view
DROP VIEW IF EXISTS prescreening_onhold_view;
CREATE OR REPLACE VIEW prescreening_onhold_view AS
SELECT
  pc."IRN",
  fm."DisplayIRN",
  to_char(pc."PRSubmissionDate", 'DD-MM-YYYY') AS "SubmissionDate",
  pc."PRFormType",
  pc."PRID",
  wpd."WorkerFirstName",
  wpd."WorkerLastName"
FROM "prescreeningreview" pc
JOIN "form1112master" fm ON pc."IRN" = fm."IRN"
JOIN "workerpersonaldetails" wpd ON fm."WorkerID" = wpd."WorkerID"
WHERE pc."PRStatus" = 'OnHold';

-- Update prescreening_resubmitted_view
DROP VIEW IF EXISTS prescreening_resubmitted_view;
CREATE OR REPLACE VIEW prescreening_resubmitted_view AS
SELECT
  pc."IRN",
  fm."DisplayIRN",
  to_char(pc."PRSubmissionDate", 'DD-MM-YYYY') AS "SubmissionDate",
  pc."PRFormType",
  pc."PRID",
  wpd."WorkerFirstName",
  wpd."WorkerLastName"
FROM "prescreeningreview" pc
JOIN "form1112master" fm ON pc."IRN" = fm."IRN"
JOIN "workerpersonaldetails" wpd ON fm."WorkerID" = wpd."WorkerID"
WHERE pc."PRStatus" = 'Resubmitted';

-- Update prescreening_approved_view
DROP VIEW IF EXISTS prescreening_approved_view;
CREATE OR REPLACE VIEW prescreening_approved_view AS
SELECT
  pc."IRN",
  fm."DisplayIRN",
  to_char(pc."PRSubmissionDate", 'DD-MM-YYYY') AS "SubmissionDate",
  pc."PRFormType",
  pc."PRID",
  wpd."WorkerFirstName",
  wpd."WorkerLastName"
FROM "prescreeningreview" pc
JOIN "form1112master" fm ON pc."IRN" = fm."IRN"
JOIN "workerpersonaldetails" wpd ON fm."WorkerID" = wpd."WorkerID"
WHERE pc."PRStatus" = 'Approved';

-- Update chief_commissioner_pending_view
DROP VIEW IF EXISTS chief_commissioner_pending_view;
CREATE OR REPLACE VIEW chief_commissioner_pending_view AS
SELECT
  cacr."IRN",
  fm."DisplayIRN",
  to_char(cacr."CACRSubmissionDate", 'DD-MM-YYYY') AS "SubmissionDate",
  cacr."IncidentType",
  cacr."CACRID",
  wpd."WorkerFirstName",
  wpd."WorkerLastName"
FROM "claimsawardedcommissionersreview" cacr
JOIN "form1112master" fm ON cacr."IRN" = fm."IRN"
JOIN "workerpersonaldetails" wpd ON fm."WorkerID" = wpd."WorkerID"
WHERE cacr."CACRReviewStatus" = 'ChiefCommissionerReviewPending';

-- Update chief_commissioner_approved_view
DROP VIEW IF EXISTS chief_commissioner_approved_view;
CREATE OR REPLACE VIEW chief_commissioner_approved_view AS
SELECT
  cacr."IRN",
  fm."DisplayIRN",
  to_char(cacr."CACRSubmissionDate", 'DD-MM-YYYY') AS "SubmissionDate",
  cacr."IncidentType",
  cacr."CACRID",
  wpd."WorkerFirstName",
  wpd."WorkerLastName"
FROM "claimsawardedcommissionersreview" cacr
JOIN "form1112master" fm ON cacr."IRN" = fm."IRN"
JOIN "workerpersonaldetails" wpd ON fm."WorkerID" = wpd."WorkerID"
WHERE cacr."CACRReviewStatus" = 'ChiefCommissionerAccepted';

-- Update commissioner_pending_view
DROP VIEW IF EXISTS commissioner_pending_view;
CREATE OR REPLACE VIEW commissioner_pending_view AS
SELECT
  cacr."IRN",
  fm."DisplayIRN",
  to_char(cacr."CACRSubmissionDate", 'DD-MM-YYYY') AS "SubmissionDate",
  cacr."IncidentType",
  cacr."CACRID",
  wpd."WorkerFirstName",
  wpd."WorkerLastName"
FROM "claimsawardedcommissionersreview" cacr
JOIN "form1112master" fm ON cacr."IRN" = fm."IRN"
JOIN "workerpersonaldetails" wpd ON fm."WorkerID" = wpd."WorkerID"
WHERE cacr."CACRReviewStatus" IN ('CommissionerReviewPending', 'ChiefCommissionerReviewPending');

-- Update commissioner_approved_view
DROP VIEW IF EXISTS commissioner_approved_view;
CREATE OR REPLACE VIEW commissioner_approved_view AS
SELECT
  cacr."IRN",
  fm."DisplayIRN",
  to_char(cacr."CACRSubmissionDate", 'DD-MM-YYYY') AS "SubmissionDate",
  cacr."IncidentType",
  cacr."CACRID",
  wpd."WorkerFirstName",
  wpd."WorkerLastName"
FROM "claimsawardedcommissionersreview" cacr
JOIN "form1112master" fm ON cacr."IRN" = fm."IRN"
JOIN "workerpersonaldetails" wpd ON fm."WorkerID" = wpd."WorkerID"
WHERE cacr."CACRReviewStatus" IN ('CommissionerAccepted', 'ChiefCommissionerAccepted');

-- Update registrar_pending_view
DROP VIEW IF EXISTS registrar_pending_view;
CREATE OR REPLACE VIEW registrar_pending_view AS
SELECT
  rr."IRN",
  fm."DisplayIRN",
  to_char(rr."RRSubmissionDate", 'DD-MM-YYYY') AS "SubmissionDate",
  rr."IncidentType",
  rr."RRID",
  rr."RRStatus",
  wpd."WorkerFirstName",
  wpd."WorkerLastName"
FROM "registrarreview" rr
JOIN "form1112master" fm ON rr."IRN" = fm."IRN"
JOIN "workerpersonaldetails" wpd ON fm."WorkerID" = wpd."WorkerID"
WHERE rr."RRStatus" != 'Approved';

-- Update registrar_approved_view
DROP VIEW IF EXISTS registrar_approved_view;
CREATE OR REPLACE VIEW registrar_approved_view AS
SELECT
  rr."IRN",
  fm."DisplayIRN",
  to_char(rr."RRSubmissionDate", 'DD-MM-YYYY') AS "SubmissionDate",
  rr."IncidentType",
  rr."RRID",
  rr."RRStatus",
  wpd."WorkerFirstName",
  wpd."WorkerLastName"
FROM "registrarreview" rr
JOIN "form1112master" fm ON rr."IRN" = fm."IRN"
JOIN "workerpersonaldetails" wpd ON fm."WorkerID" = wpd."WorkerID"
WHERE rr."RRStatus" = 'Approved';

-- Update registrar_rejected_view
DROP VIEW IF EXISTS registrar_rejected_view;
CREATE OR REPLACE VIEW registrar_rejected_view AS
SELECT
  rr."IRN",
  fm."DisplayIRN",
  to_char(rr."RRSubmissionDate", 'DD-MM-YYYY') AS "SubmissionDate",
  rr."IncidentType",
  rr."RRID",
  rr."RRStatus",
  wpd."WorkerFirstName",
  wpd."WorkerLastName"
FROM "registrarreview" rr
JOIN "form1112master" fm ON rr."IRN" = fm."IRN"
JOIN "workerpersonaldetails" wpd ON fm."WorkerID" = wpd."WorkerID"
WHERE rr."RRStatus" = 'Rejected';

-- Update pending_awarded_claims_registrar_view
DROP VIEW IF EXISTS pending_awarded_claims_registrar_view;
CREATE OR REPLACE VIEW pending_awarded_claims_registrar_view AS
SELECT
  carr."IRN",
  fm."DisplayIRN",
  to_char(carr."CARRSubmissionDate", 'DD-MM-YYYY') AS "SubmissionDate",
  carr."IncidentType",
  carr."CARRID",
  wpd."WorkerFirstName",
  wpd."WorkerLastName"
FROM "claimsawardedregistrarreview" carr
JOIN "form1112master" fm ON carr."IRN" = fm."IRN"
JOIN "workerpersonaldetails" wpd ON fm."WorkerID" = wpd."WorkerID"
WHERE carr."CARRReviewStatus" = 'RegistrarReviewPending';

-- Update approved_awarded_claims_registrar_view
DROP VIEW IF EXISTS approved_awarded_claims_registrar_view;
CREATE OR REPLACE VIEW approved_awarded_claims_registrar_view AS
SELECT
  carr."IRN",
  fm."DisplayIRN",
  to_char(carr."CARRSubmissionDate", 'DD-MM-YYYY') AS "SubmissionDate",
  carr."IncidentType",
  carr."CARRID",
  carr."CARRReviewStatus",
  wpd."WorkerFirstName",
  wpd."WorkerLastName"
FROM "claimsawardedregistrarreview" carr
JOIN "form1112master" fm ON carr."IRN" = fm."IRN"
JOIN "workerpersonaldetails" wpd ON fm."WorkerID" = wpd."WorkerID"
WHERE carr."CARRReviewStatus" = 'RegistrarAccepted';

-- Update timebarred_pending_view
DROP VIEW IF EXISTS timebarred_pending_view;
CREATE OR REPLACE VIEW timebarred_pending_view AS
SELECT
  tbcrr."IRN",
  fm."DisplayIRN",
  to_char(tbcrr."TBCRRSubmissionDate", 'DD-MM-YYYY') AS "SubmissionDate",
  tbcrr."TBCRRFormType",
  tbcrr."TBCRRID",
  tbcrr."TBCRRReviewStatus",
  wpd."WorkerFirstName",
  wpd."WorkerLastName"
FROM "timebarredclaimsregistrarreview" tbcrr
JOIN "form1112master" fm ON tbcrr."IRN" = fm."IRN"
JOIN "workerpersonaldetails" wpd ON fm."WorkerID" = wpd."WorkerID"
WHERE tbcrr."TBCRRReviewStatus" = 'Pending';
