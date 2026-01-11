# VidPulse Privacy Policy

**Last updated:** January 10, 2026

## What VidPulse Does

VidPulse is a Chrome extension that analyzes YouTube videos using AI to help you decide if a video is worth your time. It displays summaries, quality scores, and personalized recommendations directly on YouTube.

## Data We Collect

### Stored Locally on Your Device

| Data | Purpose | Retention |
|------|---------|-----------|
| **API keys** | OpenRouter and optional Brave Search authentication | Until you delete |
| **Settings** | Your preferences and configuration | Until you delete |
| **Learned preferences** | Likes/dislikes to personalize recommendations | Until you delete |
| **Video notes** | Timestamped notes you create on videos | Until you delete |
| **Analysis cache** | Cached results to avoid redundant API calls | Configurable (default 365 days) |
| **Feedback history** | Your like/dislike actions | Last 100 entries |
| **Session data** | Current viewing session stats | Cleared when browser closes |

All data is stored in Chrome's local storage on your device. It is **not** sent to VidPulse developers or any third party (except the API services you configure).

### Sent to Third-Party Services

When you view a YouTube video, VidPulse sends the video URL to:

- **OpenRouter** (openrouter.ai) — to analyze video content using AI models (Gemini, Claude, GPT). Uses your own API key.

If you configure a Brave API key:

- **Brave Search** (api.search.brave.com) — to fetch related tutorials, articles, and guides. Uses your own API key.

These services have their own privacy policies:
- OpenRouter: https://openrouter.ai/privacy
- Brave: https://brave.com/privacy/browser/

VidPulse uses **your own API keys**. We never see your API keys or the data sent to these services.

## Data We Do NOT Collect

- We do not collect personally identifiable information
- We do not track you across websites
- We do not sell or share your data
- We do not have servers that receive your data
- We do not use analytics or telemetry
- We do not display advertisements

## Data Storage

All data remains on your device in Chrome's extension storage:

- **Local storage** (`chrome.storage.local`) — API keys, cache, notes, feedback
- **Sync storage** (`chrome.storage.sync`) — Settings, learned preferences (syncs across your Chrome devices)
- **Session storage** (`chrome.storage.session`) — Temporary session data

Uninstalling the extension deletes all stored data.

## Your Control

You have full control over your data:

- **Clear cache** — Options page → Clear cached analyses
- **Delete preferences** — Options page → Memory section → Clear all
- **Remove API keys** — Options page → Delete API key fields
- **Delete notes** — Notes tab → Delete individual notes
- **Uninstall** — Removes all VidPulse data from your device

## Children's Privacy

VidPulse is not directed at children under 13. We do not knowingly collect data from children.

## Changes

We may update this policy. Changes will be reflected in the "Last updated" date. Significant changes will be noted in release notes.

## Contact

For privacy questions or concerns:
- GitHub: https://github.com/planetaryescape/vidpulse/issues
- Email: vidpulse@bhekani.com
