import CodeMirror from "@uiw/react-codemirror";
import { EditorView } from "@codemirror/view";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  AlertTriangle,
  BookOpen,
  Bug,
  CheckCircle2,
  Code2,
  Download,
  FileCheck2,
  GitBranch,
  Globe2,
  ListTree,
  Loader2,
  Package,
  Play,
  RefreshCcw,
  Search,
  ShieldCheck,
  SquareTerminal,
  TimerReset,
  WandSparkles,
  Workflow
} from "lucide-react";
import {
  execute,
  fetchDownloads,
  fetchHealth,
  fetchRuntimes,
  fetchVscodeExtension,
  type ApiExecutionResult,
  type ApiHealth,
  type DownloadsInfo,
  type InstallerDownload,
  type VscodeExtensionInfo,
  type RuntimeOption
} from "./api.js";
import { examples } from "./examples.js";
import { immHighlighting, immLanguage } from "./immLanguage.js";
import {
  languageDocCategories,
  languageDocs,
  repositoryRoles,
  type LanguageDocCoverage,
  type LanguageDocSection
} from "./siteContent.js";
import { staticDownloads, staticHealth, staticRuntimes, staticVscodeExtension } from "./staticFallback.js";

const editorTheme = EditorView.theme({
  "&": {
    height: "100%",
    fontSize: "14px",
    backgroundColor: "#fffdf8"
  },
  ".cm-scroller": {
    fontFamily: "'SFMono-Regular', Consolas, 'Liberation Mono', monospace"
  },
  ".cm-gutters": {
    backgroundColor: "#edf3ef",
    borderRight: "1px solid #cfd9d4",
    color: "#6f7d78"
  },
  ".cm-activeLine": {
    backgroundColor: "#fff1c8"
  },
  ".cm-activeLineGutter": {
    backgroundColor: "#dcebe4"
  },
  ".cm-content": {
    caretColor: "#0f766e"
  },
  "&.cm-focused": {
    outline: "2px solid #0f766e"
  },
  ".cm-selectionBackground, &.cm-focused .cm-selectionBackground": {
    backgroundColor: "#b7e4dc"
  }
});

const defaultSource = examples[0].source;
const defaultStdin = examples[0].stdin ?? "";

function App() {
  const [source, setSource] = useState(defaultSource);
  const [stdin, setStdin] = useState(defaultStdin);
  const [trace, setTrace] = useState(false);
  const [health, setHealth] = useState<ApiHealth | null>(null);
  const [runtimes, setRuntimes] = useState<RuntimeOption[]>([]);
  const [downloads, setDownloads] = useState<DownloadsInfo | null>(null);
  const [vscodeExtension, setVscodeExtension] = useState<VscodeExtensionInfo | null>(null);
  const [selectedRuntimeId, setSelectedRuntimeId] = useState("local");
  const [runtimeError, setRuntimeError] = useState<string | null>(null);
  const [result, setResult] = useState<ApiExecutionResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<"run" | "check" | "runtime" | null>(null);

  const extensions = useMemo(() => [immLanguage, immHighlighting, editorTheme], []);
  const selectedRuntime = runtimes.find((runtime) => runtime.id === selectedRuntimeId);
  const releaseRuntimes = runtimes.filter((runtime) => runtime.kind === "release");
  const runnerAvailable = health?.runnerAvailable !== false;

  useEffect(() => {
    fetchHealth()
      .then((payload) => {
        const nextHealth = { ...payload, runnerAvailable: payload.runnerAvailable ?? true };
        setHealth(nextHealth);
        if (nextHealth.runtimes?.length) {
          setRuntimes(nextHealth.runtimes);
          setSelectedRuntimeId(nextHealth.runtimes.find((runtime) => runtime.available)?.id ?? "local");
        }
      })
      .catch(() => {
        setHealth(staticHealth);
        setRuntimes(staticRuntimes);
        setSelectedRuntimeId("static");
      });

    fetchDownloads()
      .then(setDownloads)
      .catch(() => setDownloads(staticDownloads));

    fetchVscodeExtension()
      .then(setVscodeExtension)
      .catch(() => setVscodeExtension(staticVscodeExtension));
  }, []);

  useEffect(() => {
    function scrollToCurrentHash() {
      const id = decodeURIComponent(window.location.hash.replace(/^#/, ""));
      if (!id) {
        return;
      }
      const element = document.getElementById(id);
      if (!element) {
        return;
      }
      const top = Math.max(element.getBoundingClientRect().top + window.scrollY - 92, 0);
      const previousScrollBehavior = document.documentElement.style.scrollBehavior;
      document.documentElement.style.scrollBehavior = "auto";
      window.scrollTo({ top, behavior: "auto" });
      document.documentElement.style.scrollBehavior = previousScrollBehavior;
    }

    const timers = [0, 100, 350].map((delay) => window.setTimeout(scrollToCurrentHash, delay));
    window.addEventListener("hashchange", scrollToCurrentHash);
    return () => {
      timers.forEach((timer) => window.clearTimeout(timer));
      window.removeEventListener("hashchange", scrollToCurrentHash);
    };
  }, []);

  async function refreshRuntimeList() {
    setPending("runtime");
    setRuntimeError(null);
    try {
      const next = await fetchRuntimes(true);
      setRuntimes(next);
      if (!next.some((runtime) => runtime.id === selectedRuntimeId && runtime.available)) {
        setSelectedRuntimeId(next.find((runtime) => runtime.available)?.id ?? "local");
      }
    } catch (err) {
      setRuntimes(staticRuntimes);
      setSelectedRuntimeId("static");
      setRuntimeError("Static Cloudflare build: runtime refresh and execution API are disabled.");
    } finally {
      setPending(null);
    }
  }

  async function submit(kind: "run" | "check") {
    if (!runnerAvailable) {
      setResult(null);
      setError("This Cloudflare build publishes the site and downloads only. Web execution is disabled.");
      return;
    }
    setPending(kind);
    setError(null);
    setResult(null);
    try {
      const next = await execute(kind, source, trace, selectedRuntimeId, stdin);
      setResult(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setPending(null);
    }
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand">
          <div className="brand-mark">IMM</div>
          <div>
            <h1>Insane Marmot Matrix</h1>
            <p>行列・座標・盤面処理のための小さな実験言語</p>
          </div>
        </div>
        <nav className="topnav" aria-label="Site navigation">
          <a href="#install">Install</a>
          <a href="#docs">Docs</a>
          <a href="#vscode">VS Code</a>
        </nav>
        <HealthBadge health={health} />
      </header>

      <main className="workspace" id="runner">
        <section className="editor-pane" aria-label="IMM source editor">
          <div className="pane-toolbar">
            <div className="examples">
              {examples.map((example) => (
                <button
                  className="chip-button"
                  key={example.name}
                  type="button"
                  onClick={() => {
                    setSource(example.source);
                    setStdin(example.stdin ?? "");
                    setResult(null);
                    setError(null);
                  }}
                >
                  <WandSparkles size={15} />
                  {example.name}
                </button>
              ))}
            </div>
            <div className="runner-controls">
              <label className="runtime-field">
                <span>runtime</span>
                <select
                  value={selectedRuntimeId}
                  onChange={(event) => setSelectedRuntimeId(event.target.value)}
                  aria-label="Runtime version"
                >
                  {runtimes.map((runtime) => (
                    <option key={runtime.id} disabled={!runtime.available} value={runtime.id}>
                      {runtime.available ? runtime.label : `${runtime.label} unavailable`}
                    </option>
                  ))}
                </select>
              </label>
              <button
                className="icon-button"
                type="button"
                aria-label="Refresh runtime list"
                onClick={refreshRuntimeList}
                disabled={pending !== null}
              >
                {pending === "runtime" ? <Loader2 className="spin" size={16} /> : <RefreshCcw size={16} />}
              </button>
              <label className="trace-toggle">
                <input checked={trace} onChange={(event) => setTrace(event.target.checked)} type="checkbox" />
                trace
              </label>
            </div>
          </div>
          {runtimeError ? (
            <div className="inline-warning">
              <AlertTriangle size={16} />
              {runtimeError}
            </div>
          ) : null}
          <div className="editor-frame">
            <CodeMirror
              value={source}
              height="100%"
              extensions={extensions}
              basicSetup={{
                foldGutter: true,
                lineNumbers: true,
                highlightActiveLine: true,
                bracketMatching: true,
                closeBrackets: true
              }}
              onChange={setSource}
            />
          </div>
          <label className="stdin-panel">
            <span>stdin</span>
            <textarea
              aria-label="Standard input"
              onChange={(event) => setStdin(event.target.value)}
              placeholder="stdin"
              spellCheck={false}
              value={stdin}
            />
          </label>
          <div className="action-row">
            <button className="primary-button" disabled={pending !== null || !runnerAvailable} type="button" onClick={() => submit("run")}>
              {pending === "run" ? <Loader2 className="spin" size={18} /> : <Play size={18} />}
              Run
            </button>
            <button className="secondary-button" disabled={pending !== null || !runnerAvailable} type="button" onClick={() => submit("check")}>
              {pending === "check" ? <Loader2 className="spin" size={18} /> : <FileCheck2 size={18} />}
              Check
            </button>
          </div>
        </section>

        <section className="result-pane" aria-label="Execution result">
          <div className="result-header">
            <div>
              <span className="eyebrow">Web Runner</span>
              <h2>{result ? (result.ok ? "Completed" : "Stopped") : error ? "Request Error" : "Ready"}</h2>
            </div>
            {result ? <StatusBadge result={result} /> : null}
          </div>

          {error ? (
            <div className="message error-message">
              <AlertTriangle size={18} />
              {error}
            </div>
          ) : null}

          <RuntimeSummary runtime={selectedRuntime} />

          <div className="terminal-grid">
            <OutputPanel title="stdout" icon={<SquareTerminal size={17} />} value={result?.stdout ?? ""} />
            <OutputPanel title="stderr" icon={<Bug size={17} />} value={result?.stderr ?? ""} />
          </div>

          <SandboxPanel result={result} health={health} />
        </section>
      </main>

      <SiteSections
        downloads={downloads ?? staticDownloads}
        releaseRuntimes={releaseRuntimes}
        vscodeExtension={vscodeExtension ?? staticVscodeExtension}
      />
    </div>
  );
}

function HealthBadge({ health }: { health: ApiHealth | null }) {
  if (!health) {
    return (
      <div className="health pending">
        <Loader2 className="spin" size={16} />
        Engine
      </div>
    );
  }
  if (!health.ok) {
    return (
      <div className="health bad">
        <AlertTriangle size={16} />
        Engine unavailable
      </div>
    );
  }
  return (
    <div className="health good">
      <ShieldCheck size={16} />
      {health.engine?.version ?? "IMM ready"}
    </div>
  );
}

function RuntimeSummary({ runtime }: { runtime: RuntimeOption | undefined }) {
  return (
    <div className="runtime-summary">
      <GitBranch size={17} />
      <div>
        <span>Selected runtime</span>
        <strong>{runtime ? `${runtime.label} · ${runtime.version}` : "Loading runtime list"}</strong>
      </div>
    </div>
  );
}

function StatusBadge({ result }: { result: ApiExecutionResult }) {
  const label = result.timedOut ? "Timeout" : result.outputTruncated ? "Output capped" : result.ok ? "OK" : "Error";
  return (
    <div className={`status-badge ${result.ok ? "good" : "bad"}`}>
      {result.ok ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
      {label}
    </div>
  );
}

function OutputPanel({ title, icon, value }: { title: string; icon: ReactNode; value: string }) {
  return (
    <div className="output-panel">
      <div className="output-title">
        {icon}
        {title}
      </div>
      <pre>{value || "No output"}</pre>
    </div>
  );
}

function SandboxPanel({ result, health }: { result: ApiExecutionResult | null; health: ApiHealth | null }) {
  const sandbox = result?.sandbox;
  return (
    <div className="sandbox-panel">
      <div className="sandbox-heading">
        <ShieldCheck size={18} />
        Sandbox
      </div>
      <div className="sandbox-grid">
        <Metric label="Engine" value={health?.engine?.binary ? "resolved" : health?.ok ? "ready" : "checking"} />
        <Metric label="Boundary" value={sandbox?.kind ?? "pending"} />
        <Metric label="Network" value={sandbox?.networkDeniedByOs ? "denied by OS" : "process only"} />
        <Metric label="Timeout" value={sandbox ? `${sandbox.timeoutMs} ms` : "3000 ms"} />
        <Metric label="Duration" value={result ? `${result.durationMs} ms` : "-"} icon={<TimerReset size={15} />} />
        <Metric label="Exit" value={result ? String(result.exitCode ?? result.signal ?? "-") : "-"} />
      </div>
    </div>
  );
}

function Metric({ label, value, icon }: { label: string; value: string; icon?: ReactNode }) {
  return (
    <div className="metric">
      <span>{label}</span>
      <strong>
        {icon}
        {value}
      </strong>
    </div>
  );
}

function SiteSections({
  downloads,
  releaseRuntimes,
  vscodeExtension
}: {
  downloads: DownloadsInfo | null;
  releaseRuntimes: RuntimeOption[];
  vscodeExtension: VscodeExtensionInfo | null;
}) {
  const vscodeDownloadHref = vscodeExtension?.downloadUrl ?? vscodeExtension?.directUrl;

  return (
    <section className="site-sections">
      <div className="section-band intro-band">
        <div className="section-copy">
          <span className="eyebrow">Language</span>
          <h2>盤面処理を短く、実行は安全に。</h2>
          <p>
            IMM は matrix、point、path、howl task、web fetch を持つ小さな言語です。
            このサイトはドキュメント、インストーラ、VS Code 拡張、Web 実行環境をまとめる入口です。
          </p>
        </div>
        <div className="feature-list">
          <Feature icon={<Code2 size={18} />} title="Matrix-first" text="field[y, x]、@point、neighbors4 で盤面処理を素直に書けます。" />
          <Feature icon={<ShieldCheck size={18} />} title="Sandboxed runner" text="Web 実行は一時領域、タイムアウト、OS sandbox を通します。" />
          <Feature icon={<Workflow size={18} />} title="Release lanes" text="Runtime、installers、VS Code 拡張を分離してリリースします。" />
        </div>
      </div>

      <div className="section-band" id="install">
        <SectionHeader
          icon={<Download size={20} />}
          title="Install"
          text={
            downloads?.release
              ? `Latest installer release: ${downloads.release.name}`
              : "CLI のインストールコマンドと直接ダウンロードをここに表示します。"
          }
        />
        {downloads?.error ? <InlineError text={downloads.error} /> : null}
        <div className="download-grid">
          {(downloads?.installers ?? []).map((download) => (
            <DownloadCard download={download} key={`${download.platform}-${download.assetName ?? "command"}`} />
          ))}
        </div>
      </div>

      <LanguageDocs />

      <div className="section-band" id="vscode">
        <SectionHeader icon={<Package size={20} />} title="VS Code Extension" text="VSIX を直接ダウンロードし、コマンドでインストールできます。" />
        <div className="release-layout">
          <div className="ops-panel">
            <strong>{vscodeExtension?.ok ? `imm-vscode ${vscodeExtension.version ?? ""}` : "VSIX package"}</strong>
            <p>
              .imm のシンタックスハイライト、スニペット、保存時 check、run / format / law コマンドを提供します。
            </p>
            {vscodeExtension?.ok && vscodeDownloadHref ? (
              <a className="download-button" href={vscodeDownloadHref} download>
                <Download size={16} />
                Download {vscodeExtension.fileName}
              </a>
            ) : (
              <InlineError text={vscodeExtension?.error ?? "VSIX package is loading."} />
            )}
            {vscodeExtension?.installCommand ? <pre className="command-block">{vscodeExtension.installCommand}</pre> : null}
          </div>
          <div className="ops-panel">
            <strong>Release workflow</strong>
            <p>
              統合リポジトリの release workflow で npm test、VSIX packaging、artifact upload、tag release を行います。
              Marketplace 公開は publisher token と公開ライセンスを整えた後に有効化します。
            </p>
            <pre className="command-block">npm test{`\n`}npm run package:vsix{`\n`}git tag vX.Y.Z</pre>
          </div>
        </div>
      </div>

      <div className="section-band">
        <SectionHeader icon={<Globe2 size={20} />} title="Runtime Releases" text="Web Runner が選択実行できるランタイムの直接 asset です。" />
        <div className="release-list">
          {releaseRuntimes.length ? (
            releaseRuntimes.slice(0, 6).map((runtime) => (
              <a
                className={`release-row ${runtime.available ? "" : "disabled"}`}
                href={runtime.assetUrl || "#"}
                key={runtime.id}
                rel="noreferrer"
                target="_blank"
              >
                <strong>{runtime.label}</strong>
                <span>{runtime.assetName || runtime.notes || "No asset"}</span>
                <small>{runtime.publishedAt ? new Date(runtime.publishedAt).toLocaleString() : runtime.version}</small>
              </a>
            ))
          ) : (
            <p className="muted">Release list is loading from GitHub.</p>
          )}
        </div>
      </div>

      <div className="section-band">
        <SectionHeader icon={<GitBranch size={20} />} title="Version Lanes" text="リンク集ではなく、運用上の責務を直接表示します。" />
        <div className="repo-grid">
          {repositoryRoles.map((repo) => (
            <div className="repo-link" key={repo.title}>
              <strong>{repo.title}</strong>
              <span>{repo.text}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

const coverageLabels: Record<LanguageDocCoverage, string> = {
  browser: "Browser + Native",
  native: "Native/API",
  partial: "Partial"
};

function LanguageDocs() {
  const [query, setQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const normalizedQuery = query.trim().toLowerCase();

  const categoryCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const section of languageDocs) {
      counts.set(section.category, (counts.get(section.category) ?? 0) + 1);
    }
    return counts;
  }, []);

  const visibleDocs = useMemo(() => {
    return languageDocs.filter((section) => {
      if (selectedCategory !== "All" && section.category !== selectedCategory) {
        return false;
      }
      if (!normalizedQuery) {
        return true;
      }
      return searchableDocText(section).includes(normalizedQuery);
    });
  }, [normalizedQuery, selectedCategory]);

  return (
    <div className="section-band docs-band" id="docs">
      <SectionHeader
        icon={<BookOpen size={20} />}
        title="Language Docs"
        text="現行の IMM 言語仕様、標準ライブラリ、実行ターゲットの差分をこのページ内で引けるようにまとめています。"
      />

      <div className="docs-controls">
        <label className="docs-search">
          <Search size={17} />
          <input
            aria-label="Search language documentation"
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search syntax, library, runtime..."
            type="search"
            value={query}
          />
        </label>
        <div className="docs-filter-row" aria-label="Documentation categories">
          {languageDocCategories.map((category) => {
            const count = category === "All" ? languageDocs.length : categoryCounts.get(category) ?? 0;
            return (
              <button
                className={`filter-button ${selectedCategory === category ? "active" : ""}`}
                key={category}
                onClick={() => setSelectedCategory(category)}
                type="button"
              >
                {category}
                <span>{count}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="docs-result-row">
        <strong>{visibleDocs.length}</strong>
        <span>of {languageDocs.length} sections</span>
      </div>

      <div className="language-doc-layout">
        <aside className="language-doc-sidebar" aria-label="Language documentation contents">
          <div className="sidebar-title">
            <ListTree size={16} />
            Contents
          </div>
          {visibleDocs.length ? (
            <nav className="language-doc-nav">
              {visibleDocs.map((section) => (
                <a href={`#${section.id}`} key={section.id}>
                  <span>{section.title}</span>
                  <small>{section.category}</small>
                </a>
              ))}
            </nav>
          ) : (
            <p className="doc-empty">No matching sections.</p>
          )}
        </aside>

        <div className="language-doc-list">
          {visibleDocs.map((section) => (
            <LanguageDocCard key={section.id} section={section} />
          ))}
        </div>
      </div>
    </div>
  );
}

function searchableDocText(section: LanguageDocSection) {
  return [
    section.title,
    section.summary,
    section.category,
    section.coverageNote,
    ...section.keywords,
    ...section.bullets,
    ...(section.syntax ?? []),
    section.code ?? ""
  ]
    .join(" ")
    .toLowerCase();
}

function LanguageDocCard({ section }: { section: LanguageDocSection }) {
  return (
    <article className="language-doc-card" id={section.id}>
      <div className="language-doc-meta">
        <span>{section.category}</span>
        <span className={`coverage-pill coverage-${section.coverage}`}>{coverageLabels[section.coverage]}</span>
      </div>
      <div className="language-doc-heading">
        <h3>{section.title}</h3>
        <p>{section.summary}</p>
      </div>
      <p className="coverage-note">{section.coverageNote}</p>
      {section.syntax?.length ? (
        <div className="syntax-strip" aria-label={`${section.title} syntax`}>
          {section.syntax.map((syntax) => (
            <code key={syntax}>{syntax}</code>
          ))}
        </div>
      ) : null}
      <ul className="doc-bullets">
        {section.bullets.map((bullet) => (
          <li key={bullet}>
            <TextWithCode text={bullet} />
          </li>
        ))}
      </ul>
      {section.code ? (
        <pre className="doc-code">
          <code>{section.code}</code>
        </pre>
      ) : null}
    </article>
  );
}

function TextWithCode({ text }: { text: string }) {
  return (
    <>
      {text.split(/(`[^`]+`)/g).map((part, index) => {
        if (part.startsWith("`") && part.endsWith("`")) {
          return <code key={`${part}-${index}`}>{part.slice(1, -1)}</code>;
        }
        return <span key={`${part}-${index}`}>{part}</span>;
      })}
    </>
  );
}

function DownloadCard({ download }: { download: InstallerDownload }) {
  return (
    <article className="download-card">
      <span>{download.label}</span>
      <strong>{download.platform}</strong>
      <pre>{download.command}</pre>
      <div className="download-actions">
        {download.directUrl ? (
          <a className="download-button" href={download.directUrl}>
            <Download size={16} />
            Direct download
          </a>
        ) : null}
        {download.assetName ? <small>{download.assetName}</small> : null}
      </div>
    </article>
  );
}

function InlineError({ text }: { text: string }) {
  return (
    <div className="inline-warning standalone">
      <AlertTriangle size={16} />
      {text}
    </div>
  );
}

function SectionHeader({ icon, title, text }: { icon: ReactNode; title: string; text: string }) {
  return (
    <div className="section-header">
      <div className="section-icon">{icon}</div>
      <div>
        <h2>{title}</h2>
        <p>{text}</p>
      </div>
    </div>
  );
}

function Feature({ icon, title, text }: { icon: ReactNode; title: string; text: string }) {
  return (
    <div className="feature-item">
      {icon}
      <div>
        <strong>{title}</strong>
        <span>{text}</span>
      </div>
    </div>
  );
}

export default App;
