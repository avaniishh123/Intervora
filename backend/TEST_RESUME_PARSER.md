# Resume Parser Testing Guide

## Quick Test Commands

### 1. Test the Fixed Resume Parser
```bash
cd backend
node test-resume-parser-fix.mjs
```

**Expected Output**:
- ✅ 100% success rate
- ✅ ~2,900+ characters extracted per resume
- ✅ Text preview showing resume content

### 2. Test PDF Parse API
```bash
cd backend
node test-new-pdf-parse-api.mjs
```

**Expected Output**:
- ✅ PDFParse instance created
- ✅ Text extracted successfully
- ✅ Preview of resume content

### 3. Check PDF Parse Exports
```bash
cd backend
node check-pdf-parse-exports.mjs
```

**Expected Output**:
- Shows available exports from pdf-parse module
- Confirms PDFParse class is available

## Test Files Location

All test files are in the `backend/` directory:
- `test-resume-parser-fix.mjs` - Main comprehensive test
- `test-new-pdf-parse-api.mjs` - API exploration
- `check-pdf-parse-exports.mjs` - Export verification

## Test Data

Tests use actual resume files from:
```
backend/uploads/resumes/*.pdf
```

Currently testing with 7 PDF files uploaded by users.

## What Gets Tested

### File Operations
- ✅ File existence check
- ✅ File size validation
- ✅ Buffer reading
- ✅ Uint8Array conversion

### PDF Parsing
- ✅ PDFParse class instantiation
- ✅ getText() method execution
- ✅ Result object structure
- ✅ Text extraction quality

### Content Validation
- ✅ Minimum character count (50+)
- ✅ Text readability
- ✅ Resume keyword detection
- ✅ Content preview generation

## Troubleshooting

### If tests fail:

1. **Check Node.js version**:
   ```bash
   node --version
   ```
   Required: v20.16.0+ or v22.3.0+

2. **Verify pdf-parse installation**:
   ```bash
   npm list pdf-parse
   ```
   Should show: pdf-parse@2.4.5

3. **Check resume files exist**:
   ```bash
   ls uploads/resumes/
   ```
   Should show PDF files

4. **Reinstall dependencies**:
   ```bash
   npm install
   ```

## Integration Test

To test the full resume upload pipeline:

1. Start backend:
   ```bash
   npm run dev
   ```

2. Use the API endpoint:
   ```bash
   # Upload resume
   curl -X POST http://localhost:5000/api/resume/upload \
     -H "Authorization: Bearer YOUR_TOKEN" \
     -F "resume=@path/to/resume.pdf"

   # Analyze resume
   curl -X POST http://localhost:5000/api/resume/analyze \
     -H "Authorization: Bearer YOUR_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{"jobDescription": "Optional JD text"}'
   ```

## Success Criteria

All tests should show:
- ✅ No errors during execution
- ✅ Text extraction successful
- ✅ Character count > 50
- ✅ Readable text preview
- ✅ 100% success rate

## Next Steps

After successful tests:
1. Start the full application
2. Test via the web interface
3. Upload a new resume
4. Verify Gemini AI analysis
5. Check interview session creation
