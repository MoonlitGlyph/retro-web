import { StrictMode, useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import "./style.css";

type Health = { collection?: string; status?: string };
type UploadState = "idle" | "uploading" | "complete" | "error";
type View = "dashboard" | "platforms" | "collections" | "libraries";
type Platform = {
  id: number;
  name: string;
  identifier: string;
  icon?: string;
  daijishou?: Record<string, unknown>;
};
type Collection = {
  id: number;
  name: string;
  dataFiles: string[];
  platformId?: number;
};
type Library = {
  id: number;
  name: string;
  path: string;
  collectionIds: number[];
};
type DirectoryListing = {
  path: string;
  parent?: string;
  directories: { name: string; path: string }[];
};

const pageTitles: Record<View, string> = {
  dashboard: "Dashboard",
  platforms: "Platforms",
  collections: "Collections",
  libraries: "Libraries",
};

async function apiRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`/api${path}`, {
    headers: { "Content-Type": "application/json", ...(init?.headers || {}) },
    ...init,
  });
  const payload = await response.json();
  if (!response.ok)
    throw new Error(
      payload.error?.message || `Rusty-ROM returned ${response.status}`,
    );
  return payload as T;
}

function viewFromHash(): View {
  const value = window.location.hash.slice(1) as View;
  return value in pageTitles ? value : "dashboard";
}

function App() {
  const [view, setView] = useState<View>(viewFromHash);
  const [health, setHealth] = useState<Health | null>(null);
  const [error, setError] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadState, setUploadState] = useState<UploadState>("idle");
  const [uploadMessage, setUploadMessage] = useState("");
  const [platforms, setPlatforms] = useState<Platform[]>([]);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [libraries, setLibraries] = useState<Library[]>([]);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch("/api/health")
      .then((response) => {
        if (!response.ok)
          throw new Error(`Rusty-ROM service returned ${response.status}`);
        return response.json();
      })
      .then(setHealth)
      .catch((reason) =>
        setError(
          reason instanceof Error
            ? reason.message
            : "Rusty-ROM service unavailable",
        ),
      );
  }, []);

  useEffect(() => {
    Promise.all([
      apiRequest<Platform[]>("/platforms"),
      apiRequest<Collection[]>("/collections"),
      apiRequest<Library[]>("/libraries"),
    ])
      .then(([loadedPlatforms, loadedCollections, loadedLibraries]) => {
        setPlatforms(loadedPlatforms);
        setCollections(loadedCollections);
        setLibraries(loadedLibraries);
      })
      .catch((reason) =>
        setError(
          reason instanceof Error
            ? reason.message
            : "Could not load Rusty-ROM configuration",
        ),
      );
  }, []);

  useEffect(() => {
    window.history.replaceState(
      null,
      "",
      view === "dashboard" ? "#" : `#${view}`,
    );
  }, [view]);

  function chooseFile(event: React.ChangeEvent<HTMLInputElement>) {
    setSelectedFile(event.target.files?.[0] || null);
    setUploadState("idle");
    setUploadMessage("");
  }
  function uploadRom() {
    if (!selectedFile) return;
    setUploadState("uploading");
    setUploadMessage("Uploading ROM to Rusty-ROM…");
    const request = new XMLHttpRequest();
    const body = new FormData();
    body.append("file", selectedFile, selectedFile.name);
    request.open("POST", "/api/roms");
    request.responseType = "json";
    request.onload = () => {
      if (request.status >= 200 && request.status < 300) {
        setUploadState("complete");
        setUploadMessage(
          "Uploaded. Rusty-ROM will hash and match it against the imported DAT.",
        );
      } else {
        setUploadState("error");
        setUploadMessage(
          request.response?.error?.message ||
            `Upload failed (${request.status}).`,
        );
      }
    };
    request.onerror = () => {
      setUploadState("error");
      setUploadMessage("Rusty-ROM could not be reached.");
    };
    request.send(body);
  }

  const serviceOnline = Boolean(health);
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark">R</span>
          <span>Rusty-ROM</span>
        </div>
        <nav aria-label="Main navigation">
          <NavItem view="dashboard" current={view} setView={setView} icon="▦">
            Dashboard
          </NavItem>
          <NavItem view="platforms" current={view} setView={setView} icon="▥">
            Platforms
          </NavItem>
          <NavItem view="collections" current={view} setView={setView} icon="▤">
            Collections
          </NavItem>
          <NavItem view="libraries" current={view} setView={setView} icon="▣">
            Libraries
          </NavItem>
        </nav>
        <div className="sidebar-footer">
          <span className={`status-dot ${serviceOnline ? "online" : ""}`} />
          {serviceOnline ? "Service online" : "Connecting…"}
          <small>v0.1.0</small>
        </div>
      </aside>
      <main className="content">
        <header className="topbar">
          <div>
            <p className="breadcrumb">
              HOME / {pageTitles[view].toUpperCase()}
            </p>
            <h1>{pageTitles[view]}</h1>
          </div>
          <button className="icon-button" aria-label="Settings">
            ⚙
          </button>
        </header>
        {view === "dashboard" && (
          <Dashboard
            health={health}
            error={error}
            serviceOnline={serviceOnline}
            input={input}
            selectedFile={selectedFile}
            uploadState={uploadState}
            uploadMessage={uploadMessage}
            chooseFile={chooseFile}
            uploadRom={uploadRom}
            setSelectedFile={setSelectedFile}
            setUploadMessage={setUploadMessage}
          />
        )}
        {view === "platforms" && (
          <Platforms platforms={platforms} setPlatforms={setPlatforms} />
        )}
        {view === "collections" && (
          <Collections
            platforms={platforms}
            collections={collections}
            setCollections={setCollections}
          />
        )}
        {view === "libraries" && (
          <Libraries
            collections={collections}
            libraries={libraries}
            setLibraries={setLibraries}
          />
        )}
      </main>
    </div>
  );
}

function NavItem({
  view,
  current,
  setView,
  icon,
  children,
}: {
  view: View;
  current: View;
  setView: (view: View) => void;
  icon: string;
  children: string;
}) {
  return (
    <button
      className={`nav-item ${current === view ? "active" : ""}`}
      onClick={() => setView(view)}
    >
      <span>{icon}</span>
      {children}
    </button>
  );
}

function Dashboard({
  health,
  error,
  serviceOnline,
  input,
  selectedFile,
  uploadState,
  uploadMessage,
  chooseFile,
  uploadRom,
  setSelectedFile,
  setUploadMessage,
}: {
  health: Health | null;
  error: string;
  serviceOnline: boolean;
  input: React.RefObject<HTMLInputElement | null>;
  selectedFile: File | null;
  uploadState: UploadState;
  uploadMessage: string;
  chooseFile: (event: React.ChangeEvent<HTMLInputElement>) => void;
  uploadRom: () => void;
  setSelectedFile: (file: File | null) => void;
  setUploadMessage: (message: string) => void;
}) {
  return (
    <>
      <section className="welcome-row">
        <div>
          <h2>Good morning.</h2>
          <p>Configure your platforms, data files, and libraries in order.</p>
        </div>
        <button
          className="button primary"
          onClick={() => input.current?.click()}
        >
          ＋ Add ROM
        </button>
      </section>
      <section className="stats-grid">
        <article className="stat-card">
          <span className="stat-icon orange">▥</span>
          <div>
            <small>PLATFORMS</small>
            <strong>0</strong>
            <p>Configured</p>
          </div>
        </article>
        <article className="stat-card">
          <span className="stat-icon blue">▤</span>
          <div>
            <small>COLLECTIONS</small>
            <strong>0</strong>
            <p>Data files</p>
          </div>
        </article>
        <article className="stat-card">
          <span className="stat-icon purple">▣</span>
          <div>
            <small>LIBRARIES</small>
            <strong>0</strong>
            <p>Library folders</p>
          </div>
        </article>
      </section>
      <div className="dashboard-grid">
        <section className="panel status-panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">SYSTEM STATUS</p>
              <h2>Rusty-ROM service</h2>
            </div>
            <span className={`pill ${serviceOnline ? "success" : "warning"}`}>
              <span className="status-dot" />
              {serviceOnline ? "Healthy" : "Unavailable"}
            </span>
          </div>
          <p className="muted">
            {health
              ? health.collection || health.status || "Service online"
              : error || "Connecting to the Rusty-ROM service…"}
          </p>
          <div className="actions">
            <button className="button">Scan collection</button>
            <button className="button">Review changes</button>
          </div>
        </section>
        <section className="panel activity-panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">SETUP ORDER</p>
              <h2>Build your catalog</h2>
            </div>
          </div>
          <ol className="setup-list">
            <li>
              <b>Platforms</b>
              <span>Define the systems you collect</span>
            </li>
            <li>
              <b>Collections</b>
              <span>Attach data files to each platform</span>
            </li>
            <li>
              <b>Libraries</b>
              <span>Choose folders and data sources</span>
            </li>
          </ol>
        </section>
        <section className="panel intake-panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">ROM INTAKE</p>
              <h2>Verify a ROM</h2>
            </div>
            <span className="panel-count">01</span>
          </div>
          <p className="muted">
            Upload a ROM to hash it against the active data files. The original
            stays unchanged until approval.
          </p>
          <input
            ref={input}
            className="file-input"
            type="file"
            onChange={chooseFile}
          />
          <button
            className="drop-target"
            onClick={() => input.current?.click()}
          >
            <span className="upload-icon">↑</span>
            <strong>
              {selectedFile ? selectedFile.name : "Choose a ROM file"}
            </strong>
            <small>
              {selectedFile
                ? formatSize(selectedFile.size)
                : "Click to browse your files"}
            </small>
          </button>
          {selectedFile && (
            <div className="upload-row">
              <button
                className="button primary"
                onClick={uploadRom}
                disabled={uploadState === "uploading"}
              >
                {uploadState === "uploading"
                  ? "Uploading…"
                  : "Upload for verification"}
              </button>
              <button
                className="button"
                onClick={() => {
                  setSelectedFile(null);
                  setUploadMessage("");
                  if (input.current) input.current.value = "";
                }}
              >
                Clear
              </button>
            </div>
          )}
          {uploadMessage && (
            <p
              className={`message ${uploadState === "error" ? "error" : uploadState === "complete" ? "ok" : ""}`}
              role="status"
            >
              {uploadMessage}
            </p>
          )}
        </section>
      </div>
    </>
  );
}

function Platforms({
  platforms,
  setPlatforms,
}: {
  platforms: Platform[];
  setPlatforms: (items: Platform[]) => void;
}) {
  const [name, setName] = useState("");
  const [identifier, setIdentifier] = useState("");
  const [icon, setIcon] = useState("");
  async function add() {
    if (!name.trim()) return;
    const platform = await apiRequest<Platform>("/platforms", {
      method: "POST",
      body: JSON.stringify({
        name: name.trim(),
        identifier: identifier.trim() || undefined,
        icon: icon.trim() || undefined,
      }),
    });
    setPlatforms([...platforms, platform]);
    setName("");
    setIdentifier("");
    setIcon("");
  }
  async function importManifests(files: FileList | null) {
    if (!files?.length) return;
    const imported: Platform[] = [];
    for (const file of Array.from(files)) {
      const parsed = JSON.parse(await file.text());
      const entries = Array.isArray(parsed)
        ? parsed
        : parsed.name || parsed.title || parsed.id
          ? [parsed]
          : parsed.platforms ||
            parsed.systems ||
            parsed.consoles ||
            Object.values(parsed).filter(
              (value): value is Record<string, unknown> =>
                Boolean(value && typeof value === "object"),
            );
      for (const entry of entries as Record<string, unknown>[]) {
        const name = String(
          entry.name || entry.title || entry.label || "",
        ).trim();
        if (!name) continue;
        const identifier = String(
          entry.uniqueId ||
            entry.identifier ||
            entry.id ||
            entry.slug ||
            entry.shortName ||
            "",
        ).trim();
        const icon = String(
          entry.icon || entry.iconUrl || entry.logo || entry.logoUrl || "",
        ).trim();
        imported.push(
          await apiRequest<Platform>("/platforms", {
            method: "POST",
            body: JSON.stringify({
              name,
              identifier: identifier || undefined,
              icon: icon || undefined,
              daijishou: entry,
            }),
          }),
        );
      }
    }
    setPlatforms([...platforms, ...imported]);
  }
  return (
    <ConfigPage
      eyebrow="PLATFORM CONFIGURATION"
      title="Platforms"
      description="Define the systems your collection supports. Collections and libraries use these platform definitions."
      form={
        <>
          <Field
            label="Platform name"
            value={name}
            onChange={setName}
            placeholder="Platform name"
          />
          <Field
            label="Identifier"
            value={identifier}
            onChange={setIdentifier}
            placeholder="platform-id"
          />
          <Field
            label="Icon URL or emoji"
            value={icon}
            onChange={setIcon}
            placeholder="Optional icon"
          />
          <button className="button primary" onClick={add}>
            ＋ Add platform
          </button>
          <label className="field">
            <span>Daijishou manifests</span>
            <input
              type="file"
              accept=".json"
              multiple
              onChange={(event) => {
                void importManifests(event.target.files);
              }}
            />
            <small className="field-help">
              Imports all selected platform entries immediately.
            </small>
          </label>
        </>
      }
    >
      <div className="config-list">
        {platforms.length === 0 ? (
          <EmptyState text="No platforms configured yet." />
        ) : (
          platforms.map((platform) => (
            <PlatformRow
              key={platform.id}
              platform={platform}
              onDeleted={() =>
                setPlatforms(
                  platforms.filter((item) => item.id !== platform.id),
                )
              }
            />
          ))
        )}
      </div>
    </ConfigPage>
  );
}

function PlatformIcon({ platform }: { platform: Platform }) {
  const fallback = platform.name.slice(0, 2).toUpperCase();
  return (
    <span className="platform-icon">
      {platform.icon?.startsWith("http") ? (
        <img src={platform.icon} alt="" />
      ) : (
        platform.icon || fallback
      )}
    </span>
  );
}

function PlatformRow({
  platform,
  onDeleted,
}: {
  platform: Platform;
  onDeleted: () => void;
}) {
  async function remove() {
    if (!window.confirm(`Delete ${platform.name}?`)) return;
    await apiRequest(`/platforms/${platform.id}`, { method: "DELETE" });
    onDeleted();
  }
  return (
    <div className="config-row">
      <PlatformIcon platform={platform} />
      <div>
        <b>{platform.name}</b>
        <small>{platform.identifier}</small>
      </div>
      <div className="platform-actions">
        <button className="button danger" onClick={remove}>
          Delete
        </button>
      </div>
    </div>
  );
}

function Collections({
  platforms,
  collections,
  setCollections,
}: {
  platforms: Platform[];
  collections: Collection[];
  setCollections: (items: Collection[]) => void;
}) {
  const [name, setName] = useState("");
  const [platformId, setPlatformId] = useState("");
  const [dataFiles, setDataFiles] = useState("");
  const [datFile, setDatFile] = useState<File | null>(null);
  async function add() {
    const files = dataFiles
      .split(/[,\n]/)
      .map((value) => value.trim())
      .filter(Boolean);
    if (!name.trim()) return;
    let collection: Collection;
    if (datFile) {
      const body = new FormData();
      body.append("file", datFile, datFile.name);
      const query = platformId ? `?platformId=${platformId}` : "";
      const response = await fetch(`/api/collections/import${query}`, {
        method: "POST",
        body,
      });
      const payload = await response.json();
      if (!response.ok)
        throw new Error(
          payload.error?.message || `Rusty-ROM returned ${response.status}`,
        );
      collection = payload as Collection;
    } else {
      collection = await apiRequest<Collection>("/collections", {
        method: "POST",
        body: JSON.stringify({
          name: name.trim(),
          dataFiles: files,
          platformId: platformId ? Number(platformId) : undefined,
        }),
      });
    }
    setCollections([...collections, collection]);
    setName("");
    setDataFiles("");
    setDatFile(null);
  }
  return (
    <ConfigPage
      eyebrow="DATA FILE CONFIGURATION"
      title="Collections"
      description="Define a collection, optionally associate it with a platform, and attach one or more data files as its verification sources."
      form={
        <>
          {platforms.length === 0 && (
            <Notice>Configure a platform first.</Notice>
          )}
          <Field
            label="Collection name"
            value={name}
            onChange={setName}
            placeholder="Collection name"
          />
          <Select
            label="Platform"
            value={platformId}
            onChange={setPlatformId}
            options={platforms.map((platform) => ({
              value: String(platform.id),
              label: platform.name,
            }))}
          />
          <Field
            label="Data file paths"
            value={dataFiles}
            onChange={setDataFiles}
            placeholder="/path/to/data-file.dat, /path/to/another.xml"
          />
          <label className="field">
            <span>Optional DAT/XML file</span>
            <input
              type="file"
              accept=".dat,.xml"
              onChange={(event) => setDatFile(event.target.files?.[0] || null)}
            />
            <small className="field-help">
              If selected, Add collection imports and validates this file.
            </small>
          </label>
          <button
            className="button primary"
            onClick={add}
            disabled={!name.trim()}
          >
            ＋ Add collection
          </button>
        </>
      }
    >
      <div className="config-list">
        {collections.length === 0 ? (
          <EmptyState text="No data files configured yet." />
        ) : (
          collections.map((collection) => {
            const platform = platforms.find(
              (item) => item.id === collection.platformId,
            );
            return (
              <CollectionRow
                key={collection.id}
                collection={collection}
                platform={platform}
                onDeleted={() =>
                  setCollections(
                    collections.filter((item) => item.id !== collection.id),
                  )
                }
              />
            );
          })
        )}
      </div>
    </ConfigPage>
  );
}

function CollectionRow({
  collection,
  platform,
  onDeleted,
}: {
  collection: Collection;
  platform?: Platform;
  onDeleted: () => void;
}) {
  async function remove() {
    if (!window.confirm(`Delete ${collection.name}?`)) return;
    await apiRequest(`/collections/${collection.id}`, { method: "DELETE" });
    onDeleted();
  }
  return (
    <div className="config-row">
      <span className="list-icon blue">▤</span>
      <div>
        <b>{collection.name}</b>
        <small>
          {platform?.name || "Platform agnostic"} ·{" "}
          {collection.dataFiles.join(" · ")}
        </small>
      </div>
      <div className="platform-actions">
        <button className="button danger" onClick={remove}>
          Delete
        </button>
      </div>
    </div>
  );
}

function Libraries({
  collections,
  libraries,
  setLibraries,
}: {
  collections: Collection[];
  libraries: Library[];
  setLibraries: (items: Library[]) => void;
}) {
  const [name, setName] = useState("");
  const [path, setPath] = useState("");
  const [selected, setSelected] = useState<number[]>([]);
  const [browser, setBrowser] = useState<DirectoryListing | null>(null);
  const [browserError, setBrowserError] = useState("");
  async function add() {
    if (!name.trim() || !path.trim() || selected.length === 0) return;
    const library = await apiRequest<Library>("/libraries", {
      method: "POST",
      body: JSON.stringify({
        name: name.trim(),
        path: path.trim(),
        collectionIds: selected,
      }),
    });
    setLibraries([...libraries, library]);
    setName("");
    setPath("");
    setSelected([]);
  }
  function toggle(id: number) {
    setSelected(
      selected.includes(id)
        ? selected.filter((item) => item !== id)
        : [...selected, id],
    );
  }
  async function browse(directory = path || "/") {
    try {
      setBrowserError("");
      setBrowser(
        await apiRequest<DirectoryListing>(
          `/directories?path=${encodeURIComponent(directory)}`,
        ),
      );
    } catch (error) {
      setBrowserError(
        error instanceof Error
          ? error.message
          : "Unable to browse this directory",
      );
    }
  }
  return (
    <ConfigPage
      eyebrow="FOLDER CONFIGURATION"
      title="Libraries"
      description="Point Rusty-ROM at a folder and select the collections that source its verification rules."
      form={
        <>
          {collections.length === 0 && (
            <Notice>Configure a collection first.</Notice>
          )}
          <Field
            label="Library name"
            value={name}
            onChange={setName}
            placeholder="Library name"
          />
          <label className="field">
            <span>Folder path</span>
            <div className="path-picker">
              <input
                value={path}
                onChange={(event) => setPath(event.target.value)}
                placeholder="/path/to/roms"
              />
              <button
                className="button"
                type="button"
                onClick={() => void browse()}
              >
                Browse
              </button>
            </div>
            <small className="field-help">
              Absolute path inside the retro-rom container.
            </small>
          </label>
          {browser && (
            <div className="directory-browser">
              <div className="directory-browser-heading">
                <b>Choose folder</b>
                <button
                  className="icon-button"
                  type="button"
                  aria-label="Close folder browser"
                  onClick={() => setBrowser(null)}
                >
                  ×
                </button>
              </div>
              <code>{browser.path}</code>
              <div className="directory-actions">
                {browser.parent && (
                  <button
                    className="button"
                    type="button"
                    onClick={() => void browse(browser.parent)}
                  >
                    ↑ Parent
                  </button>
                )}
                <button
                  className="button primary"
                  type="button"
                  onClick={() => {
                    setPath(browser.path);
                    setBrowser(null);
                  }}
                >
                  Select this folder
                </button>
              </div>
              <div className="directory-list">
                {browser.directories.length === 0 ? (
                  <small>No subfolders.</small>
                ) : (
                  browser.directories.map((directory) => (
                    <button
                      className="directory-entry"
                      type="button"
                      key={directory.path}
                      onClick={() => void browse(directory.path)}
                    >
                      ▸ {directory.name}
                    </button>
                  ))
                )}
              </div>
              {browserError && <Notice>{browserError}</Notice>}
            </div>
          )}
          <fieldset className="source-picker">
            <legend>Source data files</legend>
            {collections.length === 0 ? (
              <small>No collections exist yet.</small>
            ) : (
              collections.map((collection) => (
                <label key={collection.id}>
                  <input
                    type="checkbox"
                    checked={selected.includes(collection.id)}
                    onChange={() => toggle(collection.id)}
                  />
                  {collection.name}
                  <small>{collection.dataFiles.join(" · ")}</small>
                </label>
              ))
            )}
          </fieldset>
          <button
            className="button primary"
            onClick={add}
            disabled={!collections.length}
          >
            ＋ Add library
          </button>
        </>
      }
    >
      <div className="config-list">
        {libraries.length === 0 ? (
          <EmptyState text="No libraries configured yet." />
        ) : (
          libraries.map((library) => {
            return (
              <div className="config-row" key={library.id}>
                <span className="list-icon purple">▣</span>
                <div>
                  <b>{library.name}</b>
                  <small>
                    {library.path} · {library.collectionIds.length} source(s)
                  </small>
                </div>
                <span className="row-state">Configured</span>
              </div>
            );
          })
        )}
      </div>
    </ConfigPage>
  );
}

function ConfigPage({
  eyebrow,
  title,
  description,
  form,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  form: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <>
      <section className="page-intro">
        <p className="eyebrow">{eyebrow}</p>
        <h2>{title}</h2>
        <p>{description}</p>
      </section>
      <div className="config-layout">
        <section className="panel config-form">
          <div className="panel-heading">
            <h3>Configuration</h3>
            <span className="panel-count">SETUP</span>
          </div>
          {form}
        </section>
        <section className="panel">
          <div className="panel-heading">
            <h3>Configured {title.toLowerCase()}</h3>
          </div>
          {children}
        </section>
      </div>
    </>
  );
}
function Field({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
      />
    </label>
  );
}
function Select({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <label className="field">
      <span>{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        <option value="">Select a platform…</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}
function Notice({ children }: { children: string }) {
  return <p className="notice">{children}</p>;
}
function EmptyState({ text }: { text: string }) {
  return (
    <div className="empty-config">
      <span>◌</span>
      <p>{text}</p>
    </div>
  );
}
function formatSize(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
