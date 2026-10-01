import { useMemo, useRef, useState } from "react";
import { Play, Search, ArrowRight, ArrowLeft, SquareTerminal, BookOpen, FileCode2 } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { runConsoleRequest } from "../api";
import Breadcrumb from "../components/Breadcrumb";
import { API_REFERENCE, COMPONENT_TYPES_DOC } from "../lib/apiReference";

const METHOD_STYLE = {
  GET: "bg-sky-50 text-sky-700 ring-sky-600/10",
  POST: "bg-emerald-50 text-emerald-700 ring-emerald-600/10",
  PATCH: "bg-amber-50 text-amber-700 ring-amber-600/10",
  DELETE: "bg-red-50 text-red-700 ring-red-600/10",
};

const AUTH_STYLE = {
  public: { label: "Public", className: "bg-slate-100 text-slate-500" },
  authenticated: { label: "Authentifié", className: "bg-slate-100 text-slate-600" },
  admin: { label: "Admin", className: "bg-violet-50 text-violet-700" },
};

function MethodBadge({ method }) {
  return (
    <span className={`shrink-0 text-[11px] font-mono font-semibold px-1.5 py-0.5 rounded ring-1 ring-inset ${METHOD_STYLE[method] || "bg-slate-100 text-slate-600"}`}>
      {method}
    </span>
  );
}

function JsonBlock({ value }) {
  return (
    <pre className="bg-slate-900 text-slate-100 text-xs p-3 rounded-lg overflow-auto m-0">
      {value === null || value === undefined ? "(pas de corps)" : JSON.stringify(value, null, 2)}
    </pre>
  );
}

const METHOD_LINE = /^(GET|POST|PATCH|DELETE|PUT)\s+(\S+)\s*$/i;

// Exemples affichés en placeholder (grisés, non exécutables) : ils disparaissent
// dès que l'utilisateur tape quoi que ce soit dans l'éditeur.
const PLACEHOLDER_TEXT = `GET /me

GET /namespaces

POST /namespaces
{
  "name": "production",
  "components": [
    { "name": "web", "type": "nginx", "expose": true }
  ]
}
`;

const SHORTCUTS = [
  "GET /me",
  "GET /namespaces",
  "GET /namespaces/ns-exemple/pods",
  "GET /namespaces/ns-exemple/logs",
  "GET /namespaces/ns-exemple/metrics",
  "DELETE /namespaces/ns-exemple",
];

// parseBlocks découpe le texte en requêtes : chaque ligne "METHODE /chemin"
// démarre un nouveau bloc, les lignes suivantes jusqu'au prochain "METHODE
// /chemin" (ou la fin) forment son corps JSON optionnel.
function parseBlocks(text) {
  const lines = text.split("\n");
  const blocks = [];
  let current = null;

  lines.forEach((line, i) => {
    const m = line.match(METHOD_LINE);
    if (m) {
      if (current) blocks.push(current);
      current = { method: m[1].toUpperCase(), path: m[2], bodyLines: [], startLine: i, endLine: i };
    } else if (current) {
      current.bodyLines.push(line);
      if (line.trim() !== "") current.endLine = i;
    }
  });
  if (current) blocks.push(current);
  return blocks;
}

function lineAtIndex(text, index) {
  return text.slice(0, index).split("\n").length - 1;
}

function blockAtLine(blocks, line) {
  let candidate = null;
  for (const b of blocks) {
    if (b.startLine <= line) candidate = b;
    else break;
  }
  return candidate;
}

function statusColor(status) {
  if (status === 0) return "bg-slate-200 text-slate-600";
  if (status < 300) return "bg-green-100 text-green-700";
  if (status < 500) return "bg-amber-100 text-amber-700";
  return "bg-red-100 text-red-700";
}

export default function Console() {
  const { isAdmin } = useAuth();
  const [tab, setTab] = useState("essayer");
  const [text, setText] = useState("");
  const [activeBlock, setActiveBlock] = useState(null);
  const [result, setResult] = useState(null);
  const [running, setRunning] = useState(false);
  const [runError, setRunError] = useState("");
  const [docSearch, setDocSearch] = useState("");
  const [selectedDoc, setSelectedDoc] = useState(null);
  const textareaRef = useRef(null);
  const gutterRef = useRef(null);
  const resultRef = useRef(null);

  const shortcuts = isAdmin ? [...SHORTCUTS, "GET /admin/namespaces"] : SHORTCUTS;

  const reference = isAdmin ? API_REFERENCE : API_REFERENCE.filter((d) => d.auth !== "admin");

  const filteredDocs = useMemo(() => {
    const q = docSearch.trim().toLowerCase();
    if (!q) return reference;
    return reference.filter(
      (d) =>
        d.method.toLowerCase().includes(q) ||
        d.path.toLowerCase().includes(q) ||
        d.description.toLowerCase().includes(q) ||
        d.category.toLowerCase().includes(q)
    );
  }, [reference, docSearch]);

  const groupedDocs = useMemo(() => {
    const groups = [];
    for (const d of filteredDocs) {
      let g = groups.find((g) => g.category === d.category);
      if (!g) {
        g = { category: d.category, items: [] };
        groups.push(g);
      }
      g.items.push(d);
    }
    return groups;
  }, [filteredDocs]);

  function loadIntoConsole(doc) {
    if (!doc.examplePath) return;
    const bodyText = doc.body ? JSON.stringify(doc.body, null, 2) : "";
    const block = `${doc.method} ${doc.examplePath}${bodyText ? "\n" + bodyText : ""}\n`;
    setText(block);
    setActiveBlock(parseBlocks(block)[0] || null);
    setTab("essayer");
    requestAnimationFrame(() => {
      const el = textareaRef.current;
      el?.focus();
      el?.setSelectionRange(block.length, block.length);
    });
  }

  function updateActiveBlock() {
    const el = textareaRef.current;
    if (!el) return;
    const blocks = parseBlocks(text);
    const line = lineAtIndex(text, el.selectionStart);
    setActiveBlock(blockAtLine(blocks, line));
  }

  async function runActiveBlock() {
    const el = textareaRef.current;
    if (!el) return;
    const blocks = parseBlocks(text);
    const line = lineAtIndex(text, el.selectionStart);
    const block = blockAtLine(blocks, line);
    setActiveBlock(block);
    if (!block) return;

    setRunError("");
    const bodyText = block.bodyLines.join("\n").trim();
    let body;
    if (bodyText) {
      try {
        body = JSON.parse(bodyText);
      } catch {
        setRunError("Le corps de cette requête n'est pas un JSON valide");
        return;
      }
    }

    setRunning(true);
    const res = await runConsoleRequest(block.method, block.path, body);
    setResult({ ...res, method: block.method, path: block.path });
    setRunning(false);
    // Sur téléphone la réponse est empilée sous l'éditeur, hors écran : on y descend.
    if (window.matchMedia("(max-width: 1023px)").matches) {
      requestAnimationFrame(() => resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
    }
  }

  function handleKeyDown(e) {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      runActiveBlock();
    }
  }

  function insertShortcut(line) {
    const el = textareaRef.current;
    const sep = text === "" ? "" : text.endsWith("\n") ? "\n" : "\n\n";
    const addition = `${sep}${line}\n`;
    const next = text + addition;
    setText(next);
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(next.length, next.length);
    });
  }

  return (
    <div className="md:h-full flex flex-col space-y-6">
      <div>
        <Breadcrumb items={[{ label: "Environnements", to: "/" }, { label: "Console" }]} />
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 bg-slate-100 text-slate-700 ring-1 ring-slate-200">
              <SquareTerminal size={16} strokeWidth={2} />
            </div>
            <div className="min-w-0">
              <h1 className="text-xl font-semibold">Console API</h1>
              <p className="text-xs text-slate-500">
                {tab === "essayer"
                  ? "Écris et exécute des requêtes sur l'API de la plateforme"
                  : "Référence complète des endpoints : authentification, paramètres, corps et réponses"}
              </p>
            </div>
          </div>
          <div className="flex bg-slate-100 rounded-lg p-0.5">
            {[
              { id: "essayer", label: "Éditeur", icon: SquareTerminal, title: "Écrire et exécuter des requêtes" },
              { id: "docs", label: "Documentation", icon: BookOpen, title: "Référence de tous les endpoints de l'API" },
            ].map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                title={t.title}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-md transition ${
                  tab === t.id ? "bg-white shadow-sm text-slate-900" : "text-slate-500 hover:text-slate-700"
                }`}
              >
                <t.icon size={14} />
                {t.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {tab === "essayer" && (
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar -mx-4 px-4 sm:mx-0 sm:px-0 sm:flex-wrap">
          <span className="shrink-0 text-xs text-slate-500">Insérer :</span>
          {shortcuts.map((s) => (
            <button
              key={s}
              onClick={() => insertShortcut(s)}
              className="shrink-0 text-xs bg-white border border-slate-200 rounded-full px-3 py-1.5 hover:bg-slate-50 active:bg-slate-100 transition font-mono"
            >
              {s}
            </button>
          ))}
        </div>
      )}

      {tab === "essayer" && (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 flex-1 lg:min-h-[420px]">
        <div className="bg-slate-950 rounded-xl shadow ring-1 ring-slate-800 flex flex-col overflow-hidden min-h-[300px]">
          <div className="flex items-center justify-between gap-3 px-3 py-2 bg-slate-900 border-b border-slate-800">
            <div className="flex items-center gap-2 min-w-0">
              <span className="flex items-center gap-1.5 text-xs text-slate-300 bg-slate-950 rounded-md px-2.5 py-1 ring-1 ring-slate-800">
                <FileCode2 size={12} className="text-slate-400" />
                requetes.http
              </span>
              <span className="text-[11px] font-mono text-slate-500 truncate min-w-0">
                {activeBlock ? `${activeBlock.method} ${activeBlock.path}` : text ? "place le curseur dans une requête" : ""}
              </span>
            </div>
            <button
              onClick={runActiveBlock}
              disabled={running || !activeBlock}
              title="Exécuter la requête sous le curseur (Ctrl/Cmd + Entrée)"
              className="shrink-0 flex items-center gap-1.5 bg-emerald-500 text-slate-950 text-xs font-semibold px-3 py-2 sm:py-1.5 rounded-md hover:bg-emerald-400 transition disabled:opacity-30"
            >
              <Play size={12} fill="currentColor" />
              {running ? "..." : "Exécuter"}
            </button>
          </div>
          <div className="flex flex-1 min-h-0">
            {/* Numéros de ligne : défilent avec le textarea (onScroll), d'où le
                wrap="off" - une ligne repliée décalerait la numérotation. */}
            <div
              ref={gutterRef}
              aria-hidden="true"
              className="shrink-0 overflow-hidden select-none py-4 pl-3 pr-2 text-right font-mono text-sm leading-6 text-slate-600 border-r border-slate-800/80"
            >
              {(text || " ").split("\n").map((_, i) => (
                <div
                  key={i}
                  className={activeBlock && i >= activeBlock.startLine && i <= activeBlock.endLine ? "text-slate-300" : ""}
                >
                  {i + 1}
                </div>
              ))}
            </div>
            <textarea
              ref={textareaRef}
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={handleKeyDown}
              onKeyUp={updateActiveBlock}
              onClick={updateActiveBlock}
              onScroll={(e) => {
                if (gutterRef.current) gutterRef.current.scrollTop = e.target.scrollTop;
              }}
              placeholder={PLACEHOLDER_TEXT}
              wrap="off"
              spellCheck={false}
              autoFocus
              aria-label="Éditeur de requêtes"
              className="flex-1 min-w-0 w-full bg-transparent py-4 px-3 text-sm font-mono leading-6 text-slate-100 caret-emerald-400 placeholder:text-slate-600 placeholder:italic resize-none outline-none overflow-auto whitespace-pre selection:bg-slate-700"
            />
          </div>
          <div className="flex items-center justify-between gap-3 px-3 py-1.5 bg-slate-900 border-t border-slate-800 text-[11px] text-slate-500">
            <span className="truncate">« METHODE /chemin », puis le corps JSON sur les lignes suivantes</span>
            <span className="hidden md:inline shrink-0">
              <kbd className="font-sans bg-slate-800 text-slate-300 rounded px-1.5 py-0.5">Ctrl/Cmd + Entrée</kbd> pour exécuter
            </span>
          </div>
        </div>

        <div ref={resultRef} className="bg-slate-900 rounded-xl shadow ring-1 ring-slate-800 flex flex-col overflow-hidden min-h-[260px] max-h-[70dvh] lg:max-h-none scroll-mt-20">
          <div className="flex items-center gap-3 px-3 py-2 bg-slate-900 border-b border-slate-800 min-h-[41px]">
            {!result && <span className="text-xs text-slate-500">Réponse</span>}
            {result && (
              <>
                <span className={`text-xs font-mono font-medium px-2 py-0.5 rounded ${statusColor(result.status)}`}>
                  {result.status || "erreur réseau"}
                </span>
                <span className="text-xs text-slate-400 font-mono truncate min-w-0">
                  {result.method} {result.path}
                </span>
                <span className="shrink-0 text-xs text-slate-400 ml-auto">{result.durationMs} ms</span>
              </>
            )}
          </div>
          {runError && <p className="text-xs text-red-400 px-4 pt-3">{runError}</p>}
          <pre className="flex-1 bg-slate-950 text-slate-100 text-xs leading-5 p-4 overflow-auto m-0">
            {result ? (
              JSON.stringify(result.data, null, 2)
            ) : (
              <span className="text-slate-600 italic">La réponse de la requête exécutée s'affichera ici.</span>
            )}
          </pre>
        </div>
      </div>
      )}

      {tab === "docs" && (
        <div className="flex flex-col flex-1 md:min-h-[420px] gap-4">
          <div className="space-y-2">
            <div className="relative max-w-md">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                value={docSearch}
                onChange={(e) => setDocSearch(e.target.value)}
                placeholder="Rechercher un endpoint (méthode, chemin, description...)"
                className="w-full border border-slate-300 rounded-md pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400"
              />
            </div>
            <div className="flex flex-wrap gap-3 text-xs text-slate-500 bg-white border border-slate-200 rounded-lg px-3 py-2">
              <span className="font-medium text-slate-700">Authentification :</span>
              <span className="break-words"><code className="bg-slate-100 rounded px-1">Authorization: Bearer &lt;token&gt;</code> (via POST /auth/login, 7 jours)</span>
              <span className="text-slate-300">ou</span>
              <span className="break-words"><code className="bg-slate-100 rounded px-1">X-API-Key: &lt;clé&gt;</code> (n'expire jamais)</span>
            </div>
          </div>

          {/* Téléphone : maître/détail - la liste OU la doc de l'endpoint choisi,
              avec un bouton retour ; côte à côte à partir de md. */}
          <div className="grid grid-cols-1 md:grid-cols-[280px_1fr] gap-4 flex-1 min-h-0">
            <div className={`bg-white rounded-xl shadow overflow-y-auto ${selectedDoc ? "hidden md:block" : ""}`}>
              {groupedDocs.length === 0 && (
                <p className="text-sm text-slate-400 p-4">Aucun endpoint ne correspond à cette recherche.</p>
              )}
              {groupedDocs.map((g) => (
                <div key={g.category}>
                  <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400 px-3 pt-3 pb-1">
                    {g.category}
                  </p>
                  {g.items.map((d) => (
                    <button
                      key={`${d.method} ${d.path}`}
                      onClick={() => {
                        setSelectedDoc(d);
                        // Téléphone : la doc remplace la liste, on repart du haut.
                        window.scrollTo({ top: 0 });
                      }}
                      className={`w-full flex items-center gap-2 text-left px-3 py-3 md:py-2 text-xs transition active:bg-slate-100 ${
                        selectedDoc === d ? "bg-slate-100" : "hover:bg-slate-50"
                      }`}
                    >
                      <MethodBadge method={d.method} />
                      <span className="font-mono text-slate-600 truncate">{d.path}</span>
                    </button>
                  ))}
                </div>
              ))}
            </div>

            <div className={`bg-white rounded-xl shadow overflow-y-auto p-4 sm:p-5 ${selectedDoc ? "" : "hidden md:block"}`}>
              {!selectedDoc && (
                <div className="h-full flex flex-col items-center justify-center text-center text-sm text-slate-400 gap-1">
                  <p>Sélectionne un endpoint à gauche pour voir sa documentation.</p>
                  <p className="text-xs">{reference.length} endpoints disponibles.</p>
                </div>
              )}
              {selectedDoc && (
                <div className="space-y-4">
                  <button
                    onClick={() => setSelectedDoc(null)}
                    className="md:hidden flex items-center gap-1.5 text-sm text-slate-500 -mt-1"
                  >
                    <ArrowLeft size={14} />
                    Tous les endpoints
                  </button>
                  <div className="flex items-center gap-2 flex-wrap">
                    <MethodBadge method={selectedDoc.method} />
                    <code className="text-sm font-mono font-medium break-all">{selectedDoc.path}</code>
                    <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${AUTH_STYLE[selectedDoc.auth].className}`}>
                      {AUTH_STYLE[selectedDoc.auth].label}
                    </span>
                  </div>

                  <p className="text-sm text-slate-600">{selectedDoc.description}</p>

                  {selectedDoc.pathParams && (
                    <div>
                      <p className="text-xs font-semibold text-slate-700 mb-1.5">Paramètres de chemin</p>
                      <div className="space-y-1">
                        {selectedDoc.pathParams.map((p) => (
                          <p key={p.name} className="text-xs text-slate-500">
                            <code className="bg-slate-100 rounded px-1 text-slate-700">{p.name}</code> — {p.description}
                          </p>
                        ))}
                      </div>
                    </div>
                  )}

                  {selectedDoc.queryParams && (
                    <div>
                      <p className="text-xs font-semibold text-slate-700 mb-1.5">Paramètres de requête</p>
                      <div className="space-y-1">
                        {selectedDoc.queryParams.map((p) => (
                          <p key={p.name} className="text-xs text-slate-500">
                            <code className="bg-slate-100 rounded px-1 text-slate-700">{p.name}</code>
                            {p.required ? " (requis)" : " (optionnel)"} — {p.description}
                            {p.default && <span className="text-slate-400"> · défaut : {p.default}</span>}
                          </p>
                        ))}
                      </div>
                    </div>
                  )}

                  {"body" in selectedDoc && (
                    <div>
                      <p className="text-xs font-semibold text-slate-700 mb-1.5">Corps de la requête</p>
                      <JsonBlock value={selectedDoc.body} />
                      {selectedDoc.bodyNotes && (
                        <ul className="mt-1.5 space-y-0.5">
                          {selectedDoc.bodyNotes.map((n) => (
                            <li key={n} className="text-xs text-slate-500">· {n}</li>
                          ))}
                        </ul>
                      )}
                      {selectedDoc.path === "/namespaces" && selectedDoc.method === "POST" && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {COMPONENT_TYPES_DOC.map((t) => (
                            <span key={t} className="text-[11px] font-mono bg-slate-100 text-slate-600 rounded px-1.5 py-0.5">
                              {t}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  <div>
                    <p className="text-xs font-semibold text-slate-700 mb-1.5">Réponse</p>
                    <JsonBlock value={selectedDoc.response} />
                    {selectedDoc.responseNotes && (
                      <ul className="mt-1.5 space-y-0.5">
                        {selectedDoc.responseNotes.map((n) => (
                          <li key={n} className="text-xs text-slate-500">· {n}</li>
                        ))}
                      </ul>
                    )}
                  </div>

                  {selectedDoc.examplePath ? (
                    <button
                      onClick={() => loadIntoConsole(selectedDoc)}
                      className="flex items-center gap-1.5 bg-slate-900 text-white text-xs font-medium px-3 py-1.5 rounded-md hover:bg-slate-800 transition"
                    >
                      Charger dans la console
                      <ArrowRight size={12} />
                    </button>
                  ) : (
                    <p className="text-xs text-slate-400">Non exécutable depuis la console.</p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
