import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { PromptTemplate } from '@langchain/core/prompts';
import { StringOutputParser } from '@langchain/core/output_parsers';
import { RunnableSequence } from '@langchain/core/runnables';
import { config } from '../config/env';
import { Question } from '../types/gemini.types';
import { v4 as uuidv4 } from 'uuid';

/**
 * RAG Service for Job Description-based Interview Question Generation
 * Uses LangChain with Google Gemini for intelligent question generation
 */
export class RAGService {
  private model: ChatGoogleGenerativeAI;
  private questionCache: Set<string> = new Set();

  constructor() {
    if (!config.geminiApiKey) {
      throw new Error('GEMINI_API_KEY is not configured');
    }

    // Initialize Gemini model with LangChain
    // Use ONLY models/gemini-flash-latest for all operations
    this.model = new ChatGoogleGenerativeAI({
      apiKey: config.geminiApiKey,
      model: 'models/gemini-flash-latest',
      temperature: 0.7,
      maxOutputTokens: 2048,
    });
  }

  /**
   * Generate interview questions based on Job Description using RAG approach
   * @param jobDescription - The job description text
   * @param role - Job role/title
   * @param previousQuestions - Previously asked questions to avoid duplicates
   * @param difficulty - Question difficulty level
   * @param count - Number of questions to generate
   * @returns Array of generated questions
   */
  async generateQuestionsFromJD(
    jobDescription: string,
    role: string,
    previousQuestions: Question[] = [],
    difficulty: 'easy' | 'medium' | 'hard' = 'medium',
    count: number = 5
  ): Promise<Question[]> {
    try {
      console.log('🔍 RAG Service: Starting JD analysis');
      console.log('📄 JD Length:', jobDescription.length);
      console.log('👤 Role:', role);
      console.log('📊 Difficulty:', difficulty);
      console.log('🔢 Count:', count);

      // Validate inputs
      if (!jobDescription || jobDescription.trim().length === 0) {
        throw new Error('Job description is empty or undefined');
      }

      if (jobDescription.trim().length < 50) {
        throw new Error('Job description is too short (minimum 50 characters required)');
      }

      if (!role || role.trim().length === 0) {
        throw new Error('Job role is required');
      }

      // Extract key information from JD using RAG
      console.log('🔍 Step 1: Analyzing job description...');
      const jdAnalysis = await this.analyzeJobDescription(jobDescription);
      console.log('✅ JD Analysis complete:', {
        requiredSkills: jdAnalysis.requiredSkills.length,
        responsibilities: jdAnalysis.responsibilities.length,
        experienceLevel: jdAnalysis.experienceLevel
      });

      // Generate questions based on JD analysis
      console.log('🔍 Step 2: Generating contextual questions...');
      const questions = await this.generateContextualQuestions(
        jdAnalysis,
        role,
        previousQuestions,
        difficulty,
        count
      );

      console.log(`✅ RAG Service: Generated ${questions.length} questions successfully`);
      return questions;
    } catch (error) {
      console.error('❌ RAG Service Error:', error);
      console.error('Error details:', error instanceof Error ? error.message : 'Unknown error');
      console.error('Stack trace:', error instanceof Error ? error.stack : 'No stack trace');
      throw error;
    }
  }

  /**
   * Analyze Job Description to extract key requirements and skills
   * This is the "Retrieval" part of RAG
   */
  private async analyzeJobDescription(jobDescription: string): Promise<{
    requiredSkills: string[];
    responsibilities: string[];
    qualifications: string[];
    experienceLevel: string;
    technicalStack: string[];
    softSkills: string[];
  }> {
    try {
      console.log('🔍 Analyzing JD with LangChain...');
      
      const analysisPrompt = PromptTemplate.fromTemplate(`
You are an expert HR analyst. Analyze the following job description and extract key information.

JOB DESCRIPTION:
{jobDescription}

Extract and return the following information in JSON format:
{{
  "requiredSkills": ["skill1", "skill2", ...],
  "responsibilities": ["responsibility1", "responsibility2", ...],
  "qualifications": ["qualification1", "qualification2", ...],
  "experienceLevel": "entry|mid|senior",
  "technicalStack": ["tech1", "tech2", ...],
  "softSkills": ["skill1", "skill2", ...]
}}

Focus on:
1. Technical skills and tools mentioned
2. Key responsibilities and duties
3. Required qualifications and certifications
4. Experience level indicators
5. Soft skills and interpersonal requirements

Return ONLY the JSON object, no additional text.
`);

      const chain = RunnableSequence.from([
        analysisPrompt,
        this.model,
        new StringOutputParser(),
      ]);

      console.log('📤 Sending JD to Gemini for analysis...');
      const result = await chain.invoke({ jobDescription });
      console.log('📥 Received analysis response, length:', result.length);
      console.log('📄 Response preview:', result.substring(0, 200));

      try {
        // Clean up the response to extract JSON
        let jsonText = result.trim();
        if (jsonText.startsWith('```json')) {
          jsonText = jsonText.replace(/```json\n?/g, '').replace(/```\n?/g, '');
        } else if (jsonText.startsWith('```')) {
          jsonText = jsonText.replace(/```\n?/g, '');
        }

        const parsed = JSON.parse(jsonText);
        console.log('✅ Successfully parsed JD analysis');
        return parsed;
      } catch (parseError) {
        console.error('❌ Failed to parse JD analysis JSON:', parseError);
        console.error('Raw response:', result);
        
        // Return default structure with some basic extraction
        console.warn('⚠️ Using fallback JD analysis structure');
        return {
          requiredSkills: [],
          responsibilities: [],
          qualifications: [],
          experienceLevel: 'mid',
          technicalStack: [],
          softSkills: [],
        };
      }
    } catch (error) {
      console.error('❌ Error in analyzeJobDescription:', error);
      throw new Error(`Failed to analyze job description: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Generate contextual questions based on JD analysis
   * This is the "Augmented Generation" part of RAG
   */
  private async generateContextualQuestions(
    jdAnalysis: any,
    role: string,
    previousQuestions: Question[],
    difficulty: 'easy' | 'medium' | 'hard',
    count: number
  ): Promise<Question[]> {
    try {
      console.log('🔍 Generating contextual questions from JD analysis...');
      
      const questionPrompt = PromptTemplate.fromTemplate(`
You are an expert technical interviewer. Generate {count} unique, high-quality interview questions for a {role} position based on the job description analysis.

JOB DESCRIPTION ANALYSIS:
- Required Skills: {requiredSkills}
- Key Responsibilities: {responsibilities}
- Qualifications: {qualifications}
- Experience Level: {experienceLevel}
- Technical Stack: {technicalStack}
- Soft Skills: {softSkills}

DIFFICULTY LEVEL: {difficulty}

PREVIOUSLY ASKED QUESTIONS (DO NOT REPEAT):
{previousQuestions}

REQUIREMENTS:
1. Generate questions that directly relate to the skills and responsibilities in the JD
2. Mix question types:
   - Technical questions (50%): Test specific skills mentioned in JD
   - Behavioral questions (30%): Assess experience with similar responsibilities
   - Situational questions (20%): Present scenarios related to the role

3. Each question should:
   - Be specific to the job requirements
   - Match the {difficulty} difficulty level
   - Be different from previously asked questions
   - Test real-world application of skills

4. For each question, provide:
   - The question text
   - Category (technical/behavioral/situational/coding)
   - 3-5 expected keywords from the JD that a good answer should include
   - Recommended time limit in seconds (60-300 seconds)

FORMAT YOUR RESPONSE AS JSON:
{{
  "questions": [
    {{
      "text": "Question text here",
      "category": "technical|behavioral|situational|coding",
      "expectedKeywords": ["keyword1", "keyword2", "keyword3"],
      "timeLimit": 180,
      "jdRelevance": "Brief explanation of how this relates to the JD"
    }}
  ]
}}

Generate exactly {count} questions now.
`);

      const chain = RunnableSequence.from([
        questionPrompt,
        this.model,
        new StringOutputParser(),
      ]);

      const previousQuestionsText = previousQuestions
        .map((q, idx) => `${idx + 1}. ${q.text}`)
        .join('\n');

      console.log('📤 Sending prompt to Gemini for question generation...');
      const result = await chain.invoke({
        count: count.toString(),
        role,
        requiredSkills: jdAnalysis.requiredSkills.join(', ') || 'Not specified',
        responsibilities: jdAnalysis.responsibilities.join(', ') || 'Not specified',
        qualifications: jdAnalysis.qualifications.join(', ') || 'Not specified',
        experienceLevel: jdAnalysis.experienceLevel || 'mid',
        technicalStack: jdAnalysis.technicalStack.join(', ') || 'Not specified',
        softSkills: jdAnalysis.softSkills.join(', ') || 'Not specified',
        difficulty,
        previousQuestions: previousQuestionsText || 'None',
      });

      console.log('📥 Received question generation response, length:', result.length);
      console.log('📄 Response preview:', result.substring(0, 200));

      const questions = this.parseQuestionsFromResponse(result, difficulty);
      console.log(`✅ Parsed ${questions.length} questions from response`);
      
      return questions;
    } catch (error) {
      console.error('❌ Error in generateContextualQuestions:', error);
      throw new Error(`Failed to generate contextual questions: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Parse questions from LangChain response
   */
  private parseQuestionsFromResponse(
    responseText: string,
    difficulty: 'easy' | 'medium' | 'hard'
  ): Question[] {
    try {
      console.log('🔍 Parsing questions from RAG response...');
      
      // Extract JSON from response
      let jsonText = responseText.trim();

      // Remove markdown code blocks if present
      if (jsonText.startsWith('```json')) {
        jsonText = jsonText.replace(/```json\n?/g, '').replace(/```\n?/g, '');
      } else if (jsonText.startsWith('```')) {
        jsonText = jsonText.replace(/```\n?/g, '');
      }

      const parsed = JSON.parse(jsonText);
      const questions: Question[] = [];

      if (parsed.questions && Array.isArray(parsed.questions)) {
        console.log(`📊 Found ${parsed.questions.length} questions in RAG response`);
        
        for (const q of parsed.questions) {
          const questionText = q.text || '';

          if (!questionText || questionText.trim().length === 0) {
            console.warn('⚠️ Skipping empty question in RAG response');
            continue;
          }

          // Skip if duplicate
          if (this.questionCache.has(questionText)) {
            console.warn('⚠️ Skipping duplicate question:', questionText.substring(0, 50));
            continue;
          }

          const question: Question = {
            id: uuidv4(),
            text: questionText,
            category: this.validateCategory(q.category),
            difficulty,
            expectedKeywords: Array.isArray(q.expectedKeywords)
              ? q.expectedKeywords
              : [],
            timeLimit: typeof q.timeLimit === 'number' ? q.timeLimit : 180,
          };

          questions.push(question);
          this.questionCache.add(questionText);
          console.log(`✅ Added RAG question ${questions.length}: ${questionText.substring(0, 60)}...`);
        }
      } else {
        console.error('❌ RAG response does not contain questions array');
        console.error('Parsed object keys:', Object.keys(parsed));
      }

      if (questions.length === 0) {
        console.error('❌ No valid questions were parsed from RAG response');
      }

      return questions;
    } catch (error) {
      console.error('❌ Failed to parse questions from RAG response:', error);
      console.error('Response text:', responseText);
      console.error('Error details:', error instanceof Error ? error.message : 'Unknown error');
      return [];
    }
  }

  /**
   * Validate and normalize question category
   */
  private validateCategory(
    category: string
  ): 'technical' | 'behavioral' | 'situational' | 'coding' {
    const validCategories = ['technical', 'behavioral', 'situational', 'coding'];
    const normalized = category?.toLowerCase();

    if (validCategories.includes(normalized)) {
      return normalized as 'technical' | 'behavioral' | 'situational' | 'coding';
    }

    return 'technical'; // Default fallback
  }

  /**
   * Clear question cache (useful for new sessions)
   */
  clearQuestionCache(): void {
    this.questionCache.clear();
  }
}

// Lazy singleton — defers instantiation until first use so dotenv has time to load
let _ragServiceInstance: RAGService | null = null;

export const ragService = new Proxy({} as RAGService, {
  get(_target, prop) {
    if (!_ragServiceInstance) {
      if (!process.env.GEMINI_API_KEY) {
        console.error('❌ GEMINI_API_KEY is not set. Please add it to backend/.env');
        console.error('   Get your key at: https://aistudio.google.com/app/apikey');
        throw new Error('GEMINI_API_KEY is required. Add it to backend/.env and restart the server.');
      }
      _ragServiceInstance = new RAGService();
    }
    const value = (_ragServiceInstance as any)[prop];
    return typeof value === 'function' ? value.bind(_ragServiceInstance) : value;
  }
});

export default ragService;
