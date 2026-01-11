import { exportNotesForVideo } from "../../../shared/export";
import type { PanelState, VideoNote } from "../../../shared/types";
import { updateMarkersForNotes } from "../../markers";
import {
	addNote,
	deleteNote,
	getNotesForVideo,
	updateNote,
} from "../../storage-proxy";
import { formatTimestamp, generateNoteId } from "../utils";
import { getCurrentVideoTime, getVideoTitle, seekToTime } from "../video";

function createNoteItem(
	note: VideoNote,
	videoId: string,
	onUpdate: () => void,
): HTMLElement {
	const item = document.createElement("div");
	item.className = "vp-note-item";
	item.dataset.noteId = note.id;

	const timestampBtn = document.createElement("button");
	timestampBtn.className = "vp-note-time";
	timestampBtn.setAttribute("type", "button");
	timestampBtn.textContent = note.timestampFormatted;
	timestampBtn.title = `Jump to ${note.timestampFormatted}`;
	timestampBtn.addEventListener("click", (e) => {
		e.preventDefault();
		e.stopPropagation();
		seekToTime(note.timestamp);
	});

	const contentArea = document.createElement("div");
	contentArea.className = "vp-note-content";

	const textarea = document.createElement("textarea");
	textarea.className = "vp-note-text";
	textarea.value = note.content;
	textarea.placeholder = "Type your note...";
	textarea.rows = 2;

	const autoResize = () => {
		textarea.style.height = "auto";
		textarea.style.height = `${Math.max(textarea.scrollHeight, 40)}px`;
	};

	let saveTimeout: ReturnType<typeof setTimeout>;
	let lastSavedContent = note.content;

	const saveNote = async () => {
		const currentContent = textarea.value;
		if (currentContent !== lastSavedContent) {
			await updateNote(videoId, note.id, currentContent);
			lastSavedContent = currentContent;
		}
	};

	textarea.addEventListener("input", () => {
		autoResize();
		clearTimeout(saveTimeout);
		saveTimeout = setTimeout(saveNote, 500);
	});

	// Also save on blur for reliability
	textarea.addEventListener("blur", () => {
		clearTimeout(saveTimeout);
		saveNote();
	});

	textarea.addEventListener("focus", autoResize);

	const deleteBtn = document.createElement("button");
	deleteBtn.className = "vp-note-delete";
	deleteBtn.setAttribute("type", "button");
	deleteBtn.textContent = "\u2715";
	deleteBtn.title = "Delete note";

	deleteBtn.addEventListener("click", async (e) => {
		e.preventDefault();
		e.stopPropagation();

		if (confirm("Delete this note?")) {
			await deleteNote(videoId, note.id);
			onUpdate();
		}
	});

	contentArea.appendChild(textarea);
	contentArea.appendChild(deleteBtn);

	item.appendChild(timestampBtn);
	item.appendChild(contentArea);

	setTimeout(autoResize, 0);

	return item;
}

export function buildNotesPanel(state: PanelState): HTMLElement {
	const panel = document.createElement("div");
	panel.className = "vp-tab-panel vp-notes-panel";
	panel.style.display = "none";

	const header = document.createElement("div");
	header.className = "vp-notes-header";

	const addBtn = document.createElement("button");
	addBtn.className = "vp-add-note-btn";
	addBtn.setAttribute("type", "button");
	addBtn.textContent = "+ Add Note";

	const exportBtn = document.createElement("button");
	exportBtn.className = "vp-export-notes-btn";
	exportBtn.setAttribute("type", "button");
	exportBtn.title = "Export notes as markdown";
	exportBtn.textContent = "\u2193";

	header.appendChild(addBtn);
	header.appendChild(exportBtn);
	panel.appendChild(header);

	const notesList = document.createElement("div");
	notesList.className = "vp-notes-list";
	panel.appendChild(notesList);

	const emptyState = document.createElement("p");
	emptyState.className = "vp-no-notes";
	emptyState.textContent =
		'No notes yet. Click "Add Note" to capture a thought.';

	const loadNotes = async () => {
		const notes = await getNotesForVideo(state.videoId);
		while (notesList.firstChild) {
			notesList.removeChild(notesList.firstChild);
		}

		if (notes.length === 0) {
			notesList.appendChild(emptyState);
			exportBtn.style.display = "none";
		} else {
			exportBtn.style.display = "";
			for (const note of notes) {
				notesList.appendChild(createNoteItem(note, state.videoId, loadNotes));
			}
		}

		// Update timeline markers
		updateMarkersForNotes(state.videoId, notes);
	};

	addBtn.addEventListener("click", async (e) => {
		e.preventDefault();
		e.stopPropagation();

		const currentTime = getCurrentVideoTime();
		const timestamp = formatTimestamp(currentTime);

		const newNote: VideoNote = {
			id: generateNoteId(),
			videoId: state.videoId,
			videoTitle: getVideoTitle(),
			videoUrl: `https://www.youtube.com/watch?v=${state.videoId}`,
			timestamp: currentTime,
			timestampFormatted: timestamp,
			content: "",
			createdAt: Date.now(),
			updatedAt: Date.now(),
		};

		await addNote(newNote);
		await loadNotes();

		const noteItems = notesList.querySelectorAll(".vp-note-item");
		const lastNote = noteItems[noteItems.length - 1];
		const textarea = lastNote?.querySelector("textarea") as HTMLTextAreaElement;
		textarea?.focus();
	});

	exportBtn.addEventListener("click", async (e) => {
		e.preventDefault();
		e.stopPropagation();
		await exportNotesForVideo(state.videoId);
	});

	loadNotes();

	return panel;
}
