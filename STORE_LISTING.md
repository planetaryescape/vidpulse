# Chrome Web Store Listing

## Short Description (132 chars max)
AI-powered YouTube video analysis - get summaries, quality scores, and personalized recommendations before watching

## Detailed Description

Stop wasting time on clickbait. VidPulse is a mindful video consumption tool that analyzes YouTube videos before you watch, helping you make informed decisions about what deserves your attention.

### How It Works
1. Navigate to any YouTube video
2. VidPulse analyzes the content using AI via OpenRouter
3. View the analysis panel showing summary, scores, and verdict
4. Make informed decisions about what to watch

### Video Analysis Features

**Smart Analysis**
- AI-generated video summaries
- Key points extraction
- Chapter breakdowns
- Relevant tags

**Quality Scores**
Rate videos across 5 dimensions:
- Productivity - Will this help you get things done?
- Educational - Will you learn something valuable?
- Entertainment - Is it worth watching for fun?
- Inspiring - Will it motivate you?
- Creative - Is the content original and well-crafted?

**Worth It Verdict**
Get a clear recommendation: Worth It, Maybe, or Skip - personalized to your preferences.

**Personalized Analysis**
- Like or dislike analyzed videos
- VidPulse learns what content you value
- Future analysis becomes more relevant to your interests

**Quality Threshold Guardian**
- Set minimum quality thresholds for videos
- Get warnings before watching low-quality content
- Optional focus mode for work hours

**Watch Quality Awareness**
- See analysis history for your current session
- Understand your viewing patterns by content quality
- Make more intentional watching decisions

### Privacy First
- Your API keys stay on your device (never synced)
- No tracking or analytics
- No data sold to third parties
- Open source and auditable

### Requirements
- OpenRouter API key (get one at openrouter.ai/keys)
- Optional: Brave Search API key for related content

---

## Category
Productivity

## Language
English

## Support Email
vidpulse@bhekani.com

---

## Screenshots Needed

Place in `store-assets/screenshots/`:

1. **analysis-panel.png** (1280x800 or 640x400)
   - YouTube video page with VidPulse panel visible in sidebar
   - Show a video with interesting analysis results

2. **summary-tab.png** (1280x800 or 640x400)
   - Close-up of the summary tab
   - Show scores, verdict, and summary text

3. **memory-system.png** (1280x800 or 640x400)
   - The "For You" or preferences tab
   - Show learned preferences

4. **guardian.png** (1280x800 or 640x400) - Optional
   - Guardian blocking overlay on a low-quality video
   - Shows threshold warning

5. **options-page.png** (1280x800 or 640x400)
   - Settings/options page
   - Show API key setup, model config

---

## Promotional Assets

Generated in `store-assets/`:
- `icon256.png` - 256x256 store icon
- `small-tile-440x280.png` - Small promotional tile
- `large-tile-920x680.png` - Large promotional tile

---

## Permission Justifications

For Chrome Web Store privacy practices form:

| Permission | Justification |
|------------|---------------|
| `storage` | Save user settings, cache video analysis results locally, store learned preferences |
| `activeTab` | Detect current YouTube video URL to trigger analysis |
| `tabs` | Send re-analyze command when user clicks extension icon |
| `scripting` | Inject analysis panel UI into YouTube video pages |

**Host Permissions:**

| Host | Justification |
|------|---------------|
| `youtube.com` | Primary site - inject analysis panel, read video information |
| `openrouter.ai` | OpenRouter API for AI video analysis (user's own API key) |
| `api.search.brave.com` | Optional Brave Search API for related content (user's own API key) |

---

## Privacy Practices Questionnaire

Answers for Chrome Web Store submission form:

**"Does your extension collect user data?"**
Yes - user preferences, video analysis cache, feedback on videos. All stored locally on device.

**"Is data sent to external servers?"**
Yes - video content is sent to OpenRouter for AI analysis (which routes to models like Gemini, Claude, GPT). User provides their own API key. Optionally, search queries sent to Brave Search API for related content.

**"Do you share or sell user data?"**
No - data is only sent to APIs the user explicitly configures with their own keys. No data is shared with the extension developer or any third parties.

**"What data is collected?"**
- User preferences and settings (local + Chrome sync)
- Video analysis results (cached locally)
- Like/dislike feedback (local only)
- Learned content preferences (Chrome sync)
- Session viewing history (cleared on browser close)

**"How long is data retained?"**
- Analysis cache: Configurable, default 365 days
- Feedback history: Last 100 entries
- Session data: Cleared when browser closes
- Preferences: Until user deletes

---

## Submission Checklist

- [ ] Developer account created ($5 one-time)
- [ ] Privacy policy URL hosted (link to PRIVACY.md in repo or separate page)
- [ ] Screenshots captured and uploaded
- [ ] Promotional images uploaded
- [ ] Description reviewed for typos
- [ ] Permissions justified in privacy practices form (see above)
- [ ] Privacy questionnaire completed (see above)
- [ ] API key disclosure noted (Gemini, Brave)
- [ ] Test extension on Chrome latest version
- [ ] Build passes: `npm run build`
