/**
 * Active attention means the signed-in person can take the next step.
 * A submitted record remains in history but stops reminding its submitter.
 * Review rights are checked independently by the database on mutation.
 */
export function needsOwnerWorkAction(status: string): boolean {
  return status === "pending" || status === "in_progress" || status === "blocked";
}

export interface IssueAttentionState {
  status: string;
  isOwner: boolean;
  isReporter: boolean;
  isDirectManager: boolean;
  isEscalationRecipient: boolean;
  severity: string;
}

/** Return the next authorised user's action, or null for waiting/history. */
export function issueAttentionAction(
  issue: IssueAttentionState,
  overdue: boolean,
): "act" | "verify" | "close" | null {
  if (issue.status === "closed") return null;
  if (issue.status === "resolved") {
    return !issue.isOwner &&
      (issue.isReporter || issue.isDirectManager || issue.isEscalationRecipient)
      ? "verify"
      : null;
  }
  if (issue.status === "verified") {
    return issue.isReporter || issue.isDirectManager || issue.isEscalationRecipient
      ? "close"
      : null;
  }
  if (issue.isOwner || issue.isEscalationRecipient) return "act";
  if (issue.isReporter && issue.status === "open") return "act";
  if (issue.isDirectManager && (overdue || issue.severity === "P1")) return "act";
  return null;
}

export interface DecisionAttentionState {
  status: string;
  isAuthority: boolean;
  isRequester: boolean;
  isImplementationOwner: boolean;
  actionRequired: boolean;
}

/** Holding a senior title does not authorise self-approval. */
export function decisionAttentionActions(decision: DecisionAttentionState): {
  approval: boolean;
  implementation: boolean;
} {
  return {
    approval:
      decision.isAuthority &&
      !decision.isRequester &&
      (decision.status === "submitted" || decision.status === "under_review"),
    implementation:
      decision.isImplementationOwner &&
      decision.actionRequired &&
      decision.status === "approved",
  };
}
