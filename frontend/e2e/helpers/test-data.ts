/**
 * Test data generators and fixtures for E2E tests
 */

export const generateTestUser = (prefix: string = 'test') => {
  const timestamp = Date.now();
  return {
    email: `${prefix}-${timestamp}@example.com`,
    password: 'Test123!@#',
    name: `Test User ${timestamp}`,
    role: 'candidate' as const,
  };
};

export const generateAdminUser = () => {
  const timestamp = Date.now();
  return {
    email: `admin-${timestamp}@example.com`,
    password: 'Admin123!@#',
    name: `Admin User ${timestamp}`,
    role: 'admin' as const,
  };
};

export const sampleJobDescription = `
We are looking for a Senior Software Engineer to join our team.

Requirements:
- 5+ years of experience in software development
- Strong knowledge of JavaScript, TypeScript, and React
- Experience with Node.js and Express
- Familiarity with MongoDB or PostgreSQL
- Understanding of RESTful APIs and WebSocket communication
- Experience with cloud platforms (AWS, GCP, or Azure)

Responsibilities:
- Design and implement scalable web applications
- Collaborate with cross-functional teams
- Write clean, maintainable code
- Participate in code reviews
- Mentor junior developers
`;

export const sampleResumeText = `
John Doe
Senior Software Engineer
john.doe@example.com | (555) 123-4567

EXPERIENCE
Senior Software Engineer | Tech Corp | 2020 - Present
- Led development of microservices architecture using Node.js and Express
- Implemented real-time features using Socket.io and WebRTC
- Reduced API response time by 40% through optimization
- Mentored team of 5 junior developers

Software Engineer | StartupXYZ | 2018 - 2020
- Built React-based dashboard with Chart.js visualizations
- Integrated third-party APIs including payment gateways
- Implemented JWT authentication and authorization

SKILLS
Languages: JavaScript, TypeScript, Python, Java
Frontend: React, Vue.js, HTML5, CSS3
Backend: Node.js, Express, Django
Databases: MongoDB, PostgreSQL, Redis
Tools: Git, Docker, AWS, CI/CD

EDUCATION
Bachelor of Science in Computer Science
University of Technology | 2014 - 2018
`;

export const waitForApiResponse = (page: any, urlPattern: string | RegExp) => {
  return page.waitForResponse((response: any) => {
    const url = response.url();
    if (typeof urlPattern === 'string') {
      return url.includes(urlPattern);
    }
    return urlPattern.test(url);
  });
};
