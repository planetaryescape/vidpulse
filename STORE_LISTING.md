# Chrome Web Store Listing

## Short Description (132 chars max)
AI-powered YouTube video analysis - get summaries, quality scores, and personalized recommendations before watching

## Detailed Description

Stop wasting time on clickbait. VidPulse analyzes YouTube videos before you watch, giving you AI-generated summaries, quality scores, and honest recommendations.

### How It Works
1. Navigate to any YouTube video
2. VidPulse analyzes the content using Google's Gemini AI
3. View the analysis panel showing summary, scores, and verdict
4. Make informed decisions about what to watch

### Features

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

**Learns Your Taste**
- Like or dislike analyzed videos
- VidPulse learns what content you value
- Future recommendations become more personalized

**Productivity Guardian**
- Set minimum quality thresholds
- Block distracting content during focus hours
- Stay productive on YouTube

**Session Tracking**
- See what you've watched this session
- Track time by content category
- Build better watching habits

### Privacy First
- Your API keys stay on your device (never synced)
- No tracking or analytics
- No data sold to third parties
- Open source and auditable

### Requirements
- Google Gemini API key (free tier available at ai.google.dev)
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

## Submission Checklist

- [ ] Developer account created ($5 one-time)
- [ ] Privacy policy URL hosted (link to PRIVACY.md in repo or separate page)
- [ ] Screenshots captured and uploaded
- [ ] Promotional images uploaded
- [ ] Description reviewed for typos
- [ ] Permissions justified in privacy practices form
- [ ] API key disclosure noted (Gemini, Brave)
- [ ] Test extension on Chrome latest version
- [ ] Build passes: `npm run build`
