import { useEffect, useRef, useState } from "react";
import { Terminal as XTerm } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { Maximize2, Minimize2 } from "lucide-react";
import "@xterm/xterm/css/xterm.css";
import { createShellTicket, getShellSocketURL } from "../api";

function sendResize(term, ws) {
  if (ws.readyState !== WebSocket.OPEN) return;
  const bytes = new TextEncoder().encode(JSON.stringify({ cols: term.cols, rows: term.rows }));
  const msg = new Uint8Array(bytes.length + 1);
  msg[0] = 0x31; // '1'
  msg.set(bytes, 1);
  ws.send(msg);
}

export default function Shell({ namespace, pod }) {
  const containerRef = useRef(null);
  const sessionRef = useRef(null);
  const [status, setStatus] = useState("disconnected");
  const [fullscreen, setFullscreen] = useState(false);

  function teardown() {
    sessionRef.current?.resizeObserver?.disconnect();
    sessionRef.current?.ws?.close();
    sessionRef.current?.term?.dispose();
    sessionRef.current = null;
  }

  async function connect() {
    teardown();
    setStatus("connecting");

    const term = new XTerm({ cursorBlink: true, fontSize: 13, convertEol: true });
    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.open(containerRef.current);
    fitAddon.fit();
    term.focus();

    let ticket;
    try {
      ticket = await createShellTicket(namespace, pod);
    } catch (err) {
      term.writeln(`\r\nErreur : ${err.response?.data?.error || "impossible d'obtenir un ticket"}`);
      setStatus("error");
      sessionRef.current = { term };
      return;
    }

    const ws = new WebSocket(getShellSocketURL(namespace, pod, ticket));
    ws.binaryType = "arraybuffer";

    ws.onopen = () => {
      setStatus("connected");
      sendResize(term, ws);
      term.focus();
    };
    ws.onmessage = (event) => term.write(new Uint8Array(event.data));
    ws.onclose = () => setStatus("disconnected");
    ws.onerror = () => setStatus("error");

    term.onData((data) => {
      if (ws.readyState !== WebSocket.OPEN) return;
      const bytes = new TextEncoder().encode(data);
      const msg = new Uint8Array(bytes.length + 1);
      msg[0] = 0x30; // '0'
      msg.set(bytes, 1);
      ws.send(msg);
    });

    const resizeObserver = new ResizeObserver(() => {
      fitAddon.fit();
      sendResize(term, ws);
    });
    resizeObserver.observe(containerRef.current);

    sessionRef.current = { term, ws, resizeObserver };
  }

  useEffect(() => {
    connect();
    return () => teardown();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [namespace, pod]);

  // Pas de raccourci Échap pour quitter : xterm capture cette touche pour la
  // transmettre au pty (essentiel pour vim, entre autres) et ne la laisse
  // jamais remonter jusqu'ici - seul le bouton "Réduire" quitte le plein écran.

  // Le ResizeObserver déjà branché sur le conteneur (voir connect()) refait le
  // fit + prévient le pty du nouveau nombre de colonnes/lignes automatiquement
  // dès que le layout change - il suffit de laisser le focus suivre.
  useEffect(() => {
    requestAnimationFrame(() => sessionRef.current?.term?.focus());
  }, [fullscreen]);

  const canConnect = status === "disconnected" || status === "error";
  const statusLabel = {
    connected: "connecté",
    connecting: "connexion...",
    disconnected: "déconnecté",
    error: "erreur",
  }[status];

  return (
    <div
      className={
        fullscreen
          ? "fixed inset-0 z-50 bg-slate-950 p-4 flex flex-col"
          : ""
      }
    >
      <div className="flex items-center justify-between mb-2">
        <span className={`text-xs ${fullscreen ? "text-slate-400" : "text-slate-500"}`}>
          {statusLabel}
        </span>
        <div className="flex items-center gap-2">
          {canConnect ? (
            <button onClick={connect} className="text-xs bg-slate-900 text-white px-3 py-1 rounded-md">
              Reconnecter
            </button>
          ) : (
            <button onClick={teardown} className="text-xs text-red-600 border border-red-200 px-3 py-1 rounded-md">
              Déconnecter
            </button>
          )}
          <button
            onClick={() => setFullscreen((f) => !f)}
            title={fullscreen ? "Quitter le plein écran" : "Plein écran"}
            className={`flex items-center gap-1.5 text-xs px-3 py-1 rounded-md border transition ${
              fullscreen
                ? "border-slate-700 text-slate-300 hover:bg-slate-800"
                : "border-slate-300 text-slate-600 hover:bg-slate-50"
            }`}
          >
            {fullscreen ? <Minimize2 size={12} /> : <Maximize2 size={12} />}
            {fullscreen ? "Réduire" : "Plein écran"}
          </button>
        </div>
      </div>
      <div
        ref={containerRef}
        onClick={() => sessionRef.current?.term?.focus()}
        className={`bg-black rounded-md p-2 ${fullscreen ? "flex-1" : ""}`}
        style={fullscreen ? undefined : { height: "420px" }}
      />
    </div>
  );
}
