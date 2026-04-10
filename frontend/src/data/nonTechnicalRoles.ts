/**
 * nonTechnicalRoles.ts
 * Role definitions and simulation task pools for non-technical interview tracks.
 * Mirrors the structure of simulationTaskLibrary.ts so the same simulation
 * engine can render these tasks without any backend changes.
 */

import type { SimTask } from './simulationTaskLibrary';

// ─── Role metadata ────────────────────────────────────────────────────────────

export interface NonTechnicalRole {
  label: string;
  icon: string;
  /** Focus areas shown as chips in the UI */
  focusAreas: string[];
  /** Modes that are relevant for this role (subset of all modes) */
  supportedModes: Array<'resume-based' | 'jd-based' | 'general' | 'simulation' | 'panel' | 'company'>;
  /** Short description for the role card tooltip */
  description: string;
}

export const NON_TECHNICAL_ROLES: NonTechnicalRole[] = [
  {
    label: 'Product Manager',
    icon: '🗺️',
    focusAreas: ['Product Strategy', 'Roadmapping', 'Stakeholder Management', 'Metrics & KPIs'],
    supportedModes: ['resume-based', 'jd-based', 'general', 'simulation', 'panel', 'company'],
    description: 'Case studies, product sense, prioritisation frameworks, and cross-functional leadership.',
  },
  {
    label: 'Project Manager',
    icon: '📋',
    focusAreas: ['Planning & Scheduling', 'Risk Management', 'Agile / Scrum', 'Stakeholder Communication'],
    supportedModes: ['resume-based', 'jd-based', 'general', 'simulation', 'panel', 'company'],
    description: 'Delivery planning, risk mitigation, team coordination, and project lifecycle management.',
  },
  {
    label: 'Business Analyst',
    icon: '📊',
    focusAreas: ['Requirements Gathering', 'Process Mapping', 'Data Analysis', 'Stakeholder Alignment'],
    supportedModes: ['resume-based', 'jd-based', 'general', 'simulation', 'panel', 'company'],
    description: 'Bridging business needs and technical solutions through analysis and documentation.',
  },
  {
    label: 'Human Resources',
    icon: '🤝',
    focusAreas: ['Talent Acquisition', 'Employee Relations', 'Performance Management', 'HR Policy'],
    supportedModes: ['resume-based', 'jd-based', 'general', 'panel', 'company'],
    description: 'People strategy, conflict resolution, compliance, and organisational development.',
  },
  {
    label: 'Digital Marketing Specialist',
    icon: '📣',
    focusAreas: ['SEO / SEM', 'Content Strategy', 'Analytics & ROI', 'Campaign Management'],
    supportedModes: ['resume-based', 'jd-based', 'general', 'simulation', 'panel', 'company'],
    description: 'Growth marketing, channel strategy, data-driven campaigns, and brand positioning.',
  },
  {
    label: 'Writing Consultant',
    icon: '✍️',
    focusAreas: ['Content Creation', 'Editing & Proofreading', 'Brand Voice', 'Audience Analysis'],
    supportedModes: ['resume-based', 'jd-based', 'general', 'panel'],
    description: 'Strategic writing, editorial standards, content planning, and communication clarity.',
  },
  {
    label: 'UX Designer',
    icon: '🎨',
    focusAreas: ['User Research', 'Wireframing', 'Usability Testing', 'Design Systems'],
    supportedModes: ['resume-based', 'jd-based', 'general', 'simulation', 'panel', 'company'],
    description: 'Human-centred design, portfolio critique, design thinking, and cross-functional collaboration.',
  },
  {
    label: 'Sales Manager',
    icon: '💼',
    focusAreas: ['Pipeline Management', 'Negotiation', 'CRM & Forecasting', 'Team Leadership'],
    supportedModes: ['resume-based', 'jd-based', 'general', 'panel', 'company'],
    description: 'Revenue strategy, objection handling, quota attainment, and sales team coaching.',
  },
  {
    label: 'Operations Manager',
    icon: '⚙️',
    focusAreas: ['Process Optimisation', 'Supply Chain', 'KPI Tracking', 'Cross-team Coordination'],
    supportedModes: ['resume-based', 'jd-based', 'general', 'simulation', 'panel', 'company'],
    description: 'Operational efficiency, resource allocation, vendor management, and continuous improvement.',
  },
  {
    label: 'Financial Analyst',
    icon: '💹',
    focusAreas: ['Financial Modelling', 'Budgeting & Forecasting', 'Valuation', 'Reporting'],
    supportedModes: ['resume-based', 'jd-based', 'general', 'simulation', 'panel', 'company'],
    description: 'Quantitative analysis, investment evaluation, variance analysis, and strategic finance.',
  },
];

export const NON_TECHNICAL_ROLE_LABELS = NON_TECHNICAL_ROLES.map(r => r.label);

// ─── Simulation task pools ────────────────────────────────────────────────────

const PM_TASKS: SimTask[] = [
  {
    id: 'pm-sim-001',
    title: 'Prioritise a Conflicting Product Backlog',
    difficulty: 'medium',
    timeLimit: 900,
    description: 'Apply a prioritisation framework to a backlog with competing stakeholder demands.',
    scenario: `You are the PM for a B2B SaaS analytics platform. Three stakeholders have escalated competing feature requests for the next sprint. Engineering capacity is 40 story points.\n\n• Sales team: "We're losing deals without SSO login" (est. 20 pts, affects 15 enterprise prospects)\n• Customer Success: "Top 5 clients are threatening churn without bulk CSV export" (est. 25 pts, $400K ARR at risk)\n• CEO: "I want a new executive dashboard for the board demo in 3 weeks" (est. 35 pts, strategic visibility)\n\nEngineering says SSO and CSV export cannot be parallelised due to shared auth service.`,
    questions: [
      'Which framework (RICE, MoSCoW, ICE, Kano) would you apply here and why?',
      'Walk through your prioritisation decision step by step with explicit scoring.',
      'How do you communicate the trade-off to the CEO whose request is deprioritised?',
      'What would you do if the CEO overrides your recommendation?',
    ],
    evaluationCriteria: [
      'Applies a named framework correctly',
      'Quantifies impact (ARR at risk, deal count)',
      'Addresses stakeholder communication diplomatically',
      'Demonstrates understanding of capacity constraints',
      'Considers sequencing dependencies',
    ],
    hints: ['RICE = Reach × Impact × Confidence / Effort', 'Consider ARR at risk vs new revenue', 'Partial delivery or phasing is valid'],
  },
  {
    id: 'pm-sim-002',
    title: 'Define Success Metrics for a New Feature',
    difficulty: 'medium',
    timeLimit: 900,
    description: 'Design a measurement framework for a newly launched onboarding flow.',
    scenario: `Your team just shipped a redesigned onboarding flow for a mobile app. The goal was to improve activation (users completing their first key action within 7 days). You have access to product analytics, support tickets, and NPS surveys. The launch was 2 weeks ago.`,
    questions: [
      'What is your north-star metric for this feature and why?',
      'Define 3–5 supporting metrics (leading and lagging indicators) with their measurement method.',
      'The activation rate improved from 34% to 41%. Is this a success? What else do you need to know?',
      'How would you design an A/B test to validate the onboarding change rigorously?',
    ],
    evaluationCriteria: [
      'Identifies activation rate as primary metric',
      'Distinguishes leading vs lagging indicators',
      'Questions statistical significance and segment breakdown',
      'Describes valid A/B test design with control group',
      'Considers downstream metrics (retention, LTV)',
    ],
  },
  {
    id: 'pm-sim-003',
    title: 'Product Strategy Case: Enter a New Market',
    difficulty: 'hard',
    timeLimit: 1200,
    description: 'Evaluate whether your company should expand into a new vertical.',
    scenario: `You are PM at a project management SaaS (think Asana/Monday). The CEO asks: "Should we build a healthcare-specific version of our product?" Healthcare teams are currently using generic tools and complaining about HIPAA compliance gaps. A competitor just raised $50M targeting this space.`,
    questions: [
      'What framework would you use to evaluate this market entry decision?',
      'What are the top 3 risks and how would you validate or mitigate each?',
      'How would you structure a 3-month discovery phase before committing to build?',
      'If you decide to proceed, what is your go-to-market strategy for the first 6 months?',
    ],
    evaluationCriteria: [
      'Uses structured framework (TAM/SAM/SOM, Porter\'s Five Forces, or similar)',
      'Identifies HIPAA compliance as critical risk',
      'Proposes customer discovery interviews and pilot program',
      'Outlines realistic GTM with ICP definition',
      'Considers build vs partner vs acquire options',
    ],
  },
];

const BA_TASKS: SimTask[] = [
  {
    id: 'ba-sim-001',
    title: 'Requirements Elicitation from a Vague Brief',
    difficulty: 'medium',
    timeLimit: 900,
    description: 'Extract structured requirements from an ambiguous stakeholder request.',
    scenario: `A department head sends you this email:\n\n"Hi, we need a system to track our vendor contracts. Right now everything is in spreadsheets and we keep missing renewal dates. Can you sort this out? We have about 200 vendors. Thanks."\n\nYou have a 30-minute discovery call scheduled.`,
    questions: [
      'List the 10 most important questions you would ask in the discovery call and explain why each matters.',
      'Draft a structured requirements document outline (functional + non-functional) based on what you can infer.',
      'What are the risks of proceeding with only this information?',
      'How would you validate your requirements with the stakeholder before development begins?',
    ],
    evaluationCriteria: [
      'Asks about current pain points, not just features',
      'Identifies non-functional requirements (security, access control)',
      'Structures requirements with MoSCoW or similar',
      'Proposes prototype or wireframe validation',
      'Identifies integration requirements (email alerts, ERP)',
    ],
  },
  {
    id: 'ba-sim-002',
    title: 'Process Gap Analysis',
    difficulty: 'hard',
    timeLimit: 1200,
    description: 'Analyse a broken business process and recommend improvements.',
    scenario: `An insurance company's claims processing takes an average of 22 days. The industry benchmark is 8 days. You have been asked to perform a gap analysis. Current process:\n\n1. Customer submits claim via email → 2. Admin manually enters into system (1–3 days) → 3. Assigned to adjuster (2–4 days queue) → 4. Adjuster reviews (3–5 days) → 5. Manager approval required for all claims >$500 (2–3 days) → 6. Payment processed (3–5 days)\n\nKey data: 60% of claims are under $500. Manager approval queue is the most complained-about step.`,
    questions: [
      'Map the current process and identify all bottlenecks with evidence.',
      'Which single change would have the highest impact on cycle time? Justify with data.',
      'Design the future-state process and estimate the new average cycle time.',
      'What change management challenges would you anticipate and how would you address them?',
    ],
    evaluationCriteria: [
      'Correctly identifies manager approval as primary bottleneck',
      'Proposes auto-approval threshold for <$500 claims',
      'Quantifies impact: 60% of claims skip approval → saves 2–3 days for majority',
      'Addresses automation of manual data entry',
      'Considers change resistance from managers',
    ],
  },
];

const HR_TASKS: SimTask[] = [
  {
    id: 'hr-sim-001',
    title: 'Handle a Workplace Conflict Escalation',
    difficulty: 'medium',
    timeLimit: 900,
    description: 'Navigate a sensitive interpersonal conflict between two senior employees.',
    scenario: `Two senior engineers, Alex and Jordan, have escalating tension. Their manager escalates to you (HR):\n\n• Alex claims Jordan takes credit for their work in meetings\n• Jordan says Alex is "difficult to work with" and "blocks progress"\n• Three team members have separately mentioned the tension is affecting team morale\n• Both are high performers and critical to an upcoming product launch in 6 weeks`,
    questions: [
      'What is your investigation process? Who do you speak to and in what order?',
      'What are the possible root causes and how do you distinguish between them?',
      'Design a resolution plan that preserves both employees and team productivity.',
      'At what point, if any, would you escalate to formal disciplinary action?',
    ],
    evaluationCriteria: [
      'Conducts separate confidential interviews first',
      'Identifies attribution bias vs genuine misconduct distinction',
      'Proposes mediation with clear ground rules',
      'Considers business continuity (launch timeline)',
      'Documents all steps for legal protection',
    ],
  },
  {
    id: 'hr-sim-002',
    title: 'Design a Performance Improvement Plan',
    difficulty: 'hard',
    timeLimit: 1200,
    description: 'Create a structured PIP for an underperforming employee.',
    scenario: `A mid-level marketing manager, Sam, has missed 3 consecutive quarterly targets (50%, 60%, 55% of goal). Their manager wants to terminate immediately. Sam has been with the company 4 years with previously strong reviews. Recent context: Sam went through a divorce 8 months ago and mentioned personal stress in a 1:1.`,
    questions: [
      'Should you proceed with a PIP or immediate termination? Justify your recommendation.',
      'Design a 90-day PIP with specific, measurable milestones.',
      'How do you handle the personal circumstances legally and ethically?',
      'What documentation do you need before, during, and after the PIP?',
    ],
    evaluationCriteria: [
      'Recommends PIP given tenure and prior performance',
      'Sets SMART goals with clear measurement criteria',
      'Separates personal circumstances from performance (ADA/EAP awareness)',
      'Lists required documentation (written warnings, meeting notes)',
      'Considers wrongful termination risk',
    ],
  },
];

const MARKETING_TASKS: SimTask[] = [
  {
    id: 'mkt-sim-001',
    title: 'Diagnose a Declining Campaign Performance',
    difficulty: 'medium',
    timeLimit: 900,
    description: 'Analyse campaign data and identify the root cause of a performance drop.',
    scenario: `Your Google Ads campaign for a SaaS product has seen the following changes over the past 30 days:\n\n• Impressions: +15% (up)\n• CTR: 3.2% → 1.8% (down 44%)\n• Conversion rate: 4.1% → 4.0% (stable)\n• CPC: $2.10 → $3.40 (up 62%)\n• Total conversions: down 38%\n• A competitor launched a similar product 35 days ago`,
    questions: [
      'What is the most likely root cause of the performance drop? Walk through your reasoning.',
      'What additional data would you pull to confirm your hypothesis?',
      'List 5 specific optimisation actions you would take in the next 7 days.',
      'How would you adjust the budget allocation across channels given this data?',
    ],
    evaluationCriteria: [
      'Identifies CTR drop as primary signal (ad relevance / competition)',
      'Connects competitor launch to increased auction competition',
      'Proposes ad copy refresh and audience segmentation review',
      'Suggests search term report analysis',
      'Considers channel diversification',
    ],
  },
  {
    id: 'mkt-sim-002',
    title: 'Build a Content Strategy for a Product Launch',
    difficulty: 'hard',
    timeLimit: 1200,
    description: 'Design a 90-day content strategy for a B2B SaaS product launch.',
    scenario: `You are the Digital Marketing Specialist for a startup launching an AI-powered HR tool targeting mid-market companies (200–2000 employees). Budget: $15,000 for 90 days. Target persona: HR Directors and CHROs. The product solves employee engagement measurement. No existing content library or social following.`,
    questions: [
      'What content pillars would you build the strategy around and why?',
      'Allocate the $15,000 budget across channels with justification.',
      'What are your KPIs for each phase (awareness, consideration, conversion)?',
      'How would you measure content ROI and report it to the CEO?',
    ],
    evaluationCriteria: [
      'Defines 3–4 relevant content pillars tied to persona pain points',
      'Realistic budget allocation with channel rationale',
      'Distinguishes awareness vs conversion KPIs',
      'Proposes attribution model for ROI measurement',
      'Includes SEO and thought leadership components',
    ],
  },
];

const WRITING_TASKS: SimTask[] = [
  {
    id: 'write-sim-001',
    title: 'Edit a Poorly Written Executive Summary',
    difficulty: 'medium',
    timeLimit: 900,
    description: 'Identify writing issues and rewrite an executive summary for clarity and impact.',
    scenario: `A colleague submits this executive summary for a board report:\n\n"In terms of the Q3 performance metrics that were achieved by the team, it should be noted that there were a number of significant improvements that were made to the overall revenue figures which increased by approximately 23% when compared to the same period in the previous year, and additionally the customer satisfaction scores also showed improvement, going from 7.2 to 8.1 on a scale of 10, which is something that the team worked very hard on achieving through various initiatives."\n\nWord count: 89 words. Target: 30 words maximum.`,
    questions: [
      'Identify all writing problems in this passage (structure, clarity, concision, passive voice).',
      'Rewrite the executive summary in 30 words or fewer without losing key information.',
      'What principles guide effective executive communication?',
      'How would you coach the colleague to improve their writing going forward?',
    ],
    evaluationCriteria: [
      'Identifies passive voice, nominalisation, and redundancy',
      'Rewrites to ≤30 words with all key data preserved',
      'States principles: lead with insight, use active voice, quantify',
      'Provides constructive coaching approach',
    ],
  },
];

const OPERATIONS_TASKS: SimTask[] = [
  {
    id: 'ops-sim-001',
    title: 'Optimise a Broken Fulfilment Process',
    difficulty: 'hard',
    timeLimit: 1200,
    description: 'Analyse an e-commerce fulfilment operation and reduce order-to-ship time.',
    scenario: `An e-commerce company has an average order-to-ship time of 4.2 days against a 1-day target. Current process:\n\n• Order received → Warehouse picks items (avg 6 hours, 15% error rate)\n• Quality check (avg 2 hours, manual)\n• Packing (avg 1.5 hours)\n• Carrier handoff (only 2 pickup windows: 9am and 3pm)\n• Orders placed after 2pm miss the 3pm pickup\n\nVolume: 500 orders/day. Staff: 12 warehouse workers, 2 QC staff.`,
    questions: [
      'Map the current process and calculate where time is being lost.',
      'What is the single highest-leverage change you would make first?',
      'How would you reduce the 15% pick error rate?',
      'Design the future-state process with a realistic timeline to achieve the 1-day target.',
    ],
    evaluationCriteria: [
      'Correctly identifies carrier pickup windows as critical constraint',
      'Proposes adding evening pickup window or same-day cutoff adjustment',
      'Addresses pick error rate with barcode scanning or zone picking',
      'Calculates realistic capacity with current staffing',
      'Prioritises changes by impact vs effort',
    ],
  },
];

// ─── Non-technical task pool mapping ─────────────────────────────────────────

export const NON_TECHNICAL_TASK_POOLS: Record<string, SimTask[]> = {
  'Product Manager':              PM_TASKS,
  'Project Manager':              PM_TASKS,   // shares PM-style tasks
  'Business Analyst':             BA_TASKS,
  'Human Resources':              HR_TASKS,
  'Digital Marketing Specialist': MARKETING_TASKS,
  'Writing Consultant':           WRITING_TASKS,
  'UX Designer':                  PM_TASKS,   // product-sense overlap
  'Sales Manager':                BA_TASKS,   // case-study overlap
  'Operations Manager':           OPERATIONS_TASKS,
  'Financial Analyst':            BA_TASKS,   // analytical overlap
};

/**
 * Returns duration-scaled simulation tasks for a non-technical role.
 */
export function getNonTechnicalFallbackTasks(role: string, durationMin: number): SimTask[] {
  const pool = NON_TECHNICAL_TASK_POOLS[role] ?? PM_TASKS;
  let count: number;
  if (durationMin <= 5)       count = 1;
  else if (durationMin <= 10) count = Math.min(2, pool.length);
  else if (durationMin <= 15) count = Math.min(3, pool.length);
  else if (durationMin <= 25) count = Math.min(4, pool.length);
  else                        count = pool.length;
  return pool.slice(0, count);
}
