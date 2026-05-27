-- Create view for personal compensation details
CREATE OR REPLACE VIEW ClaimCompensationPersonalDetails AS
SELECT
  ccd."IRN",
  ccd."CCDPersonFirstName",
  ccd."CCDPersonLastName",
  ccd."CCDPersonDOB",
  ccd."CCDRelationToWorker",
  ccd."CCDDegreeOfDependance",
  ccd."CCDCompensationAmount"
FROM "claimcompensationdependents" ccd;
