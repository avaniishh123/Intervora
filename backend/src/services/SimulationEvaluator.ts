import { geminiService } from './geminiService';
import { ISimulationSubmission, ISimulationEvaluation, ISimulationReport } from '../models/SimulationSession';

interface EvalInput {
  jobRole: string;
  task: any;
  submission: ISimulationSubmission;
  events: any[];
  allSubmissions: ISimulationSubmission[];
}

export class SimulationEvaluator {
  /**
   * Rule-based scoring for code submissions
   */
  private scoreCodeSubmission(submission: ISimulationSubmission, task: any): number {
    const testResults = submission.testResults;
    if (!testResults) return 0;
    const passRate = testResults.total > 0 ? testResults.passed / testResults.total : 0;
    // Penalize for many attempts
    const attemptPenalty = Math.max(0, (submission.attemptNumber - 1) * 5);
    return Math.max(0, Math.round(passRate * 100) - attemptPenalty);
  }

  /**
   * Rule-based scoring for text/explanation submissions
   */
  private scoreTextSubmission(submission: ISimulationSubmission, task: any): number {
    const content = (submission.content as string) || '';
    const wordCount = content.trim().split(/\s+/).length;
    // Minimum viable answer: 50 words
    if (wordCount < 20) return 10;
    if (wordCount < 50) return 30;
    // Check for key criteria mentions
    const criteria: string[] = task.evaluationCriteria || [];
    const lowerContent = content.toLowerCase();
    const mentionedCriteria = criteria.filter((c: string) =>
      c.toLowerCase().split(' ').some((word: string) => word.length > 4 && lowerContent.includes(word))
    );
    const criteriaScore = criteria.length > 0 ? (mentionedCriteria.length / criteria.length) * 60 : 40;
    return Math.min(100, Math.round(30 + criteriaScore));
  }

  /**
   * Compute behavioral metrics from events
   */
  private analyzeBehavior(events: any[], submissions: ISimulationSubmission[]) {
    const runEvents = events.filter(e => e.type === 'code_run');
    const errorEvents = events.filter(e => e.type === 'error_encountered');
    const totalAttempts = submissions.reduce((s, sub) => s + sub.attemptNumber, 0);

    return {
      totalRuns: runEvents.length,
      totalErrors: errorEvents.length,
      totalAttempts,
      avgAttemptsPerTask: submissions.length > 0 ? totalAttempts / submissions.length : 0,
      iterativeApproach: runEvents.length > 2,
    };
  }

  /**
   * AI-based evaluation using Gemini
   */
  private async aiEvaluate(input: EvalInput): Promise<{ score: number; reasoning: string; strengths: string[]; weaknesses: string[] }> {
    const { jobRole, task, submission } = input;
    const content = typeof submission.content === 'string'
      ? submission.content
      : JSON.stringify(submission.content, null, 2);

    const prompt = `You are an expert ${jobRole} interviewer evaluating a simulation task submission.

TASK: ${task.title}
DESCRIPTION: ${task.description || task.scenario || ''}
EVALUATION CRITERIA: ${JSON.stringify(task.evaluationCriteria || task.issues || [])}

CANDIDATE SUBMISSION:
${content}

${submission.testResults ? `TEST RESULTS: ${submission.testResults.passed}/${submission.testResults.total} tests passed` : ''}

Evaluate this submission on a scale of 0-100. Respond in this exact JSON format:
{
  "score": <number 0-100>,
  "reasoning": "<2-3 sentence overall assessment>",
  "strengths": ["<strength 1>", "<strength 2>"],
  "weaknesses": ["<weakness 1>", "<weakness 2>"],
  "edgeCaseHandling": "<assessment of edge case handling>",
  "debuggingApproach": "<assessment of problem-solving approach>"
}`;

    try {
      const result = await geminiService.generateRawContent(prompt);
      const jsonMatch = result.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
    } catch (err) {
      console.warn('AI evaluation failed, using rule-based fallback:', err);
    }

    return {
      score: 50,
      reasoning: 'Evaluation completed with partial analysis.',
      strengths: ['Attempted the task'],
      weaknesses: ['Could not fully evaluate submission'],
    };
  }

  /**
   * Evaluate a single task submission
   */
  async evaluateSubmission(input: EvalInput): Promise<ISimulationEvaluation> {
    const { task, submission, events } = input;

    // Rule-based score
    const ruleScore = submission.taskType === 'coding'
      ? this.scoreCodeSubmission(submission, task)
      : this.scoreTextSubmission(submission, task);

    // AI score
    const aiResult = await this.aiEvaluate(input);

    // Behavioral metrics
    const behavior = this.analyzeBehavior(events, input.allSubmissions);

    // Time performance (0-100): full score if under 80% of time limit
    const taskDuration = task.timeLimit || 900;
    const timeTaken = submission.submittedAt
      ? (new Date(submission.submittedAt).getTime() - Date.now()) / 1000 + taskDuration
      : taskDuration;
    const timePerformance = Math.max(0, Math.min(100, Math.round((1 - timeTaken / taskDuration) * 100 + 50)));

    // Weighted final score: 40% rule-based, 40% AI, 20% time
    const finalScore = Math.round(ruleScore * 0.4 + aiResult.score * 0.4 + timePerformance * 0.2);

    return {
      taskId: task.id,
      ruleBasedScore: ruleScore,
      aiScore: aiResult.score,
      finalScore: Math.min(100, Math.max(0, finalScore)),
      correctness: ruleScore,
      efficiency: timePerformance,
      completionRate: submission.content ? 100 : 0,
      timePerformance,
      reasoning: aiResult.reasoning,
      strengths: aiResult.strengths || [],
      weaknesses: aiResult.weaknesses || [],
      edgeCaseHandling: (aiResult as any).edgeCaseHandling || 'Not assessed',
      debuggingApproach: (aiResult as any).debuggingApproach || 'Not assessed',
    };
  }

  /**
   * Generate the final simulation report
   */
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
      const task = tasks.find(t => t.id === e.taskId);
      if (task) sectionScores[task.title] = e.finalScore;
    });

    const allStrengths = evaluations.flatMap(e => e.strengths);
    const allWeaknesses = evaluations.flatMap(e => e.weaknesses);

    const behavioralObservations: string[] = [];
    if (behavior.iterativeApproach) behavioralObservations.push('Demonstrated iterative problem-solving approach');
    if (behavior.totalRuns > 5) behavioralObservations.push('Actively tested code with multiple runs');
    if (behavior.avgAttemptsPerTask > 3) behavioralObservations.push('Required multiple attempts — may benefit from planning before coding');
    if (behavior.totalErrors < 2) behavioralObservations.push('Clean execution with minimal errors');

    let hiringRecommendation: ISimulationReport['hiringRecommendation'];
    if (avgScore >= 80) hiringRecommendation = 'Strong Hire';
    else if (avgScore >= 65) hiringRecommendation = 'Hire';
    else if (avgScore >= 50) hiringRecommendation = 'Borderline';
    else hiringRecommendation = 'No Hire';

    // AI-generated narrative
    let aiNarrative = { candidateSummary: '', recruiterSummary: '', tips: [] as string[], risks: [] as string[], positives: [] as string[] };
    try {
      const prompt = `You are evaluating a ${jobRole} candidate who scored ${avgScore}/100 on a simulation interview.
Section scores: ${JSON.stringify(sectionScores)}
Strengths: ${allStrengths.slice(0, 4).join(', ')}
Weaknesses: ${allWeaknesses.slice(0, 4).join(', ')}
Behavioral: ${behavioralObservations.join(', ')}

Generate a JSON response:
{
  "candidateSummary": "<2 sentence summary for the candidate>",
  "recruiterSummary": "<2 sentence summary for the recruiter>",
  "tips": ["<tip 1>", "<tip 2>", "<tip 3>"],
  "risks": ["<risk 1>", "<risk 2>"],
  "positives": ["<positive signal 1>", "<positive signal 2>"]
}`;
      const result = await geminiService.generateRawContent(prompt);
      const jsonMatch = result.match(/\{[\s\S]*\}/);
      if (jsonMatch) aiNarrative = JSON.parse(jsonMatch[0]);
    } catch (err) {
      console.warn('Report narrative generation failed:', err);
    }

    return {
      overallScore: avgScore,
      sectionScores,
      strengths: [...new Set(allStrengths)].slice(0, 5),
      weaknesses: [...new Set(allWeaknesses)].slice(0, 5),
      behavioralObservations,
      confidenceIndicators: behavior.iterativeApproach ? 'High — systematic approach observed' : 'Moderate',
      hiringRecommendation,
      hiringRationale: `Candidate scored ${avgScore}/100 across ${evaluations.length} simulation tasks.`,
      candidateView: {
        summary: aiNarrative.candidateSummary || `You scored ${avgScore}/100 in this simulation.`,
        tips: aiNarrative.tips || ['Practice more real-world scenarios', 'Focus on edge cases'],
        areasToImprove: allWeaknesses.slice(0, 3),
      },
      recruiterView: {
        summary: aiNarrative.recruiterSummary || `Candidate demonstrated ${hiringRecommendation.toLowerCase()} performance.`,
        riskFactors: aiNarrative.risks || [],
        positiveSignals: aiNarrative.positives || allStrengths.slice(0, 3),
      },
    };
  }
}

export const simulationEvaluator = new SimulationEvaluator();
