export type AddActionType = "lead" | "project" | "session";

export interface AddActionEventDetail {
  source: "header" | "dashboard";
  type: AddActionType;
}

export const ADD_ACTION_EVENTS: Record<AddActionType, string> = {
  lead: "add-action:lead",
  project: "add-action:project",
  session: "add-action:session",
};
