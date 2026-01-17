import { useEffect, useState } from "preact/hooks";
import type { SearchRelatedContentResponse } from "../../../../shared/messages";
import { MessageType, sendMessage } from "../../../../shared/messages";
import type { RelatedResource, VideoAnalysis } from "../../../../shared/types";

interface RelatedPanelProps {
	videoId: string;
	analysis?: VideoAnalysis;
}

export function RelatedPanel({ videoId, analysis }: RelatedPanelProps) {
	const [resources, setResources] = useState<RelatedResource[]>([]);
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [needsApiKey, setNeedsApiKey] = useState(false);

	useEffect(() => {
		if (!analysis) return;

		const loadRelated = async () => {
			try {
				const response = await sendMessage<SearchRelatedContentResponse>({
					type: MessageType.SEARCH_RELATED_CONTENT,
					videoId,
					summary: analysis.summary,
					tags: analysis.tags,
				});

				setIsLoading(false);

				if (!response.success) {
					if (response.error?.includes("not configured")) {
						setNeedsApiKey(true);
					} else {
						setError(response.error || "Failed to find related content");
					}
					return;
				}

				setResources(response.resources || []);
			} catch {
				setIsLoading(false);
				setError("Error loading related content");
			}
		};

		// Slight delay to avoid blocking main render
		const timer = setTimeout(loadRelated, 100);
		return () => clearTimeout(timer);
	}, [videoId, analysis]);

	const handleOpenSettings = (e: MouseEvent) => {
		e.preventDefault();
		sendMessage({ type: MessageType.OPEN_OPTIONS });
	};

	if (isLoading) {
		return (
			<div className="vp-tab-panel vp-related-panel">
				<div className="vp-related-loading">Finding related resources...</div>
			</div>
		);
	}

	if (needsApiKey) {
		return (
			<div className="vp-tab-panel vp-related-panel">
				<div className="vp-related-empty">
					Brave API key not configured.{" "}
					<button
						type="button"
						className="vp-link-button"
						onClick={handleOpenSettings}
					>
						Open settings
					</button>
				</div>
			</div>
		);
	}

	if (error) {
		return (
			<div className="vp-tab-panel vp-related-panel">
				<div className="vp-related-empty">{error}</div>
			</div>
		);
	}

	if (resources.length === 0) {
		return (
			<div className="vp-tab-panel vp-related-panel">
				<div className="vp-related-empty">No related resources found</div>
			</div>
		);
	}

	return (
		<div className="vp-tab-panel vp-related-panel">
			<div className="vp-related-list">
				{resources.map((resource, index) => (
					<a
						key={index}
						className="vp-related-item"
						href={resource.url}
						target="_blank"
						rel="noopener"
					>
						{resource.favicon && (
							<img
								className="vp-related-favicon"
								src={resource.favicon}
								alt=""
								onError={(e) => {
									(e.target as HTMLImageElement).style.display = "none";
								}}
							/>
						)}
						<div className="vp-related-content">
							<div className="vp-related-title">{resource.title}</div>
							<div className="vp-related-desc">
								{resource.description && resource.description.length > 120
									? `${resource.description.slice(0, 120)}...`
									: resource.description}
							</div>
							<div className="vp-related-source">{resource.source}</div>
						</div>
					</a>
				))}
			</div>
		</div>
	);
}
