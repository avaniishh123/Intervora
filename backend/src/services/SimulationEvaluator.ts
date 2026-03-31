import { geminiService } from './geminiService';
import { ISimulationSubmission, ISimulationEvaluation, ISimulationReport } from '../models/SimulationSession';

interface EvalInput {
  jobRole: string;
  task: any;
  submission: ISimulationSubmission;
  events: any[];
  allSubmissions: ISimulationSubmission[];
}

// ── Role-specific evaluation rubrics ─────────────────────────────────────────
const ROLE_RUBRICS: Record<string, string> = {
  'Software Engineer': `Evaluate on: (1) Correctness — does the logic solve the problem? (2) Code quality — naming, structure, readability. (3) Time/space complexity — is the approach optimal? (4) Edge case handling — empty input, overflow, duplicates. (5) Debugging approach — did they identify and fix the bug systematically?`,
  'Backend Developer': `Evaluate on: (1) API design correctness. (2) Database query efficiency. (3) Error handling and validation. (4) Scalability considerations. (5) Security awareness (SQL injection, auth).`,
  'Frontend Developer': `Evaluate on: (1) Component structure and reusability. (2) State management correctness. (3) Performance awareness (re-renders, memoization). (4) Accessibility considerations. (5) CSS/layout correctness.`,
  'Full Stack Developer': `Evaluate on: (1) Frontend-backend integration understanding. (2) API design. (3) State management. (4) Database interaction. (5) End-to-end flow correctness.`,
  'AI/ML Engineer': `Evaluate on: (1) Understanding of ML concepts (overfitting, data leakage, bias-variance). (2) Correct preprocessing pipeline. (3) Model selection reasoning. (4) Evaluation metric choice. (5) Practical implementation knowledge.`,
  'Data Scientist': `Evaluate on: (1) Statistical reasoning accuracy. (2) Data interpretation correctness. (3) Feature engineering creativity. (4) Business insight quality. (5) SQL/query correctness.`,
  'Cloud Engineer': `Evaluate on: (1) Architecture correctness and best practices. (2) Security and IAM understanding. (3) Cost optimization awareness. (4) High availability and fault tolerance. (5) Correct service selection (AWS/GCP/Azure).`,
  'DevOps Engineer': `Evaluate on: (1) CI/CD pipeline correctness. (2) Infrastructure as code understanding. (3) Monitoring and observability. (4) Incident response quality. (5) Security and secrets management.`,
  'Cybersecurity Engineer': `Evaluate on: (1) Vulnerability identification accuracy. (2) Attack vector classification. (3) Remediation quality and completeness. (4) Incident response procedure. (5) Regulatory/compliance awareness.`,
};

// ── Deterministic rule-based scorer (always runs, never fails) ───────────────
function ruleBasedScore(submission: ISimulationSubmission, task: any): number {
  if (submission.taskType === 'coding') {
    const tr = submission.testResults;
    if (!tr || tr.total === 0) return 20;
    const passRate = tr.passed / tr.total;
    const attemptPenalty = Math.max(0, (submission.attemptNumber - 1) * 4);
    return Math.max(10, Math.round(passRate * 90) - attemptPenalty);
  }
  // Text/analysis submission
  const content = typeof submission.content === 'string' ? submission.content : JSON.stringify(submission.content);
  const words = content.trim().split(/\s+/).filter(Boolean).length;
  if (words < 20) return 15;
  if (words < 50) return 35;
  const criteria: string[] = task.evaluationCriteria || [];
  const lower = content.toLowerCase();
  const hits = criteria.filter(c =>
    c.toLowerCase().split(' ').some(w => w.length > 4 && lower.includes(w))
  ).length;
  const criteriaScore = criteria.length > 0 ? (hits / criteria.length) * 55 : 40;
  return Math.min(95, Math.round(30 + criteriaScore));
}

// ── Parse Gemini JSON response safely ────────────────────────────────────────
function parseGeminiJson<T>(raw: string, fallback: T): T {
  try {
    // Strip markdown code fences if present
    const cleaned = raw.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (match) return JSON.parse(match[0]) as T;
  } catch (_) {}
  return fallback;
}

export class SimulationEvaluator {

  // ── Gemini evaluation with retry + fallback ──────────────────────────────
  private async geminiEvaluate(input: EvalInput): Promise<{
    score: number;
    reasoning: string;
    strengths: string[];
    weaknesses: string[];
    improvements: string[];
    technicalAccuracy: number;
    clarity: number;
    depth: number;
    edgeCaseHandling: string;
    debuggingApproach: string;
  }> {
    const { jobRole, task, submission } = input;
    const rubric = ROLE_RUBRICS[jobRole] || ROLE_RUBRICS['Software Engineer'];
    const content = typeof submission.content === 'string'
      ? submission.content
      : JSON.stringify(submission.content, null, 2);

    const testSummary = submission.testResults
      ? `Test results: ${submission.testResults.passed}/${submission.testResults.total} passed.`
      : '';

    const taskContext = task.scenario || task.description || task.problemStatement || '';
    const criteria = (task.evaluationCriteria || task.issues || []).join('; ');

    const prompt = `You are a senior ${jobRole} interviewer conducting a technical simulation interview. Evaluate the candidate's submission with the precision and rigor of a FAANG-level technical interview.

## Task
Title: ${task.title}
Difficulty: ${task.difficulty || 'medium'}
Context: ${taskContext}
Evaluation Criteria: ${criteria || 'Technical accuracy, clarity, depth, problem-solving approach'}

## Candidate Submission
${content}

${testSummary}

## Evaluation Rubric
${rubric}

## CRITICAL SCORING RULES — READ CAREFULLY:
1. A score of 0 is ONLY for completely blank, gibberish, or totally off-topic submissions. Any submission with relevant technical content must score at least 15.
2. Partial credit is MANDATORY. If the candidate addresses even one evaluation criterion correctly, they earn at least 25 points.
3. For text/analysis submissions: score based on technical accuracy (40%), relevance to scenario (25%), completeness (20%), reasoning quality (15%).
4. Do NOT penalize for writing style — only penalize for technical incorrectness or missing key concepts.

## Score Bands:
- 80-100: Technically correct, specific, demonstrates deep understanding, addresses all criteria
- 60-79: Mostly correct, minor gaps, addresses most criteria
- 40-59: Partial understanding, addresses some criteria, misses key concepts
- 20-39: Vague or mostly incorrect, addresses few criteria
- 1-19: Barely relevant, almost no correct content
- 0: Completely blank, pure gibberish, or zero relevance to the task

Respond ONLY with valid JSON in this exact format (no markdown, no extra text):
{
  "score": <integer 0-100>,
  "technicalAccuracy": <integer 0-100>,
  "clarity": <integer 0-100>,
  "depth": <integer 0-100>,
  "reasoning": "<2-3 sentence overall assessment referencing specific aspects of their answer>",
  "strengths": ["<specific strength from their actual answer>", "<another specific strength>"],
  "weaknesses": ["<specific gap or error in their answer>", "<another weakness>"],
  "improvements": ["<concrete actionable improvement>", "<another improvement>"],
  "edgeCaseHandling": "<assessment of how they handled edge cases or corner scenarios>",
  "debuggingApproach": "<assessment of their problem-solving and debugging methodology>"
}`;

    const fallback = {
      score: ruleBasedScore(submission, task),
      technicalAccuracy: 50,
      clarity: 50,
      depth: 50,
      reasoning: `Submission evaluated for ${task.title}. ${testSummary}`,
      strengths: ['Attempted the task', 'Provided a response'],
      weaknesses: ['Could not fully assess — please review manually'],
      improvements: ['Provide more detailed explanations', 'Address all evaluation criteria'],
      edgeCaseHandling: 'Not fully assessed',
      debuggingApproach: 'Not fully assessed',
    };

    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const raw = await geminiService.generateRawContent(prompt);
        const parsed = parseGeminiJson(raw, null);
        if (parsed && typeof (parsed as any).score === 'number') {
          const p = parsed as any;
          // Apply content floor — never return 0 for a non-empty submission
          const contentWords = content.trim().split(/\s+/).filter(Boolean).length;
          const contentFloor = contentWords >= 10 ? Math.max(15, Math.min(40, Math.round(contentWords / 3))) : 0;
          const rawScore = Math.min(100, Math.max(0, Math.round(p.score)));
          const finalScore = contentWords >= 10 ? Math.max(contentFloor, rawScore) : rawScore;
          return {
            score: finalScore,
            technicalAccuracy: Math.min(100, Math.max(0, Math.round(p.technicalAccuracy || p.score))),
            clarity: Math.min(100, Math.max(0, Math.round(p.clarity || p.score))),
            depth: Math.min(100, Math.max(0, Math.round(p.depth || p.score))),
            reasoning: p.reasoning || fallback.reasoning,
            strengths: Array.isArray(p.strengths) && p.strengths.length > 0 ? p.strengths.slice(0, 4) : fallback.strengths,
            weaknesses: Array.isArray(p.weaknesses) ? p.weaknesses.slice(0, 4) : fallback.weaknesses,
            improvements: Array.isArray(p.improvements) ? p.improvements.slice(0, 3) : fallback.improvements,
            edgeCaseHandling: p.edgeCaseHandling || fallback.edgeCaseHandling,
            debuggingApproach: p.debuggingApproach || fallback.debuggingApproach,
          };
        }
      } catch (err) {
        console.warn(`Gemini evaluation attempt ${attempt}/3 failed:`, err);
        if (attempt < 3) await new Promise(r => setTimeout(r, 800 * attempt));
      }
    }

    return fallback;
  }

  // ── Behavioral analysis ──────────────────────────────────────────────────
  private analyzeBehavior(events: any[], submissions: ISimulationSubmission[]) {
    const runs = events.filter(e => e.type === 'code_run').length;
    const errors = events.filter(e => e.type === 'error_encountered').length;
    const totalAttempts = submissions.reduce((s, sub) => s + sub.attemptNumber, 0);
    return {
      totalRuns: runs,
      totalErrors: errors,
      totalAttempts,
      avgAttemptsPerTask: submissions.length > 0 ? totalAttempts / submissions.length : 0,
      iterativeApproach: runs > 2,
    };
  }

  // ── Main evaluation entry point ──────────────────────────────────────────
  async evaluateSubmission(input: EvalInput): Promise<ISimulationEvaluation> {
    const { task, submission, events } = input;

    const rule = ruleBasedScore(submission, task);
    const ai = await this.geminiEvaluate(input);

    // Weighted blend: 35% rule-based (objective), 65% Gemini (qualitative)
    const blended = Math.round(rule * 0.35 + ai.score * 0.65);

    // Time performance
    const taskDuration = task.timeLimit || 900;
    const timeTaken = submission.submittedAt
      ? (new Date(submission.submittedAt).getTime() - Date.now()) / 1000 + taskDuration
      : taskDuration * 0.7;
    const timePerf = Math.max(20, Math.min(100, Math.round((1 - Math.max(0, timeTaken) / taskDuration) * 100 + 50)));

    const finalScore = Math.min(100, Math.max(0, Math.round(blended * 0.85 + timePerf * 0.15)));

    return {
      taskId: task.id,
      ruleBasedScore: rule,
      aiScore: ai.score,
      finalScore,
      correctness: rule,
      efficiency: timePerf,
      completionRate: submission.content ? 100 : 0,
      timePerformance: timePerf,
      reasoning: ai.reasoning,
      strengths: ai.strengths,
      weaknesses: ai.weaknesses,
      edgeCaseHandling: ai.edgeCaseHandling,
      debuggingApproach: ai.debuggingApproach,
    };
  }

  // ── Final report generation ──────────────────────────────────────────────
  async generateReport(
    jobRole: string,
    tasks: any[],
    submissions: ISimulationSubmission[],
    evaluations: ISimulationEvaluation[],
    events: any[]
  ): Promise<ISimulationReport> {
    const behavior = this.analyzeBehavior(events, submissions);
    const avgScore = evaluations.length > 0
      ? Math.round(evaluations.reduce((s, e) => s + e.finalScore, 0) / evaluations.length)
      : 0;

    const sectionScores: Record<string, number> = {};
    evaluations.forEach(e => {
      const t = tasks.find(t => t.id === e.taskId);
      if (t) sectionScores[t.title] = e.finalScore;
    });

    const allStrengths = [...new Set(evaluations.flatMap(e => e.strengths))].slice(0, 6);
    const allWeaknesses = [...new Set(evaluations.flatMap(e => e.weaknesses))].slice(0, 6);

    const behavioralObs: string[] = [];
    if (behavior.iterativeApproach) behavioralObs.push('Demonstrated iterative problem-solving with multiple test runs');
    if (behavior.totalRuns > 5) behavioralObs.push('Actively validated code — shows engineering discipline');
    if (behavior.avgAttemptsPerTask > 3) behavioralObs.push('Required multiple attempts — planning before coding would help');
    if (behavior.totalErrors < 2) behavioralObs.push('Clean execution with minimal runtime errors');
    if (submissions.length === tasks.length) behavioralObs.push('Completed all assigned tasks within the session');

    let rec: ISimulationReport['hiringRecommendation'];
    if (avgScore >= 80) rec = 'Strong Hire';
    else if (avgScore >= 65) rec = 'Hire';
    else if (avgScore >= 50) rec = 'Borderline';
    else rec = 'No Hire';

    // Build per-task detail for the Gemini report prompt
    const taskDetails = evaluations.map(e => {
      const t = tasks.find(t => t.id === e.taskId);
      return `Task: ${t?.title || e.taskId} | Score: ${e.finalScore}/100 | Strengths: ${e.strengths.join(', ')} | Weaknesses: ${e.weaknesses.join(', ')}`;
    }).join('\n');

    const reportPrompt = `You are a senior ${jobRole} hiring manager writing a post-interview evaluation report.

## Candidate Performance Summary
Role: ${jobRole}
Overall Score: ${avgScore}/100
Hiring Recommendation: ${rec}
Tasks Completed: ${submissions.length}/${tasks.length}

## Per-Task Breakdown
${taskDetails || 'No tasks completed'}

## Behavioral Observations
${behavioralObs.join('; ') || 'No behavioral data'}

## Key Strengths
${allStrengths.join('; ') || 'None identified'}

## Key Weaknesses
${allWeaknesses.join('; ') || 'None identified'}

Write a professional evaluation report. Respond ONLY with valid JSON (no markdown):
{
  "candidateSummary": "<3-4 sentence honest assessment for the candidate — what they did well, what to improve, encouragement>",
  "recruiterSummary": "<3-4 sentence assessment for the recruiter — technical fit, risk factors, recommendation rationale>",
  "tips": ["<specific actionable tip 1>", "<specific actionable tip 2>", "<specific actionable tip 3>"],
  "risks": ["<hiring risk 1>", "<hiring risk 2>"],
  "positives": ["<positive signal 1>", "<positive signal 2>", "<positive signal 3>"]
}`;

    let narrative = {
      candidateSummary: `You scored ${avgScore}/100 in this ${jobRole} simulation. ${rec === 'Strong Hire' || rec === 'Hire' ? 'Strong performance overall.' : 'There is room for improvement in key areas.'}`,
      recruiterSummary: `Candidate demonstrated ${rec.toLowerCase()} performance with an overall score of ${avgScore}/100 across ${evaluations.length} simulation tasks.`,
      tips: ['Practice more real-world scenarios', 'Focus on edge cases and error handling', 'Review system design fundamentals'],
      risks: allWeaknesses.slice(0, 2),
      positives: allStrengths.slice(0, 3),
    };

    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const raw = await geminiService.generateRawContent(reportPrompt);
        const parsed = parseGeminiJson(raw, null);
        if (parsed && (parsed as any).candidateSummary) {
          narrative = parsed as typeof narrative;
          break;
        }
      } catch (err) {
        console.warn(`Report generation attempt ${attempt}/3 failed:`, err);
        if (attempt < 3) await new Promise(r => setTimeout(r, 1000 * attempt));
      }
    }

    return {
      overallScore: avgScore,
      sectionScores,
      strengths: allStrengths,
      weaknesses: allWeaknesses,
      behavioralObservations: behavioralObs,
      confidenceIndicators: behavior.iterativeApproach ? 'High — systematic approach observed' : 'Moderate',
      hiringRecommendation: rec,
      hiringRationale: `Candidate scored ${avgScore}/100 across ${evaluations.length} simulation tasks for the ${jobRole} role.`,
      candidateView: {
        summary: narrative.candidateSummary,
        tips: narrative.tips || [],
        areasToImprove: allWeaknesses.slice(0, 3),
      },
      recruiterView: {
        summary: narrative.recruiterSummary,
        riskFactors: narrative.risks || [],
        positiveSignals: narrative.positives || allStrengths.slice(0, 3),
      },
    };
  }
}

export const simulationEvaluator = new SimulationEvaluator();
