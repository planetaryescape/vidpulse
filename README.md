# VidPulse

**Know if a YouTube video is worth your time—before you watch it.**

## Why VidPulse?

You click on a video. 20 minutes later, you realize it was clickbait, poorly explained, or just not what you needed. Now multiply that by every video in your recommended feed.

YouTube doesn't tell you if a video will actually be useful to *you*. Titles lie. Thumbnails exaggerate. Comments are hit or miss. You only find out a video wasn't worth it *after* you've watched it.

**VidPulse fixes this.**

It uses Google's Gemini AI to actually watch videos for you (via multimodal analysis—not just reading titles or thumbnails) and tells you:

- Is this worth your time?
- Does it match your interests?
- What are the key points so you can skip to what matters?

Over time, it learns what you like and dislike, so recommendations get more personal. It can even block time-wasting content during focus hours.

Stop wasting time on videos that disappoint. Let AI be your filter.

## What It Does

- **Watches videos for you** — Gemini AI analyzes actual video content, not just metadata
- **Scores on 5 dimensions** — Productivity, Educational, Entertainment, Inspiring, Creative (0-100)
- **Gives a verdict** — Worth It / Maybe / Skip
- **Learns your taste** — Like/dislike videos to teach it your preferences
- **Finds related resources** — Tutorials, articles, guides from the web
- **Blocks rabbit holes** — Productivity Guardian stops low-value content
- **Tracks your time** — Session stats, daily analytics, channel insights

## Quick Start

### 1. Get API Keys

**Gemini API Key** (required):
1. Go to [Google AI Studio](https://aistudio.google.com/app/apikey)
2. Create a free API key
3. Copy it

**Brave Search API Key** (optional, for Related tab):
1. Go to [Brave Search API](https://brave.com/search/api/)
2. Sign up for free tier (2,000 queries/month)
3. Copy your API key

### 2. Install Extension

```bash
git clone https://github.com/planetaryescape/vidpulse.git
cd vidpulse
npm install
npm run build
```

Load in Chrome:
1. Go to `chrome://extensions`
2. Enable "Developer mode" (top right)
3. Click "Load unpacked"
4. Select the `dist/` folder

### 3. Configure

1. Click VidPulse icon in toolbar
2. Go to Settings (gear icon)
3. Paste your Gemini API key
4. (Optional) Paste Brave Search API key for related content

## Features

### Analysis Panel

Opens automatically on YouTube video pages. Five tabs:

| Tab | What It Shows |
|-----|---------------|
| **Summary** | Verdict, 5 score bars, topic tags |
| **For You** | Personalized reasoning, relevance score, enjoyment confidence |
| **Chapters** | Timestamped key points—click to jump in video |
| **Notes** | Your timestamped bookmarks with export to markdown |
| **Related** | Web resources (tutorials, articles) via Brave Search |

### Memory System

VidPulse learns what you like:

1. **Like or dislike** a video (Shift+L / Shift+K)
2. AI extracts specific preferences: *"likes deep technical tutorials on system design"*, *"dislikes clickbait thumbnails"*
3. Similar preferences automatically merge
4. Future videos scored against your learned taste
5. See "relevance score" and "enjoyment confidence" in For You tab

View and manage learned preferences in Settings > Personalization.

### About Me Profile

Tell VidPulse what you're interested in:

- Write your interests manually
- Or enable **auto-sync** to combine your text with learned preferences
- Used for relevance scoring and personalized recommendations

### Notes (Timestamped Bookmarks)

Take notes while watching:

- Click "Add note" to capture current timestamp
- Click any timestamp to jump to that moment
- Notes auto-save as you type
- Export single video's notes or all notes as markdown

### Related Content

Find supporting resources:

- AI generates search query from video summary + tags
- Brave Search finds tutorials, articles, guides
- Shows favicon, title, description, source domain
- Requires Brave Search API key

### Productivity Guardian

Block time-wasting content:

- **Tag blocking** — Block videos with specific tags (e.g., "drama", "reaction")
- **Score threshold** — Block if all scores below your minimum
- **Focus schedule** — Stricter rules during work hours
- **Entertainment blocking** — Block entertainment-dominant videos during focus time

Override: Click "Watch Anyway" or press Escape.

### Focus Schedule

Set productive hours:

- Pick days (Mon-Sun)
- Set start/end hours
- Higher score threshold during focus
- Optional: block all entertainment
- Pause focus for 1 hour via badge in panel

### Intent System

Declare your watching goal:

- **Learning** — Expects educational content
- **Research** — Expects educational or productive
- **Relaxing** — Expects entertainment
- **Browsing** — No expectations

Videos show alignment badge based on intent vs scores.

### Check-in Prompts

Optional time awareness:

- Set interval (e.g., every 30 minutes)
- Shows total watch time, video breakdown
- "Still intentional?" with continue or break options

### Session & Analytics

Track your YouTube habits:

- **Session timer** in panel header (duration + video count)
- **Daily stats** — Time by category, video counts
- **Channel stats** — Average scores per channel, trust badges
- **Liked channels** — Auto-tracked from liked videos, subscription status

### Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `Shift+V` | Toggle panel visibility |
| `Shift+L` | Like video (trains preferences) |
| `Shift+K` | Skip/dislike video |
| `Shift+R` | Regenerate analysis |
| `Escape` | Dismiss overlays |

## Configuration

### Model Selection

Configure different Gemini models per operation:

| Operation | Default | Purpose |
|-----------|---------|---------|
| Video Reading | gemini-3-flash-preview | Multimodal video analysis |
| Summarization | gemini-2.0-flash | Generate summary |
| Reasoning | gemini-2.0-flash | Personalized recommendations |
| Tag Generation | gemini-2.0-flash | Topic tags |
| Content Analysis | gemini-2.0-flash | Scoring & verdict |
| Memory Extraction | gemini-2.0-flash | Learn preferences from feedback |

### Caching

- Analyses cached locally (default: 365 days)
- Cache invalidates when you update profile or change models
- Regenerate any video with Shift+R

## Troubleshooting

### "API key not configured"
Open Settings, paste a valid Gemini API key.

### "Analysis failed" / Rate limits
- Check API key at [Google AI Studio](https://aistudio.google.com)
- Free tier: 60 requests/minute
- Wait and retry

### Panel not showing
- Click extension icon
- Refresh page
- Check console (F12) for errors

### Related tab empty
Add Brave Search API key in Settings.

### Guardian blocking too much
Lower threshold in Settings > Productivity Guardian.

## Build Commands

```bash
npm run dev      # Build with watch mode
npm run build    # Production build
npm run clean    # Remove dist/
```

## Tech Stack

- TypeScript, Vite, @crxjs/vite-plugin
- @google/genai for Gemini API
- Brave Search API for related content
- Chrome Extension Manifest V3

## License

MIT — see [LICENSE](LICENSE)

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md)
