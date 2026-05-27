-- Create view for injury case checklist
CREATE OR REPLACE VIEW InjuryCaseCheckList AS
SELECT
  iccl."IRN",
  iccl."ICCLCriteria",
  iccl."ICCLFactor",
  iccl."ICCLDoctorPercentage",
  iccl."ICCLCompensationAmount"
FROM "injurycasechecklist" iccl;
