import { useRef, useState } from "react";
import { Play } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { runConsoleRequest } from "../api";
import Breadcrumb from "../components/Breadcrumb";

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
  const [text, setText] = useState(DEFAULT_TEXT);
  const [activeBlock, setActiveBlock] = useState(null);
  const [result, setResult] = useState(null);
  const [running, setRunning] = useState(false);
  const [runError, setRunError] = useState("");
  const textareaRef = useRef(null);

  const shortcuts = isAdmin ? [...SHORTCUTS, "GET /admin/namespaces"] : SHORTCUTS;

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
    <div className="space-y-6">
      <div>
        <Breadcrumb items={[{ label: "Environnements", to: "/" }, { label: "Console" }]} />
        <h1 className="text-xl font-semibold">Console API</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Écris une ou plusieurs requêtes ("METHODE /chemin", corps JSON sur les lignes
          suivantes). Place le curseur dans une requête et lance-la avec{" "}
          <kbd className="text-xs bg-slate-100 border border-slate-300 rounded px-1">
            Ctrl/Cmd + Entrée
          </kbd>{" "}
          ou le bouton Exécuter.
        </p>
      </div>

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

      <div className="grid grid-cols-2 gap-4" style={{ height: "480px" }}>
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
    </div>
  );
}
