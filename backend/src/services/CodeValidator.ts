import { geminiService } from './geminiService';
import { codeExecutor } from './CodeExecutor';
import { CodeFeedback, CodeValidationParams, TestResult } from '../types/coding.types';
import { Question } from '../types/gemini.types';
import { v4 as uuidv4 } from 'uuid';

/**
 * CodeValidator - Service for validating code submissions using Gemini AI
 * Evaluates code quality, efficiency, correctness, and best practices
 * Optionally executes code with test cases for validation
 */
export class CodeValidator {
  /**
   * Validate code submission with Gemini AI analysis and optional execution
   * @param params - Code validation parameters
   * @param executeTests - Whether to execute code with test cases (default: false)
   * @returns Code feedback with analysis and suggestions
   */
  async validateCode(params: CodeValidationParams, executeTests: boolean = false): Promise<CodeFeedback> {
    const { code, language, challengeTitle, challengeDescription, testCases } = params;

    // Execute test cases if requested and language is supported
    let testResults: TestResult[] | undefined;
    if (executeTests && testCases && testCases.length > 0 && codeExecutor.isSupportedLanguage(language)) {
      try {
        testResults = await codeExecutor.executeCode(code, language, testCases);
      } catch (error) {
        console.error('Code execution failed:', error);
        // Continue with Gemini analysis even if execution fails
      }
    }

    // Build validation prompt (include test results if available)
    const prompt = this.buildValidationPrompt(
      code,
      language,
      challengeTitle,
      challengeDescription,
      testCases,
      testResults
    );

    // Use Gemini Pro model for comprehensive code analysis
    const operation = async () => {
      const model = geminiService.getProModel();
      const result = await model.generateContent(prompt);
      const response = result.response;
      const text = response.text();
      
      return this.parseCodeFeedback(text, testResults);
    };

    return geminiService.callWithRetry(operation);
  }

  /**
   * Build prompt for code validation
   */
  private buildValidationPrompt(
    code: string,
    language: string,
    challengeTitle: string,
    challengeDescription: string,
    testCases?: any[],
    testResults?: TestResult[]
  ): string {
    let prompt = `You are an expert code reviewer and technical interviewer. Analyze the following code submission comprehensively.\n\n`;

    prompt += `CHALLENGE: ${challengeTitle}\n\n`;
    prompt += `DESCRIPTION:\n${challengeDescription}\n\n`;
    prompt += `PROGRAMMING LANGUAGE: ${language}\n\n`;

    if (testCases && testCases.length > 0) {
      prompt += `TEST CASES:\n`;
      testCases.forEach((tc, idx) => {
        if (!tc.isHidden) {
          prompt += `Test ${idx + 1}: Input: ${JSON.stringify(tc.input)}, Expected Output: ${JSON.stringify(tc.expectedOutput)}\n`;
        }
      });
      prompt += `\n`;
    }

    // Include test execution results if available
    if (testResults && testResults.length > 0) {
      prompt += `TEST EXECUTION RESULTS:\n`;
      testResults.forEach((result) => {
        const status = result.passed ? '✓ PASSED' : '✗ FAILED';
        prompt += `Test ${result.testCase}: ${status}`;
        if (!result.passed) {
          if (result.error) {
            prompt += ` - Error: ${result.error}`;
          } else {
            prompt += ` - Expected: ${JSON.stringify(result.expectedOutput)}, Got: ${JSON.stringify(result.actualOutput)}`;
          }
        }
        if (result.executionTime) {
          prompt += ` (${result.executionTime}ms)`;
        }
        prompt += `\n`;
      });
      prompt += `\n`;
    }

    prompt += `SUBMITTED CODE:\n\`\`\`${language}\n${code}\n\`\`\`\n\n`;

    prompt += `EVALUATION REQUIREMENTS:

1. **Correctness Analysis** (0-100):
   - Does the code solve the problem correctly?
   - Does it handle edge cases?
   - Are there any logical errors?

2. **Code Quality** (0-100):
   - Is the code readable and well-structured?
   - Are variable names meaningful?
   - Is the code properly formatted?
   - Are there appropriate comments?

3. **Efficiency Analysis**:
   - What is the time complexity (Big O notation)?
   - What is the space complexity?
   - Are there more efficient approaches?

4. **Best Practices**:
   - Does the code follow language-specific conventions?
   - Are there any code smells or anti-patterns?
   - Is error handling appropriate?
   - Are there security concerns?

5. **Strengths**: List 2-4 specific strengths in the implementation

6. **Improvements**: List 2-4 specific areas for improvement

7. **Suggestions**: Provide 2-3 actionable suggestions to improve the code

8. **Follow-up Questions**: Generate 1-2 technical follow-up questions based on the code implementation to probe deeper understanding

SCORING GUIDELINES:
- 90-100: Excellent solution with optimal approach and clean code
- 75-89: Good solution with minor improvements possible
- 60-74: Working solution but with notable inefficiencies or code quality issues
- 40-59: Partially working solution with significant problems
- 0-39: Non-working solution or fundamentally flawed approach

FORMAT YOUR RESPONSE AS JSON:
{
  "isCorrect": true,
  "score": 85,
  "geminiAnalysis": {
    "codeQuality": 80,
    "efficiency": "Time: O(n log n), Space: O(1) - Good efficiency",
    "correctness": "The solution correctly handles all test cases including edge cases",
    "bestPractices": [
      "Follows PEP 8 style guidelines",
      "Uses descriptive variable names",
      "Includes proper error handling"
    ],
    "suggestions": [
      "Consider adding input validation",
      "Could optimize the inner loop",
      "Add docstrings for better documentation"
    ],
    "strengths": [
      "Clean and readable code structure",
      "Efficient algorithm choice",
      "Good edge case handling"
    ],
    "improvements": [
      "Missing input validation for null/empty arrays",
      "Could use more descriptive variable names in nested loops",
      "Lacks comments for complex logic sections"
    ]
  },
  "followUpQuestions": [
    {
      "text": "How would you modify this solution to handle very large datasets that don't fit in memory?",
      "category": "technical",
      "expectedKeywords": ["streaming", "chunking", "external sorting", "memory management"],
      "timeLimit": 180
    },
    {
      "text": "What would be the trade-offs of using a different data structure for this problem?",
      "category": "technical",
      "expectedKeywords": ["time complexity", "space complexity", "trade-offs"],
      "timeLimit": 120
    }
  ]
}

Provide your comprehensive code analysis now.`;

    return prompt;
  }

  /**
   * Parse code feedback from Gemini response
   */
  private parseCodeFeedback(responseText: string, testResults?: TestResult[]): CodeFeedback {
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

      // Parse follow-up questions
      const followUpQuestions: Question[] = [];
      if (Array.isArray(parsed.followUpQuestions)) {
        for (const q of parsed.followUpQuestions) {
          if (q.text) {
            followUpQuestions.push({
              id: uuidv4(),
              text: q.text,
              category: this.validateCategory(q.category),
              difficulty: 'medium',
              expectedKeywords: Array.isArray(q.expectedKeywords) ? q.expectedKeywords : [],
              timeLimit: q.timeLimit || 180
            });
          }
        }
      }

      const feedback: CodeFeedback = {
        isCorrect: parsed.isCorrect === true,
        score: this.validateScore(parsed.score),
        testResults, // Include test execution results if available
        geminiAnalysis: {
          codeQuality: this.validateScore(parsed.geminiAnalysis?.codeQuality),
          efficiency: parsed.geminiAnalysis?.efficiency || 'Not analyzed',
          correctness: parsed.geminiAnalysis?.correctness || 'Not analyzed',
          bestPractices: Array.isArray(parsed.geminiAnalysis?.bestPractices) 
            ? parsed.geminiAnalysis.bestPractices 
            : [],
          suggestions: Array.isArray(parsed.geminiAnalysis?.suggestions) 
            ? parsed.geminiAnalysis.suggestions 
            : [],
          strengths: Array.isArray(parsed.geminiAnalysis?.strengths) 
            ? parsed.geminiAnalysis.strengths 
            : [],
          improvements: Array.isArray(parsed.geminiAnalysis?.improvements) 
            ? parsed.geminiAnalysis.improvements 
            : []
        },
        followUpQuestions
      };

      return feedback;
    } catch (error) {
      console.error('Failed to parse code feedback from Gemini response:', error);
      console.error('Response text:', responseText);
      
      // Return fallback feedback
      return {
        isCorrect: false,
        score: 0,
        testResults, // Include test results even in fallback
        geminiAnalysis: {
          codeQuality: 0,
          efficiency: 'Unable to analyze',
          correctness: 'Unable to analyze',
          bestPractices: [],
          suggestions: ['Please ensure your code is properly formatted and complete'],
          strengths: [],
          improvements: ['Code could not be analyzed. Please check syntax and completeness']
        },
        followUpQuestions: []
      };
    }
  }

  /**
   * Validate question category
   */
  private validateCategory(category: string): 'technical' | 'behavioral' | 'situational' | 'coding' {
    const validCategories = ['technical', 'behavioral', 'situational', 'coding'];
    const normalized = category?.toLowerCase();
    
    if (validCategories.includes(normalized)) {
      return normalized as 'technical' | 'behavioral' | 'situational' | 'coding';
    }
    
    return 'technical';
  }

  /**
   * Validate score (0-100)
   */
  private validateScore(score: any): number {
    const num = typeof score === 'number' ? score : parseInt(score, 10);
    if (isNaN(num)) return 0;
    return Math.min(100, Math.max(0, num));
  }
}

// Export singleton instance
export const codeValidator = new CodeValidator();
export default codeValidator;
