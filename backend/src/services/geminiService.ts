import { GoogleGenerativeAI, GenerativeModel } from '@google/generative-ai';
import { config } from '../config/env';
import { 
  Question, 
  QuestionGenerationParams,
  AnswerEvaluationParams,
  Evaluation,
  TopicTracker
} from '../types/gemini.types';
import { v4 as uuidv4 } from 'uuid';
import { ragService } from './ragService';

/**
 * GeminiService - Core service for Google Gemini AI interactions
 * Handles question generation, answer evaluation, and AI-powered analysis
 */
export class GeminiService {
  private questionCache: Set<string> = new Set(); // Track generated questions to avoid duplicates
  private genAI: GoogleGenerativeAI;
  private proModel: GenerativeModel;
  private flashModel: GenerativeModel;
  
  // Domain-specific topic mapping
  private domainTopics: { [role: string]: string[] } = {
    'Software Engineer': [
      'Data Structures & Algorithms',
      'Database Management (DBMS)',
      'Operating Systems',
      'Computer Networks',
      'Object-Oriented Programming (OOP)',
      'System Design (Basic-Mid)',
      'Coding & Problem Solving'
    ],
    'AI/ML Engineer': [
      'Machine Learning Fundamentals',
      'Deep Learning',
      'Statistics & Probability',
      'Python for ML',
      'Model Evaluation & Metrics',
      'Data Preprocessing',
      'Real-world ML Use Cases'
    ],
    'Cloud Engineer': [
      'AWS/Azure/GCP Services',
      'Virtual Machines & Compute',
      'Storage & Networking',
      'Identity & Access Management (IAM)',
      'Cloud Architecture Patterns',
      'Deployment Models',
      'Cost Optimization'
    ],
    'Cybersecurity Engineer': [
      'Network Security',
      'Cryptography',
      'Web Application Security',
      'OWASP Top 10',
      'Malware Analysis',
      'Penetration Testing',
      'Incident Response'
    ],
    'Data Scientist': [
      'Python/R Programming',
      'Statistics & Hypothesis Testing',
      'Machine Learning',
      'Data Cleaning & Preprocessing',
      'Data Visualization',
      'SQL & Database Querying',
      'Business Intelligence & Insights'
    ],
    'DevOps Engineer': [
      'Linux System Administration',
      'Git & Version Control',
      'CI/CD Pipelines',
      'Docker & Containerization',
      'Kubernetes Orchestration',
      'Cloud Deployment',
      'Monitoring & Logging'
    ],
    'Full Stack Developer': [
      'Frontend Technologies (HTML, CSS, JS, React)',
      'Backend Development (Node.js, APIs)',
      'Database Design & Management',
      'Authentication & Authorization',
      'System Design & Architecture',
      'Deployment & DevOps'
    ],
    'Backend Developer': [
      'API Design & Development',
      'Database Design & Optimization',
      'Authentication & Security',
      'Caching Strategies',
      'System Design & Scalability',
      'Performance Optimization'
    ],
    'Frontend Developer': [
      'HTML, CSS, JavaScript Fundamentals',
      'React/Vue/Angular Frameworks',
      'UI/UX Design Principles',
      'Performance Optimization',
      'API Integration',
      'State Management'
    ]
  };
  
  // Track topics covered per session
  private sessionTopicTrackers: Map<string, TopicTracker> = new Map();

  constructor() {
    // Verify API key is configured
    if (!config.geminiApiKey) {
      console.error('❌ GEMINI_API_KEY is not configured');
      throw new Error('GEMINI_API_KEY is not configured');
    }

    this.genAI = new GoogleGenerativeAI(config.geminiApiKey);
    
    // Use ONLY models/gemini-flash-latest for all operations
    this.proModel = this.genAI.getGenerativeModel({ 
      model: 'models/gemini-flash-latest'
    });
    
    this.flashModel = this.genAI.getGenerativeModel({ 
      model: 'models/gemini-flash-latest'
    });

    // Log model and API key validation at startup (key presence only — never log key value)
    console.log('✅ Gemini API initialized successfully');
    console.log('🤖 Model: models/gemini-flash-latest');
    console.log('🔑 API Key: configured ✅');
  }

  /**
   * Execute Gemini API call with retry logic and error handling
   */
  async callWithRetry<T>(
    operation: () => Promise<T>,
    maxRetries: number = 3
  ): Promise<T> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error as Error;
        
        console.error(`Gemini API attempt ${attempt} failed:`, error);

        // Don't retry on the last attempt
        if (attempt === maxRetries) {
          break;
        }

        // Exponential backoff: 1s, 2s, 4s
        const backoffMs = 1000 * Math.pow(2, attempt - 1);
        console.log(`Retrying in ${backoffMs}ms...`);
        await new Promise(resolve => setTimeout(resolve, backoffMs));
      }
    }

    throw new Error(
      `Gemini API failed after ${maxRetries} attempts: ${lastError?.message || 'Unknown error'}`
    );
  }

  /**
   * Get the Pro model for complex tasks (now using flash model only)
   */
  getProModel(): GenerativeModel {
    console.log('🤖 Using model: models/gemini-flash-latest (Pro operations)');
    return this.proModel;
  }

  /**
   * Get the Flash model for simple tasks
   */
  getFlashModel(): GenerativeModel {
    console.log('🤖 Using model: models/gemini-flash-latest (Flash operations)');
    return this.flashModel;
  }

  /**
   * Generate interview questions based on role, resume, and job description
   */
  async generateQuestions(params: QuestionGenerationParams): Promise<Question[]> {
    const {
      role,
      resume,
      jobDescription,
      previousQuestions = [],
      difficulty = 'medium',
      count = 5
    } = params;

    console.log('📝 generateQuestions called with params:', {
      role,
      hasResume: !!resume,
      hasJobDescription: !!jobDescription,
      jdLength: jobDescription?.length || 0,
      difficulty,
      count
    });

    // Validate inputs
    if (!role || role.trim().length === 0) {
      throw new Error('Job role is required for question generation');
    }

    // Use RAG service for JD-based interviews
    if (jobDescription && jobDescription.trim().length > 0) {
      console.log('🔍 Using RAG service for JD-based question generation');
      console.log('📄 Job Description preview:', jobDescription.substring(0, 200) + '...');
      
      try {
        const questions = await ragService.generateQuestionsFromJD(
          jobDescription,
          role,
          previousQuestions,
          difficulty,
          count
        );
        
        if (questions && questions.length > 0) {
          console.log(`✅ RAG service generated ${questions.length} questions successfully`);
          return questions;
        } else {
          console.warn('⚠️ RAG service returned empty questions array, falling back to standard generation');
        }
      } catch (error) {
        console.error('❌ RAG service failed with error:', error);
        console.error('Stack trace:', error instanceof Error ? error.stack : 'No stack trace');
        console.log('⚠️ Falling back to standard generation with JD in prompt');
      }
    }

    // Initialize topic tracker if not exists
    const sessionId = params.sessionId || `session_${Date.now()}`;
    if (!this.sessionTopicTrackers.has(sessionId)) {
      this.initializeTopicTracker(sessionId, role);
    }

    // Build the domain-aware prompt
    const prompt = this.buildQuestionGenerationPrompt(
      role,
      resume,
      jobDescription,
      previousQuestions,
      difficulty,
      count,
      sessionId
    );

    console.log('📝 Using standard Gemini generation (Flash model only)');

    // Use ONLY Flash model for all question generation
    const operation = async () => {
      const result = await this.flashModel.generateContent(prompt);
      const response = result.response;
      const text = response.text();
      
      console.log('📥 Received response from Gemini, parsing questions...');
      return this.parseQuestionsFromResponse(text, role, difficulty);
    };

    let questions = await this.callWithRetry(operation);
    
    // CRITICAL FIX: Retry if no valid questions generated (only greetings)
    if (questions.length === 0) {
      console.warn('⚠️ No valid questions generated, retrying with stricter prompt...');
      
      const strictPrompt = `DO NOT INCLUDE GREETING. ONLY INTERVIEW QUESTIONS.

You are conducting a ${role} interview. Generate EXACTLY ${count} technical interview questions.

FORBIDDEN WORDS: Hello, Welcome, How are you, Introduction, Greeting

REQUIRED: Only ${role}-specific technical questions.

FORMAT AS JSON:
{
  "questions": [
    {
      "text": "Technical question here",
      "category": "technical",
      "topic": "Technical Topic",
      "expectedKeywords": ["keyword1", "keyword2"],
      "timeLimit": 180
    }
  ]
}

Generate exactly ${count} questions now.`;

      const retryOperation = async () => {
        const result = await this.flashModel.generateContent(strictPrompt);
        const response = result.response;
        const text = response.text();
        
        console.log('📥 Retry response received, parsing questions...');
        return this.parseQuestionsFromResponse(text, role, difficulty);
      };

      questions = await this.callWithRetry(retryOperation);
      console.log(`🔄 Retry generation produced ${questions.length} questions`);
    }
    
    console.log(`✅ Final generation result: ${questions.length} questions`);
    return questions;
  }

  /**
   * Build domain-aware prompt for question generation
   */
  private buildQuestionGenerationPrompt(
    role: string,
    resume?: string,
    jobDescription?: string,
    _previousQuestions: Question[] = [],
    difficulty: string = 'medium',
    count: number = 5,
    sessionId?: string
  ): string {
    // Get domain-specific topics and next topic to focus on
    const domainTopics = this.domainTopics[role] || [];
    const tracker = sessionId ? this.sessionTopicTrackers.get(sessionId) : null;
    const lastScore = _previousQuestions.length > 0 ? 
      _previousQuestions[_previousQuestions.length - 1].evaluation?.score : undefined;
    
    const nextTopic = sessionId ? this.getNextTopic(sessionId, _previousQuestions, lastScore) : domainTopics[0] || 'General';
    
    // CRITICAL FIX: Never generate greeting questions - they are handled separately
    let prompt = `You are a professional AI interviewer conducting a ${role} interview.

🚨 CRITICAL INSTRUCTION: The greeting has already been completed. Start directly with interview questions.

DO NOT INCLUDE:
- Greetings ("Hello", "Welcome", "How are you")
- Introduction questions
- Personal pleasantries
- Any non-technical questions

GENERATE ONLY: Role-specific interview questions for ${role}

🎯 ROLE: ${role}
📚 DOMAIN TOPICS TO COVER:
`;

    // Add domain topics
    domainTopics.forEach((topic, index) => {
      const covered = tracker?.coveredTopics.includes(topic) ? '✅' : '⭕';
      const performance = tracker?.topicPerformance[topic] ? 
        ` (Avg: ${tracker.topicPerformance[topic].toFixed(1)})` : '';
      prompt += `${index + 1}. ${covered} ${topic}${performance}\n`;
    });

    prompt += `
🎯 CURRENT FOCUS TOPIC: ${nextTopic}
📋 GENERATE ${count} QUESTIONS PRIMARILY FROM: ${nextTopic}

🚫 STRICT RULES:
1. NO GREETINGS OR INTRODUCTIONS - Interview questions only
2. NEVER repeat the same topic continuously unless performance is weak (<60 score)
3. MUST cover ALL domain topics systematically
4. Questions must be SPECIFIC to ${role} responsibilities
5. Balance theory (40%) + practical (40%) + problem-solving (20%)
6. Adapt difficulty based on previous performance
7. NO generic programming questions - must be role-specific

`;

    // Add context based on available information
    if (resume) {
      prompt += `CANDIDATE'S RESUME:\n${resume}\n\nGenerate questions that are personalized based on the candidate's experience, skills, and projects mentioned in their resume.\n\n`;
    }

    if (jobDescription) {
      prompt += `JOB DESCRIPTION:\n${jobDescription}\n\nGenerate questions that align with the requirements and responsibilities in this job description.\n\n`;
    }

    prompt += `DIFFICULTY LEVEL: ${difficulty}\n\n`;

    // Add previous questions to avoid duplicates
    if (_previousQuestions.length > 0) {
      prompt += `PREVIOUSLY ASKED QUESTIONS (DO NOT REPEAT):\n`;
      _previousQuestions.forEach((q, idx) => {
        prompt += `${idx + 1}. ${q.text}\n`;
      });
      prompt += `\n`;
    }

    prompt += `REQUIREMENTS:
1. Generate a mix of question types:
   - Technical questions (40%): Test specific technical knowledge and skills
   - Behavioral questions (30%): Assess past experiences and soft skills
   - Situational questions (20%): Present hypothetical scenarios
   - Coding questions (10%): For technical roles, include algorithm/problem-solving

2. Each question should be:
   - Clear and specific to ${nextTopic}
   - Appropriate for the ${difficulty} difficulty level
   - Relevant to ${role} responsibilities
   - Different from previously asked questions
   - Cover practical, real-world scenarios

3. For each question, provide:
   - The question text (specific to ${nextTopic})
   - Category (technical/behavioral/situational/coding)
   - Topic (must be from domain topics list)
   - 3-5 expected keywords that a good answer should include
   - Recommended time limit in seconds (60-300 seconds)

🎯 TOPIC-SPECIFIC EXAMPLES FOR ${role}:
${this.getTopicExamples(role, nextTopic)}

🔄 ADAPTIVE LOGIC:
- If last score ≥ 80: Move to harder subtopic or new topic
- If last score 60-79: Continue current topic with different angle
- If last score < 60: Ask supporting/foundational question in same topic
- Always ensure questions test both theory AND practical application

FORMAT YOUR RESPONSE AS JSON:
{
  "questions": [
    {
      "text": "Question text here",
      "category": "technical|behavioral|situational|coding",
      "topic": "${nextTopic}",
      "expectedKeywords": ["keyword1", "keyword2", "keyword3"],
      "timeLimit": 180
    }
  ]
}

Generate exactly ${count} questions focused on ${nextTopic} for ${role} role.`;

    return prompt;
  }

  /**
   * Parse questions from Gemini response
   */
  private parseQuestionsFromResponse(
    responseText: string,
    _role: string,
    difficulty: string
  ): Question[] {
    try {
      // Extract JSON from response (handle markdown code blocks)
      let jsonText = responseText.trim();
      
      console.log('🔍 Parsing response, length:', jsonText.length);
      console.log('📄 Response preview:', jsonText.substring(0, 300));
      
      // Remove markdown code blocks if present
      if (jsonText.startsWith('```json')) {
        jsonText = jsonText.replace(/```json\n?/g, '').replace(/```\n?/g, '');
      } else if (jsonText.startsWith('```')) {
        jsonText = jsonText.replace(/```\n?/g, '');
      }

      const parsed = JSON.parse(jsonText);
      const questions: Question[] = [];

      if (parsed.questions && Array.isArray(parsed.questions)) {
        console.log(`📊 Found ${parsed.questions.length} questions in response`);
        
        for (const q of parsed.questions) {
          const questionId = uuidv4();
          const questionText = q.text || '';

          if (!questionText || questionText.trim().length === 0) {
            console.warn('⚠️ Skipping empty question');
            continue;
          }

          // CRITICAL FIX: Filter out greeting questions
          const greetingKeywords = ['hello', 'welcome', 'how are you', 'introduction', 'good morning', 'good afternoon'];
          const isGreeting = greetingKeywords.some(keyword => 
            questionText.toLowerCase().includes(keyword)
          );
          
          if (isGreeting || q.category === 'greeting') {
            console.warn('⚠️ Skipping greeting question:', questionText.substring(0, 50));
            continue;
          }

          // Skip if duplicate
          if (this.questionCache.has(questionText)) {
            console.warn('⚠️ Skipping duplicate question:', questionText.substring(0, 50));
            continue;
          }

          const question: Question = {
            id: questionId,
            text: questionText,
            category: this.validateCategory(q.category),
            difficulty: difficulty as 'easy' | 'medium' | 'hard',
            expectedKeywords: Array.isArray(q.expectedKeywords) ? q.expectedKeywords : [],
            timeLimit: typeof q.timeLimit === 'number' ? q.timeLimit : 180,
            topic: q.topic || 'General'
          };

          questions.push(question);
          this.questionCache.add(questionText);
          console.log(`✅ Added question ${questions.length}: ${questionText.substring(0, 60)}...`);
        }
      } else {
        console.error('❌ Response does not contain questions array');
        console.error('Parsed object keys:', Object.keys(parsed));
      }

      if (questions.length === 0) {
        console.error('❌ No valid questions were parsed from response');
      }

      return questions;
    } catch (error) {
      console.error('❌ Failed to parse questions from Gemini response:', error);
      console.error('Response text:', responseText);
      console.error('Error details:', error instanceof Error ? error.message : 'Unknown error');
      
      // Fallback: return empty array
      return [];
    }
  }

  /**
   * Validate and normalize question category (NO GREETINGS ALLOWED)
   */
  private validateCategory(category: string): 'technical' | 'behavioral' | 'situational' | 'coding' {
    const validCategories = ['technical', 'behavioral', 'situational', 'coding'];
    const normalized = category?.toLowerCase();
    
    // CRITICAL FIX: Never allow greeting category
    if (normalized === 'greeting') {
      return 'technical'; // Convert greetings to technical
    }
    
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

  /**
   * Initialize topic tracker for a session
   */
  initializeTopicTracker(sessionId: string, role: string): void {
    this.sessionTopicTrackers.set(sessionId, {
      role,
      coveredTopics: [],
      topicPerformance: {}
    });
    console.log(`🎯 Initialized topic tracker for ${role} interview (Session: ${sessionId})`);
  }

  /**
   * Get next topic to cover based on performance and coverage
   */
  private getNextTopic(sessionId: string, _previousQuestions: Question[], lastScore?: number): string {
    const tracker = this.sessionTopicTrackers.get(sessionId);
    if (!tracker) {
      console.warn('⚠️ No topic tracker found, using first available topic');
      return this.domainTopics['Software Engineer']?.[0] || 'General Programming';
    }

    const availableTopics = this.domainTopics[tracker.role] || [];
    const uncoveredTopics = availableTopics.filter(topic => !tracker.coveredTopics.includes(topic));

    // If we have uncovered topics, prioritize them
    if (uncoveredTopics.length > 0) {
      // If last answer was weak (score < 60), stay on current topic for follow-up
      if (lastScore !== undefined && lastScore < 60 && tracker.currentTopic) {
        console.log(`📉 Weak performance (${lastScore}), staying on topic: ${tracker.currentTopic}`);
        return tracker.currentTopic;
      }
      
      // Move to next uncovered topic
      const nextTopic = uncoveredTopics[0];
      console.log(`🎯 Moving to new topic: ${nextTopic}`);
      return nextTopic;
    }

    // All topics covered, find weakest performing topic for reinforcement
    const weakestTopic = Object.entries(tracker.topicPerformance)
      .sort(([,a], [,b]) => a - b)[0]?.[0];
    
    if (weakestTopic) {
      console.log(`🔄 Revisiting weakest topic: ${weakestTopic} (Score: ${tracker.topicPerformance[weakestTopic]})`);
      return weakestTopic;
    }

    // Fallback to random topic
    return availableTopics[Math.floor(Math.random() * availableTopics.length)];
  }

  /**
   * Get topic-specific examples for the prompt
   */
  private getTopicExamples(role: string, topic: string): string {
    const examples: { [key: string]: { [topic: string]: string[] } } = {
      'Software Engineer': {
        'Data Structures & Algorithms': [
          'Explain time complexity of merge sort vs quicksort in worst case',
          'Design a data structure for LRU cache with O(1) operations',
          'How would you detect a cycle in a linked list?'
        ],
        'Database Management (DBMS)': [
          'Explain ACID properties with real-world examples',
          'Design database schema for an e-commerce platform',
          'What are the trade-offs between normalization and denormalization?'
        ],
        'Operating Systems': [
          'Explain deadlock prevention vs deadlock avoidance',
          'How does virtual memory management work?',
          'Compare process vs thread creation overhead'
        ]
      }
    };

    const roleExamples = examples[role];
    if (!roleExamples || !roleExamples[topic]) {
      return `Generate questions specific to ${topic} in the context of ${role} responsibilities.`;
    }

    return roleExamples[topic].map((example, index) => 
      `${index + 1}. ${example}`
    ).join('\n');
  }

  /**
   * Update topic performance based on answer evaluation
   */
  updateTopicPerformance(sessionId: string, topic: string, score: number): void {
    const tracker = this.sessionTopicTrackers.get(sessionId);
    if (!tracker) return;

    // Add topic to covered if not already there
    if (!tracker.coveredTopics.includes(topic)) {
      tracker.coveredTopics.push(topic);
    }

    // Update performance (running average)
    const currentAvg = tracker.topicPerformance[topic] || 0;
    const currentCount = tracker.coveredTopics.filter(t => t === topic).length;
    tracker.topicPerformance[topic] = ((currentAvg * (currentCount - 1)) + score) / currentCount;

    tracker.currentTopic = topic;
    
    console.log(`📊 Updated topic performance: ${topic} = ${tracker.topicPerformance[topic].toFixed(1)} (Score: ${score})`);
  }

  /**
   * Evaluate candidate's answer with Gemini AI and generate next question
   * Optimized to complete within 15 seconds
   */
  async evaluateAnswer(params: AnswerEvaluationParams): Promise<Evaluation> {
    const { question, answer, sessionId } = params;
    
    console.log('🧠 Evaluating answer with Gemini AI...');
    console.log(`📝 Question: ${question.text.substring(0, 100)}...`);
    console.log(`💬 Answer length: ${answer.length} characters`);

    // Build evaluation prompt
    const prompt = `You are an expert technical interviewer. Evaluate this candidate's answer and generate the next question.

CURRENT QUESTION:
${question.text}

CANDIDATE'S ANSWER:
${answer}

EVALUATION CRITERIA:
1. Technical Accuracy (40%): Is the answer technically correct?
2. Depth & Detail (30%): Does it show deep understanding?
3. Clarity (20%): Is it well-explained and structured?
4. Relevance (10%): Does it address the question?

SCORING GUIDE:
- 90-100: Excellent - Deep understanding, accurate, well-explained
- 75-89: Good - Solid answer with minor gaps
- 60-74: Satisfactory - Basic understanding, needs improvement
- 40-59: Weak - Significant gaps or inaccuracies
- 0-39: Poor - Incorrect or irrelevant

NEXT QUESTION LOGIC:
- If score ≥ 80: Ask harder question or move to new topic
- If score 60-79: Continue current topic with different angle
- If score < 60: Ask foundational question in same topic

RESPONSE FORMAT (JSON):
{
  "score": 85,
  "feedback": "Brief constructive feedback (2-3 sentences)",
  "strengths": ["strength1", "strength2"],
  "improvements": ["improvement1", "improvement2"],
  "appreciation": "Brief encouraging message",
  "nextQuestion": {
    "text": "Next interview question based on performance",
    "category": "technical|behavioral|situational|coding",
    "topic": "Specific topic",
    "difficulty": "easy|medium|hard",
    "timeLimit": 180
  },
  "sentiment": {
    "overall": "positive|neutral|negative",
    "confidence": 75,
    "clarity": 80,
    "professionalism": 85,
    "tone": "engaged|hesitant|confident"
  }
}

Generate evaluation and next question now.`;

    try {
      // Use Flash model for speed (target: <10 seconds)
      const startTime = Date.now();
      
      const result = await this.callWithRetry(async () => {
        return await this.flashModel.generateContent(prompt);
      }, 2); // Only 2 retries for speed

      const response = result.response;
      const text = response.text();
      const elapsedTime = Date.now() - startTime;
      
      console.log(`⏱️ Gemini evaluation completed in ${elapsedTime}ms`);

      // Parse response
      let jsonText = text.trim();
      if (jsonText.startsWith('```json')) {
        jsonText = jsonText.replace(/```json\n?/g, '').replace(/```\n?/g, '');
      } else if (jsonText.startsWith('```')) {
        jsonText = jsonText.replace(/```\n?/g, '');
      }

      const parsed = JSON.parse(jsonText);

      // Update topic performance if session ID provided
      if (sessionId && question.topic) {
        this.updateTopicPerformance(sessionId, question.topic, parsed.score);
      }

      // Build evaluation result
      const evaluation: Evaluation = {
        score: parsed.score || 70,
        feedback: parsed.feedback || 'Thank you for your answer.',
        strengths: parsed.strengths || ['Provided a response'],
        improvements: parsed.improvements || ['Continue with detailed explanations'],
        appreciation: parsed.appreciation || 'Good effort!',
        sentiment: {
          overall: parsed.sentiment?.overall || 'neutral',
          confidence: parsed.sentiment?.confidence || 60,
          clarity: parsed.sentiment?.clarity || 60,
          professionalism: parsed.sentiment?.professionalism || 70,
          tone: parsed.sentiment?.tone || 'engaged',
          emotions: {
            nervousness: 30,
            confidence: parsed.sentiment?.confidence || 60,
            hesitation: 25,
            excitement: 50,
            confusion: 20,
            stress: 30,
            enthusiasm: 60
          }
        }
      };

      // Add next question if provided
      if (parsed.nextQuestion) {
        evaluation.followUpQuestion = {
          id: uuidv4(),
          text: parsed.nextQuestion.text,
          category: this.validateCategory(parsed.nextQuestion.category),
          difficulty: parsed.nextQuestion.difficulty || 'medium',
          expectedKeywords: [],
          timeLimit: parsed.nextQuestion.timeLimit || 180,
          topic: parsed.nextQuestion.topic || question.topic
        };
      }

      console.log(`✅ Evaluation complete: Score ${evaluation.score}/100`);
      return evaluation;

    } catch (error) {
      console.error('❌ Gemini evaluation failed:', error);
      
      // Fast fallback evaluation
      return {
        score: 65,
        feedback: 'Thank you for your answer. Let\'s continue with the next question.',
        strengths: ['Provided a response to the question'],
        improvements: ['Try to provide more specific examples'],
        appreciation: 'Good effort!',
        sentiment: {
          overall: 'neutral',
          confidence: 60,
          clarity: 60,
          professionalism: 70,
          tone: 'engaged',
          emotions: {
            nervousness: 30,
            confidence: 60,
            hesitation: 25,
            excitement: 50,
            confusion: 20,
            stress: 30,
            enthusiasm: 60
          }
        },
        followUpQuestion: {
          id: uuidv4(),
          text: 'Can you describe a challenging technical problem you solved recently?',
          category: 'behavioral',
          difficulty: 'medium',
          expectedKeywords: [],
          timeLimit: 180,
          topic: question.topic || 'General'
        }
      };
    }
  }

  /**
   * Generate company-specific interview questions for a given company, role, and interviewer persona
   */
  async generateCompanyQuestions(params: {
    company: string;
    role: string;
    interviewerType: 'tech' | 'hiring' | 'hr';
    conversationHistory?: { role: string; content: string }[];
    count?: number;
  }): Promise<string[]> {
    const { company, role, interviewerType, conversationHistory = [], count = 2 } = params;

    const personaMap: Record<string, string> = {
      tech: 'Technical Lead — focus on system design, algorithms, coding practices, and technical depth specific to how this company operates',
      hiring: 'Hiring Manager — focus on role fit, team collaboration, past achievements, and alignment with company values and culture',
      hr: 'HR Specialist — focus on behavioral questions, career motivation, salary expectations, and cultural fit',
    };

    const historyText = conversationHistory.length > 0
      ? `\nPrevious conversation:\n${conversationHistory.map(m => `${m.role}: ${m.content}`).join('\n')}\n`
      : '';

    const prompt = `You are a ${personaMap[interviewerType]} at ${company} interviewing a ${role} candidate.

${historyText}
Generate exactly ${count} interview question(s) that:
1. Are specific to ${company}'s known engineering culture, tech stack, and interview style
2. Are appropriate for a ${role} position
3. Build naturally on the conversation history if provided
4. Are asked by a ${personaMap[interviewerType]}
5. Feel realistic and company-authentic

Return ONLY a JSON array of question strings, no extra text:
["Question 1 here", "Question 2 here"]`;

    try {
      const result = await this.callWithRetry(async () => {
        return await this.flashModel.generateContent(prompt);
      }, 2);

      let text = result.response.text().trim();
      if (text.startsWith('```json')) text = text.replace(/```json\n?/g, '').replace(/```\n?/g, '');
      else if (text.startsWith('```')) text = text.replace(/```\n?/g, '');

      const parsed = JSON.parse(text);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed.map(String);
      return [`Tell me about your experience relevant to this ${role} position at ${company}.`];
    } catch {
      return [`Tell me about your experience relevant to this ${role} position at ${company}.`];
    }
  }

  /**
   * Generate raw text content from a prompt — used by SimulationEvaluator
   */
  async generateRawContent(prompt: string): Promise<string> {
    return this.callWithRetry(async () => {
      const result = await this.flashModel.generateContent(prompt);
      return result.response.text();
    });
  }
}

// Export singleton instance
export const geminiService = new GeminiService();
export default geminiService;