# Start Using Enhanced Interview Features

## Quick Start

### 1. Restart Backend (to load new evaluation logic)
```bash
cd backend
# Stop current process (Ctrl+C)
npm run dev
```
Wait for: `✅ Server running on port 5000`

### 2. Restart Frontend (to load collapsible panel)
```bash
cd frontend
# Stop current process (Ctrl+C)
npm run dev
```
Wait for: `Local: http://localhost:5173`

### 3. Test New Features

## Feature 1: Collapsible Answer Panel

### How to Test
1. Navigate to `http://localhost:5173`
2. Login and start an interview
3. Look at bottom of screen - see answer panel
4. Find toggle button at top-right: **[Minimize ▼]**
5. Click it → Panel collapses to slim bar
6. See more space for reading question
7. Click **[▲ Your Answer]** → Panel expands
8. Type answer → Panel stays expanded
9. Toggle anytime without losing answer

### What to Observe
✅ Smooth 400ms transition
✅ No flicker or layout jumps
✅ Camera feed stays stable
✅ Answer preserved when toggling
✅ More space to read question when collapsed

## Feature 2: Adaptive Question Generation

### How to Test
1. Start interview session
2. Read first question carefully
3. Type a detailed, accurate answer
4. Click **[Submit Answer]**
5. See "Analyzing your response..." (immediate)
6. Wait 5-10 seconds
7. See appreciation: "Great answer! Score: 85/100"
8. Wait 2 seconds
9. Next question appears automatically (harder)
10. Answer poorly this time
11. Submit answer
12. Next question will be easier/foundational

### What to Observe
✅ Evaluation completes in 5-12 seconds
✅ Appreciation message shows
✅ Score displayed clearly
✅ Next question loads automatically
✅ Difficulty adapts to your performance
✅ Recording continues uninterrupted

## Expected Behavior

### Collapsible Panel States

**Expanded (Default):**
```
┌─────────────────────────────────────┐
│ Question Area                        │
└─────────────────────────────────────┘
┌─────────────────────────────────────┐
│ [Minimize ▼]                         │
│ ┌─────────────────────────────────┐ │
│ │ Type your answer here...        │ │
│ │                                 │ │
│ └─────────────────────────────────┘ │
│ [Submit Answer] [End Interview]     │
└─────────────────────────────────────┘
```

**Collapsed:**
```
┌─────────────────────────────────────┐
│ Question Area (40% MORE SPACE!)     │
│                                      │
│                                      │
└─────────────────────────────────────┘
┌─────────────────────────────────────┐
│ ▲ Your Answer          [Minimize ▼] │
└─────────────────────────────────────┘
```

### Adaptive Question Flow

**High Score (85+):**
```
Question: "Explain hash maps"
Answer: Detailed, accurate explanation
Score: 85/100
Next: "Design a distributed hash table" (HARDER)
```

**Medium Score (60-79):**
```
Question: "Explain hash maps"
Answer: Basic explanation, some gaps
Score: 70/100
Next: "Compare hash maps vs binary trees" (SAME LEVEL)
```

**Low Score (<60):**
```
Question: "Explain hash maps"
Answer: Incomplete or incorrect
Score: 45/100
Next: "What is array time complexity?" (EASIER)
```

## Performance Indicators

### Good Performance
- ✅ Panel toggles instantly (<100ms)
- ✅ Smooth transitions (400ms)
- ✅ No camera flicker
- ✅ Evaluation: 5-12 seconds
- ✅ Total time: <15 seconds
- ✅ Automatic progression

### If Performance Issues
- Check internet connection (5+ Mbps recommended)
- Close unnecessary browser tabs
- Use Chrome or Edge (best performance)
- Verify Gemini API key configured
- Check backend logs for errors

## Troubleshooting

### Panel Not Collapsing?
**Symptoms:** Toggle button doesn't work
**Solutions:**
1. Hard refresh: Ctrl+Shift+R (Windows) or Cmd+Shift+R (Mac)
2. Clear browser cache
3. Check browser console (F12) for errors
4. Try different browser

### Evaluation Taking Too Long?
**Symptoms:** "Analyzing..." for >20 seconds
**Solutions:**
1. Check internet connection
2. Verify Gemini API key in `backend/.env`
3. Check Gemini API quota/limits
4. Wait for fallback (automatic after 20s)
5. Interview will continue with fallback question

### Questions Not Adapting?
**Symptoms:** All questions same difficulty
**Solutions:**
1. Ensure backend restarted (new code loaded)
2. Check backend console for Gemini errors
3. Verify API key has sufficient quota
4. Fallback questions will be used if Gemini fails

### Camera Flickering?
**Symptoms:** Video feed unstable when toggling
**Solutions:**
1. This shouldn't happen - panel isolated from camera
2. If it does, report as bug
3. Try different browser
4. Check GPU acceleration enabled

## Configuration

### Gemini API Key
File: `backend/.env`
```env
GEMINI_API_KEY=your_api_key_here
```

### Adjust Evaluation Speed
File: `backend/src/services/geminiService.ts`
```typescript
// Line ~670
const result = await this.callWithRetry(async () => {
  return await this.flashModel.generateContent(prompt);
}, 2); // Increase to 3 for more retries (slower but more reliable)
```

### Adjust Panel Transition
File: `frontend/src/styles/InterviewPage.css`
```css
/* Line ~1050 */
.answer-section {
  transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
  /* Change 0.4s to 0.3s for faster, 0.6s for slower */
}
```

## Testing Checklist

### Before Starting Interview
- [ ] Backend running on port 5000
- [ ] Frontend running on port 5173
- [ ] MongoDB connected
- [ ] Gemini API key configured
- [ ] Browser permissions granted (camera/mic)

### During Interview
- [ ] Toggle button visible
- [ ] Panel collapses smoothly
- [ ] Panel expands smoothly
- [ ] Answer preserved when toggling
- [ ] Camera stays stable
- [ ] Evaluation completes <15s
- [ ] Appreciation message shows
- [ ] Next question loads automatically
- [ ] Difficulty adapts to performance

### After Interview
- [ ] Session completes successfully
- [ ] Results page loads
- [ ] Recording saved
- [ ] Performance report generated

## Success Indicators

### Collapsible Panel Working
✅ Toggle button responds instantly
✅ Smooth 400ms transition
✅ No layout jumps or flicker
✅ Camera feed stable
✅ Answer preserved
✅ More space when collapsed

### Adaptive Questions Working
✅ Evaluation: 5-12 seconds
✅ Appreciation message displays
✅ Score shown clearly
✅ Next question loads automatically
✅ Difficulty adapts (high/medium/low)
✅ Topics progress systematically
✅ Recording continues

## Need Help?

### Check Documentation
- `COLLAPSIBLE_PANEL_AND_ADAPTIVE_QUESTIONS.md` - Detailed docs
- `QUICK_PANEL_AND_ADAPTIVE_GUIDE.md` - Quick reference
- `ENHANCED_INTERVIEW_SUMMARY.md` - Complete summary

### Common Issues
1. **Panel not working:** Hard refresh browser
2. **Slow evaluation:** Check internet, API key
3. **No adaptation:** Restart backend
4. **Camera issues:** Check permissions

### Still Stuck?
1. Check browser console (F12)
2. Check backend logs
3. Verify all environment variables
4. Test with different browser
5. Restart everything

---

## Ready to Go! 🚀

Your AI Interview Session now features:
- **Collapsible panel** for better screen space (40% more!)
- **Adaptive questions** based on your performance
- **Fast evaluation** (<15 seconds with Gemini AI)
- **Smooth transitions** and professional UX
- **Intelligent topic progression**

**Start your enhanced interview and experience the difference!**

### Quick Commands
```bash
# Start backend
cd backend && npm run dev

# Start frontend (new terminal)
cd frontend && npm run dev

# Open browser
http://localhost:5173
```

**Enjoy your improved interview experience!** 🎉
