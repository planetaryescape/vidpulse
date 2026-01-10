# VidPulse

AI-powered YouTube video analysis - know if it's worth your time before watching.

## What It Does

VidPulse uses Google's Gemini AI to **actually watch videos** (via multimodal fileData API) and tells you:

- **5-dimension scoring**: Productivity, Educational, Entertainment, Inspiring, Creative (0-100 each)
- **3-level verdict**: Worth It / Maybe / Skip
- **Timestamped key points** with one-click seeking
- **Personalized recommendations** that learn your preferences over time
- **Productivity Guardian** to block low-value rabbit holes

Unlike extensions that just read titles/thumbnails, VidPulse analyzes actual video content.

## Quick Start

### 1. Get a Gemini API Key

1. Visit [Google AI Studio](https://aistudio.google.com/app/apikey)
2. Create a free API key
3. Copy the key

### 2. Install Extension

**Development:**
```bash
git clone https://github.com/planetaryescape/vidpulse.git
cd vidpulse
npm install
npm run build
```

Then load in Chrome:
1. Go to `chrome://extensions`
2. Enable "Developer mode" (top right)
3. Click "Load unpacked"
4. Select the `dist/` folder

### 3. Configure

1. Click VidPulse icon in toolbar
2. Go to Settings (gear icon)
3. Paste your Gemini API key
4. (Optional) Add Brave Search API key for related resources

## Usage

### Analysis Panel

Opens automatically on YouTube video pages. Shows:
- Summary + verdict badge
- 5 score bars with color coding
- Tabs: For You (reasoning) | Chapters (key points) | Notes | Related

### Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `Shift+V` | Toggle panel visibility |
| `Shift+L` | Like video (trains preferences) |
| `Shift+K` | Skip/dislike video |
| `Shift+R` | Regenerate analysis |

### Productivity Guardian

Blocks videos when:
- All scores below your threshold
- Video has tags you've blocked
- Entertainment content during Focus Mode hours

Override: Click "Watch Anyway" or press Escape.

### Intent System

New sessions prompt you to select your goal:
- Learning | Research | Relaxing | Browsing

Videos show alignment badge based on your intent vs their scores.

### Check-in Prompts

Optional timed reminders showing your session duration and asking if you want to continue or take a break.

## Features

### Memory System

Like/dislike videos to teach VidPulse your taste. AI extracts preferences like:
- "Likes deep technical tutorials on system design"
- "Dislikes clickbait thumbnails"

Similar preferences merge automatically. View/manage in Settings > Personalization.

### Focus Schedule

Block entertainment during work hours:
- Configure days and time ranges
- Set stricter score thresholds
- Auto-block entertainment-dominant videos

### Model Selection

Configure different Gemini models per operation:
- Video Reading (multimodal required)
- Summarization
- Reasoning
- Tag Generation
- Content Analysis
- Memory Extraction

Default: `gemini-2.0-flash` for most, `gemini-3-flash-preview` for video reading.

### Caching

Analyses are cached locally (default: 365 days). Cache invalidates when:
- You update your profile/preferences
- Model configuration changes

## Troubleshooting

### "API key not configured"
Open Settings, paste a valid Gemini API key.

### "Analysis failed" / Rate limits
- Verify API key is valid at [Google AI Studio](https://aistudio.google.com)
- Free tier: 60 requests/minute
- Wait 1 minute and retry

### Panel not showing
- Click extension icon to force re-detection
- Refresh the page
- Check browser console for errors (`F12` > Console)

### Guardian blocking too much
Lower the score threshold in Settings > Productivity Guardian.

## Build Commands

```bash
npm run dev      # Build with watch mode (development)
npm run build    # Production build
npm run clean    # Remove dist/
```

## Tech Stack

- TypeScript, Vite, @crxjs/vite-plugin
- @google/genai for Gemini API
- Chrome Extension Manifest V3

## License

MIT - see [LICENSE](LICENSE)

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md)
