// Single source of truth for onboarding stages - V3 with bulletproof state management
export type OnboardingStage = 'not_started' | 'modal_shown' | 'in_progress' | 'completed' | 'skipped';

// Define onboarding steps in a single place - easy to modify in future
export const ONBOARDING_STEPS = [
  {
    id: 1, 
    title: "Create Your First Lead",
    description: "Add a potential client to start tracking opportunities",
    route: "/leads",
    buttonText: "Go to Leads",
    duration: "2 min"
  },
  {
    id: 2,
    title: "Set Up a Photography Project", 
    description: "Convert a lead into a project to organize sessions and deliverables",
    route: "/leads",
    buttonText: "Create Project from Lead",
    duration: "4 min"
  },
  {
    id: 3,
    title: "Explore Projects Page",
    description: "Learn about different project views: Board, List, and Archived projects",
    route: "/projects?tutorial=true",
    buttonText: "Explore Projects",
    duration: "3 min"
  },
  {
    id: 4,
    title: "Schedule a Photo Session",
    description: "Book your first session and manage your calendar",
    route: "/leads?tutorial=scheduling", 
    buttonText: "Schedule Session",
    duration: "3 min"
  },
  {
    id: 5,
    title: "Configure Your Packages",
    description: "Set up photography packages and pricing structure",
    route: "/settings/services",
    buttonText: "Set Up Packages",
    duration: "5 min"
  }
] as const;

export const TOTAL_STEPS = ONBOARDING_STEPS.length;
