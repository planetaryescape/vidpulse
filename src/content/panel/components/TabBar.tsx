interface Tab {
	id: string;
	label: string;
	disabled?: boolean;
}

interface TabBarProps {
	tabs: Tab[];
	activeTab: string;
	onTabChange: (tabId: string) => void;
}

export function TabBar({ tabs, activeTab, onTabChange }: TabBarProps) {
	return (
		<div className="vp-tab-bar">
			{tabs.map((tab) => (
				<button
					key={tab.id}
					type="button"
					className={`vp-tab${tab.id === activeTab ? " vp-tab-active" : ""}${tab.disabled ? " vp-tab-disabled" : ""}`}
					disabled={tab.disabled}
					data-tab={tab.id}
					onClick={(e) => {
						e.preventDefault();
						e.stopPropagation();
						if (!tab.disabled) {
							onTabChange(tab.id);
						}
					}}
				>
					{tab.label}
				</button>
			))}
		</div>
	);
}
