import { StrictMode, useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './style.css';

type Health = { collection?: string; status?: string };
type UploadState = 'idle' | 'uploading' | 'complete' | 'error';

function App() {
  const [health, setHealth] = useState<Health | null>(null);
  const [error, setError] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadState, setUploadState] = useState<UploadState>('idle');
  const [uploadMessage, setUploadMessage] = useState('');
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch('/api/health').then(response => {
      if (!response.ok) throw new Error(`Rusty-ROM service returned ${response.status}`);
      return response.json();
    }).then(setHealth).catch(reason => setError(reason instanceof Error ? reason.message : 'Rusty-ROM service unavailable'));
  }, []);

  function chooseFile(event: React.ChangeEvent<HTMLInputElement>) {
    setSelectedFile(event.target.files?.[0] || null); setUploadState('idle'); setUploadMessage('');
  }

  function uploadRom() {
    if (!selectedFile) return;
    setUploadState('uploading'); setUploadMessage('Uploading ROM to Rusty-ROM…');
    const request = new XMLHttpRequest(); const body = new FormData(); body.append('file', selectedFile, selectedFile.name);
    request.open('POST', '/api/roms'); request.responseType = 'json';
    request.onload = () => { if (request.status >= 200 && request.status < 300) { setUploadState('complete'); setUploadMessage('Uploaded. Rusty-ROM will hash and match it against the imported DAT.'); } else { setUploadState('error'); setUploadMessage(request.response?.error?.message || `Upload failed (${request.status}).`); } };
    request.onerror = () => { setUploadState('error'); setUploadMessage('Rusty-ROM could not be reached.'); };
    request.send(body);
  }

  const serviceOnline = Boolean(health);
  return <div className="app-shell">
    <aside className="sidebar">
      <div className="brand"><span className="brand-mark">R</span><span>Rusty-ROM</span></div>
      <nav aria-label="Main navigation"><a className="nav-item active" href="#dashboard"><span>▦</span> Dashboard</a><a className="nav-item" href="#library"><span>▤</span> Library</a><a className="nav-item" href="#queue"><span>↻</span> Activity</a><a className="nav-item" href="#settings"><span>⚙</span> Settings</a></nav>
      <div className="sidebar-footer"><span className={`status-dot ${serviceOnline ? 'online' : ''}`} />{serviceOnline ? 'Service online' : 'Connecting…'}<small>v0.1.0</small></div>
    </aside>
    <main className="content" id="dashboard">
      <header className="topbar"><div><p className="breadcrumb">HOME / DASHBOARD</p><h1>Dashboard</h1></div><button className="icon-button" aria-label="Settings">⚙</button></header>
      <section className="welcome-row"><div><h2>Good morning.</h2><p>Keep your collection clean, verified, and ready to publish.</p></div><button className="button primary" onClick={() => input.current?.click()}>＋ Add ROM</button></section>
      <section className="stats-grid" aria-label="Collection summary"><article className="stat-card"><span className="stat-icon orange">▤</span><div><small>LIBRARY</small><strong>0</strong><p>ROMs indexed</p></div></article><article className="stat-card"><span className="stat-icon blue">✓</span><div><small>VERIFIED</small><strong>0</strong><p>Ready to publish</p></div></article><article className="stat-card"><span className="stat-icon purple">↻</span><div><small>ACTIVITY</small><strong>0</strong><p>Pending actions</p></div></article></section>
      <div className="dashboard-grid">
        <section className="panel status-panel"><div className="panel-heading"><div><p className="eyebrow">SYSTEM STATUS</p><h2>Rusty-ROM service</h2></div><span className={`pill ${serviceOnline ? 'success' : 'warning'}`}><span className="status-dot" />{serviceOnline ? 'Healthy' : 'Unavailable'}</span></div><p className="muted">{health ? (health.collection || health.status || 'Service online') : (error || 'Connecting to the Rusty-ROM service…')}</p><div className="actions"><button className="button primary">Import DAT</button><button className="button">Scan collection</button><button className="button">Review changes</button></div></section>
        <section className="panel activity-panel"><div className="panel-heading"><div><p className="eyebrow">RECENT ACTIVITY</p><h2>Activity</h2></div><button className="link-button">View all</button></div><div className="empty-activity"><span>◌</span><p>No activity yet</p><small>Your collection activity will appear here.</small></div></section>
        <section className="panel intake-panel"><div className="panel-heading"><div><p className="eyebrow">ROM INTAKE</p><h2>Verify a ROM</h2></div><span className="panel-count">01</span></div><p className="muted">Upload a ROM to hash it against the active DAT. The original file stays unchanged until you approve a result.</p><input ref={input} className="file-input" type="file" onChange={chooseFile} /><button className="drop-target" onClick={() => input.current?.click()}><span className="upload-icon">↑</span><strong>{selectedFile ? selectedFile.name : 'Choose a ROM file'}</strong><small>{selectedFile ? formatSize(selectedFile.size) : 'Click to browse your files'}</small></button>{selectedFile && <div className="upload-row"><button className="button primary" onClick={uploadRom} disabled={uploadState === 'uploading'}>{uploadState === 'uploading' ? 'Uploading…' : 'Upload for verification'}</button><button className="button" onClick={() => { setSelectedFile(null); if (input.current) input.current.value = ''; }}>Clear</button></div>}{uploadMessage && <p className={`message ${uploadState === 'error' ? 'error' : uploadState === 'complete' ? 'ok' : ''}`} role="status">{uploadMessage}</p>}</section>
      </div>
    </main>
  </div>;
}

function formatSize(bytes: number) { if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`; return `${(bytes / (1024 * 1024)).toFixed(1)} MB`; }

createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>);
