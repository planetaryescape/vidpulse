import type { VideoNote } from './types';
import { getNotesForVideo, getAllNotes } from './storage';

function formatTimestamp(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hours > 0) {
    return `${hours}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }
  return `${mins}:${String(secs).padStart(2, '0')}`;
}

function notesToMarkdown(videoTitle: string, videoUrl: string, notes: VideoNote[]): string {
  const sortedNotes = [...notes].sort((a, b) => a.timestamp - b.timestamp);

  let md = `# ${videoTitle}\n`;
  md += `${videoUrl}\n\n`;
  md += `## Notes\n\n`;

  for (const note of sortedNotes) {
    const timestamp = formatTimestamp(note.timestamp);
    const timeUrl = `${videoUrl}&t=${Math.floor(note.timestamp)}`;
    md += `**[${timestamp}](${timeUrl})** ${note.content}\n\n`;
  }

  return md;
}

export async function exportNotesForVideo(videoId: string): Promise<void> {
  const notes = await getNotesForVideo(videoId);
  if (notes.length === 0) return;

  const firstNote = notes[0];
  const markdown = notesToMarkdown(firstNote.videoTitle, firstNote.videoUrl, notes);

  downloadMarkdown(markdown, `${sanitizeFilename(firstNote.videoTitle)}-notes.md`);
}

export async function exportAllNotes(): Promise<void> {
  const allNotes = await getAllNotes();
  const entries = Object.entries(allNotes).filter(([, notes]) => notes.length > 0);

  if (entries.length === 0) return;

  let markdown = `# VidPulse Notes Export\n\n`;
  markdown += `Exported: ${new Date().toLocaleString()}\n\n`;
  markdown += `---\n\n`;

  for (const [, notes] of entries) {
    if (notes.length === 0) continue;
    const firstNote = notes[0];
    markdown += notesToMarkdown(firstNote.videoTitle, firstNote.videoUrl, notes);
    markdown += `---\n\n`;
  }

  downloadMarkdown(markdown, `vidpulse-notes-${new Date().toISOString().split('T')[0]}.md`);
}

function sanitizeFilename(name: string): string {
  return name
    .replace(/[<>:"/\\|?*]/g, '')
    .replace(/\s+/g, '-')
    .toLowerCase()
    .slice(0, 50);
}

function downloadMarkdown(content: string, filename: string): void {
  const blob = new Blob([content], { type: 'text/markdown' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
