import { ISession, IPerformanceReport } from '../models/Session';
import { geminiService } from './geminiService';

/**
 * PerformanceAnalyzer - Generates comprehensive performance reports using Gemini AI
 */
export class PerformanceAnalyzer {
  /**
   * Generate a comprehensive performance report for a completed session
   * @param session - The interview session to analyze
   * @returns Performance report with scores, metrics, and recommendations
   */
  async generateReport(session: ISession): Promise<IPerformanceReport> {
    // Calculate basic metrics
    const overallScore = this.calculateOverallScore(session);
    const categoryScores = this.calculateCategoryScores(session);
    const wordCountMetrics = this.calculateWordCountMetrics(session);
    const sentimentAnalysis = this.calculateSentimentAnalysis(session);

    // Generate AI-powered insights
    const aiInsights = await this.generateAIInsights(session, overallScore, categoryScores);

    // Calculate CAR framework score if mentor mode was enabled
    let carFrameworkScore: number | undefined;
    if (session.metadata.mentorModeEnabled) {
      carFrameworkScore = await this.calculateCARFrameworkScore(session);
    }

    const report: IPerformanceReport = {
      overallScore,
      categoryScores,
      wordCountMetrics,
      sentimentAnalysis,
      strengths: aiInsights.strengths,
      weaknesses: aiInsights.weaknesses,
      recommendations: aiInsights.recommendations,
      carFrameworkScore
    };

    return report;
  }

  /**
   * Calculate overall performance score
   */
  private calculateOverallScore(session: ISession): number {
    if (session.questions.length === 0) {
      return 0;
    }

    const totalScore = session.questions.reduce((sum, q) => sum + q.evaluation.score, 0);
    const averageScore = totalScore / session.questions.length;
    
    return Math.round(averageScore * 100) / 100; // Round to 2 decimal places
  }

  /**
   * Calculate category-specific scores
   */
  private calculateCategoryScores(session: ISession): {
    technical: number;
    behavioral: number;
    communication: number;
  } {
    const technicalQuestions = session.questions.filter(
      q => q.question.category === 'technical' || q.question.category === 'coding'
    );
    const behavioralQuestions = session.questions.filter(
      q => q.question.category === 'behavioral' || q.question.category === 'situational'
    );

    // Calculate technical score
    const technicalScore = technicalQuestions.length > 0
      ? technicalQuestions.reduce((sum, q) => sum + q.evaluation.score, 0) / technicalQuestions.length
      : 0;

    // Calculate behavioral score
    const behavioralScore = behavioralQuestions.length > 0
      ? behavioralQuestions.reduce((sum, q) => sum + q.evaluation.score, 0) / behavioralQuestions.length
      : 0;

    // Calculate communication score (average of clarity and professionalism from sentiment)
    const communicationScore = session.questions.length > 0
      ? session.questions.reduce((sum, q) => {
          const clarity = q.evaluation.sentiment.clarity || 0;
          const professionalism = q.evaluation.sentiment.professionalism || 0;
          return sum + (clarity + professionalism) / 2;
        }, 0) / session.questions.length
      : 0;

    return {
      technical: Math.round(technicalScore * 100) / 100,
      behavioral: Math.round(behavioralScore * 100) / 100,
      communication: Math.round(communicationScore * 100) / 100
    };
  }

  /**
   * Calculate word count metrics
   */
  private calculateWordCountMetrics(session: ISession): {
    average: number;
    total: number;
    perQuestion: number[];
  } {
    const perQuestion = session.questions.map(q => {
      const words = q.answer.trim().split(/\s+/).filter(w => w.length > 0);
      return words.length;
    });

    const total = perQuestion.reduce((sum, count) => sum + count, 0);
    const average = session.questions.length > 0 ? total / session.questions.length : 0;

    return {
      average: Math.round(average * 100) / 100,
      total,
      perQuestion
    };
  }

  /**
   * Calculate aggregated sentiment analysis
   */
  private calculateSentimentAnalysis(session: ISession): {
    overall: string;
    confidence: number;
    clarity: number;
    professionalism: number;
  } {
    if (session.questions.length === 0) {
      return {
        overall: 'neutral',
        confidence: 0,
        clarity: 0,
        professionalism: 0
      };
    }

    // Calculate average sentiment metrics
    const avgConfidence = session.questions.reduce((sum, q) => sum + (q.evaluation.sentiment.confidence || 0), 0) / session.questions.length;
    const avgClarity = session.questions.reduce((sum, q) => sum + (q.evaluation.sentiment.clarity || 0), 0) / session.questions.length;
    const avgProfessionalism = session.questions.reduce((sum, q) => sum + (q.evaluation.sentiment.professionalism || 0), 0) / session.questions.length;

    // Determine overall sentiment based on averages
    const overallAvg = (avgConfidence + avgClarity + avgProfessionalism) / 3;
    let overall: string;
    if (overallAvg >= 70) {
      overall = 'positive';
    } else if (overallAvg >= 50) {
      overall = 'neutral';
    } else {
      overall = 'negative';
    }

    return {
      overall,
      confidence: Math.round(avgConfidence * 100) / 100,
      clarity: Math.round(avgClarity * 100) / 100,
      professionalism: Math.round(avgProfessionalism * 100) / 100
    };
  }

  /**
   * Generate AI-powered insights using Gemini
   */
  private async generateAIInsights(
    session: ISession,
    overallScore: number,
    categoryScores: { technical: number; behavioral: number; communication: number }
  ): Promise<{
    strengths: string[];
    weaknesses: string[];
    recommendations: string[];
  }> {
    // Build comprehensive prompt for Gemini
    const prompt = this.buildInsightsPrompt(session, overallScore, categoryScores);

    try {
      const model = geminiService.getProModel();
      const result = await geminiService.callWithRetry(async () => {
        const response = await model.generateContent(prompt);
        return response.response.text();
      });

      return this.parseInsightsFromResponse(result);
    } catch (error) {
      console.error('Error generating AI insights:', error);
      
      // Return fallback insights
      return {
        strengths: ['Completed the interview session'],
        weaknesses: ['Unable to generate detailed analysis at this time'],
        recommendations: ['Review your answers and practice more interviews']
      };
    }
  }

  /**
   * Build prompt for generating insights
   */
  private buildInsightsPrompt(
    session: ISession,
    overallScore: number,
    categoryScores: { technical: number; behavioral: number; communication: number }
  ): string {
    let prompt = `You are an expert career coach analyzing an interview performance. Generate comprehensive insights.\n\n`;

    prompt += `INTERVIEW DETAILS:\n`;
    prompt += `Job Role: ${session.jobRole}\n`;
    prompt += `Interview Mode: ${session.mode}\n`;
    prompt += `Total Questions: ${session.questions.length}\n`;
    prompt += `Overall Score: ${overallScore}/100\n`;
    prompt += `Technical Score: ${categoryScores.technical}/100\n`;
    prompt += `Behavioral Score: ${categoryScores.behavioral}/100\n`;
    prompt += `Communication Score: ${categoryScores.communication}/100\n\n`;

    prompt += `QUESTIONS AND ANSWERS:\n`;
    session.questions.forEach((q, idx) => {
      prompt += `\nQuestion ${idx + 1} [${q.question.category}]:\n`;
      prompt += `Q: ${q.question.text}\n`;
      prompt += `A: ${q.answer}\n`;
      prompt += `Score: ${q.evaluation.score}/100\n`;
      prompt += `Feedback: ${q.evaluation.feedback}\n`;
    });

    prompt += `\n\nANALYSIS REQUIREMENTS:
1. Identify 3-5 key STRENGTHS demonstrated across the interview
2. Identify 3-5 key WEAKNESSES or areas needing improvement
3. Provide 3-5 specific, actionable RECOMMENDATIONS for improvement

Be specific and reference actual answers when possible. Focus on patterns across multiple questions.

FORMAT YOUR RESPONSE AS JSON:
{
  "strengths": [
    "Specific strength with example",
    "Another strength..."
  ],
  "weaknesses": [
    "Specific weakness with example",
    "Another weakness..."
  ],
  "recommendations": [
    "Specific actionable recommendation",
    "Another recommendation..."
  ]
}

Generate the analysis now.`;

    return prompt;
  }

  /**
   * Parse insights from Gemini response
   */
  private parseInsightsFromResponse(responseText: string): {
    strengths: string[];
    weaknesses: string[];
    recommendations: string[];
  } {
    try {
      // Extract JSON from response
      let jsonText = responseText.trim();
      
      // Remove markdown code blocks if present
      if (jsonText.startsWith('```json')) {
        jsonText = jsonText.replace(/```json\n?/g, '').replace(/```\n?/g, '');
      } else if (jsonText.startsWith('```')) {
        jsonText = jsonText.replace(/```\n?/g, '');
      }

      const parsed = JSON.parse(jsonText);

      return {
        strengths: Array.isArray(parsed.strengths) ? parsed.strengths : [],
        weaknesses: Array.isArray(parsed.weaknesses) ? parsed.weaknesses : [],
        recommendations: Array.isArray(parsed.recommendations) ? parsed.recommendations : []
      };
    } catch (error) {
      console.error('Failed to parse insights:', error);
      
      return {
        strengths: ['Completed the interview'],
        weaknesses: ['Analysis unavailable'],
        recommendations: ['Continue practicing']
      };
    }
  }

  /**
   * Calculate CAR (Context-Action-Result) framework score
   */
  private async calculateCARFrameworkScore(session: ISession): Promise<number> {
    // Build prompt to evaluate CAR framework adherence
    const prompt = this.buildCARPrompt(session);

    try {
      const model = geminiService.getFlashModel(); // Use Flash for faster evaluation
      const result = await geminiService.callWithRetry(async () => {
        const response = await model.generateContent(prompt);
        return response.response.text();
      });

      return this.parseCARScoreFromResponse(result);
    } catch (error) {
      console.error('Error calculating CAR framework score:', error);
      return 0;
    }
  }

  /**
   * Build prompt for CAR framework evaluation
   */
  private buildCARPrompt(session: ISession): string {
    let prompt = `Evaluate how well the candidate followed the Context-Action-Result (CAR) framework in their answers.\n\n`;

    prompt += `The CAR framework requires answers to include:\n`;
    prompt += `- CONTEXT: Background and situation\n`;
    prompt += `- ACTION: Specific actions taken\n`;
    prompt += `- RESULT: Outcomes and impact\n\n`;

    prompt += `ANSWERS TO EVALUATE:\n`;
    session.questions.forEach((q, idx) => {
      if (q.question.category === 'behavioral' || q.question.category === 'situational') {
        prompt += `\nQuestion ${idx + 1}:\n`;
        prompt += `Q: ${q.question.text}\n`;
        prompt += `A: ${q.answer}\n`;
      }
    });

    prompt += `\n\nProvide an overall CAR framework adherence score (0-100) based on how well the candidate structured their behavioral/situational answers.\n\n`;
    prompt += `FORMAT: Return ONLY a number between 0 and 100.`;

    return prompt;
  }

  /**
   * Parse CAR score from response
   */
  private parseCARScoreFromResponse(responseText: string): number {
    try {
      // Extract number from response
      const match = responseText.match(/\d+/);
      if (match) {
        const score = parseInt(match[0], 10);
        return Math.min(100, Math.max(0, score));
      }
      return 0;
    } catch (error) {
      console.error('Failed to parse CAR score:', error);
      return 0;
    }
  }
}

// Export singleton instance
export const performanceAnalyzer = new PerformanceAnalyzer();
export default performanceAnalyzer;
