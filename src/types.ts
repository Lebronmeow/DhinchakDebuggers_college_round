export type View =
  | "overview"
  | "office"
  | "crm"
  | "websites"
  | "campaigns"
  | "webinars"
  | "billing"
  | "approvals"
  | "analytics"
  | "settings";
export interface Contact {
  id: string;
  name: string;
  email: string;
  company: string;
  stage: string;
  source: string;
  consent: boolean;
  phone?: string;
  notes?: string;
  createdAt: string;
}
export interface Page {
  id: string;
  title: string;
  slug: string;
  headline: string;
  description: string;
  accent: string;
  blocks: string[];
  status: "draft" | "published";
  createdAt: string;
}
export interface Campaign {
  id: string;
  name: string;
  subject: string;
  body: string;
  status: string;
  audience: string;
  scheduledAt: string;
  createdAt: string;
}
export interface Webinar {
  id: string;
  title: string;
  description: string;
  startsAt: string;
  capacity: number;
  joinUrl: string;
  status: string;
  registrations: { contactId: string; attended: boolean }[];
  createdAt: string;
}
export interface Plan {
  id: string;
  name: string;
  amount: number;
  interval: string;
  includedUsage: number;
  overageRate: number;
}
export interface Subscription {
  id: string;
  contactId: string;
  planId: string;
  status: string;
  usage: number;
  createdAt: string;
  sandbox: boolean;
}
export interface Approval {
  id: string;
  kind: "publish_page" | "schedule_campaign" | "send_campaign";
  targetId: string;
  title: string;
  summary: string;
  status: string;
  createdAt: string;
}
export interface WorkflowStep {
  id: string;
  label: string;
  agent: string;
  status: string;
}
export interface Workflow {
  id: string;
  prompt: string;
  title: string;
  status: string;
  steps: WorkflowStep[];
  createdAt: string;
  pageId?: string;
  campaignId?: string;
  webinarId?: string;
}
export interface Activity {
  id: string;
  type: string;
  message: string;
  createdAt: string;
}
export interface Integration {
  id: string;
  name: string;
  status: string;
  description: string;
  url: string;
}
export interface NexusState {
  contacts: Contact[];
  pages: Page[];
  campaigns: Campaign[];
  webinars: Webinar[];
  plans: Plan[];
  subscriptions: Subscription[];
  approvals: Approval[];
  workflows: Workflow[];
  activities: Activity[];
  integrations: Integration[];
}
export interface ModuleProps {
  view: View;
  state: NexusState;
  refresh: () => Promise<void>;
  notify: (message: string, error?: boolean) => void;
  onNavigate?: (view: View) => void;
}
