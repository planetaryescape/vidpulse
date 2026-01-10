# Privacy Policy for VidPulse

**Last Updated:** January 2025

VidPulse is a Chrome extension that analyzes YouTube videos using AI. This policy explains what data we collect and how we handle it.

## Data Collection

### What We Collect

**User-Provided Data:**
- OpenRouter API key (required) - stored locally on your device only
- Brave Search API key (optional) - stored locally on your device only
- "About Me" profile text - synced across your Chrome devices
- Manual preferences - synced across your Chrome devices

**Automatically Collected:**
- Video analysis results (summaries, scores, tags) - cached locally
- Like/dislike feedback on analyzed videos - stored locally
- Learned preferences from your feedback - synced across devices
- Session viewing history - temporary, cleared when browser closes
- Video notes/bookmarks - stored locally

### What We Don't Collect

- Personal identification information
- Browsing history outside YouTube
- YouTube account credentials
- Data for advertising purposes

## How We Use Your Data

**Video Analysis:**
- Your OpenRouter API key authenticates requests to AI models (Gemini, Claude, GPT)
- YouTube video URLs and content are sent to OpenRouter for analysis
- Analysis results are cached locally to avoid repeated API calls

**Personalization:**
- Your feedback (likes/dislikes) trains preference learning
- Learned preferences improve future recommendations
- "About Me" text provides context for personalized analysis

**Related Content:**
- If configured, Brave Search API finds related tutorials/articles
- Search queries based on video topics are sent to Brave

## External Services

### OpenRouter API
- **What's sent:** YouTube video data, analysis prompts
- **Purpose:** AI-powered video analysis (routes to Gemini, Claude, GPT models)
- **OpenRouter's privacy:** https://openrouter.ai/privacy

### Brave Search API (Optional)
- **What's sent:** Search queries based on video topics
- **Purpose:** Finding related content
- **Brave's privacy:** https://brave.com/privacy/browser/

## Data Storage

| Data Type | Location | Sync | Retention |
|-----------|----------|------|-----------|
| API keys | chrome.storage.local | No | Until deleted |
| Settings/preferences | chrome.storage.sync | Yes | Until deleted |
| Learned memories | chrome.storage.sync | Yes | Until deleted |
| Video cache | chrome.storage.local | No | Configurable (default 365 days) |
| Feedback history | chrome.storage.local | No | Last 100 entries |
| Session data | chrome.storage.session | No | Cleared on browser close |
| Video notes | chrome.storage.local | No | Until deleted |

## Your Controls

**Clear Cached Data:**
- Options page > Clear cache

**Delete Learned Preferences:**
- Options page > Memory section > Clear all

**Remove API Keys:**
- Options page > Delete API key fields

**Uninstall:**
- Removing the extension deletes all locally stored data

## Data Security

- API keys are stored locally only (never synced to cloud)
- All API communications use HTTPS
- No data is sent to VidPulse developers or third parties (other than Gemini/Brave APIs)
- Extension code is open source and auditable

## No Tracking

VidPulse does not:
- Include analytics or telemetry
- Track user behavior
- Sell or share data with third parties
- Display advertisements

## Children's Privacy

VidPulse is not directed at children under 13. We do not knowingly collect data from children.

## Changes to This Policy

Updates will be posted to this file with a new "Last Updated" date. Significant changes will be noted in release notes.

## Contact

For privacy questions or concerns:
- Email: vidpulse@bhekani.com
- GitHub: https://github.com/planetaryescape/vidpulse/issues
