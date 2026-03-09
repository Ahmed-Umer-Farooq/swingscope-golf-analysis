import { useState, useCallback, useRef, useEffect } from "react";
import { Upload, Activity, Download, CheckCircle, AlertCircle, Loader2, ChevronRight, Zap, Play } from "lucide-react";

const API_BASE = import.meta.env.VITE_API_URL || "https://ahmadumerfarooq-golf-analysis-api.hf.space";
const POLL_MS  = 2500;

const fmtSize = (b) => b < 1e6 ? `${(b/1e3).toFixed(0)} KB` : `${(b/1e6).toFixed(1)} MB`;
const fmtDur  = (s) => s < 60 ? `${Math.round(s)}s` : `${Math.floor(s/60)}m ${Math.round(s%60)}s`;

// Free high-quality golf images from Unsplash (no API key needed)
const BG_IMAGES = [
  "https://images.unsplash.com/photo-1535131749006-b7f58c99034b?w=1920&q=80&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1587174486073-ae5e5cff23aa?w=1920&q=80&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1592919505780-303950717480?w=1920&q=80&auto=format&fit=crop",
];

function HeroBg() {
  const [idx, setIdx] = useState(0);
  const [fading, setFading] = useState(false);

  useEffect(() => {
    const t = setInterval(() => {
      setFading(true);
      setTimeout(() => { setIdx(i => (i+1) % BG_IMAGES.length); setFading(false); }, 800);
    }, 6000);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="hero-bg-wrap">
      <img
        key={idx}
        src={BG_IMAGES[idx]}
        alt=""
        className={`hero-bg-img ${fading ? "fading" : ""}`}
      />
      <div className="hero-bg-overlay" />
      <div className="hero-bg-vignette" />
      {/* Animated scan line */}
      <div className="scan-line" />
    </div>
  );
}

function DropZone({ onFile, disabled }) {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef();

  const handle = (file) => {
    if (!file) return;
    if (!file.type.match(/video\/(mp4|quicktime|x-msvideo|x-matroska)/)) {
      alert("Please upload an MP4, MOV, AVI or MKV file.");
      return;
    }
    onFile(file);
  };

  return (
    <div
      className={`dropzone ${dragging ? "dragging" : ""} ${disabled ? "disabled" : ""}`}
      onClick={() => !disabled && inputRef.current?.click()}
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => { e.preventDefault(); setDragging(false); handle(e.dataTransfer.files[0]); }}
    >
      <input
        ref={inputRef}
        type="file"
        accept="video/mp4,video/quicktime,video/x-msvideo,.mov,.mp4,.avi,.mkv"
        style={{ display: "none" }}
        onChange={(e) => handle(e.target.files[0])}
      />
      <div className="drop-ring">
        <Upload size={28} className="drop-icon" />
      </div>
      <p className="drop-title">Drop your swing video here</p>
      <p className="drop-tip">💡 Best results: 3–5 sec · side-on angle · single golfer</p>
      <p className="drop-sub">MP4 · MOV · AVI · MKV · Max 80 MB</p>
      <div className="drop-btn">
        <ChevronRight size={13} /> Browse File
      </div>
    </div>
  );
}

function ProgressBar({ pct, message, status }) {
  const color = status === "error" ? "#ef4444" : status === "done" ? "#22c55e" : "#d4a853";
  return (
    <div className="progress-wrap">
      <div className="progress-header">
        <span className="progress-msg">
          {status === "running" && <Loader2 className="spin-icon" size={13} />}
          {status === "done"    && <CheckCircle size={13} color="#22c55e" />}
          {status === "error"   && <AlertCircle size={13} color="#ef4444" />}
          &nbsp;{message}
        </span>
        <span className="progress-pct" style={{ color }}>{pct}%</span>
      </div>
      <div className="progress-track">
        <div className="progress-fill" style={{ width: `${pct}%`, background: color }} />
        {status === "running" && <div className="progress-glow" style={{ left: `${pct}%`, background: color }} />}
      </div>
    </div>
  );
}

export default function App() {
  const [file,      setFile]      = useState(null);
  const [jobId,     setJobId]     = useState(null);
  const [status,    setStatus]    = useState("idle");
  const [progress,  setProgress]  = useState(0);
  const [message,   setMessage]   = useState("");
  const [outputUrl, setOutputUrl] = useState(null);
  const [elapsed,   setElapsed]   = useState(0);
  const pollRef  = useRef(null);
  const timerRef = useRef(null);

  const stopPolling = () => {
    clearInterval(pollRef.current);
    clearInterval(timerRef.current);
  };

  const pollStatus = useCallback((id) => {
    pollRef.current = setInterval(async () => {
      try {
        const res  = await fetch(`${API_BASE}/status/${id}`);
        if (!res.ok) return;
        const data = await res.json();
        setProgress(data.progress);
        setMessage(data.message);
        setStatus(data.status);
        if (data.status === "done")  { stopPolling(); setOutputUrl(`${API_BASE}/download/${id}`); }
        if (data.status === "error") { stopPolling(); }
      } catch {}
    }, POLL_MS);
  }, []);

  const handleFile = (f) => {
    setFile(f); setStatus("idle"); setProgress(0);
    setMessage(""); setOutputUrl(null); setJobId(null);
  };

  const handleSubmit = async () => {
    if (!file) return;
    stopPolling();
    setStatus("queued"); setProgress(0); setMessage("Uploading..."); setOutputUrl(null);
    const t0 = Date.now();
    timerRef.current = setInterval(() => setElapsed(Math.round((Date.now()-t0)/1000)), 1000);
    try {
      const fd = new FormData(); fd.append("video", file);
      const res = await fetch(`${API_BASE}/analyze`, { method: "POST", body: fd });
      if (!res.ok) { const e = await res.json(); throw new Error(e.detail || "Upload failed"); }
      const data = await res.json();
      setJobId(data.job_id); setStatus("running"); setMessage("Analysing swing...");
      pollStatus(data.job_id);
    } catch (e) { stopPolling(); setStatus("error"); setMessage(e.message); }
  };

  const handleReset = () => {
    stopPolling();
    setFile(null); setJobId(null); setStatus("idle");
    setProgress(0); setMessage(""); setOutputUrl(null);
  };

  const busy = status === "queued" || status === "running";

  return (
    <div className="app">

      {/* ── HERO with cycling golf backgrounds ── */}
      <section className="hero-section">
        <HeroBg />

        <header className="header">
          <div className="logo">
            <Zap size={18} className="logo-icon" />
            <span>SwingScope</span>
          </div>
        </header>

        <div className="hero-content">
          <div className="hero-eyebrow">
            <Activity size={11} />
            <span>YOLO11-POSE · MOTIONBERT · 3D BIOMECHANICS</span>
          </div>
          <h1 className="hero-title">
            Decode Your<br />
            <em>Golf Swing</em>
          </h1>
          <p className="hero-sub">
            Upload a 3–5 second swing clip. Get a frame-by-frame 3D skeleton
            with 7 biomechanical metrics — instantly.
          </p>
          <a href="#analyze" className="hero-cta">
            <Play size={14} fill="currentColor" /> Analyse My Swing
          </a>
        </div>

        {/* Scroll indicator */}
        <div className="scroll-indicator">
          <div className="scroll-dot" />
        </div>
      </section>

      {/* ── MAIN CONTENT ── */}
      <main className="main-content" id="analyze">

        {/* Upload / Result card */}
        <section className="card-section">
          <div className="section-label">SWING ANALYSIS</div>
          <h2 className="section-heading">Upload Your Video</h2>

          <div className="card">
            {/* File info strip */}
            {file && (
              <div className="file-strip">
                <div className="file-info">
                  <div className="file-details">
                    <span className="file-name">{file.name}</span>
                    <span className="file-size">{fmtSize(file.size)}</span>
                  </div>
                </div>
                {!busy && <button className="btn-ghost" onClick={handleReset}>Change</button>}
              </div>
            )}

            {!file && <DropZone onFile={handleFile} disabled={busy} />}

            {status !== "idle" && (
              <ProgressBar pct={progress} message={message} status={status} />
            )}

            {busy && <p className="timer">⏱ {fmtDur(elapsed)} elapsed</p>}

            <div className="actions">
              {file && status === "idle" && (
                <button className="btn-primary" onClick={handleSubmit}>
                  <Activity size={15} /> Analyse Swing
                </button>
              )}
              {status === "done" && outputUrl && (
                <>
                  <a className="btn-primary" href={outputUrl} download="golf_3d_analysis.mp4">
                    <Download size={15} /> Download Result
                  </a>
                  <button className="btn-ghost" onClick={handleReset}>Analyse Another</button>
                </>
              )}
              {status === "error" && (
                <button className="btn-ghost" onClick={handleReset}>Try Again</button>
              )}
            </div>

            {status === "done" && outputUrl && (
              <div className="preview-wrap">
                <video controls autoPlay loop muted playsInline className="preview-video" src={outputUrl} />
              </div>
            )}
          </div>
        </section>

        {/* Metrics */}
        <section className="metrics-section">
          <div className="section-label">WHAT YOU GET</div>
          <h2 className="section-heading">7 Biomechanical Metrics</h2>
          <div className="metrics-grid">
            {[
              ["Upper Torso Turn",  "Shoulder rotation angle relative to camera plane", "#d4a853", "https://fonts.gstatic.com/s/i/short-term/release/materialsymbolsoutlined/360/default/24px.svg", "45°"],
              ["Pelvis Turn",       "Hip rotation — the key power transfer metric", "#c49a47", "https://fonts.gstatic.com/s/i/short-term/release/materialsymbolsoutlined/sync_alt/default/24px.svg", "38°"],
              ["Posture Bend",      "Spine tilt from vertical at address & impact", "#b48c3b", "https://fonts.gstatic.com/s/i/short-term/release/materialsymbolsoutlined/straighten/default/24px.svg", "28°"],
              ["Stance Alignment",  "Foot line angle relative to target line", "#a47e2f", "https://fonts.gstatic.com/s/i/short-term/release/materialsymbolsoutlined/align_horizontal_left/default/24px.svg", "2°"],
              ["Stance Width",      "Ankle-to-ankle distance in centimetres", "#947023", "https://fonts.gstatic.com/s/i/short-term/release/materialsymbolsoutlined/width/default/24px.svg", "62cm"],
              ["Stance Depth",      "Front-to-back foot depth differential", "#846217", "https://fonts.gstatic.com/s/i/short-term/release/materialsymbolsoutlined/height/default/24px.svg", "8cm"],
              ["Ball Position",     "Left/right ball position as % of total stance", "#74540b", "https://fonts.gstatic.com/s/i/short-term/release/materialsymbolsoutlined/sports_golf/default/24px.svg", "43%"],
            ].map(([label, desc, color, icon, value]) => (
              <div key={label} className="metric-card" style={{ '--accent': color }}>
                <div className="metric-header">
                  <div className="metric-icon-wrap">
                    <img src={icon} alt="" className="metric-icon" style={{ filter: `brightness(0) saturate(100%) invert(73%) sepia(28%) saturate(645%) hue-rotate(8deg) brightness(92%) contrast(87%)` }} />
                  </div>
                  <div className="metric-value">{value}</div>
                </div>
                <div className="metric-content">
                  <span className="metric-label">{label}</span>
                  <span className="metric-desc">{desc}</span>
                </div>
                <div className="metric-bar">
                  <div className="metric-bar-fill" />
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* How it works */}
        <section className="steps-section">
          <div className="section-label">THE PROCESS</div>
          <h2 className="section-heading">How It Works</h2>
          <div className="steps">
            {[
              ["01", "Upload",   "Drop a 3–5 second clip of your swing — address to follow-through. MP4, MOV, AVI or MKV."],
              ["02", "Detect",   "YOLO11-Pose extracts 17 body keypoints per frame. Custom segmentation highlights your club."],
              ["03", "Lift 3D",  "2D keypoints are mapped to H36M skeleton format and lifted to pseudo-3D using MotionBERT geometry."],
              ["04", "Analyse",  "7 biomechanical angles and distances computed per-frame and overlaid as live metrics."],
              ["05", "Download", "Side-by-side MP4: original footage with club overlay on the left, 3D skeleton + metrics on the right."],
            ].map(([n, title, desc]) => (
              <div key={n} className="step">
                <span className="step-num">{n}</span>
                <div>
                  <p className="step-title">{title}</p>
                  <p className="step-desc">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

      </main>

      <footer className="footer">
        <div className="footer-logo">
          <Zap size={14} />
          <span>SwingScope</span>
        </div>
        <span className="footer-copy">AI-Powered Golf Biomechanics</span>
      </footer>
    </div>
  );
}
