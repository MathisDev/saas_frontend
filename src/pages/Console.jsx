import { useMemo, useRef, useState } from "react";
import { Play, Search, ArrowRight } from "lucide-react";
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

const DEFAULT_TEXT = `GET /me

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
  const [text, setText] = useState(DEFAULT_TEXT);
  const [activeBlock, setActiveBlock] = useState(null);
  const [result, setResult] = useState(null);
  const [running, setRunning] = useState(false);
  const [runError, setRunError] = useState("");
  const [docSearch, setDocSearch] = useState("");
  const [selectedDoc, setSelectedDoc] = useState(null);
  const textareaRef = useRef(null);

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
  }

  function handleKeyDown(e) {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      runActiveBlock();
    }
  }

  function insertShortcut(line) {
    const el = textareaRef.current;
    const sep = text.endsWith("\n") || text === "" ? "" : "\n";
    const addition = `${sep}\n${line}\n`;
    const next = text + addition;
    setText(next);
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(next.length, next.length);
    });
  }

  return (
    <div className="h-full flex flex-col space-y-6">
      <div>
        <Breadcrumb items={[{ label: "Environnements", to: "/" }, { label: "Console" }]} />
        <h1 className="text-xl font-semibold">Console API</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          {tab === "essayer" ? (
            <>
              Écris une ou plusieurs requêtes ("METHODE /chemin", corps JSON sur les lignes
              suivantes). Place le curseur dans une requête et lance-la avec{" "}
              <kbd className="text-xs bg-slate-100 border border-slate-300 rounded px-1">
                Ctrl/Cmd + Entrée
              </kbd>{" "}
              ou le bouton Exécuter.
            </>
          ) : (
            "Référence complète des endpoints de l'API : authentification, paramètres, corps de requête et de réponse."
          )}
        </p>
      </div>

      <div className="flex gap-1 border-b border-slate-200 -mt-2">
        {[
          { id: "essayer", label: "Essayer" },
          { id: "docs", label: "Documentation" },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-3 py-2 text-sm font-medium border-b-2 -mb-px transition ${
              tab === t.id
                ? "border-slate-900 text-slate-900"
                : "border-transparent text-slate-500 hover:text-slate-700"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "essayer" && (
        <div className="flex gap-2 flex-wrap">
          {shortcuts.map((s) => (
            <button
              key={s}
              onClick={() => insertShortcut(s)}
              className="text-xs bg-white border border-slate-200 rounded-full px-3 py-1.5 hover:bg-slate-50 transition font-mono"
            >
              {s}
            </button>
          ))}
        </div>
      )}

      {tab === "essayer" && (
      <div className="grid grid-cols-2 gap-4 flex-1 min-h-[420px]">
        <div className="bg-white rounded-xl shadow flex flex-col overflow-hidden">
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-100">
            <span className="text-xs font-mono text-slate-500">
              {activeBlock ? `${activeBlock.method} ${activeBlock.path}` : "place le curseur dans une requête"}
            </span>
            <button
              onClick={runActiveBlock}
              disabled={running || !activeBlock}
              className="flex items-center gap-1.5 bg-slate-900 text-white text-xs font-medium px-3 py-1.5 rounded-md hover:bg-slate-800 transition disabled:opacity-40"
            >
              <Play size={12} />
              {running ? "..." : "Exécuter"}
            </button>
          </div>
          <textarea
            ref={textareaRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            onKeyUp={updateActiveBlock}
            onClick={updateActiveBlock}
            spellCheck={false}
            className="flex-1 w-full p-4 text-sm font-mono resize-none outline-none leading-relaxed"
          />
        </div>

        <div className="bg-white rounded-xl shadow flex flex-col overflow-hidden">
          <div className="flex items-center gap-3 px-4 py-2.5 border-b border-slate-100 min-h-[41px]">
            {result && (
              <>
                <span className={`text-xs font-mono font-medium px-2 py-0.5 rounded ${statusColor(result.status)}`}>
                  {result.status || "erreur réseau"}
                </span>
                <span className="text-xs text-slate-400 font-mono">
                  {result.method} {result.path}
                </span>
                <span className="text-xs text-slate-400 ml-auto">{result.durationMs} ms</span>
              </>
            )}
          </div>
          {runError && <p className="text-xs text-red-600 px-4 pt-2">{runError}</p>}
          <pre className="flex-1 bg-slate-900 text-slate-100 text-xs p-4 overflow-auto m-0">
            {result ? JSON.stringify(result.data, null, 2) : ""}
          </pre>
        </div>
      </div>
      )}

      {tab === "docs" && (
        <div className="flex flex-col flex-1 min-h-[420px] gap-4">
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
              <span><code className="bg-slate-100 rounded px-1">Authorization: Bearer &lt;token&gt;</code> (via POST /auth/login, 7 jours)</span>
              <span className="text-slate-300">ou</span>
              <span><code className="bg-slate-100 rounded px-1">X-API-Key: &lt;clé&gt;</code> (n'expire jamais)</span>
            </div>
          </div>

          <div className="grid grid-cols-[280px_1fr] gap-4 flex-1 min-h-0">
            <div className="bg-white rounded-xl shadow overflow-y-auto">
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
                      onClick={() => setSelectedDoc(d)}
                      className={`w-full flex items-center gap-2 text-left px-3 py-2 text-xs transition ${
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

            <div className="bg-white rounded-xl shadow overflow-y-auto p-5">
              {!selectedDoc && (
                <div className="h-full flex flex-col items-center justify-center text-center text-sm text-slate-400 gap-1">
                  <p>Sélectionne un endpoint à gauche pour voir sa documentation.</p>
                  <p className="text-xs">{reference.length} endpoints disponibles.</p>
                </div>
              )}
              {selectedDoc && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 flex-wrap">
                    <MethodBadge method={selectedDoc.method} />
                    <code className="text-sm font-mono font-medium">{selectedDoc.path}</code>
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
