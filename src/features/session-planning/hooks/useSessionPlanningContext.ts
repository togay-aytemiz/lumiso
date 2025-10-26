import { useContext } from "react";
import { SessionPlanningContext } from "../context/SessionPlanningProvider";

export const useSessionPlanningContext = () => {
  const context = useContext(SessionPlanningContext);
  if (!context) {
    throw new Error("useSessionPlanningContext must be used within a SessionPlanningProvider");
  }
  return context;
};

