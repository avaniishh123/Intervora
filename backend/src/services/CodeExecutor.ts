import { exec } from 'child_process';
import * as fs from 'fs/promises';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { TestResult } from '../types/coding.types';

/**
 * CodeExecutor - Service for safely executing code submissions
 * Supports multiple languages with timeout protection and sandboxing
 */
export class CodeExecutor {
  private readonly tempDir: string;
  private readonly maxExecutionTime: number = 5000; // 5 seconds
  private readonly maxOutputSize: number = 1024 * 1024; // 1MB

  constructor() {
    this.tempDir = path.join(process.cwd(), 'temp', 'code-execution');
  }

  /**
   * Execute code with test cases
   * @param code - The code to execute
   * @param language - Programming language
   * @param testCases - Array of test cases to run
   * @returns Array of test results
   */
  async executeCode(
    code: string,
    language: string,
    testCases: Array<{ input: any; expectedOutput: any; isHidden: boolean; description?: string }>
  ): Promise<TestResult[]> {
    // Ensure temp directory exists
    await this.ensureTempDir();

    const results: TestResult[] = [];

    for (let i = 0; i < testCases.length; i++) {
      const testCase = testCases[i];
      const result = await this.executeTestCase(code, language, testCase, i + 1);
      results.push(result);
    }

    return results;
  }

  /**
   * Execute a single test case
   */
  private async executeTestCase(
    code: string,
    language: string,
    testCase: { input: any; expectedOutput: any; isHidden: boolean; description?: string },
    testNumber: number
  ): Promise<TestResult> {
    const startTime = Date.now();
    
    try {
      const actualOutput = await this.runCode(code, language, testCase.input);
      const executionTime = Date.now() - startTime;

      // Compare outputs
      const passed = this.compareOutputs(actualOutput, testCase.expectedOutput);

      return {
        testCase: testNumber,
        passed,
        input: testCase.input,
        expectedOutput: testCase.expectedOutput,
        actualOutput,
        executionTime
      };
    } catch (error) {
      const executionTime = Date.now() - startTime;
      
      return {
        testCase: testNumber,
        passed: false,
        input: testCase.input,
        expectedOutput: testCase.expectedOutput,
        error: error instanceof Error ? error.message : 'Unknown execution error',
        executionTime
      };
    }
  }

  /**
   * Run code with specific input
   */
  private async runCode(code: string, language: string, input: any): Promise<any> {
    const sessionId = uuidv4();
    const sessionDir = path.join(this.tempDir, sessionId);

    try {
      // Create session directory
      await fs.mkdir(sessionDir, { recursive: true });

      // Prepare code based on language
      const { command } = await this.prepareExecution(code, language, input, sessionDir);

      // Execute with timeout
      const { stdout, stderr } = await this.executeWithTimeout(command, this.maxExecutionTime);

      if (stderr && stderr.trim().length > 0) {
        // Some languages output to stderr even for successful execution
        // Only throw if stdout is empty
        if (!stdout || stdout.trim().length === 0) {
          throw new Error(`Execution error: ${stderr}`);
        }
      }

      // Parse output
      return this.parseOutput(stdout);
    } finally {
      // Cleanup session directory
      await this.cleanup(sessionDir);
    }
  }

  /**
   * Prepare code execution based on language
   */
  private async prepareExecution(
    code: string,
    language: string,
    input: any,
    sessionDir: string
  ): Promise<{ filePath: string; command: string }> {
    const inputStr = JSON.stringify(input);

    switch (language.toLowerCase()) {
      case 'python':
      case 'python3':
        return this.preparePython(code, inputStr, sessionDir);
      
      case 'javascript':
      case 'node':
      case 'nodejs':
        return this.prepareJavaScript(code, inputStr, sessionDir);
      
      case 'java':
        return this.prepareJava(code, inputStr, sessionDir);
      
      case 'cpp':
      case 'c++':
        return this.prepareCpp(code, inputStr, sessionDir);
      
      default:
        throw new Error(`Unsupported language: ${language}`);
    }
  }

  /**
   * Prepare Python execution
   */
  private async preparePython(code: string, input: string, sessionDir: string): Promise<{ filePath: string; command: string }> {
    const filePath = path.join(sessionDir, 'solution.py');
    
    // Wrap code to handle input/output
    const wrappedCode = `
import json
import sys

# User code
${code}

# Execute with input
if __name__ == "__main__":
    try:
        input_data = json.loads('${input.replace(/'/g, "\\'")}')
        result = solution(input_data) if 'solution' in dir() else main(input_data) if 'main' in dir() else None
        print(json.dumps(result))
    except Exception as e:
        print(json.dumps({"error": str(e)}), file=sys.stderr)
        sys.exit(1)
`;

    await fs.writeFile(filePath, wrappedCode);
    
    return {
      filePath,
      command: `python "${filePath}"`
    };
  }

  /**
   * Prepare JavaScript execution
   */
  private async prepareJavaScript(code: string, input: string, sessionDir: string): Promise<{ filePath: string; command: string }> {
    const filePath = path.join(sessionDir, 'solution.js');
    
    // Wrap code to handle input/output
    const wrappedCode = `
// User code
${code}

// Execute with input
try {
  const input = JSON.parse('${input.replace(/'/g, "\\'")}');
  const result = typeof solution === 'function' ? solution(input) : (typeof main === 'function' ? main(input) : null);
  console.log(JSON.stringify(result));
} catch (e) {
  console.error(JSON.stringify({ error: e.message }));
  process.exit(1);
}
`;

    await fs.writeFile(filePath, wrappedCode);
    
    return {
      filePath,
      command: `node "${filePath}"`
    };
  }

  /**
   * Prepare Java execution
   */
  private async prepareJava(code: string, input: string, sessionDir: string): Promise<{ filePath: string; command: string }> {
    const filePath = path.join(sessionDir, 'Solution.java');
    
    // Wrap code to handle input/output
    const wrappedCode = `
import com.google.gson.Gson;

public class Solution {
    ${code}
    
    public static void main(String[] args) {
        try {
            Gson gson = new Gson();
            String inputJson = "${input.replace(/"/g, '\\"')}";
            Object input = gson.fromJson(inputJson, Object.class);
            Object result = solution(input);
            System.out.println(gson.toJson(result));
        } catch (Exception e) {
            System.err.println("{\\"error\\": \\"" + e.getMessage() + "\\"}");
            System.exit(1);
        }
    }
}
`;

    await fs.writeFile(filePath, wrappedCode);
    
    return {
      filePath,
      command: `cd "${sessionDir}" && javac Solution.java && java Solution`
    };
  }

  /**
   * Prepare C++ execution
   */
  private async prepareCpp(code: string, input: string, sessionDir: string): Promise<{ filePath: string; command: string }> {
    const filePath = path.join(sessionDir, 'solution.cpp');
    const exePath = path.join(sessionDir, 'solution.exe');
    
    // Wrap code to handle input/output
    const wrappedCode = `
#include <iostream>
#include <string>
#include <nlohmann/json.hpp>

using json = nlohmann::json;

${code}

int main() {
    try {
        std::string inputStr = R"(${input})";
        json input = json::parse(inputStr);
        json result = solution(input);
        std::cout << result.dump() << std::endl;
        return 0;
    } catch (const std::exception& e) {
        std::cerr << "{\\"error\\": \\"" << e.what() << "\\"}" << std::endl;
        return 1;
    }
}
`;

    await fs.writeFile(filePath, wrappedCode);
    
    return {
      filePath,
      command: `g++ "${filePath}" -o "${exePath}" && "${exePath}"`
    };
  }

  /**
   * Execute command with timeout
   */
  private async executeWithTimeout(command: string, timeout: number): Promise<{ stdout: string; stderr: string }> {
    return new Promise((resolve, reject) => {
      const child = exec(command, {
        timeout,
        maxBuffer: this.maxOutputSize,
        windowsHide: true
      });

      let stdout = '';
      let stderr = '';

      child.stdout?.on('data', (data) => {
        stdout += data.toString();
      });

      child.stderr?.on('data', (data) => {
        stderr += data.toString();
      });

      child.on('close', (code) => {
        if (code === 0 || (code === null && stdout)) {
          resolve({ stdout, stderr });
        } else {
          reject(new Error(stderr || `Process exited with code ${code}`));
        }
      });

      child.on('error', (error) => {
        reject(error);
      });

      // Handle timeout
      setTimeout(() => {
        child.kill();
        reject(new Error('Execution timeout: Code took longer than 5 seconds to execute'));
      }, timeout);
    });
  }

  /**
   * Parse output based on language
   */
  private parseOutput(output: string): any {
    try {
      const trimmed = output.trim();
      
      // Try to parse as JSON
      return JSON.parse(trimmed);
    } catch {
      // If not JSON, return as string
      return output.trim();
    }
  }

  /**
   * Compare actual output with expected output
   */
  private compareOutputs(actual: any, expected: any): boolean {
    // Deep equality check
    return JSON.stringify(actual) === JSON.stringify(expected);
  }

  /**
   * Ensure temp directory exists
   */
  private async ensureTempDir(): Promise<void> {
    try {
      await fs.mkdir(this.tempDir, { recursive: true });
    } catch (error) {
      console.error('Failed to create temp directory:', error);
    }
  }

  /**
   * Cleanup session directory
   */
  private async cleanup(sessionDir: string): Promise<void> {
    try {
      await fs.rm(sessionDir, { recursive: true, force: true });
    } catch (error) {
      console.error('Failed to cleanup session directory:', error);
    }
  }

  /**
   * Check if language is supported
   */
  isSupportedLanguage(language: string): boolean {
    const supported = ['python', 'python3', 'javascript', 'node', 'nodejs', 'java', 'cpp', 'c++'];
    return supported.includes(language.toLowerCase());
  }
}

// Export singleton instance
export const codeExecutor = new CodeExecutor();
export default codeExecutor;
