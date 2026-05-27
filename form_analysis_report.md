# Form Analysis Report - CPPS 2026

## forms folder: `C:\CPPS PROJECT FILES - LIVE\CPPS UPDATING AREA\CPPS2026\src\components\forms`

---

### 110cpoclaimreviewform.tsx
1.  **Tables and fields fetched**:
    - `owcstaffmaster`: `OSMStaffID`, `OSMFirstName`, `OSMLastName`
    - `form1112master`: `IRN`, `DisplayIRN`, `WorkerID`, `IncidentType`, `IncidentRegion`
    - `workerpersonaldetails`: `*`
    - `timebarredclaimsregistrarreview`: `IRN`, `TBCRRFormType`, `TBCRRReviewStatus`, `TBCRRDecisionReason`, `TBCRRDecisionDate`
    - `prescreening_view`: `*`
    - `registrarreview`: `IRN`, `IncidentType`, `RRStatus`, `RRDecisionReason`, `RRDecisionDate`
    - `approvedclaimscporeview`: `IRN`, `IncidentType`, `CPORStatus`, `LockedByCPOID`, `CPORSubmissionDate`
    - `compensationcalculationreview`: `IRN`, `IncidentType`, `CCRReviewStatus`, `CCRDecisionReason`, `CCRSubmissionDate`
    - `compensationcalculationcommissionersreview`: `IRN`, `IncidentType`, `CCCRReviewStatus`, `CCCRDecisionReason`, `CCCRSubmissionDate`
    - `compensationcalculationcpmreview`: `IRN`, `IncidentType`, `CPMRStatus`, `CPMRDecisionReason`, `CPMRSubmissionDate`
    - `form6master`: `IRN`, `IncidentType`, `F6MStatus`, `F6MApprovalDate`
    - `form18master`: `IRN`, `IncidentType`, `F18MStatus`, `F18MEmployerDecisionReason`, `F18MWorkerDecisionReason`, `F18MEmployerAcceptedDate`, `F18MWorkerAcceptedDate`
    - `claimsawardedcommissionersreview`: `IRN`, `IncidentType`, `CACRReviewStatus`, `CACRDecisionReason`, `CACRSubmissionDate`
    - `claimsawardedregistrarreview`: `IRN`, `IncidentType`, `CARRReviewStatus`, `CARRDecisionReason`, `CARRSubmissionDate`
2.  **Table and fields saved to**:
    - `approvedclaimscporeview`: `LockedByCPOID` (update), `IRN`, `LockedByCPOID`, `CPORStatus`, `IncidentType` (insert)
3.  **Forms called/triggered**:
    - `Form113View` (embedded)
    - `CompensationCalculation` (embedded)
4.  **Reports, utils, pdfs, prints called**:
    - None

---

### 111cpoclaimreviewform.tsx
1.  **Tables and fields fetched**:
    - `owcstaffmaster`: `OSMStaffID`, `OSMFirstName`, `OSMLastName`
    - `form1112master`: `IRN`, `DisplayIRN`, `WorkerID`, `IncidentDate`, `IncidentType`, `IncidentLocation`, `IncidentProvince`, `IncidentRegion`, `NatureExtentInjury`, `InjuryCause`, `HandInjury`, `InsuranceProviderIPACode`
    - `workerpersonaldetails`: `*`
    - `timebarredclaimsregistrarreview`: `IRN`, `TBCRRFormType`, `TBCRRReviewStatus`, `TBCRRDecisionReason`, `TBCRRDecisionDate`
    - `prescreening_view`: `*`
    - `registrarreview`: `IRN`, `IncidentType`, `RRStatus`, `RRDecisionReason`, `RRDecisionDate`
    - `approvedclaimscporeview`: `IRN`, `IncidentType`, `CPORStatus`, `LockedByCPOID`, `CPORSubmissionDate`
    - `compensationcalculationreview`: `IRN`, `IncidentType`, `CCRReviewStatus`, `CCRDecisionReason`, `CCRSubmissionDate`
    - `compensationcalculationcommissionersreview`: `IRN`, `IncidentType`, `CCCRReviewStatus`, `CCCRDecisionReason`, `CCCRSubmissionDate`
    - `compensationcalculationcpmreview`: `IRN`, `IncidentType`, `CPMRStatus`, `CPMRDecisionReason`, `CPMRSubmissionDate`
    - `form6master`: `IRN`, `IncidentType`, `F6MStatus`, `F6MApprovalDate`
    - `form18master`: `IRN`, `IncidentType`, `F18MStatus`, `F18MEmployerDecisionReason`, `F18MWorkerDecisionReason`, `F18MEmployerAcceptedDate`, `F18MWorkerAcceptedDate`
    - `claimsawardedcommissionersreview`: `IRN`, `IncidentType`, `CACRReviewStatus`, `CACRDecisionReason`, `CACRSubmissionDate`
    - `claimsawardedregistrarreview`: `IRN`, `IncidentType`, `CARRReviewStatus`, `CARRDecisionReason`, `CARRSubmissionDate`
2.  **Table and fields saved to**:
    - `approvedclaimscporeview`: `LockedByCPOID` (update), `IRN`, `LockedByCPOID`, `CPORStatus`, `IncidentType` (insert)
3.  **Forms called/triggered**:
    - `Form124View` (embedded)
    - `CompensationCalculation` (embedded)
4.  **Reports, utils, pdfs, prints called**:
    - None

---

### 133CPOForm18InjuryEmployerResponseReview.tsx
1.  **Tables and fields fetched**:
    - `form18master`: `*`, `DisplayIRN`
2.  **Table and fields saved to**:
    - `form18master`: `F18MStatus`, `F18MWorkerNotifiedDate` (update)
3.  **Forms called/triggered**:
    - `ViewForm18`
    - `Form113View`
    - `ListClaimDecisions`
    - `CompensationBreakupDetailsView`
4.  **Reports, utils, pdfs, prints called**:
    - `downloadForm18CPO` (from `../../utils/form18CPO_jspdf`)

---

### 139NotificationEmployerResponsePendingDeath.tsx
1.  **Tables and fields fetched**:
    - `form1112master`: `*`, `WorkerID`
    - `workerpersonaldetails`: `*`
    - `form6master`: `*`
2.  **Table and fields saved to**:
    - None
3.  **Forms called/triggered**:
    - `ViewForm6`
    - `Form124View`
    - `ListClaimDecisions`
    - `CompensationBreakupDetailsView`
4.  **Reports, utils, pdfs, prints called**:
    - `generateForm6CPO_jsPDF_byIRN` (from `../../utils/form6CPO_jspdf`)

---

### 140NotificationEmployerResponsePendingInjury.tsx
1.  **Tables and fields fetched**:
    - `form1112master`: `*`, `WorkerID`
    - `workerpersonaldetails`: `*`
    - `form6master`: `*`
2.  **Table and fields saved to**:
    - None
3.  **Forms called/triggered**:
    - `Form113View`
    - `ListClaimDecisions`
    - `CompensationBreakupDetailsView`
    - `ViewForm6`
4.  **Reports, utils, pdfs, prints called**:
    - `generateForm6CPO_jsPDF_byIRN` (from `../../utils/form6CPO_jspdf`)

---

### 142CPOForm18InjuryWorkerResponseView.tsx
1.  **Tables and fields fetched**:
    - `form18master`: `*`, `DisplayIRN`
2.  **Table and fields saved to**:
    - None
3.  **Forms called/triggered**:
    - `ViewForm18`
    - `Form113View`
    - `ListClaimDecisions`
    - `CompensationBreakupDetailsView`
4.  **Reports, utils, pdfs, prints called**:
    - None

---

### 168DecisionChiefCommissionerReviewDeath.tsx
1.  **Tables and fields fetched**:
    - `owcstaffmaster`: `OSMStaffID`, `OSMFirstName`, `OSMLastName`
    - `claimsawardedcommissionersreview`: `LockedByID`, `ClaimType`, `IncidentType`
    - `claimsawardedregistrarreview`: `IRN`
2.  **Table and fields saved to**:
    - `claimsawardedcommissionersreview`: `LockedByID` (update), `CACRReviewStatus`, `CACRDecisionDate`, `CACRDecisionReason` (update)
    - `claimsawardedregistrarreview`: `CARRReviewStatus`, `CARRSubmissionDate`, `ClaimType`, `IncidentType` (update/insert)
3.  **Forms called/triggered**:
    - `Form124View`
    - `ListClaimDecisions`
    - `CompensationBreakupDetailsView`
4.  **Reports, utils, pdfs, prints called**:
    - `downloadConsentOfAwardDeath` (from `../../utils/ConsentOfAward-Death`)

---

### 169DecisionChiefCommissionerReviewInjury.tsx
1.  **Tables and fields fetched**:
    - `owcstaffmaster`: `OSMStaffID`, `OSMFirstName`, `OSMLastName`
    - `claimsawardedcommissionersreview`: `LockedByID`, `ClaimType`, `IncidentType`
    - `claimsawardedregistrarreview`: `IRN`
2.  **Table and fields saved to**:
    - `claimsawardedcommissionersreview`: `LockedByID` (update), `CACRReviewStatus`, `CACRDecisionDate`, `CACRDecisionReason` (update)
    - `claimsawardedregistrarreview`: `CARRReviewStatus`, `CARRSubmissionDate`, `ClaimType`, `IncidentType` (update/insert)
3.  **Forms called/triggered**:
    - `Form113View`
    - `ListClaimDecisions`
    - `CompensationBreakupDetailsView`
4.  **Reports, utils, pdfs, prints called**:
    - `downloadConsentOfAwardInjury` (from `../../utils/ConsentOfAward-Injury`)

---

### 213CPOForm18DeathEmployerResponseReview.tsx
1.  **Tables and fields fetched**:
    - `form18master`: `*`, `DisplayIRN`
2.  **Table and fields saved to**:
    - `form18master`: `F18MStatus`, `F18MWorkerNotifiedDate` (update)
3.  **Forms called/triggered**:
    - `ViewForm18`
    - `Form124View`
    - `ListClaimDecisions`
    - `CompensationBreakupDetailsView`
4.  **Reports, utils, pdfs, prints called**:
    - `downloadForm18CPO` (from `../../utils/form18CPO_jspdf`)

---

### 224DecisionChiefCommissionerApprovedInjury.tsx
1. **Tables and fields fetched**:
    - `owcstaffmaster`: `OSMStaffID`, `OSMFirstName`, `OSMLastName`
    - `claimsawardedcommissionersreview`: `LockedByID`, `ClaimType`, `IncidentType`
    - `claimsawardedregistrarreview`: `IRN`
2. **Table and fields saved to**:
    - `claimsawardedcommissionersreview`: `LockedByID` (update), `CACRReviewStatus`, `CACRDecisionDate`, `CACRDecisionReason` (update)
    - `claimsawardedregistrarreview`: `CARRReviewStatus`, `CARRSubmissionDate`, `ClaimType`, `IncidentType` (update/insert)
3. **Forms called/triggered**:
    - `Form113View`
    - `ListClaimDecisions`
    - `CompensationBreakupDetailsView`
4. **Reports, utils, pdfs, prints called**:
    - `downloadConsentOfAwardInjury` (from `../../utils/ConsentOfAward-Injury`)
    - `form6CPO_jspdf` (dynamic import)
    - `form18CPO_jspdf` (dynamic import)

---

### 225DecisionChiefCommissionerApprovedDeath.tsx
1. **Tables and fields fetched**:
    - `owcstaffmaster`: `OSMStaffID`, `OSMFirstName`, `OSMLastName`
    - `claimsawardedcommissionersreview`: `LockedByID`, `ClaimType`, `IncidentType`
    - `claimsawardedregistrarreview`: `IRN`
2. **Table and fields saved to**:
    - `claimsawardedcommissionersreview`: `LockedByID` (update), `CACRReviewStatus`, `CACRDecisionDate`, `CACRDecisionReason` (update)
    - `claimsawardedregistrarreview`: `CARRReviewStatus`, `CARRSubmissionDate`, `ClaimType`, `IncidentType` (update/insert)
3. **Forms called/triggered**:
    - `Form124View`
    - `ListClaimDecisions`
    - `CompensationBreakupDetailsView`
4. **Reports, utils, pdfs, prints called**:
    - `downloadConsentOfAwardDeath` (from `../../utils/ConsentOfAward-Death`)
    - `form6CPO_jspdf` (dynamic import)
    - `form18CPO_jspdf` (dynamic import)

---

### 238HearingForm11SubmissionPrivate.tsx
1. **Tables and fields fetched**:
    - `owcstaffmaster`: `OSMFirstName`, `OSMLastName`
    - `form1112master`: `*`, `WorkerID`
    - `workerpersonaldetails`: `*`
    - `currentemploymentdetails`: `EmployerCPPSID`
2. **Table and fields saved to**:
    - `tribunalhearingoutcome`: `THODecision`, `THOReason`, `THODOA`, `THOClaimant`, `THOActionOfficer`, `THOProposedAmount`, `THOConfirmedAmount`, `THOHearingStatus` (update)
    - `tribunalhearingschedule`: `THSSetForHearing` (update)
    - `approvedclaimscporeview`: `CPORStatus`, `CPORSubmissionDate`, `LockedByCPOID` (update)
    - `form18master`: `IRN`, `EmployerCPPSID`, `IncidentType`, `F18MStatus`, `F18MEmployerAcceptedDate`, `F18MEmployerDecisionReason` (insert)
    - `timebarredclaimsregistrarreview`: `TBCRRReviewStatus`, `TBCRRDecisionDate`, `TBCRRDecisionReason` (update)
3. **Forms called/triggered**:
    - `Form113View`
    - `ListClaimDecisions`
    - `CompensationBreakupDetailsView`
    - `DocumentStatus`
4. **Reports, utils, pdfs, prints called**:
    - None

---

### 238HearingForm11SubmissionPublic.tsx
1. **Tables and fields fetched**:
    - `owcstaffmaster`: `OSMFirstName`, `OSMLastName`
    - `form1112master`: `*`, `WorkerID`
    - `workerpersonaldetails`: `*`
    - `currentemploymentdetails`: `EmployerCPPSID`
2. **Table and fields saved to**:
    - `tribunalhearingoutcome`: `THODecision`, `THOReason`, `THODOA`, `THOClaimant`, `THOActionOfficer`, `THOProposedAmount`, `THOConfirmedAmount`, `THOHearingStatus` (update)
    - `tribunalhearingschedule`: `THSSetForHearing` (update)
    - `approvedclaimscporeview`: `CPORStatus`, `CPORSubmissionDate`, `LockedByCPOID` (update)
    - `form18master`: `IRN`, `EmployerCPPSID`, `IncidentType`, `F18MStatus`, `F18MEmployerAcceptedDate`, `F18MEmployerDecisionReason` (insert)
    - `timebarredclaimsregistrarreview`: `TBCRRReviewStatus`, `TBCRRDecisionDate`, `TBCRRDecisionReason` (update)
3. **Forms called/triggered**:
    - `Form113View`
    - `ListClaimDecisions`
    - `CompensationBreakupDetailsView`
    - `DocumentStatus`
4. **Reports, utils, pdfs, prints called**:
    - None

---

### 238HearingPendingForm11Submission.tsx
1. **Tables and fields fetched**:
    - `form1112master`: `*`, `WorkerID`, `NatureExtentInjury`, `IncidentRegion`, `DisplayIRN`
    - `workerpersonaldetails`: `*`
    - `currentemploymentdetails`: `*`, `EmployerCPPSID`
    - `employermaster`: `*`, `OrganizationName`, `Address1`, `City`, `Province`
    - `tribunalhearingsethearing`: `*` (where `THSHID` is IRN)
2. **Table and fields saved to**:
    - `tribunalhearingschedule`: `THSSetForHearing`, `THSHearingStatus` (update)
    - `tribunalhearingoutcome`: `THOIRN`, `THORegion`, `THONatureOfAccident`, `THOEmployer` (insert)
3. **Forms called/triggered**:
    - `Form113View`
    - `ListClaimDecisions`
    - `CompensationBreakupDetailsView`
    - `DocumentStatus`
4. **Reports, utils, pdfs, prints called**:
    - `jsPDF` (inline PDF generation for Form 8)

---

### 239HearingForm12SubmissionPrivate.tsx
1. **Tables and fields fetched**:
    - `owcstaffmaster`: `OSMFirstName`, `OSMLastName`
    - `form1112master`: `*`, `WorkerID`
    - `workerpersonaldetails`: `*`
2. **Table and fields saved to**:
    - `tribunalhearingoutcome`: `THODecision`, `THOReason`, `THODOA`, `THOClaimant`, `THOActionOfficer`, `THOProposedAmount`, `THOConfirmedAmount`, `THOHearingStatus` (update)
    - `tribunalhearingschedule`: `THSSetForHearing` (update)
    - `approvedclaimscporeview`: `CPORStatus`, `CPORSubmissionDate`, `LockedByCPOID` (update)
    - `form18master`: `IRN`, `EmployerCPPSID`, `IncidentType`, `F18MStatus`, `F18MEmployerAcceptedDate`, `F18MEmployerDecisionReason` (insert)
    - `timebarredclaimsregistrarreview`: `TBCRRReviewStatus`, `TBCRRDecisionDate`, `TBCRRDecisionReason` (update)
3. **Forms called/triggered**:
    - `Form124View`
    - `ListClaimDecisions`
    - `CompensationBreakupDetailsView`
    - `DocumentStatus`
4. **Reports, utils, pdfs, prints called**:
    - None

---

### 239HearingForm12SubmissionPublic.tsx
1. **Tables and fields fetched**:
    - `owcstaffmaster`: `OSMFirstName`, `OSMLastName`
    - `form1112master`: `*`, `WorkerID`
    - `workerpersonaldetails`: `*`
2. **Table and fields saved to**:
    - `tribunalhearingoutcome`: `THODecision`, `THOReason`, `THODOA`, `THOClaimant`, `THOActionOfficer`, `THOProposedAmount`, `THOConfirmedAmount`, `THOHearingStatus` (update)
    - `tribunalhearingschedule`: `THSSetForHearing` (update)
    - `approvedclaimscporeview`: `CPORStatus`, `CPORSubmissionDate`, `LockedByCPOID` (update)
    - `form18master`: `IRN`, `EmployerCPPSID`, `IncidentType`, `F18MStatus`, `F18MEmployerAcceptedDate`, `F18MEmployerDecisionReason` (insert)
    - `timebarredclaimsregistrarreview`: `TBCRRReviewStatus`, `TBCRRDecisionDate`, `TBCRRDecisionReason` (update)
3. **Forms called/triggered**:
    - `Form124View`
    - `ListClaimDecisions`
    - `CompensationBreakupDetailsView`
    - `DocumentStatus`
4. **Reports, utils, pdfs, prints called**:
    - None

---

### 239HearingPendngForm12Submission.tsx
1. **Tables and fields fetched**:
    - `form1112master`: `*`, `WorkerID`, `NatureExtentInjury`, `IncidentRegion`, `DisplayIRN`
    - `workerpersonaldetails`: `*`
    - `currentemploymentdetails`: `*`, `EmployerCPPSID`
    - `employermaster`: `*`, `OrganizationName`, `Address1`, `City`, `Province`
    - `tribunalhearingsethearing`: `*` (where `THSHID` is IRN)
2. **Table and fields saved to**:
    - `tribunalhearingschedule`: `THSSetForHearing`, `THSHearingStatus` (update)
    - `tribunalhearingoutcome`: `THOIRN`, `THORegion`, `THONatureOfAccident`, `THOEmployer` (insert)
3. **Forms called/triggered**:
    - `Form124View`
    - `ListClaimDecisions`
    - `CompensationBreakupDetailsView`
    - `DocumentStatus`
4. **Reports, utils, pdfs, prints called**:
    - `jsPDF` (inline PDF generation for Form 8)

---

### 244EmployerRejectNotificationDeath.tsx
1. **Tables and fields fetched**:
    - `form1112master`: `*`, `WorkerID`, `DisplayIRN`
    - `workerpersonaldetails`: `*`
    - `form7master`: `*`
2. **Table and fields saved to**:
    - None
3. **Forms called/triggered**:
    - `ViewForm7`
    - `Form124View`
    - `ListClaimDecisions`
    - `CompensationBreakupDetailsView`
4. **Reports, utils, pdfs, prints called**:
    - `downloadForm7CPO` (from `../../utils/form7CPO_jspdf`)

---

### 246Form17Death.tsx
1. **Tables and fields fetched**:
    - `form1112master`: `DisplayIRN`
2. **Table and fields saved to**:
    - None
3. **Forms called/triggered**:
    - `Form124View`
    - `ListClaimDecisions`
    - `CompensationBreakupDetailsView`
4. **Reports, utils, pdfs, prints called**:
    - None

---

### 247Form17Injury.tsx
1. **Tables and fields fetched**:
    - `form1112master`: `DisplayIRN`
2. **Table and fields saved to**:
    - None
3. **Forms called/triggered**:
    - `Form113View`
    - `ListClaimDecisions`
    - `CompensationBreakupDetailsView`
4. **Reports, utils, pdfs, prints called**:
    - None

---

### 253HearingForm7SubmissionPrivate.tsx
1. **Tables and fields fetched**:
    - `owcstaffmaster`: `OSMFirstName`, `OSMLastName`
    - `form1112master`: `*`, `WorkerID`
    - `workerpersonaldetails`: `*`
    - `form7master`: `*`
    - `currentemploymentdetails`: `EmployerCPPSID`
2. **Table and fields saved to**:
    - `tribunalhearingoutcome`: `THODecision`, `THOReason`, `THODOA`, `THOClaimant`, `THOActionOfficer`, `THOProposedAmount`, `THOConfirmedAmount`, `THOHearingStatus` (update)
    - `tribunalhearingschedule`: `THSSetForHearing` (update)
    - `approvedclaimscporeview`: `CPORStatus`, `CPORSubmissionDate`, `LockedByCPOID` (update)
    - `form18master`: `IRN`, `EmployerCPPSID`, `IncidentType`, `F18MStatus`, `F18MEmployerAcceptedDate`, `F18MEmployerDecisionReason` (insert)
3. **Forms called/triggered**:
    - `ViewForm7`
    - `Form113View`
    - `ListClaimDecisions`
    - `CompensationBreakupDetailsView`
    - `DocumentStatus`
4. **Reports, utils, pdfs, prints called**:
    - None

---

### 253HearingForm7SubmissionPublic.tsx
1. **Tables and fields fetched**:
    - `owcstaffmaster`: `OSMFirstName`, `OSMLastName`
    - `form1112master`: `*`, `WorkerID`
    - `workerpersonaldetails`: `*`
    - `form7master`: `*`
    - `currentemploymentdetails`: `EmployerCPPSID`
2. **Table and fields saved to**:
    - `tribunalhearingoutcome`: `THODecision`, `THOReason`, `THODOA`, `THOClaimant`, `THOActionOfficer`, `THOProposedAmount`, `THOConfirmedAmount`, `THOHearingStatus` (update)
    - `tribunalhearingschedule`: `THSSetForHearing` (update)
    - `approvedclaimscporeview`: `CPORStatus`, `CPORSubmissionDate`, `LockedByCPOID` (update)
    - `form18master`: `IRN`, `EmployerCPPSID`, `IncidentType`, `F18MStatus`, `F18MEmployerAcceptedDate`, `F18MEmployerDecisionReason` (insert)
3. **Forms called/triggered**:
    - `ViewForm7`
    - `Form113View`
    - `ListClaimDecisions`
    - `CompensationBreakupDetailsView`
    - `DocumentStatus`
4. **Reports, utils, pdfs, prints called**:
    - None

---

### 253HearingPendingForm7Submission.tsx
1. **Tables and fields fetched**:
    - `form1112master`: `*`, `WorkerID`, `NatureExtentInjury`, `IncidentRegion`
    - `workerpersonaldetails`: `*`
    - `currentemploymentdetails`: `*`, `EmployerCPPSID`
    - `employermaster`: `*`, `OrganizationName`
    - `form7master`: `*`
2. **Table and fields saved to**:
    - `tribunalhearingschedule`: `THSSetForHearing`, `THSHearingStatus` (update)
    - `tribunalhearingoutcome`: `THOIRN`, `THORegion`, `THONatureOfAccident`, `THOEmployer` (insert)
3. **Forms called/triggered**:
    - `ViewForm7`
    - `Form113View`
    - `ListClaimDecisions`
    - `CompensationBreakupDetailsView`
    - `DocumentStatus`
4. **Reports, utils, pdfs, prints called**:
    - None

---

### 322ApprovedCompensationCalculationCPMReviewDeath.tsx
1. **Tables and fields fetched**:
    - `workerirn`: `DisplayIRN`
2. **Table and fields saved to**:
    - None
3. **Forms called/triggered**:
    - `Form113View`
    - `ListClaimDecisions`
    - `CompensationBreakupDetailsView`
4. **Reports, utils, pdfs, prints called**:
    - `form6CPO_jspdf` (dynamic import)

---

### 322RejectedCompensationCalculationCPMReviewDeath.tsx
1. **Tables and fields fetched**:
    - `workerirn`: `DisplayIRN`
2. **Table and fields saved to**:
    - None
3. **Forms called/triggered**:
    - `Form113View`
    - `ListClaimDecisions`
    - `CompensationBreakupDetailsView`
4. **Reports, utils, pdfs, prints called**:
    - None

---

### 323ApprovedCompensationCalculationCPMReviewInjury.tsx
1. **Tables and fields fetched**:
    - `workerirn`: `DisplayIRN`
2. **Table and fields saved to**:
    - None
3. **Forms called/triggered**:
    - `Form113View`
    - `ListClaimDecisions`
    - `CompensationBreakupDetailsView`
4. **Reports, utils, pdfs, prints called**:
    - `form6CPO_jspdf` (dynamic import)

---

### 323RejectedCompensationCalculationCPMReviewInjury.tsx
1. **Tables and fields fetched**:
    - `workerirn`: `DisplayIRN`
2. **Table and fields saved to**:
    - None
3. **Forms called/triggered**:
    - `Form113View`
    - `ListClaimDecisions`
    - `CompensationBreakupDetailsView`
4. **Reports, utils, pdfs, prints called**:
    - None

---

### 324PendingCompensationCalculationCPMReviewDeath.tsx
1. **Tables and fields fetched**:
    - `workerirn`: `DisplayIRN`, `WorkerID`
    - `currentemploymentdetails`: `EmployerCPPSID`
    - `form6master`: `F6MID`
2. **Table and fields saved to**:
    - `compensationcalculationcpmreview`: `CPMRStatus`, `CPMRDecisionDate`, `CPMRDecisionReason` (update)
    - `form6master`: `IRN`, `IncidentType`, `F6MStatus`, `F6MApprovalDate`, `EmployerCPPSID`, `CPOInCharge` (upsert)
    - `approvedclaimscporeview`: `CPORStatus` (update to 'CompensationReCalculate' if 'ReCheck')
3. **Forms called/triggered**:
    - `Form113View`
    - `ListClaimDecisions`
    - `CompensationBreakupDetailsView`
4. **Reports, utils, pdfs, prints called**:
    - `form6CPO_jspdf` (dynamic import)

---

### 328PendingCompensationCalculationCPMReviewInjury.tsx
1. **Tables and fields fetched**:
    - `workerirn`: `DisplayIRN`, `WorkerID`
    - `currentemploymentdetails`: `EmployerCPPSID`
    - `form6master`: `F6MID`
2. **Table and fields saved to**:
    - `compensationcalculationcpmreview`: `CPMRStatus`, `CPMRDecisionDate`, `CPMRDecisionReason` (update)
    - `form6master`: `IRN`, `IncidentType`, `F6MStatus`, `F6MApprovalDate`, `EmployerCPPSID` (upsert)
    - `approvedclaimscporeview`: `CPORStatus` (update to 'CompensationReCalculate' if 'ReCheck')
3. **Forms called/triggered**:
    - `Form113View`
    - `ListClaimDecisions`
    - `CompensationBreakupDetailsView`
4. **Reports, utils, pdfs, prints called**:
    - `form6CPO_jspdf` (dynamic import)

---

### OnHoldClaimsAwardedForPaymentsManagerReview.tsx
1. **Tables and fields fetched**:
   - `owcstaffmaster`: `OSMStaffID`
   - `insurancecompanymaster`: `*`
   - `bankaccountdepositmaster`: `*`
   - `claimcompensationworkerdetails`: `CCWDCompensationAmount`, `CCWDMedicalExpenses`, `CCWDMiscExpenses`, `CCWDDeductions`
2. **Table and fields saved to**:
   - `claimsawardedpaymentsectionreview`: `CAPSRReviewStatus`, `CAPSRReviewDate`, `CAPSRNotes` (update)
   - `bankaccountdepositmaster`: `PaymentManagerReviewStatus` (update)
3. **Forms called/triggered**:
   - `Form113View`, `Form124View`, `ListClaimDecisions`, `CompensationBreakupDetailsView`
4. **Reports, utils, pdfs, prints called**:
   - `downloadConsentOfAwardInjury`, `downloadConsentOfAwardDeath`
   - `generateCertificateOfAward`, `generateCertificateOfClaimAward`
   - `printChecklistForPayment`, `printBankConfirmationLetter`, `printForm6`, `printForm18`

---

### OnHoldClaimsAwardedForPaymentsSectionReview.tsx
1. **Tables and fields fetched**:
   - `owcstaffmaster`: `OSMStaffID`
   - `insurancecompanymaster`: `*`
   - `owcbankaccountmaster`: `OBANBankName`, `OBANBankAccountNumber`
   - `claimcompensationworkerdetails`: `CCWDCompensationAmount`, `CCWDMedicalExpenses`, `CCWDMiscExpenses`, `CCWDDeductions`
   - `workerirn`: `WorkerID`
   - `currentemploymentdetails`: `EmployerCPPSID`
   - `employermaster`: `OrganizationName`, `InsuranceProviderIPACode`
   - `bankaccountdepositmaster`: `*`
2. **Table and fields saved to**:
   - `bankaccountdepositmaster`: `IRN`, `Employer`, `Drawer`, `BankName`, `DrawerAccountNumber`, `PaymentTypeMethod`, `EbankReferenceNo`, `OWCAccountNumber`, `AwardedAmount`, `InterestAmount`, `FinalPaymentAmount`, `EbankAmountPaid`, `EbankIssuedDate`, `PaymentDetails`, `WorkerBankName`, `WorkerAccountNumber`, `WorkerBSBBranchNo` (upsert)
3. **Forms called/triggered**:
   - `Form113View`, `Form124View`, `ListClaimDecisions`, `CompensationBreakupDetailsView`
4. **Reports, utils, pdfs, prints called**:
   - `downloadConsentOfAwardInjury`, `downloadConsentOfAwardDeath`
   - `generateCertificateOfAward`, `generateCertificateOfClaimAward`, `printChecklistForPayment`, `printBankConfirmationLetter`

---

### PendingAwardedClaimsForRegistrarReview.tsx
1. **Tables and fields fetched**:
   - `owcstaffmaster`: `OSMStaffID`, `OSMFirstName`, `OSMLastName`
   - `claimsawardedregistrarreview`: `IRN`
   - `claimsawardedcommissionersreview`: `CACRReviewStatus`, `ClaimType`
2. **Table and fields saved to**:
   - `claimsawardedregistrarreview`: `CARRReviewStatus`, `CARRDecisionDate`, `CARRDecisionReason` (update)
   - `claimsawardedpaymentsectionreview`: `IRN`, `CAPSRReviewStatus`, `CAPSRSubmissionDate`, `ClaimType`, `IncidentType` (insert)
3. **Forms called/triggered**:
   - `Form113View`, `Form124View`, `ListClaimDecisions`, `CompensationBreakupDetailsView`
4. **Reports, utils, pdfs, prints called**:
   - `downloadConsentOfAwardInjury`, `downloadConsentOfAwardDeath`
   - `generateCertificateOfAward`, `generateCertificateOfClaimAward`, `printChecklistForPayment`, `printBankConfirmationLetter`, `printForm6`, `printForm18`

---

### PendingClaimsAwardedForPaymentSectionReview.tsx
1. **Tables and fields fetched**:
   - `owcstaffmaster`: `OSMStaffID`
   - `insurancecompanymaster`: `*`
   - `owcbankaccountmaster`: `OBANBankName`, `OBANBankAccountNumber`
   - `claimcompensationworkerdetails`: `CCWDCompensationAmount`, `CCWDMedicalExpenses`, `CCWDMiscExpenses`, `CCWDDeductions`
   - `workerirn`: `WorkerID`
   - `currentemploymentdetails`: `EmployerCPPSID`
   - `employermaster`: `OrganizationName`, `InsuranceProviderIPACode`
   - `workerpersonaldetails`: `WorkerFirstName`, `WorkerLastName`, `SpouseFirstName`, `SpouseLastName`
   - `dependantpersonaldetails`: `DependantID`, `DependantFirstName`, `DependantLastName`
2. **Table and fields saved to**:
   - `claimsawardedpaymentsectionreview`: `CAPSRReviewStatus`, `CAPSRReviewDate`, `CAPSRNotes` (update)
   - `bankaccountdepositmaster`: `IRN`, `AwardedAmount`, `InterestAmount`, `FinalPaymentAmount`, `EbankAmountPaid`, `EbankIssuedDate`, `WorkerBankName`, `WorkerBSBBranchNo`, `WorkerAccountNumber`, `PaymentDetails`, `BankName`, `DrawerAccountNumber`, `PaymentTypeMethod`, `EbankReferenceNo`, `Drawer`, `OWCAccountNumber`, `Employer`, `PaymentManagerReviewStatus`, `BatchNo`, `Recipients`, `OWCInvestmentAccountNumber` (insert)
3. **Forms called/triggered**:
   - `Form113View`, `Form124View`, `ListClaimDecisions`, `CompensationBreakupDetailsView`
4. **Reports, utils, pdfs, prints called**:
   - `downloadConsentOfAwardInjury`, `downloadConsentOfAwardDeath`, `generateCertificateOfAward`, `generateCertificateOfClaimAward`, `printChecklistForPayment`, `printBankConfirmationLetter`

---

### PendingClaimsAwardedForPaymentsManagerReview.tsx
1. **Tables and fields fetched**:
   - `bankaccountdepositmaster`: `*`
2. **Table and fields saved to**:
   - `claimsawardedpaymentsectionreview`: `CAPSRReviewStatus`, `CAPSRReviewDate`, `CAPSRNotes` (update)
   - `bankaccountdepositmaster`: `PaymentManagerReviewStatus` (update)
3. **Forms called/triggered**:
   - `Form113View`, `Form124View`, `ListClaimDecisions`, `CompensationBreakupDetailsView`
4. **Reports, utils, pdfs, prints called**:
   - `downloadConsentOfAwardInjury`, `downloadConsentOfAwardDeath`, `generateCertificateOfAward`

---

### PendingForm18WorkerResponseToNotification.tsx
1. **Tables and fields fetched**:
   - `form1112master`: `*`, `WorkerID`
   - `workerpersonaldetails`: `*`
   - `form18master`: `*`, `EmployerCPPSID`
   - `employermaster`: `OrganizationType`
2. **Table and fields saved to**:
   - `claimsawardedcommissionersreview`: `IRN`, `ClaimType`, `CACRReviewStatus`, `CACRSubmissionDate`, `IncidentType` (insert)
   - `form18master`: `F18MStatus`, `F18MWorkerAcceptedDate`, `F18MWorkerDecisionReason` (update)
   - `form17master`: `IRN`, `IncidentType`, `F17MStatus`, `F17MWorkerRejectedDate`, `F17MWorkerDecisionReason` (insert)
   - `tribunalhearingschedule`: `IRN`, `THSSubmissionDate`, `THSSetForHearing`, `THSHearingStatus`, `THSHearingType`, `THSOrganizationType` (insert)
3. **Forms called/triggered**:
   - `Form113View`, `Form124View`, `ViewForm18`, `ListClaimDecisions`, `CompensationBreakupDetailsView`
4. **Reports, utils, pdfs, prints called**:
   - None

---

### PendingForm6ForInsuranceProviderReview.tsx
1. **Tables and fields fetched**:
   - `form1112master`: `*`, `WorkerID`
   - `workerpersonaldetails`: `*`
   - `form6master`: `*`
   - `workerirn`: `WorkerID`
   - `currentemploymentdetails`: `EmployerCPPSID`
   - `employermaster`: `OrganizationType`
2. **Table and fields saved to**:
   - `form18master`: `EmployerCPPSID`, `IRN`, `IncidentType`, `F18MStatus`, `F18MEmployerAcceptedDate`, `F18MEmployerDecisionReason` (insert)
   - `form6master`: `F6MStatus`, `F6MApprovalDate` (update)
   - `approvedclaimscporeview`: `CPORStatus`, `CPORSubmissionDate` (update)
   - `form7master`: `EmployerCPPSID`, `IRN`, `IncidentType`, `F7MStatus`, `F7MEmployerRejectedDate`, `F7MEmployerDecisionReason` (insert)
   - `tribunalhearingschedule`: `IRN`, `THSSubmissionDate`, `THSSetForHearing`, `THSHearingStatus`, `THSHearingType`, `THSOrganizationType` (insert)
3. **Forms called/triggered**:
   - `Form113View`, `Form124View`, `ListClaimDecisions`, `CompensationBreakupDetailsView`, `ViewForm6`
4. **Reports, utils, pdfs, prints called**:
   - `printForm6` (from `form6CPO_jspdf`)

---

### PendingForm6ForStateSolicitorReview.tsx
1. **Tables and fields fetched**:
   - `form1112master`: `*`, `WorkerID`
   - `workerpersonaldetails`: `*`
   - `form6master`: `*`
2. **Table and fields saved to**:
   - None (View only)
3. **Forms called/triggered**:
   - `Form113View`, `Form124View`, `ListClaimDecisions`, `CompensationBreakupDetailsView`, `ViewForm6`
4. **Reports, utils, pdfs, prints called**:
   - `printForm6` (from `form6CPO_jspdf`)

---

### PendingRegisteredClaimsRegistrarReview.tsx
1. **Tables and fields fetched**:
   - `form1112master`: `DisplayIRN`
2. **Table and fields saved to**:
   - None (View only)
3. **Forms called/triggered**:
   - `Form113View`, `Form124View`, `ListClaimDecisions`
4. **Reports, utils, pdfs, prints called**:
   - None

---

### PendingTimebarredFormSubmissionRegistrarReview.tsx
1. **Tables and fields fetched**:
   - `workerirn`: `DisplayIRN`, `WorkerID`
   - `currentemploymentdetails`: `*`
2. **Table and fields saved to**:
   - `timebarredclaimsregistrarreview`: `TBCRRReviewStatus`, `TBCRRDecisionDate`, `TBCRRDecisionReason` (update)
   - `tribunalhearingschedule`: `IRN`, `THSHearingStatus`, `THSHearingType`, `THSSubmissionDate`, `THSWorkerOrganizatiosType` (upsert)
3. **Forms called/triggered**:
   - `ViewForm11`, `ViewForm12`
4. **Reports, utils, pdfs, prints called**:
   - None

---

### ProcessPaymentsForClaimsAwardedPaymentSection.tsx
1. **Tables and fields fetched**:
   - `approved_awarded_claims_paymentsmanagerreview_view`: `*`
   - `bankaccountdepositmaster`: `BADMID`, `IRN`, `EbankAmountPaid`, `OWCAccountNumber`, `PaymentDetails`, `BatchNo`, `WorkerBankName`, `WorkerBSBBranchNo`, `WorkerAccountNumber`, `Recipients`
2. **Table and fields saved to**:
   - `claimsawardedpaymentsectionreview`: `CAPSRReviewStatus`, `CAPSRNotes` (update)
   - `bankaccountdepositmaster`: `PaymentManagerReviewStatus`, `BatchNo` (update)
   - `BankReconciliation`: `OWCBankAccountNumber`, `Date`, `Description`, `Debit` (insert)
3. **Forms called/triggered**:
   - None
4. **Reports, utils, pdfs, prints called**:
   - `printApprovedPaymentsListNoBatch`, `printClaimsPaidBatchWithBatchNo`
   - `generateABAFile`

---

### ApprovedAwardedClaimsForRegistrarReview.tsx
1. **Tables and fields fetched**:
   - `owcstaffmaster`: `OSMStaffID`
   - `claimsawardedregistrarreview`: `IRN`
   - `claimsawardedcommissionersreview`: `CACRReviewStatus`
2. **Table and fields saved to**:
   - None (View/Print only)
3. **Forms called/triggered**:
   - `Form113View`, `Form124View`, `ListClaimDecisions`, `CompensationBreakupDetailsView`
4. **Reports, utils, pdfs, prints called**:
   - `downloadConsentOfAwardInjury`, `downloadConsentOfAwardDeath`, `generateCertificateOfAward`, `generateCertificateOfClaimAward`, `printChecklistForPayment`, `printBankConfirmationLetter`, `printForm6`, `printForm18`

---

### 214CPOForm18DeathWorkerResponseView.tsx
1. **Tables and fields fetched**:
   - `form18master`: `*`
2. **Table and fields saved to**:
   - None
3. **Forms called/triggered**:
   - `ViewForm18`, `Form124View`, `ListClaimDecisions`, `CompensationBreakupDetailsView`
4. **Reports, utils, pdfs, prints called**:
   - None

---

### 245EmployerRejectNotificationInjury.tsx
1. **Tables and fields fetched**:
   - `form1112master`: `*`, `WorkerID`
   - `workerpersonaldetails`: `*`
   - `form7master`: `*`
2. **Table and fields saved to**:
   - None
3. **Forms called/triggered**:
   - `ViewForm7`, `Form113View`, `ListClaimDecisions`, `CompensationBreakupDetailsView`
4. **Reports, utils, pdfs, prints called**:
   - `downloadForm7CPO`

---

### ApprovedClaimsAwardedForPaymentsManagerReview.tsx
1. **Tables and fields fetched**:
   - `bankaccountdepositmaster`: `*`
2. **Table and fields saved to**:
   - None (View/Print only)
3. **Forms called/triggered**:
   - `Form113View`, `Form124View`, `ListClaimDecisions`, `CompensationBreakupDetailsView`
4. **Reports, utils, pdfs, prints called**:
   - `downloadConsentOfAwardInjury`, `downloadConsentOfAwardDeath`, `generateCertificateOfAward`, `generateCertificateOfClaimAward`, `printChecklistForPayment`, `printBankConfirmationLetter`, `printForm6`, `printForm18`

---

### ApprovedClaimsAwardedForPaymentsSectionReview.tsx
1. **Tables and fields fetched**:
   - `bankaccountdepositmaster`: `*`
2. **Table and fields saved to**:
   - None (View/Print only)
3. **Forms called/triggered**:
   - `Form113View`, `Form124View`, `ListClaimDecisions`, `CompensationBreakupDetailsView`
4. **Reports, utils, pdfs, prints called**:
   - `downloadConsentOfAwardInjury`, `downloadConsentOfAwardDeath`, `generateCertificateOfAward`, `generateCertificateOfClaimAward`, `printChecklistForPayment`, `printBankConfirmationLetter`, `printForm6`, `printForm18`

---

### ApprovedForm6ForInsuranceProviderReview.tsx
1. **Tables and fields fetched**:
   - `form6master`: `*`
2. **Table and fields saved to**:
   - None
3. **Forms called/triggered**:
   - `ViewForm6`, `Form113View`, `Form124View`, `ListClaimDecisions`, `CompensationBreakupDetailsView`
4. **Reports, utils, pdfs, prints called**:
   - `printForm6`

---

### ApprovedRegisteredClaimsRegistrarReview.tsx
1. **Tables and fields fetched**:
   - `workerirn`: `DisplayIRN`
2. **Table and fields saved to**:
   - None
3. **Forms called/triggered**:
   - `Form113View`, `Form124View`, `ListClaimDecisions`
4. **Reports, utils, pdfs, prints called**:
   - None

---

### ApprovedTimebarredFormSubmissionRegistrarReview.tsx
1. **Tables and fields fetched**:
   - `workerirn`: `DisplayIRN`
2. **Table and fields saved to**:
   - None
3. **Forms called/triggered**:
   - `ViewForm11`, `ViewForm12`
4. **Reports, utils, pdfs, prints called**:
   - None

---

### BankReconciliation.tsx
1. **Tables and fields fetched**:
   - `BankReconciliation`: `*`
2. **Table and fields saved to**:
   - `BankReconciliation`: `Status`, `Balance` (update)
3. **Forms called/triggered**:
   - None
4. **Reports, utils, pdfs, prints called**:
   - None

---

### certificateofaward.tsx
1. **Tables and fields fetched**:
   - `form18master`: `*`
2. **Table and fields saved to**:
   - None (View only, uses `sessionStorage`)
3. **Forms called/triggered**:
   - None
4. **Reports, utils, pdfs, prints called**:
   - `window.open` to `/reports/certificate-of-award`

---

### CompensationBreakupDetailsView.tsx
1. **Tables and fields fetched**:
   - `workerirn`: `DisplayIRN`
   - `form1112master`: `IncidentType`, `IncidentDate`, `WorkerID`
   - `claimcompensationworkerdetails`: `*`
   - `compensationcalculationreview`: `CCRStatus`
2. **Table and fields saved to**:
   - None (View only)
3. **Forms called/triggered**:
   - None
4. **Reports, utils, pdfs, prints called**:
   - None

---

### CompensationCalculation.tsx
1. **Tables and fields fetched**:
   - `form1112master`: `IRN`, `DisplayIRN`, `WorkerID`, `IncidentType`, `IncidentDate`, `IncidentRegion`
   - `workerpersonaldetails`: `*`
   - `currentemploymentdetails`: `*`
   - `compensationcalculationreview`: `*`
2. **Table and fields saved to**:
   - `compensationcalculationreview`: `CCRStatus`, `CCRSubmissionDate`, `CCRDecisionReason` (upsert)
3. **Forms called/triggered**:
   - None
4. **Reports, utils, pdfs, prints called**:
   - None

---

### deathcaseattachments.tsx
1. **Tables and fields fetched**:
   - `formattachments`: `AttachmentType`, `FileName`
2. **Table and fields saved to**:
   - `formattachments`: `IRN`, `AttachmentType`, `FileName` (upsert)
3. **Forms called/triggered**:
   - None
4. **Reports, utils, pdfs, prints called**:
   - `supabase.storage` for uploads

---

### DecisionAwardedClaimRegistrarReview.tsx
1. **Tables and fields fetched**:
   - `claimsawardedregistrarreview`: `*`
2. **Table and fields saved to**:
   - `claimsawardedregistrarreview`: `update` (`status`, `decision_reason`, `status_history`)
   - `claimsawardedpaymentsectionreview`: `insert` (if status is 'Accepted')
3. **Forms called/triggered**:
   - None
4. **Reports, utils, pdfs, prints called**:
   - `pdf-lib` for generating PDFs inline (`generatePDF`)

---

### DecisionCommissionerReview.tsx
1. **Tables and fields fetched**:
   - `claimsawardedcommissionersreview`: `*`
2. **Table and fields saved to**:
   - `claimsawardedcommissionersreview`: `update` (`action_taken`, `decision_reason`, `status_history`)
   - `claimsawardedregistrarreview`: `insert` (if status is 'Accepted')
3. **Forms called/triggered**:
   - None
4. **Reports, utils, pdfs, prints called**:
   - `pdf-lib` for generating PDFs inline (`generatePDF`)

---

### DecisionRegisteredClaimRegistrarReview.tsx
1. **Tables and fields fetched**:
   - `registrar_reviews`: `*`
   - `cpor_records`: `id` (count check)
2. **Table and fields saved to**:
   - `registrar_reviews`: `update` (`status`, `decision_reason`, `status_history`)
   - `cpo_reviews`: `insert` (if status is 'Approved')
3. **Forms called/triggered**:
   - None
4. **Reports, utils, pdfs, prints called**:
   - `pdf-lib` for generating PDFs inline (`generatePDF`)

---

### DecisionTimeBarredFormSubmissionRegistrarReview.tsx
1. **Tables and fields fetched**:
   - `timebarredclaimsregistrarreview`: `*`
   - `cpor_records`: `id` (count check)
2. **Table and fields saved to**:
   - `timebarredclaimsregistrarreview`: `update` (`status`, `decision_reason`, `status_history`)
   - `cpo_reviews`: `insert` (if status is 'Approved')
3. **Forms called/triggered**:
   - None
4. **Reports, utils, pdfs, prints called**:
   - `pdf-lib` for generating PDFs inline (`generatePDF`)

---

### EditForm3.tsx
1. **Tables and fields fetched**:
   - `workerirn`: `WorkerID`, `FirstName`, `LastName`, `DisplayIRN`
   - `form3master`: `*`
   - `form1112master`: `TimeBarred`, `IncidentDate`, `IncidentLocation`, `IncidentProvince`, `IncidentRegion`, `NatureExtentInjury`, `InjuryCause`, `InsuranceProviderIPACode`, `ImageName`, `PublicUrl`
   - `workerpersonaldetails`: `*`
   - `currentemploymentdetails`: `*`
   - `dictionary`: `DKey`, `DValue` (where `DType` is 'Province')
   - `dependantpersonaldetails`: `*`, `DependantID`
   - `workhistory`: `*`, `WorkHistoryID`
   - `formattachments`: `AttachmentType`, `FileName`
   - `insurancecompanymaster`: `*`
2. **Table and fields saved to**:
   - `form1112master`: `update`
   - `formattachments`: `upsert`
   - `workerpersonaldetails`: `update`
   - `form3master`: `upsert`
   - `dependantpersonaldetails`: `delete`, `insert`, `update`
   - `workhistory`: `delete`, `insert`, `update`
3. **Forms called/triggered**:
   - None
4. **Reports, utils, pdfs, prints called**:
   - `supabase.storage` for uploads/previews

---

### EditForm4.tsx
1. **Tables and fields fetched**:
   - `workerirn`: `WorkerID`, `FirstName`, `LastName`, `DisplayIRN`
   - `form4master`: `*`
   - `form1112master`: `TimeBarred`, `IncidentDate`, `IncidentLocation`, `IncidentProvince`, `IncidentRegion`, `NatureExtentInjury`, `InjuryCause`, `InsuranceProviderIPACode`, `ImageName`, `PublicUrl`
   - `workerpersonaldetails`: `*`
   - `currentemploymentdetails`: `*`
   - `dictionary`: `DKey`, `DValue` (where `DType` is 'Province')
   - `dependantpersonaldetails`: `*`, `DependantID`
   - `workhistory`: `*`, `WorkHistoryID`
   - `insurancecompanymaster`: `*`
2. **Table and fields saved to**:
   - `form1112master`: `update`
   - `formattachments`: `upsert`
   - `workerpersonaldetails`: `update`
   - `form4master`: `upsert`
   - `dependantpersonaldetails`: `delete`, `insert`, `update`
   - `workhistory`: `delete`, `insert`, `update`
3. **Forms called/triggered**:
   - None
4. **Reports, utils, pdfs, prints called**:
   - `supabase.storage` for uploads/previews

---

### DecisionCompensationCalculationCPMReview.tsx
1. **Tables and fields fetched**:
   - `form1112master`: `*` (where `claim_id` matches)
   - `compensationcalculationcpmreview`: `is_processed`
   - `currentemploymentdetails`: `*`
2. **Table and fields saved to**:
   - `compensationcalculationcpmreview`: `update` (`action_taken`, `decision_reason`, `status_history`, `is_processed`)
   - `approvedclaimscporeview`: `update` (`status`, `approval_date`, `recheck_reason`, `recheck_date`)
3. **Forms called/triggered**:
   - None
4. **Reports, utils, pdfs, prints called**:
   - `generateForm6PDF` (Internal utility using `pdf-lib`)

---

### DecisionForm6NotificationEmployerReview.tsx
1. **Tables and fields fetched**:
   - `form1112master`: `*`
   - `form6notificationemployerreview`: `is_processed`
   - `currentemploymentdetails`: `*`
2. **Table and fields saved to**:
   - `form6master`: `update` (`status`)
   - `form18master`: `insert` (`claim_id`, `status`, `submission_date`)
   - `form7master`: `insert` (`claim_id`, `rejection_type`, `rejection_reason`, `submission_date`, `dispute_type`)
   - `tribunal_hearings`: `insert` (`claim_id`, `dispute_type`, `status`, `submission_date`)
   - `form6notificationemployerreview`: `update` (`action_taken`, `decision_reason`, `status_history`, `is_processed`)
3. **Forms called/triggered**:
   - None
4. **Reports, utils, pdfs, prints called**:
   - `generateForm18PDF`
   - `generateForm7PDF`

---

### DecisionForm6NotificationInsuranceProviderReview.tsx
1. **Tables and fields fetched**:
   - `form1112master`: `*`
   - `form6notificationinsuranceproviderreview`: `is_processed`
   - `currentemploymentdetails`: `*`
2. **Table and fields saved to**:
   - `form6master`: `update` (`status`)
   - `form18master`: `insert` (`claim_id`, `status`, `submission_date`)
   - `form7master`: `insert` (`claim_id`, `rejection_type`, `rejection_reason`, `submission_date`, `dispute_type`)
   - `tribunal_hearings`: `insert` (`claim_id`, `dispute_type`, `status`, `submission_date`)
   - `form6notificationinsuranceproviderreview`: `update` (`action_taken`, `decision_reason`, `status_history`, `is_processed`)
3. **Forms called/triggered**:
   - None
4. **Reports, utils, pdfs, prints called**:
   - `generateForm18PDF`
   - `generateForm7PDF`

---

### DecisionForm18WorkerReview.tsx
1. **Tables and fields fetched**:
   - `form18master`: `*`
   - `form1112master`: `worker_first_name`, `worker_last_name`
   - `currentemploymentdetails`: `employer_name`, `employer_address`
2. **Table and fields saved to**:
   - `form18master`: `update` (`status`, `is_processed`, `updated_at`)
   - `claimsawardedcommissionersreview`: `insert` (`claim_id`, `status`, `submission_date`)
   - `form17master`: `insert` (`claim_id`, `rejection_reason`, `submission_date`)
3. **Forms called/triggered**:
   - None
4. **Reports, utils, pdfs, prints called**:
   - None

---

### DecisionPrescreeningReview.tsx
1. **Tables and fields fetched**:
   - None (Simulated submission/Standalone form)
2. **Table and fields saved to**:
   - None (Simulated submission only)
3. **Forms called/triggered**:
   - None
4. **Reports, utils, pdfs, prints called**:
   - None

---

### deputyconfirmationlettercertificate.tsx
1. **Tables and fields fetched**:
   - `prescreening_reviews`: `*`
2. **Table and fields saved to**:
   - `localStorage`: `deputy_confirmation_data`, `deputy_confirmation_documents`
3. **Forms called/triggered**:
   - None
4. **Reports, utils, pdfs, prints called**:
   - `window.open` to `/reports/deputy-confirmation`

---

###### ListForm6NotificationEmployerResponsePending.tsx
- **Database Source**: `form6master` (F6MStatus='Pending'), `form1112master`, `workerpersonaldetails`.
- **Filtering Logic**: Search by DisplayIRN, WorkerFirstName, WorkerLastName. Regionalized by `IncidentRegion`.
- **Workflow Trigger**: Spawns `Form140NotificationEmployerResponsePendingInjury` or `Form139NotificationEmployerResponsePendingDeath`.

### ListForm7.tsx
- **Database Source**: `form7master`, `form1112master`, `workerpersonaldetails`.
- **Filtering Logic**: Search by DisplayIRN, WorkerFirstName, WorkerLastName.
- **Workflow Trigger**: Spawns `Form245EmployerRejectNotificationInjury` or `Form244EmployerRejectNotificationDeath`.

### ListForm17.tsx
- **Database Source**: `v_form17_joined` (IRN, DisplayIRN, WorkerFirstName, WorkerLastName, F17MWorkerRejectedDate, IncidentType, F17MID, F17MStatus).
- **Filtering Logic**: Search by DisplayIRN, WorkerFirstName, WorkerLastName.
- **Workflow Trigger**: Spawns `Form247Form17Injury` or `Form246Form17Death`.

### ListForm18EmployerAccepted.tsx
- **Database Source**: `v_form18_joined` (F18MStatus='EmployerAccepted'). Optional filter via `tribunalhearingoutcome`.
- **Filtering Logic**: Search by DisplayIRN, WorkerFirstName, WorkerLastName.
- **Workflow Trigger**: Spawns `Form133CPOForm18InjuryEmployerResponseReview` or `Form213CPOForm18DeathEmployerResponseReview`.

### ListForm18WorkerNotified.tsx
- **Database Source**: `v_form18_joined` (F18MStatus='NotifiedToWorker'), `form18master`.
- **Filtering Logic**: Search by DisplayIRN, WorkerFirstName, WorkerLastName.
- **Workflow Trigger**: Spawns `PendingForm18WorkerResponseToNotification`.

### ListForm18WorkerResponse.tsx
- **Database Source**: `v_form18_joined` (F18MStatus='WorkerAccepted'), `form18master`.
- **Filtering Logic**: Search by DisplayIRN, WorkerFirstName, WorkerLastName.
- **Workflow Trigger**: Spawns `Form142CPOForm18InjuryWorkerResponseView` or `Form214CPOForm18DeathWorkerResponseView`.

### EditEmployerRegistrationForm.tsx
- **Database Source**: `employermaster`, `employerinsurance`, `insurancecompanymaster`.
- **Filtering Logic**: Direct load by `employerId`.
- **Workflow Trigger**: Full profile updates and insurance provider management for employers.

### EditWorkerRegistrationForm.tsx
- **Database Source**: `workerpersonaldetails`, `workerbankdetails`, `currentemploymentdetails`, `workerirn`, `form1112master`.
- **Filtering Logic**: Direct load by `workerId`.
- **Workflow Trigger**: Updates core worker profile, employment history, and bank details.

### EditOWCStaffForm.tsx
- **Database Source**: `owcstaffmaster`, `profiles`.
- **Filtering Logic**: Direct load by `staffId`.
- **Workflow Trigger**: Manages staff roles, regional assignments, and system permissions.

### EditForm3.tsx / EditForm4.tsx / EditForm11.tsx / EditForm12.tsx
- **Database Source**: Respective form master and details tables.
- **Filtering Logic**: Load by `IRN`.
- **Workflow Trigger**: Administrative override/edit of submitted forms to correct metadata or calculation errors.

### EditSetTribunalHearing.tsx
- **Database Source**: `tribunalhearingschedule`, `tribunalhearingsethearing`.
- **Filtering Logic**: Load by `HearingNo`.
- **Workflow Trigger**: Updates hearing logistics including dates, venues, and Coram members.

### EmployerInsuranceListModal.tsx
- **Database Source**: `employermaster`, `insurancecompanymaster`.
- **Filtering Logic**: Search by Organization Name or CPPS ID.
- **Workflow Trigger**: Generates PDF Master Lists and Grouped Insurance Reports via `EmployerInsuranceList_jspdf`.

### InsuranceCompanyManager.tsx
- **Database Source**: `insurancecompanymaster`.
- **Filtering Logic**: CRUD operations for insurance providers.
- **Workflow Trigger**: Central management of all insurance company metadata used across the system.

### ForwardForm18ToWorker.tsx
- **Database Source**: `tribunalhearingoutcome`, `form1112master`.
- **Workflow Trigger**: Procedural component to transition a claim into the worker notification phase after a successful Tribunal Consent award.

### DocumentStatus.tsx
- **Database Source**: `form1112master`, `prescreeningreview`, `form3master`, `form4master`, `form1112detail`.
- **Filtering Logic**: Load by `IRN`.
- **Workflow Trigger**: Comprehensive claim lifecycle tracker showing progress from submission to final payment or rejection.

### Form113View.tsx / Form124View.tsx
- **Database Source**: Composite views for Form 11/12 and Form 3/4.
- **Workflow Trigger**: Read-only archival views of specific form submissions with full attachment access.

### EmployerSearchModal.tsx / WorkerSearchModal.tsx
- **Database Source**: `employermaster`, `workerpersonaldetails`.
- **Filtering Logic**: Real-time `ilike` search.
- **Workflow Trigger**: Utility modals for picking records during registration or claim association.

### GoToReportsButton.tsx
- **Workflow Trigger**: Navigational utility providing direct access to the `ReportingDashboard` from the administrative workspace.

---

### deputyconfirmationlettercertificateinjury.tsx
1. **Tables and fields fetched**:
   - `prescreening_reviews`: `*`
2. **Table and fields saved to**:
   - `localStorage`: `deputy_confirmation_data`, `deputy_confirmation_documents`
3. **Forms called/triggered**:
   - None
4. **Reports, utils, pdfs, prints called**:
   - `window.open` to `/reports/deputy-confirmation-injury`

---

### deputyregistrarapprovedlistconfirmletters.tsx
1. **Tables and fields fetched**:
   - `prescreening_reviews`: `*` (where `status` is 'Approved')
2. **Table and fields saved to**:
   - None
3. **Forms called/triggered**:
   - `deputyregistrarconfirmationletter.tsx` (embedded)
4. **Reports, utils, pdfs, prints called**:
   - None

---

### deputyregistrarconfirmationletter.tsx
1. **Tables and fields fetched**:
   - `prescreening_reviews`: `*`
2. **Table and fields saved to**:
   - `prescreening_reviews`: `update` (`confirmation_sent_date`, `status`)
3. **Forms called/triggered**:
   - None
4. **Reports, utils, pdfs, prints called**:
   - `generateConfirmationLetterPDF` (using `pdf-lib`)

---

### DocumentStatus.tsx
1. **Tables and fields fetched**:
   - `form1112master`: `DisplayIRN`
   - `formattachments`: `AttachmentType`, `FileName`
2. **Table and fields saved to**:
   - None
3. **Forms called/triggered**:
   - None
4. **Reports, utils, pdfs, prints called**:
   - `supabase.storage` for public URLs

---

### DRApprovedForm.tsx
1. **Tables and fields fetched**:
   - `form1112master`: `*`
   - `prescreening_reviews`: `*`
2. **Table and fields saved to**:
   - None (View only)
3. **Forms called/triggered**:
   - None
4. **Reports, utils, pdfs, prints called**:
   - None

---

### DROnHoldForm.tsx
1. **Tables and fields fetched**:
   - `form1112master`: `*`
   - `prescreening_reviews`: `*`
2. **Table and fields saved to**:
   - None (View only)
3. **Forms called/triggered**:
   - None
4. **Reports, utils, pdfs, prints called**:
   - None

---

### DRPendingForm.tsx
1. **Tables and fields fetched**:
   - `form1112master`: `*`
   - `prescreening_reviews`: `*`
2. **Table and fields saved to**:
   - `prescreening_reviews`: `update` (`status`, `decision_reason`)
3. **Forms called/triggered**:
   - None
4. **Reports, utils, pdfs, prints called**:
   - None

---

### EditEmployerRegistrationForm.tsx
1. **Tables and fields fetched**:
   - `employermaster`: `*`
   - `dictionary`: `DKey`, `DValue` (where `DType` is 'Province')
2. **Table and fields saved to**:
   - `employermaster`: `update`
3. **Forms called/triggered**:
   - None
4. **Reports, utils, pdfs, prints called**:
   - None

---

### EditForm11.tsx
1. **Tables and fields fetched**:
   - `workerirn`: `WorkerID`, `FirstName`, `LastName`, `DisplayIRN`
   - `form1112master`: `*`
   - `workerpersonaldetails`: `*`
   - `currentemploymentdetails`: `*`
   - `dictionary`: `DKey`, `DValue` (where `DType` is 'Province')
   - `dependantpersonaldetails`: `*`
   - `workhistory`: `*`
   - `formattachments`: `AttachmentType`, `FileName`
   - `insurancecompanymaster`: `*`
2. **Table and fields saved to**:
   - `form1112master`: `update`
   - `formattachments`: `upsert`
   - `workerpersonaldetails`: `update`
   - `dependantpersonaldetails`: `delete`, `insert`, `update`
   - `workhistory`: `delete`, `insert`, `update`
3. **Forms called/triggered**:
   - None
4. **Reports, utils, pdfs, prints called**:
   - `supabase.storage` for uploads/previews

---

### EditForm12.tsx
1. **Tables and fields fetched**:
   - `workerirn`: `WorkerID`, `FirstName`, `LastName`, `DisplayIRN`
   - `form1112master`: `*`
   - `workerpersonaldetails`: `*`
   - `currentemploymentdetails`: `*`
   - `dictionary`: `DKey`, `DValue` (where `DType` is 'Province')
   - `dependantpersonaldetails`: `*`
   - `workhistory`: `*`
   - `formattachments`: `AttachmentType`, `FileName`
   - `insurancecompanymaster`: `*`
2. **Table and fields saved to**:
   - `form1112master`: `update`
   - `formattachments`: `upsert`
   - `workerpersonaldetails`: `update`
   - `dependantpersonaldetails`: `delete`, `insert`, `update`
   - `workhistory`: `delete`, `insert`, `update`
3. **Forms called/triggered**:
   - None
4. **Reports, utils, pdfs, prints called**:
   - `supabase.storage` for uploads/previews

---

### EditOWCStaffForm.tsx
1. **Tables and fields fetched**:
   - `owcstaffmaster`: `*`
   - `users`: `email`
2. **Table and fields saved to**:
   - `owcstaffmaster`: `update`
   - `users`: `update` (`email`, `name`)
   - `profiles`: `update` (`email`, `full_name`)
3. **Forms called/triggered**:
   - None
4. **Reports, utils, pdfs, prints called**:
   - None

---

### EditSetTribunalHearing.tsx
1. **Tables and fields fetched**:
   - `tribunalhearingsethearing`: `*`
   - `tribunalhearingschedule`: `THSHearingStatus`
2. **Table and fields saved to**:
   - `tribunalhearingsethearing`: `update`
   - `tribunalhearingschedule`: `update` (`THSHearingStatus`)
3. **Forms called/triggered**:
   - None
4. **Reports, utils, pdfs, prints called**:
   - None

---

### EditWorkerRegistrationForm.tsx
1. **Tables and fields fetched**:
   - `workerpersonaldetails`: `*`
   - `workerirn`: `DisplayIRN`
   - `dictionary`: `DKey`, `DValue` (where `DType` is 'Province')
2. **Table and fields saved to**:
   - `workerpersonaldetails`: `update`
3. **Forms called/triggered**:
   - None
4. **Reports, utils, pdfs, prints called**:
   - `supabase.storage` for passport photo uploads

---

### EmployerInsuranceListModal.tsx
1. **Tables and fields fetched**:
   - `employermaster`: `EMID`, `CPPSID`, `OrganizationName`, `InsuranceProviderIPACode`
   - `insurancecompanymaster`: `IPACODE`, `InsuranceCompanyOrganizationName`
2. **Table and fields saved to**:
   - None
3. **Forms called/triggered**:
   - None
4. **Reports, utils, pdfs, prints called**:
   - `generateEmployerInsuranceListPDF`

---

### EmployerListModal.tsx
1. **Tables and fields fetched**:
   - `employermaster`: `*`
2. **Table and fields saved to**:
   - None
3. **Forms called/triggered**:
   - None
4. **Reports, utils, pdfs, prints called**:
   - None

---

### EmployerSearchModal.tsx
1. **Tables and fields fetched**:
   - `employermaster`: `*`
2. **Table and fields saved to**:
   - None
3. **Forms called/triggered**:
   - `EditEmployerRegistrationForm`
4. **Reports, utils, pdfs, prints called**:
   - None

---

### EmployerWorkerListModal.tsx
1. **Tables and fields fetched**:
   - `employermaster`: `EMID`, `CPPSID`, `OrganizationName`
   - `currentemploymentdetails`: `WorkerID`, `EmployerCPPSID`
   - `workerirn`: `WorkerID`, `DisplayIRN`
   - `workerpersonaldetails`: `*`
2. **Table and fields saved to**:
   - None
3. **Forms called/triggered**:
   - None
4. **Reports, utils, pdfs, prints called**:
   - `generateEmployerWorkerListPDF`
   - `generateMasterEmployerWorkerListPDF`

---

### Form113View.tsx
1. **Tables and fields fetched**:
   - `form3master`: `*`
   - `form1112master`: `*`
   - `workerpersonaldetails`: `*`
   - `currentemploymentdetails`: `*`
   - `dependantpersonaldetails`: `*`
   - `workhistory`: `*`
   - `insurancecompanymaster`: `*`
   - `formattachments`: `AttachmentType`, `FileName`
2. **Table and fields saved to**:
   - None
3. **Forms called/triggered**:
   - None
4. **Reports, utils, pdfs, prints called**:
   - `supabase.storage` for public URLs and signed URLs

---

### Form124View.tsx
1. **Tables and fields fetched**:
   - `form1112master`: `*`
   - `workerpersonaldetails`: `*`
   - `currentemploymentdetails`: `*`
   - `form4master`: `*`
   - `dependantpersonaldetails`: `*`
   - `workhistory`: `*`
   - `formattachments`: `AttachmentType`, `FileName`
   - `insurancecompanymaster`: `*`
   - `workerirn`: `DisplayIRN`, `FirstName`, `LastName`
2. **Table and fields saved to**:
   - None
3. **Forms called/triggered**:
   - None
4. **Reports, utils, pdfs, prints called**:
   - `supabase.storage` for public URLs and signed URLs

---

### ForwardForm18ToWorker.tsx
1. **Tables and fields fetched**:
   - `workerirn`: `WorkerID`
   - `workerpersonaldetails`: `*`
   - `currentemploymentdetails`: `EmployerCPPSID`
   - `employermaster`: `*`
2. **Table and fields saved to**:
   - `form18master`: `update` (`F18MStatus`, `F18MEmployerAcceptedDate`)
3. **Forms called/triggered**:
   - None
4. **Reports, utils, pdfs, prints called**:
   - None

---

### ForwardToTribunalTimebarredFormSubmissionRegistrarReview.tsx
1. **Tables and fields fetched**:
   - `form1112master`: `WorkerID`, `IncidentType`, `DisplayIRN`
2. **Table and fields saved to**:
   - None
3. **Forms called/triggered**:
   - `ViewForm11`
   - `ViewForm12`
4. **Reports, utils, pdfs, prints called**:
   - None

---

### GoToReportsButton.tsx
1. **Tables and fields fetched**:
   - None
2. **Table and fields saved to**:
   - None
3. **Forms called/triggered**:
   - Navigates to `/reports`
4. **Reports, utils, pdfs, prints called**:
   - None

---

### InsuranceCompanyManager.tsx
1. **Tables and fields fetched**:
   - `insurancecompanymaster`: `*`
   - `users`: `id`
2. **Table and fields saved to**:
   - `users`: `insert`/`update`/`delete`
   - `profiles`: `insert`/`update`/`delete`
   - `insurancecompanymaster`: `insert`/`update`/`delete`
3. **Forms called/triggered**:
   - None
4. **Reports, utils, pdfs, prints called**:
   - `bcryptjs` for hashing passwords

---

### InsuranceProviderListModal.tsx
1. **Tables and fields fetched**:
   - `insurancecompanymaster`: `*`
2. **Table and fields saved to**:
   - None
3. **Forms called/triggered**:
   - None
4. **Reports, utils, pdfs, prints called**:
   - None

---

### ListApprovedAwardedClaimsForRegistrarReview.tsx
1. **Tables and fields fetched**:
   - `approved_awarded_claims_registrar_view`: `*`
2. **Table and fields saved to**:
   - None
3. **Forms called/triggered**:
   - `ApprovedAwardedClaimsForRegistrarReview`
4. **Reports, utils, pdfs, prints called**:
   - None

---

### ListApprovedClaimsAwardedPaymentSectionReview.tsx
1. **Tables and fields fetched**:
   - `approved_awarded_claims_paymentsmanagerreview_view`: `*`
2. **Table and fields saved to**:
   - None
3. **Forms called/triggered**:
   - `ApprovedClaimsAwardedForPaymentsSectionReview`
4. **Reports, utils, pdfs, prints called**:
   - None

---

### ListApprovedClaimsAwardedPaymentsManagerReview.tsx
1. **Tables and fields fetched**:
   - `approved_awarded_claims_paymentsmanagerreview_view`: `*`
2. **Table and fields saved to**:
   - None
3. **Forms called/triggered**:
   - `ApprovedClaimsAwardedForPaymentsManagerReview`
4. **Reports, utils, pdfs, prints called**:
   - None

---

### ListApprovedClaimsForChiefCommissionerReview.tsx
- **Database Source**: `chief_commissioner_approved_view`, `owcstaffmaster`, `claimsawardedcommissionersreview` (Locks).
- **Filtering Logic**: Search by DisplayIRN, WorkerFirstName, WorkerLastName.
- **Workflow Trigger**: Spawns `Decision224ChiefCommissionerApprovedInjury` or `Decision225ChiefCommissionerApprovedDeath`.

### ListApprovedClaimsForCommissionerReview.tsx
- **Database Source**: `commissioner_approved_view`, `owcstaffmaster`, `claimsawardedcommissionersreview`.
- **Filtering Logic**: Search by DisplayIRN, WorkerFirstName, WorkerLastName.
- **Workflow Trigger**: Spawns `Decision226CommissionerApprovedInjury` or `Decision227CommissionerApprovedDeath`.

### ListApprovedCompensationCalculationCPmReview.tsx
- **Database Source**: `v_approved_compensation_cpm_review`.
- **Workflow Trigger**: Administrative review of approved compensation calculations before final payroll/payment processing.

### ListApprovedForm6ForInsuranceProviderReview.tsx
- **Database Source**: `v_form6_approved_insurance`.
- **Workflow Trigger**: Spawns review interface for Insurance Providers to acknowledge or query approved Form 6 submissions.

### ListApprovedRegisteredClaimsRegistrarReview.tsx
- **Database Source**: `v_approved_registered_claims_registrar`.
- **Workflow Trigger**: Spawns `DeputyRegistrarConfirmationLetter` or `DeputyConfirmationLetterCertificate`.

### ListApprovedTimeBarredFormsRegistrarReview.tsx
- **Database Source**: `v_approved_timebarred_registrar`.
- **Workflow Trigger**: Procedural review of time-barred claims that have received special authorization from the Registrar.

### ListClaimDecisions.tsx
- **Database Source**: `v_claim_decisions_summary`.
- **Filtering Logic**: Search by IRN or Claimant Name.
- **Workflow Trigger**: Read-only archival view of all final decisions made on a claim, including rejection reasons or award amounts.

### ListForm6ForwardedToTribunalForStateSolicitor.tsx
- **Database Source**: `v_form6_tribunal_solgen`.
- **Workflow Trigger**: Procedural tracking of Form 6 cases referred to the State Solicitor for legal representation.

### ListOnHoldClaimsAwardedPaymentSectionReview.tsx / ListOnHoldClaimsAwardedPaymentsManagerReview.tsx
- **Database Source**: `claimsawardedpayments_view` (Status='On-Hold').
- **Workflow Trigger**: Interface for resolving payment discrepancies or missing banking details identified by the Payment Section.

### ListPendingAwardedClaimsForRegistrarReview.tsx
- **Database Source**: `v_pending_awarded_registrar`.
- **Workflow Trigger**: Final procedural gate for the Registrar to approve Consent Awards before they are transmitted to the Payment Section.

### ListPendingClaimsAwardedPaymentSection.tsx
- **Database Source**: `v_pending_awarded_payment_section`.
- **Workflow Trigger**: Queue management for the Payment Section to process valid awards for check/transfer issuance.

### deputyregistrarapprovedlistconfirmletters.tsx
- **Database Source**: `v_registrar_review_list`.
- **Workflow Trigger**: Batch generation component for Confirmation Letters after Registrar approval.

### ForwardToTribunalTimebarredFormSubmissionRegistrarReview.tsx
- **Database Source**: `form1112master`, `prescreeningreview`.
- **Workflow Trigger**: Specialized procedural component for the Registrar to refer time-barred cases to the Tribunal for merit evaluation.
### ListOnHoldFormsPrescreeningReview.tsx
- **Database Source**: `prescreening_onhold_view`.
- **Filtering Logic**: Search by DisplayIRN, WorkerFirstName, WorkerLastName.
- **Workflow Trigger**: Spawns `DROnHoldForm` for resolving data discrepancies or missing attachments.

### ListPendingClaimsAwardedPaymentsManagerReview.tsx
- **Database Source**: `pending_awarded_claims_paymentsmanagerreview_view`.
- **Filtering Logic**: Search by DisplayIRN, WorkerFirstName, WorkerLastName.
- **Workflow Trigger**: Spawns `PendingClaimsAwardedForPaymentsManagerReview` for secondary verification of payment awards.

### ListPendingClaimsForChiefCommissionerReview.tsx
- **Database Source**: `chief_commissioner_pending_view`, `owcstaffmaster`, `claimsawardedcommissionersreview` (Locks).
- **Filtering Logic**: Search by DisplayIRN, WorkerFirstName, WorkerLastName.
- **Workflow Trigger**: Spawns `Decision169ChiefCommissionerReviewInjury` or `Decision168ChiefCommissionerReviewDeath`. Includes locking mechanism to prevent concurrent reviews.

### ListPendingCompensationCalculationCPMReview.tsx
- **Database Source**: `compensation_calculation_cpm_pending_view`.
- **Filtering Logic**: Search by DisplayIRN, WorkerFirstName, WorkerLastName. Regionalized by `IncidentRegion`.
- **Workflow Trigger**: Spawns `Form328PendingCompensationCalculationCPMReviewInjury` or `Form324PendingCompensationCalculationCPMReviewDeath`.

### ListPendingForm6ForInsuranceProviderReview.tsx
- **Database Source**: `v_form6_insurance_provider_review`.
- **Filtering Logic**: Search by DisplayIRN, WorkerFirstName, WorkerLastName.
- **Workflow Trigger**: Spawns `PendingForm6ForInsuranceProviderReview` for Insurance Providers to review approved Form 6 submissions.

### ListPendingForm6ForStateSolicitorReview.tsx
- **Database Source**: `v_form6_state_solicitor_review`, `tribunalhearingschedule`, `form6master`.
- **Filtering Logic**: Search by DisplayIRN, WorkerFirstName, WorkerLastName.
- **Workflow Trigger**: Spawns `PendingForm6ForStateSolicitorReview`. Supports individual or batch "Forward to Tribunal" actions, updating `form6master` status to 'CompensationAccepted' and scheduling hearings.
### ListPendingFormsPrescreeningReview.tsx
- **Database Source**: `prescreening_pending_view`.
- **Filtering Logic**: Search by DisplayIRN, WorkerFirstName, WorkerLastName.
- **Workflow Trigger**: Spawns `DRPendingForm` for initial Registrar/Deputy Registrar evaluation.

### ListPendingHearingsPrivate.tsx / ListPendingHearingsPublic.tsx
- **Database Source**: `tribunalhearingschedule`, `form1112master`, `workerpersonaldetails`. RPC `get_pending_hearings_public/private`.
- **Filtering Logic**: Search by DisplayIRN, WorkerFirstName, WorkerLastName. Filters by `THSHearingStatus = 'HearingPending'` and `THSWorkerOrganizationType`.
- **Workflow Trigger**: Spawns `Form238HearingPendingForm11Submission`, `Form239HearingPendingForm12Submission`, or `Form253HearingPendingForm7Submission` based on the claim type.

### ListPendingRegisteredClaimsCPOReview.tsx
- **Database Source**: `cpo_pending_view`.
- **Filtering Logic**: Search by DisplayIRN, WorkerFirstName, WorkerLastName.
- **Workflow Trigger**: Spawns `PendingRegisteredClaimsCPOReview` for Chief Project Officer verification.

### ListPendingRegisteredClaimsRegistrarReview.tsx
- **Database Source**: `registrar_pending_view`.
- **Filtering Logic**: Search by DisplayIRN, WorkerFirstName, WorkerLastName.
- **Workflow Trigger**: Spawns `PendingRegisteredClaimsRegistrarReview` for final Registrar approval before processing.

### ListPendingTimeBarredFormsRegistrarReview.tsx
- **Database Source**: `timebarred_pending_view`.
- **Filtering Logic**: Search by DisplayIRN, WorkerFirstName, WorkerLastName.
- **Workflow Trigger**: Spawns `PendingTimeBarredFormsRegistrarReview` to evaluate merit and schedule Tribunal hearings for late claims.

### ListRejectedClaimsAwardedPaymentSectionReview.tsx
- **Database Source**: `rejected_awarded_claims_paymentsmanagerreview_view`.
- **Filtering Logic**: Search by DisplayIRN, WorkerFirstName, WorkerLastName.
- **Workflow Trigger**: Spawns `RejectedClaimsAwardedForPaymentSectionReview` to address payment section rejections.

### ListRejectedClaimsAwardedPaymentsManagerReview.tsx
- **Database Source**: `rejected_awarded_claims_paymentsmanagerreview_view`.
- **Filtering Logic**: Search by DisplayIRN, WorkerFirstName, WorkerLastName.
- **Workflow Trigger**: Spawns `RejectedClaimsAwardedForPaymentsManagerReview`.

### ListRejectedCompensationCalculationCPMReview.tsx
- **Database Source**: `compensation_calculation_cpm_rejected_view`.
- **Filtering Logic**: Search by DisplayIRN, WorkerFirstName, WorkerLastName.
- **Workflow Trigger**: Spawns `RejectedCompensationCalculationCPMReview` to rectify calculation errors.

### ListRejectedRegisteredClaimsRegistrarReview.tsx
- **Database Source**: `registrar_rejected_view`.
- **Filtering Logic**: Search by DisplayIRN, WorkerFirstName, WorkerLastName.
- **Workflow Trigger**: Spawns `RejectedRegisteredClaimsRegistrarReview`.

### ListRejectedTimeBarredFormsRegistrarReview.tsx
- **Database Source**: `timebarred_rejected_view`.
- **Filtering Logic**: Search by DisplayIRN, WorkerFirstName, WorkerLastName.
- **Workflow Trigger**: Spawns `RejectedTimeBarredFormsRegistrarReview`.

### ListResubmittedFormsPrescreeningReview.tsx
- **Database Source**: `prescreening_resubmitted_view`.
- **Filtering Logic**: Search by DisplayIRN, WorkerFirstName, WorkerLastName.
- **Workflow Trigger**: Spawns `DRResubmittedForm` for claims that have provided missing info/attachments.

### ListSetTribunalHearingPrivate.tsx / ListSetTribunalHearingPublic.tsx
- **Database Source**: `view_hearings_set_public/private`, `form1112master`, `workerpersonaldetails`.
- **Filtering Logic**: Search by DisplayIRN, WorkerFirstName, WorkerLastName.
- **Workflow Trigger**: Transition point for recording Tribunal outcomes via `Form238HearingForm11SubmissionPublic`, etc.

### ListTribunalHearingAdjourned.tsx / ListTribunalHearingConsented.tsx / ListTribunalHearingDismissed.tsx
- **Database Source**: `tribunalhearingoutcome`, `form1112master`, `employermaster`, `currentemploymentdetails`, `workerirn`, `tribunalhearingsethearing`.
- **Filtering Logic**: Search by Claimant Name, CRN (DisplayIRN), and Hearing No.
- **Workflow Trigger**: Reporting components for historical hearing outcomes. Includes logic for generating Record of Proceedings (ROP) and Adjourn/Consent/Dismiss Cover Letters via PDF utilities.

### NewEmployerRegistrationForm.tsx
1. **Tables and fields fetched**:
   - `dictionary`: `DKey`, `DValue` (where `DType = 'Province'`)
   - `insurancecompanymaster`: `*`
   - `ipamaster`: `*` (for count and organization name auto-fill)
   - `employermaster`: `EMID` (for generating next numeric sequence)
   - `users`: `id` (for email existence verification)
2. **Table and fields saved to**:
   - `users`: `email`, `password` (hashed), `name`, `group_id` (15)
   - `profiles`: `id`, `email`, `full_name`, `phone_number`
   - `employermaster`: `EMID`, `CPPSID`, `OrganizationName`, `Address1`, `Address2`, `City`, `Province`, `POBox`, `Website`, `MobilePhone`, `LandLine`, `OrganizationType`, `ValidationCode`, `InsuranceProviderIPACode`, `IsLevyPaid`, `LevyReferenceNumber`, `IncorporationDate`, `IsAgent`, `IsLawyer`, `IsInsuranceCompany`, `Email`
3. **Forms called/triggered**:
   - None
4. **Reports, utils, pdfs, prints called**:
   - `bcryptjs` for password hashing

---

### NewForm3.tsx / NewForm4.tsx
1. **Tables and fields fetched**:
   - `form1112master`: `IncidentDate`, `IncidentProvince`, `IncidentRegion`, `InjuryCause`, `NatureExtentInjury`, `InsuranceProviderIPACode`, `DisplayIRN`
   - `workerpersonaldetails`: `*`
   - `currentemploymentdetails`: `*`
   - `employermaster`: `InsuranceProviderIPACode`, `OrganizationType`, `OrganizationName`, `Address1`, `Address2`, `City`
   - `dictionary`: `DKey`, `DValue` (where `DType = 'Province'`)
   - `insurancecompanymaster`: `*`
   - `dependantpersonaldetails`: `*`
   - `workhistory`: `*`
   - `form4master`: `*` (Death specific fields like `AnnualEarningsAtDeath`, `FuneralExpenseDetails`)
2. **Table and fields saved to**:
   - `form1112master`: `update` (NatureExtentInjury, InjuryCause, etc.)
   - `workerpersonaldetails`: `update`
   - `currentemploymentdetails`: `update`
   - `dependantpersonaldetails`: `insert`/`delete`
   - `workhistory`: `insert`/`delete`
   - `form3master` / `form4master`: `insert`/`update`
   - `formattachments`: `insert` (for scans and supporting docs)
3. **Forms called/triggered**:
   - `recordPrescreening` utility (triggers workflow in `prescreeningreview`)
4. **Reports, utils, pdfs, prints called**:
   - Supabase Storage (file uploads to `/attachments/`)

---

### NewForm11.tsx / NewForm12.tsx
1. **Tables and fields fetched**:
   - `workerpersonaldetails`: `*`
   - `dictionary`: `DKey`, `DValue` (where `DType` is `Province`, `BodyPart`, `ProvinceRegion`)
   - `currentemploymentdetails`: `*`
   - `employermaster`: `InsuranceProviderIPACode`, `OrganizationType`
   - `insurancecompanymaster`: `*`
   - `form1112master`: `IRN` (for building formatted `DisplayIRN`)
2. **Table and fields saved to**:
   - `form1112master`: `insert` (DisplayIRN, WorkerID, IncidentDate, etc.)
   - `timebarredclaimsregistrarreview`: `insert` (if claim is >365 days old)
   - `prescreeningreview`: `insert` (automatic approval if not time-barred)
   - `formattachments`: `insert`
3. **Forms called/triggered**:
   - None
4. **Reports, utils, pdfs, prints called**:
   - Supabase Storage (file uploads to `/attachments/formattachments/`)

---

### NewOWCStaffForm.tsx
1. **Tables and fields fetched**:
   - `dictionary`: `DValue` (where `DType = 'Province'`), `DValue` (where `DType = 'ProvinceRegion'`)
   - `owc_usergroups`: `id`, `title`
   - `owcstaffmaster`: `OSMStaffID` (for generating next sequence)
   - `users`: `id` (email existence check)
2. **Table and fields saved to**:
   - `users`: `email`, `password` (hashed), `name`, `group_id`
   - `profiles`: `id`, `email`, `full_name`, `phone_number`
   - `owcstaffmaster`: `OSMFirstName`, `OSMLastName`, `OSMDesignation`, `InchargeProvince`, `InchargeRegion`, `OSMDepartment`, `OSMMobilePhone`, `OSMActive`, `OSMLocked`, `OSMStaffID`, `cppsid` (linked User ID)
3. **Forms called/triggered**:
   - None
4. **Reports, utils, pdfs, prints called**:
   - `bcryptjs` for password hashing

---

### PrintHearingSetList.tsx
1. **Tables and fields fetched**:
   - `tribunalhearingsethearing`: `*`
   - `tribunalhearingschedule`: `*`
   - `form1112master`: `DisplayIRN`, `WorkerID`
   - `workerpersonaldetails`: `WorkerFirstName`, `WorkerLastName`
2. **Table and fields saved to**:
   - None
3. **Forms called/triggered**:
   - None
4. **Reports, utils, pdfs, prints called**:
   - `jsPDF`, `html2canvas` for PDF generation

### PrintListAll.tsx / PrintListPrivate.tsx / PrintListPublic.tsx
1. **Tables and fields fetched**:
   - `form1112master`: `*`
   - `workerpersonaldetails`: `*`
   - `employermaster`: `*`
2. **Table and fields saved to**:
   - None
3. **Forms called/triggered**:
   - None
4. **Reports, utils, pdfs, prints called**:
   - Browser print (`window.print()`)

### registrarcertificateofaward.tsx
1. **Tables and fields fetched**:
   - `bankaccountdepositmaster`: `*`
   - `claimcompensationworkerdetails`: `*`
   - `workerpersonaldetails`: `*`
   - `form1112master`: `*`
2. **Table and fields saved to**:
   - None
3. **Forms called/triggered**:
   - None
4. **Reports, utils, pdfs, prints called**:
   - `generateRegistrarCertificateOfAward` utility

### registrarconsentofawardcertificate.tsx
1. **Tables and fields fetched**:
   - `bankaccountdepositmaster`: `*`
   - `claimcompensationworkerdetails`: `*`
   - `workerpersonaldetails`: `*`
2. **Table and fields saved to**:
   - None
3. **Forms called/triggered**:
   - None
4. **Reports, utils, pdfs, prints called**:
   - `generateRegistrarConsentOfAwardCertificate` utility

### SearchAttachments.tsx
1. **Tables and fields fetched**:
   - `attachmentmaster`: `*`
   - `formattachments`: `*`
   - `form1112master`: `DisplayIRN`
2. **Table and fields saved to**:
   - `formattachments`: `insert`/`update`
3. **Forms called/triggered**:
   - None
4. **Reports, utils, pdfs, prints called**:
   - Supabase Storage (Bucket: `cpps`, Path: `/attachments/formattachments/`)

### SearchForm3.tsx / SearchForm4.tsx
1. **Tables and fields fetched**:
   - `form1112master`: `IRN`, `DisplayIRN`, `WorkerID`, `IncidentType`
   - `workerpersonaldetails`: `WorkerFirstName`, `WorkerLastName`
   - `form3master` / `form4master`: `IRN` (Existence check)
   - `timebarredclaimsregistrarreview`: `TBCRRReviewStatus`
2. **Table and fields saved to**:
   - None
3. **Forms called/triggered**:
   - `NewForm3/4`, `ViewForm3/4`, `EditForm3/4`
4. **Reports, utils, pdfs, prints called**:
   - None

### SetTribunalHearing.tsx
1. **Tables and fields fetched**:
   - `tribunalhearingsethearing`: `*` (by `THSHID`)
   - `form1112master`: `DisplayIRN`, `IncidentType`, `WorkerID` (by `IRN`)
   - `workerpersonaldetails`: `WorkerFirstName`, `WorkerLastName` (by `WorkerID`)
   - `tribunalhearingschedule`: `THSSetForHearing`, `count`
2. **Table and fields saved to**:
   - `tribunalhearingsethearing`: `insert`/`update`
   - `tribunalhearingschedule`: `update` (`THSSetForHearing`, `THSHearingNo`)
   - `tribunalhearingoutcome`: `update` (`THOHearingNo`)
3. **Forms called/triggered**:
   - None
4. **Reports, utils, pdfs, prints called**:
   - `generateSolgenHearingLetter` utility

### ViewEmployerRegistrationForm.tsx
1. **Tables and fields fetched**:
   - `employermaster`: `*` (by `EMID`)
   - `insurancecompanymaster`: `IPACODE`, `InsuranceCompanyOrganizationName`
2. **Table and fields saved to**:
   - None
3. **Forms called/triggered**:
   - None
4. **Reports, utils, pdfs, prints called**:
   - `window.print()`

### ViewForm3.tsx / ViewForm4.tsx / ViewForm6.tsx / ViewForm7.tsx / ViewForm11.tsx / ViewForm12.tsx / ViewForm18.tsx
1. **Tables and fields fetched**:
   - Respective master tables (`form3master`, `form4master`, `form6master`, `form7master`, `form1112master`, `form18master`)
   - `workerpersonaldetails`: `*`
   - `employermaster`: `*`
   - `attachmentmaster` & `formattachments` (for viewing related documents)
2. **Table and fields saved to**:
   - None
3. **Forms called/triggered**:
   - None
4. **Reports, utils, pdfs, prints called**:
   - `window.print()` / `jsPDF` (depending on specific view)

### ViewHearingForm7/11/12Private/Public.tsx
1. **Tables and fields fetched**:
   - `view_hearings_set_public/private` (view-based fetch)
   - `tribunalhearingoutcome`: `*`
   - `form1112master`: `DisplayIRN`
2. **Table and fields saved to**:
   - None
3. **Forms called/triggered**:
   - None
4. **Reports, utils, pdfs, prints called**:
   - `window.print()`

### ViewSetTribunalHearing.tsx
1. **Tables and fields fetched**:
   - `tribunalhearingsethearing`: `*` (by `THSHID` or `THSHHearingNo`)
   - `tribunalhearingschedule`: `count` (by `THSHearingNo`)
2. **Table and fields saved to**:
   - None
3. **Forms called/triggered**:
   - None
4. **Reports, utils, pdfs, prints called**:
   - `generateSolgenHearingLetter` utility

### ViewWorkerRegistrationForm.tsx
1. **Tables and fields fetched**:
   - `workerpersonaldetails`: `*` (by `WorkerID`)
   - `currentemploymentdetails`: `*` (by `WorkerID`)
   - `dependantpersonaldetails`: `*` (by `WorkerID`)
   - `workhistory`: `*` (by `WorkerID`)
   - `insurancecompanymaster`: `*` (by `IPACODE`)
2. **Table and fields saved to**:
   - None
3. **Forms called/triggered**:
   - None
4. **Reports, utils, pdfs, prints called**:
   - `window.print()`

### WorkerRegistrationForm.tsx / EditWorkerRegistrationForm.tsx
1. **Tables and fields fetched**:
   - `workerpersonaldetails`: `*` (by `WorkerID`)
   - `currentemploymentdetails`: `*` (by `WorkerID`)
   - `dependantpersonaldetails`: `*` (by `WorkerID`)
   - `workhistory`: `*` (by `WorkerID`)
   - `insurancecompanymaster`: `*` (by `IPACODE`)
   - `employermaster`: `*` (by `CPPSID`)
2. **Table and fields saved to**:
   - `workerpersonaldetails`: `insert`/`update`
   - `currentemploymentdetails`: `insert`/`update`
   - `dependantpersonaldetails`: `insert`/`upsert`/`delete`
   - `workhistory`: `insert`/`upsert`/`delete`
3. **Forms called/triggered**:
   - `EmployerListModal`, `InsuranceProviderListModal`
4. **Reports, utils, pdfs, prints called**:
   - Supabase Storage (Bucket: `cpps`, Path: `attachments/workerpassportphotos/`)

### WorkerSearchForm.tsx / WorkerSearchModal.tsx
1. **Tables and fields fetched**:
   - `workerpersonaldetails`: `WorkerID`, `WorkerFirstName`, `WorkerLastName`
   - `form1112master`: `IRN`, `DisplayIRN`, `WorkerID`, `IncidentType`
   - `form3master` / `form4master`: `IRN` (Existence check)
2. **Table and fields saved to**:
   - None
3. **Forms called/triggered**:
   - `WorkerRegistrationForm`, `EditWorkerRegistrationForm`, `ViewWorkerRegistrationForm`, `NewForm11/12`, `EditForm11/12`, `ViewForm11/12`
4. **Reports, utils, pdfs, prints called**:
   - None

### RejectedClaimsAwardedForPaymentSectionReview.tsx
1. **Tables and fields fetched**:
   - `owcstaffmaster`: `OSMStaffID` (by `cppsid`)
   - `insurancecompanymaster`: `*`
   - `bankaccountdepositmaster`: `Employer`, `Drawer`, `BankName`, `DrawerAccountNumber`, `PaymentTypeMethod`, `EbankReferenceNo`, `OWCAccountNumber`, `AwardedAmount`, `InterestAmount`, `FinalPaymentAmount`, `EbankAmountPaid`, `EbankIssuedDate`, `PaymentDetails`, `PaymentManagerReviewStatus`, `BatchNo` (by `IRN`)
   - `claimcompensationworkerdetails`: `CCWDCompensationAmount`, `CCWDMedicalExpenses`, `CCWDMiscExpenses`, `CCWDDeductions` (fallback)
2. **Table and fields saved to**:
   - None (Read-only/Preview review)
3. **Forms called/triggered**:
   - `Form113View`, `Form124View`, `ListClaimDecisions`, `CompensationBreakupDetailsView`
4. **Reports, utils, pdfs, prints called**:
   - `ConsentOfAward-Injury`, `ConsentOfAward-Death`, `CertificateOfAward_jspdf`, `ChecklistForPayment_jspdf`, `BankConfirmationLetter_jspdf`, `form6CPO_jspdf`

### RejectedClaimsAwardedForPaymentsManagerReview.tsx
1. **Tables and fields fetched**:
   - `owcstaffmaster`: `OSMStaffID` (by `cppsid`)
   - `insurancecompanymaster`: `*`
   - `bankaccountdepositmaster`: `*` (Supports multiple records/splits per IRN)
   - `claimcompensationworkerdetails`: `CCWDCompensationAmount`, `CCWDMedicalExpenses`, `CCWDMiscExpenses`, `CCWDDeductions` (fallback)
2. **Table and fields saved to**:
   - None (Read-only review view)
3. **Forms called/triggered**:
   - `Form113View`, `Form124View`, `ListClaimDecisions`, `CompensationBreakupDetailsView`
4. **Reports, utils, pdfs, prints called**:
   - `ConsentOfAward-Injury`, `ConsentOfAward-Death`, `CertificateOfAward_jspdf`, `ChecklistForPayment_jspdf`, `BankConfirmationLetter_jspdf`, `form6CPO_jspdf`

### RejectedRegisteredClaimsRegistrarReview.tsx
1. **Tables and fields fetched**:
   - `form1112master`: `DisplayIRN` (by `IRN`)
2. **Table and fields saved to**:
   - None (Review component)
3. **Forms called/triggered**:
   - `Form113View`, `Form124View`, `ListClaimDecisions`
4. **Reports, utils, pdfs, prints called**:
   - None

### RejectedTimebarredFormSubmissionRegistrarReview.tsx
1. **Tables and fields fetched**:
   - `form1112master`: `WorkerID`, `IncidentType`, `DisplayIRN` (by `IRN`)
2. **Table and fields saved to**:
   - None (Review component)
3. **Forms called/triggered**:
   - `ViewForm11`, `ViewForm12`
4. **Reports, utils, pdfs, prints called**:
   - None

### reportofpendingmandatorydocuments.tsx
1. **Tables and fields fetched**:
   - `form1112master`: `*` (by `irn`)
   - `cpor_records`: `id` (Count check for duplicate `irn`)
2. **Table and fields saved to**:
   - None (Report generation component)
3. **Forms called/triggered**:
   - Opens `/reports/pending-documents` (Targeted reporting route)
4. **Reports, utils, pdfs, prints called**:
   - Custom report generation via URL-based routing.

---
*Documentation Phase Complete.*
*The CPPS2026 Administrative Module Registry is now a comprehensive reference for all operational modules, providing the necessary mapping for the Statistical and Performance Dashboard project.*


