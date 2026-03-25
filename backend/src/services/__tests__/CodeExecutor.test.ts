// Mock uuid before importing CodeExecutor
jest.mock('uuid', () => ({
  v4: jest.fn(() => 'test-uuid-1234')
}));

import { CodeExecutor } from '../CodeExecutor';

describe('CodeExecutor', () => {
  let codeExecutor: CodeExecutor;

  beforeEach(() => {
    codeExecutor = new CodeExecutor();
  });

  describe('Language Support', () => {
    it('should support Python', () => {
      expect(codeExecutor.isSupportedLanguage('python')).toBe(true);
      expect(codeExecutor.isSupportedLanguage('Python')).toBe(true);
      expect(codeExecutor.isSupportedLanguage('python3')).toBe(true);
    });

    it('should support JavaScript', () => {
      expect(codeExecutor.isSupportedLanguage('javascript')).toBe(true);
      expect(codeExecutor.isSupportedLanguage('JavaScript')).toBe(true);
      expect(codeExecutor.isSupportedLanguage('node')).toBe(true);
      expect(codeExecutor.isSupportedLanguage('nodejs')).toBe(true);
    });

    it('should support Java', () => {
      expect(codeExecutor.isSupportedLanguage('java')).toBe(true);
      expect(codeExecutor.isSupportedLanguage('Java')).toBe(true);
    });

    it('should support C++', () => {
      expect(codeExecutor.isSupportedLanguage('cpp')).toBe(true);
      expect(codeExecutor.isSupportedLanguage('c++')).toBe(true);
      expect(codeExecutor.isSupportedLanguage('C++')).toBe(true);
    });

    it('should not support unsupported languages', () => {
      expect(codeExecutor.isSupportedLanguage('ruby')).toBe(false);
      expect(codeExecutor.isSupportedLanguage('go')).toBe(false);
      expect(codeExecutor.isSupportedLanguage('rust')).toBe(false);
      expect(codeExecutor.isSupportedLanguage('php')).toBe(false);
    });

    it('should be case-insensitive for language names', () => {
      expect(codeExecutor.isSupportedLanguage('PYTHON')).toBe(true);
      expect(codeExecutor.isSupportedLanguage('JavaScript')).toBe(true);
      expect(codeExecutor.isSupportedLanguage('JAVA')).toBe(true);
      expect(codeExecutor.isSupportedLanguage('CPP')).toBe(true);
    });
  });

  describe('Code Execution Integration', () => {
    it('should have executeCode method', () => {
      expect(typeof codeExecutor.executeCode).toBe('function');
    });

    it('should accept code, language, and test cases', () => {
      const executeCode = codeExecutor.executeCode;
      expect(executeCode.length).toBe(3); // 3 parameters
    });
  });
});

/**
 * Note: Full integration tests that actually execute code are skipped in CI/CD
 * because they require Python, Node.js, Java, and C++ compilers to be installed.
 * 
 * For manual testing, run:
 * - npm run test:integration
 * 
 * Or test manually using the API endpoints:
 * - POST /api/coding/execute
 * - POST /api/coding/submit?executeTests=true
 */
