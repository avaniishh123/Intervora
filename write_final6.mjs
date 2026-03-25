import { appendFileSync } from 'fs';
const T = 'frontend/src/pages/CompanyInterviewPage.tsx';

appendFileSync(T, `
// ── Fallback questions ────────────────────────────────────────────────────
const FALLBACK_QUESTIONS: Record<string, Record<string, string[]>> = {
  tech: {
    'Software Engineer': [
      'Walk me through how you would design a scalable microservices architecture.',
      'How do you approach debugging a production issue with no logs?',
      'Explain the CAP theorem and give a real-world example.',
      'How would you optimize a slow SQL query?',
      'Describe your approach to code reviews.',
    ],
    default: [
      'Describe your most technically challenging project.',
      'How do you handle technical debt in a fast-moving team?',
      'Walk me through your system design process.',
      'How do you stay current with new technologies?',
      'Describe a time you had to make a difficult technical trade-off.',
    ],
  },
  hiring: {
    default: [
      'Why are you interested in this role specifically?',
      'Where do you see yourself in 3 years?',
      'What is your biggest professional achievement?',
      'How do you handle competing priorities under tight deadlines?',
      'Describe a time you disagreed with your manager and how you handled it.',
    ],
  },
  hr: {
    default: [
      'Tell me about yourself and your career journey.',
      'What are your salary expectations?',
      'How do you handle work-life balance?',
      'Describe a conflict with a colleague and how you resolved it.',
      'What motivates you to do your best work?',
    ],
  },
};

const CROSS_QUESTIONS: Record<string, string[]> = {
  tech:   ['Can you elaborate on the technical implementation?', 'How does that scale to millions of users?', 'What trade-offs did you consider?'],
  hiring: ['How does that align with your long-term goals?', 'Can you give a specific example?', 'How did that impact the business outcome?'],
  hr:     ['What did you learn from that experience?', 'How would you handle that differently today?', 'How did that affect team morale?'],
};

function getFallbackQuestion(panelId: string, role: string): string {
  const bank = FALLBACK_QUESTIONS[panelId] ?? FALLBACK_QUESTIONS['tech'];
  const questions = bank[role] ?? bank['default'] ?? [];
  return questions[Math.floor(Math.random() * questions.length)] ?? 'Tell me about your experience.';
}

function getCrossQuestion(panelId: string): string {
  const qs = CROSS_QUESTIONS[panelId] ?? CROSS_QUESTIONS['tech'];
  return qs[Math.floor(Math.random() * qs.length)];
}
`, 'utf8');
console.log('Part 6 written');
