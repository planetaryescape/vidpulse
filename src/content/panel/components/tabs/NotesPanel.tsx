import { useCallback, useEffect, useRef, useState } from "preact/hooks";
import { exportNotesForVideo } from "../../../../shared/export";
import type { VideoNote } from "../../../../shared/types";
import { updateMarkersForNotes } from "../../../markers";
import {
	addNote,
	deleteNote,
	getNotesForVideo,
	updateNote,
} from "../../../storage-proxy";
import { formatTimestamp, generateNoteId } from "../../utils";
import { getCurrentVideoTime, getVideoTitle, seekToTime } from "../../video";

interface NoteItemProps {
	note: VideoNote;
	videoId: string;
	onDelete: () => void;
}

function NoteItem({ note, videoId, onDelete }: NoteItemProps) {
	const [content, setContent] = useState(note.content);
	const textareaRef = useRef<HTMLTextAreaElement>(null);
	const saveTimeoutRef = useRef<ReturnType<typeof setTimeout>>();
	const lastSavedRef = useRef(note.content);

	const autoResize = useCallback(() => {
		const textarea = textareaRef.current;
		if (textarea) {
			textarea.style.height = "auto";
			textarea.style.height = `${Math.max(textarea.scrollHeight, 40)}px`;
		}
	}, []);

	const saveNote = useCallback(async () => {
		if (content !== lastSavedRef.current) {
			await updateNote(videoId, note.id, content);
			lastSavedRef.current = content;
		}
	}, [content, videoId, note.id]);

	useEffect(() => {
		autoResize();
	}, [autoResize]);

	const handleInput = (e: Event) => {
		const target = e.target as HTMLTextAreaElement;
		setContent(target.value);
		autoResize();
		if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
		saveTimeoutRef.current = setTimeout(saveNote, 500);
	};

	const handleBlur = () => {
		if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
		saveNote();
	};

	const handleDelete = async () => {
		if (confirm("Delete this note?")) {
			await deleteNote(videoId, note.id);
			onDelete();
		}
	};

	return (
		<div className="vp-note-item" data-note-id={note.id}>
			<button
				type="button"
				className="vp-note-time"
				title={`Jump to ${note.timestampFormatted}`}
				onClick={(e) => {
					e.preventDefault();
					e.stopPropagation();
					seekToTime(note.timestamp);
				}}
			>
				{note.timestampFormatted}
			</button>
			<div className="vp-note-content">
				<textarea
					ref={textareaRef}
					className="vp-note-text"
					value={content}
					placeholder="Type your note..."
					rows={2}
					onInput={handleInput}
					onBlur={handleBlur}
					onFocus={autoResize}
				/>
				<button
					type="button"
					className="vp-note-delete"
					title="Delete note"
					onClick={(e) => {
						e.preventDefault();
						e.stopPropagation();
						handleDelete();
					}}
				>
					{"\u2715"}
				</button>
			</div>
		</div>
	);
}

interface NotesPanelProps {
	videoId: string;
}

export function NotesPanel({ videoId }: NotesPanelProps) {
	const [notes, setNotes] = useState<VideoNote[]>([]);
	const [isLoading, setIsLoading] = useState(true);

	const loadNotes = useCallback(async () => {
		const loaded = await getNotesForVideo(videoId);
		setNotes(loaded);
		setIsLoading(false);
		updateMarkersForNotes(videoId, loaded);
	}, [videoId]);

	useEffect(() => {
		loadNotes();
	}, [loadNotes]);

	const handleAddNote = async () => {
		const currentTime = getCurrentVideoTime();
		const timestamp = formatTimestamp(currentTime);

		const newNote: VideoNote = {
			id: generateNoteId(),
			videoId,
			videoTitle: getVideoTitle(),
			videoUrl: `https://www.youtube.com/watch?v=${videoId}`,
			timestamp: currentTime,
			timestampFormatted: timestamp,
			content: "",
			createdAt: Date.now(),
			updatedAt: Date.now(),
		};

		await addNote(newNote);
		await loadNotes();

		// Focus the new note's textarea after render
		setTimeout(() => {
			const noteItems = document.querySelectorAll(".vp-note-item");
			const lastNote = noteItems[noteItems.length - 1];
			const textarea = lastNote?.querySelector(
				"textarea",
			) as HTMLTextAreaElement;
			textarea?.focus();
		}, 0);
	};

	const handleExport = async () => {
		await exportNotesForVideo(videoId);
	};

	const hasNotes = notes.length > 0;

	return (
		<div className="vp-tab-panel vp-notes-panel">
			<div className="vp-notes-header">
				<button
					type="button"
					className="vp-add-note-btn"
					onClick={(e) => {
						e.preventDefault();
						e.stopPropagation();
						handleAddNote();
					}}
				>
					+ Add Note
				</button>
				<button
					type="button"
					className="vp-export-notes-btn"
					title="Export notes as markdown"
					style={{ display: hasNotes ? "" : "none" }}
					onClick={(e) => {
						e.preventDefault();
						e.stopPropagation();
						handleExport();
					}}
				>
					{"\u2193"}
				</button>
			</div>
			<div className="vp-notes-list">
				{isLoading ? null : hasNotes ? (
					notes.map((note) => (
						<NoteItem
							key={note.id}
							note={note}
							videoId={videoId}
							onDelete={loadNotes}
						/>
					))
				) : (
					<p className="vp-no-notes">
						No notes yet. Click "Add Note" to capture a thought.
					</p>
				)}
			</div>
		</div>
	);
}
