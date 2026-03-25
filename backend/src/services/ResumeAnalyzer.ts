import { GoogleGenerativeAI, GenerativeModel } from '@google/generative-ai';
import { config } from '../config/env';

/**
 * Experience item interface
 */
export interface ExperienceItem {
  company: string;
  role: string;
  duration: string;
  highlights: string[];
}

/**
 * Project item interface
 */
export interface ProjectItem {
  name: string;
  description: string;
  technologies: string[];
  highlights: string[];
}

/**
 * Education item interface
 */
export interface EducationItem {
  institution: string;
  degree: string;
  field: string;
  year: string;
}

/**
 * Resume analysis result interface
 */
export interface ResumeAnalysis {
  skills: string[];
  experience: ExperienceItem[];
  projects: ProjectItem[];
  education: EducationItem[];
  suggestions: string[];
  jdMatchScore?: number;
  strengthAreas: string[];
  improvementAreas: string[];
}

/**
 * ResumeAnalyzer service - Gemini-powered resume analysis
 */
export class ResumeAnalyzer {
  private genAI: GoogleGenerativeAI;
  private proModel: GenerativeModel;

  constructor() {
    if (!config.geminiApiKey) {
      throw new Error('GEMINI_API_KEY is not configured');
    }

    this.genAI = new GoogleGenerativeAI(config.geminiApiKey);
    
    // Use ONLY models/gemini-flash-latest for all operations
    this.proModel = this.genAI.getGenerativeModel({ 
      model: 'models/gemini-flash-latest'
    });
  }

  /**
   * Execute Gemini API call with retry logic
   */
  private async callWithRetry<T>(
    operation: () => Promise<T>,
    maxRetries: number = 5
  ): Promise<T> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`🔄 Gemini API attempt ${attempt}/${maxRetries}...`);
        const result = await operation();
        console.log(`✅ Gemini API attempt ${attempt} succeeded`);
        return result;
      } catch (error) {
        lastError = error as Error;
        console.error(`❌ Gemini API attempt ${attempt}/${maxRetries} failed:`, error);

        if (attempt === maxRetries) {
          console.error(`❌ All ${maxRetries} attempts failed`);
          break;
        }

        // Exponential backoff with jitter
        const baseBackoff = 1000 * Math.pow(2, attempt - 1);
        const jitter = Math.random() * 500;
        const backoffMs = baseBackoff + jitter;
        
        console.log(`⏳ Waiting ${Math.round(backoffMs)}ms before retry...`);
        await new Promise(resolve => setTimeout(resolve, backoffMs));
      }
    }

    throw new Error(
      `Gemini API failed after ${maxRetries} attempts: ${lastError?.message || 'Unknown error'}`
    );
  }

  /**
   * Analyze resume text and extract structured information
   * @param resumeText - Extracted text from resume
   * @param jobDescription - Optional job description for match scoring
   * @returns Structured resume analysis
   */
  async analyzeResume(
    resumeText: string,
    jobDescription?: string
  ): Promise<ResumeAnalysis> {
    const prompt = this.buildAnalysisPrompt(resumeText, jobDescription);

    const operation = async () => {
      const result = await this.proModel.generateContent(prompt);
      const response = result.response;
      const text = response.text();
      
      return this.parseAnalysisFromResponse(text);
    };

    return this.callWithRetry(operation);
  }

  /**
   * Build prompt for resume analysis
   */
  private buildAnalysisPrompt(resumeText: string, jobDescription?: string): string {
    let prompt = `You are an expert resume analyst and career coach. Analyze the following resume and provide comprehensive, structured feedback.\n\n`;

    prompt += `RESUME TEXT:\n${resumeText}\n\n`;

    if (jobDescription) {
      prompt += `JOB DESCRIPTION:\n${jobDescription}\n\n`;
      prompt += `Calculate a match score (0-100) between the resume and job description based on:\n`;
      prompt += `- Skills alignment\n`;
      prompt += `- Experience relevance\n`;
      prompt += `- Education requirements\n`;
      prompt += `- Overall fit\n\n`;
    }

    prompt += `ANALYSIS REQUIREMENTS:

1. SKILLS: Extract all technical and soft skills mentioned in the resume
   - Include programming languages, frameworks, tools, methodologies
   - Include soft skills like leadership, communication, teamwork

2. EXPERIENCE: Extract work experience with details
   - Company name
   - Job role/title
   - Duration (approximate if not exact)
   - Key highlights and achievements (3-5 per role)

3. PROJECTS: Extract notable projects
   - Project name
   - Brief description
   - Technologies used
   - Key highlights and outcomes

4. EDUCATION: Extract educational background
   - Institution name
   - Degree type (Bachelor's, Master's, PhD, etc.)
   - Field of study
   - Year of completion (or expected)

5. SUGGESTIONS: Provide 5-7 actionable suggestions to improve the resume
   - Formatting improvements
   - Content gaps to address
   - Keywords to add for ATS optimization
   - Ways to better highlight achievements

6. STRENGTH AREAS: Identify 3-5 key strengths based on the resume
   - What makes this candidate stand out
   - Strong skill areas
   - Impressive achievements

7. IMPROVEMENT AREAS: Identify 3-5 areas that need improvement
   - Missing information
   - Weak sections
   - Areas to expand or clarify
`;

    if (jobDescription) {
      prompt += `\n8. JD MATCH SCORE: Calculate match score (0-100) and explain the reasoning\n`;
    }

    prompt += `\nFORMAT YOUR RESPONSE AS JSON:
{
  "skills": ["skill1", "skill2", "skill3"],
  "experience": [
    {
      "company": "Company Name",
      "role": "Job Title",
      "duration": "Jan 2020 - Present",
      "highlights": ["achievement1", "achievement2", "achievement3"]
    }
  ],
  "projects": [
    {
      "name": "Project Name",
      "description": "Brief description",
      "technologies": ["tech1", "tech2"],
      "highlights": ["highlight1", "highlight2"]
    }
  ],
  "education": [
    {
      "institution": "University Name",
      "degree": "Bachelor's",
      "field": "Computer Science",
      "year": "2020"
    }
  ],
  "suggestions": [
    "suggestion1",
    "suggestion2",
    "suggestion3"
  ],
  "strengthAreas": [
    "strength1",
    "strength2",
    "strength3"
  ],
  "improvementAreas": [
    "improvement1",
    "improvement2",
    "improvement3"
  ]`;

    if (jobDescription) {
      prompt += `,
  "jdMatchScore": 85`;
    }

    prompt += `
}

Provide your analysis now.`;

    return prompt;
  }

  /**
   * Parse analysis from Gemini response
   */
  private parseAnalysisFromResponse(responseText: string): ResumeAnalysis {
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

      const analysis: ResumeAnalysis = {
        skills: Array.isArray(parsed.skills) ? parsed.skills : [],
        experience: Array.isArray(parsed.experience) ? parsed.experience : [],
        projects: Array.isArray(parsed.projects) ? parsed.projects : [],
        education: Array.isArray(parsed.education) ? parsed.education : [],
        suggestions: Array.isArray(parsed.suggestions) ? parsed.suggestions : [],
        strengthAreas: Array.isArray(parsed.strengthAreas) ? parsed.strengthAreas : [],
        improvementAreas: Array.isArray(parsed.improvementAreas) ? parsed.improvementAreas : [],
        jdMatchScore: typeof parsed.jdMatchScore === 'number' 
          ? Math.min(100, Math.max(0, parsed.jdMatchScore))
          : undefined
      };

      return analysis;
    } catch (error) {
      console.error('Failed to parse resume analysis from Gemini response:', error);
      console.error('Response text:', responseText);
      
      // Return fallback analysis
      return {
        skills: [],
        experience: [],
        projects: [],
        education: [],
        suggestions: ['Unable to analyze resume at this time. Please try again.'],
        strengthAreas: [],
        improvementAreas: []
      };
    }
  }
}

// Export singleton instance
export const resumeAnalyzer = new ResumeAnalyzer();
export default resumeAnalyzer;
