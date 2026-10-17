export const LEARNING_STAGES = [
  { code: "preschool", label: "Preschool / early years", name: "Preschool" },
  { code: "lower_primary", label: "Lower primary", name: "Lower Primary" },
  { code: "upper_primary", label: "Upper primary", name: "Upper Primary" },
  {
    code: "junior_secondary",
    label: "Junior secondary",
    name: "Junior Secondary",
  },
  {
    code: "senior_secondary",
    label: "Senior secondary",
    name: "Senior Secondary",
  },
  { code: "other", label: "Other / school-defined", name: "" },
] as const;
export type LearningStage = (typeof LEARNING_STAGES)[number]["code"];
