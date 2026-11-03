import { NavLink } from "react-router";

interface Tab {
  to: string;
  label: string;
  end?: boolean;
}

/** Route-backed tabs. The active link gets `aria-current="page"` from NavLink. */
export function NavTabs({ tabs, label }: { tabs: Tab[]; label: string }) {
  return (
    <nav aria-label={label} className="-mb-px flex gap-1 overflow-x-auto">
      {tabs.map((tab) => (
        <NavLink
          key={tab.to}
          to={tab.to}
          end={tab.end ?? false}
          className={({ isActive }) =>
            `border-b-2 px-3 py-2 text-sm font-medium whitespace-nowrap transition ${
              isActive
                ? "border-accent text-text"
                : "border-transparent text-text-muted hover:text-text"
            }`
          }
        >
          {tab.label}
        </NavLink>
      ))}
    </nav>
  );
}
