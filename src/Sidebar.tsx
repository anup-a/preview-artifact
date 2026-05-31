import type { Artifacts, ArtifactInfo } from "./api";
import { viewUrl } from "./api";

interface SidebarProps {
  artifacts: Artifacts;
  currentPath: string;
  onClose: () => void;
}

const KIND_LABEL: Record<string, string> = {
  markdown: "MD",
  tex: "TEX",
  pdf: "PDF",
  image: "IMG",
};

function Item({ item, active }: { item: ArtifactInfo; active: boolean }) {
  const dir = item.path.slice(0, item.path.lastIndexOf("/"));
  return (
    <a
      className={"artifact-item" + (active ? " active" : "")}
      href={viewUrl(item.path)}
      title={item.path}
    >
      <span className="artifact-kind">{KIND_LABEL[item.kind] ?? "•"}</span>
      <span className="artifact-text">
        <span className="artifact-name">{item.name}</span>
        <span className="artifact-dir">{dir}</span>
      </span>
    </a>
  );
}

export function Sidebar({ artifacts, currentPath, onClose }: SidebarProps) {
  const { opened, recents } = artifacts;
  return (
    <aside className="sidebar">
      <div className="sidebar-head">
        <span className="sidebar-title">Artifacts</span>
        <button className="icon-btn sidebar-collapse" onClick={onClose} title="Hide panel" aria-label="Hide panel">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>
      </div>

      <div className="sidebar-scroll">
        <section className="sidebar-section">
          <div className="sidebar-label">Open</div>
          {opened.length === 0 ? (
            <p className="sidebar-empty">Nothing open yet.</p>
          ) : (
            opened.map((it) => <Item key={it.path} item={it} active={it.path === currentPath} />)
          )}
        </section>

        {recents.length > 0 && (
          <section className="sidebar-section">
            <div className="sidebar-label">Recent</div>
            {recents.map((it) => (
              <Item key={it.path} item={it} active={it.path === currentPath} />
            ))}
          </section>
        )}
      </div>
    </aside>
  );
}
