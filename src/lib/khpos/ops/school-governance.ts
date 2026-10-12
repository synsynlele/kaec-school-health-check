/** Legacy code is accepted only from verified school-scoped role assignments
 * during the deployment/migration transition. A company title grants no school access. */
export function isSchoolCustodianRole(code: string) {
  return code === "SCHOOL_CUSTODIAN" || code === "VISION_CUSTODIAN";
}

/** Caller supplies only active assignments with active membership in this school. */
export function hasIndependentSchoolReviewer(assignments: Array<{ userId: string; roleCode: string }>) {
  const custodians = assignments.filter((item) => isSchoolCustodianRole(item.roleCode));
  const reviewers = assignments.filter((item) => isSchoolCustodianRole(item.roleCode) || item.roleCode === "SCHOOL_GUARDIAN");
  return custodians.length > 0 && custodians.every((author) => reviewers.some((reviewer) => reviewer.userId !== author.userId));
}

export function schoolControlReviewer(critical: boolean, authorRoleCodes: string[]) {
  if (!critical) return "School Custodian or School Guardian";
  return authorRoleCodes.some(isSchoolCustodianRole)
    ? "A different School Guardian or School Custodian"
    : "School Custodian";
}

/** Presentation rule only. The school-scoped database function remains authoritative. */
export function canReviewSchoolControl(input: {
  critical: boolean;
  status: string;
  authorId: string | null;
  reviewerId: string;
  authorRoleCodes: string[];
  reviewerRoleCodes: string[];
}) {
  if (input.status !== "in_review" || !input.authorId || !input.reviewerId || input.authorId === input.reviewerId) return false;
  const custodian = input.reviewerRoleCodes.some(isSchoolCustodianRole);
  const guardian = input.reviewerRoleCodes.includes("SCHOOL_GUARDIAN");
  if (!input.critical || input.authorRoleCodes.some(isSchoolCustodianRole)) return custodian || guardian;
  return custodian;
}
