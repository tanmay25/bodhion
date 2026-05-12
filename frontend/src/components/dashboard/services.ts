export type DashboardServiceStatus = 'active' | 'coming-soon';

export type DashboardService = {
  id: string;
  title: string;
  description: string;
  route?: string;
  cta: string;
  status: DashboardServiceStatus;
  icon: 'chat' | 'resume' | 'it' | 'sparkles';
  isAccessible: boolean;
};

export const dashboardServices: DashboardService[] = [
  {
    id: 'chat-engine',
    title: 'Chat Engine',
    description: 'Launch a new AI chat session with your available models and tools.',
    route: '/chat-engine',
    cta: 'Open Chat',
    status: 'active',
    icon: 'chat',
    isAccessible: true,
  },
  {
    id: 'resume-analyzer',
    title: 'Resume Analyzer',
    description: 'Review and score resumes with structured feedback and improvement suggestions.',
    route: '/services/resume-analyzer',
    cta: 'Coming Soon',
    status: 'coming-soon',
    icon: 'resume',
    isAccessible: true,
  },
  {
    id: 'it-help-desk',
    title: 'IT Help Desk',
    description: 'Triage incidents, gather context, and speed up internal support workflows.',
    route: '/services/it-help-desk',
    cta: 'Coming Soon',
    status: 'coming-soon',
    icon: 'it',
    isAccessible: true,
  },
  {
    id: 'knowledge-assistant',
    title: 'Knowledge Assistant',
    description: 'Search and summarize internal documentation with grounded answers.',
    cta: 'Coming Soon',
    status: 'coming-soon',
    icon: 'sparkles',
    isAccessible: true,
  },
  {
    id: 'workflow-automation',
    title: 'Workflow Automation',
    description: 'Build repeatable AI workflows for approvals, routing, and follow-ups.',
    cta: 'Coming Soon',
    status: 'coming-soon',
    icon: 'sparkles',
    isAccessible: true,
  },
];
