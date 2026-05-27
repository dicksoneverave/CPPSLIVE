-- Create view for worker compensation details
CREATE OR REPLACE VIEW ClaimCompensationWorkerDetails AS
SELECT
  cpm."IRN",
  cpm."WorkerID",
  wpd."WorkerFirstName",
  wpd."WorkerLastName",
  wpd."WorkerDOB",
  cpm."AnnualWage",
  cpm."CompensationAmount",
  cpm."MedicalExpenses",
  cpm."MiscExpenses",
  cpm."Deductions",
  cpm."DeductionsNotes"
FROM "claimcompensationmaster" cpm
JOIN "workerpersonaldetails" wpd ON cpm."WorkerID" = wpd."WorkerID";
