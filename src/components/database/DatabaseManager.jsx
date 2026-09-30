import { useCallback, useEffect, useRef, useState } from "react";
import { Archive, Database, KeyRound, RefreshCw, Table2, TerminalSquare } from "lucide-react";
import { openDatabaseSession, closeDatabaseSession } from "../../api";
import { dbError } from "../../lib/dbErrors";
import DbErrorBox from "./DbErrorBox";
import TableBrowser from "./TableBrowser";
import SqlEditor from "./SqlEditor";
import BackupPanel from "./BackupPanel";

// DatabaseManager est le contenu de la page "Base de données" d'un composant postgres
// (voir DatabasePage) : navigateur de tables et éditeur SQL, puis les sauvegardes
// dans une section à part. Les sauvegardes ne passent pas par la session (elles
// tournent dans le pod de la base) : leur section reste utilisable même si la
// connexion échoue. Les connexions sont
// tenues par l'API dans une session, rouverte d'elle-même si elle expire. Sans
// identifiants, l'API utilise le mot de passe de la base ; s'il est refusé, un
// formulaire les demande - ils ne vivent alors qu'en mémoire, le temps de la page.
export default function DatabaseManager({ namespace, component }) {
  const [session, setSession] = useState(null);
  const [status, setStatus] = useState("connecting"); // connecting | ready | login | error
  const [error, setError] = useState(null);
  const [switchError, setSwitchError] = useState(null);
  const [mode, setMode] = useState("tables");
  const [login, setLogin] = useState({ user: "", password: "" });
  const [loggingIn, setLoggingIn] = useState(false);
  // dataVersion remonte le navigateur et l'éditeur après une restauration.
  const [dataVersion, setDataVersion] = useState(0);

  const sessionRef = useRef(null);
  const credsRef = useRef(null);
  const reopening = useRef(null);
  // mounted : une session qui finit de s'ouvrir après le démontage est refermée
  // aussitôt plutôt que d'attendre son expiration côté API.
  const mounted = useRef(false);

  // open ouvre une session (database vide : celle du composant) et ferme la
  // précédente. Renvoie la session, ou null en cas d'échec (status mis à jour).
  const open = useCallback(
    async (database) => {
      try {
        const s = await openDatabaseSession(namespace, component, { database, ...(credsRef.current || {}) });
        if (!mounted.current) {
          closeDatabaseSession(namespace, component, s.sessionId).catch(() => {});
          return null;
        }
        const previous = sessionRef.current;
        sessionRef.current = s;
        setSession(s);
        setStatus("ready");
        setError(null);
        if (previous && previous.sessionId !== s.sessionId) {
          closeDatabaseSession(namespace, component, previous.sessionId).catch(() => {});
        }
        return s;
      } catch (err) {
        const e = dbError(err);
        setError(e);
        if (e.code === "db_auth_failed" || e.code === "db_credentials_required") {
          setLogin((l) => ({ user: l.user || credsRef.current?.user || "postgres", password: "" }));
          setStatus("login");
        } else {
          setStatus("error");
        }
        return null;
      }
    },
    [namespace, component]
  );

  useEffect(() => {
    mounted.current = true;
    sessionRef.current = null;
    credsRef.current = null;
    setSession(null);
    setStatus("connecting");
    open();
    return () => {
      mounted.current = false;
      const s = sessionRef.current;
      sessionRef.current = null;
      if (s) closeDatabaseSession(namespace, component, s.sessionId).catch(() => {});
    };
  }, [namespace, component, open]);

  // reopen rouvre la session expirée une seule fois, même si plusieurs requêtes
  // la découvrent expirée en même temps.
  function reopen() {
    if (!reopening.current) {
      reopening.current = open(sessionRef.current?.database).finally(() => {
        reopening.current = null;
      });
    }
    return reopening.current;
  }

  // run exécute fn(sessionId). Une session expirée est rouverte puis fn rejouée -
  // sauf retry: false (éditeur avec une transaction ouverte, perdue avec la session).
  const run = useCallback(async (fn, { retry = true } = {}) => {
    const current = sessionRef.current;
    if (!current) throw new Error("no session");
    try {
      return await fn(current.sessionId);
    } catch (err) {
      if (!retry || dbError(err).code !== "session_expired") throw err;
      const s = await reopen();
      if (!s) throw err;
      return fn(s.sessionId);
    }
  }, []);

  async function switchDatabase(database) {
    setSwitchError(null);
    const previous = sessionRef.current;
    try {
      const s = await openDatabaseSession(namespace, component, { database, ...(credsRef.current || {}) });
      sessionRef.current = s;
      setSession(s);
      if (previous) closeDatabaseSession(namespace, component, previous.sessionId).catch(() => {});
    } catch (err) {
      setSwitchError(dbError(err));
    }
  }

  // Après une restauration, l'API a fermé les sessions de la base : on en rouvre une
  // et on repart de vues vierges.
  const onRestored = useCallback(() => {
    setDataVersion((v) => v + 1);
    if (sessionRef.current) open(sessionRef.current.database);
  }, [open]);

  async function submitLogin(e) {
    e.preventDefault();
    setLoggingIn(true);
    credsRef.current = { user: login.user.trim(), password: login.password };
    await open(sessionRef.current?.database);
    setLoggingIn(false);
  }

  const modes = [
    ["tables", "Tables", Table2, "Parcourir et modifier les lignes des tables"],
    ["sql", "Éditeur SQL", TerminalSquare, "Exécuter des requêtes SQL libres"],
  ];
  const modeSwitch = (
    <div className="flex bg-slate-100 rounded-lg p-0.5">
      {modes.map(([value, label, Icon, hint]) => (
        <button
          key={value}
          title={hint}
          onClick={() => setMode(value)}
          className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1 rounded-md transition ${
            mode === value ? "bg-white shadow-sm text-slate-900" : "text-slate-500 hover:text-slate-700"
          }`}
        >
          <Icon size={12} />
          {label}
        </button>
      ))}
    </div>
  );

  return (
    <div className="space-y-6">
      <section className="bg-white rounded-xl shadow p-4 sm:p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2 min-w-0">
            <h2 className="flex items-center gap-2 text-sm font-semibold">
              <Table2 size={15} className="text-slate-400" />
              Données
            </h2>
            {status === "ready" && (
              <>
                <label className="flex items-center gap-1.5 text-xs text-slate-500">
                  <Database size={13} className="shrink-0" />
                  Base
                  <select
                    value={session.database}
                    onChange={(e) => switchDatabase(e.target.value)}
                    className="border border-slate-200 rounded-md px-2 py-1 text-xs font-mono text-slate-800 bg-white max-w-[12rem]"
                  >
                    {session.databases.map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </select>
                </label>
                <span className="text-[11px] text-slate-400 truncate">
                  {session.user}
                  {session.credentialSource === "manual" && " (identifiants saisis)"} · PostgreSQL {session.serverVersion}
                </span>
              </>
            )}
          </div>
          {status === "ready" && modeSwitch}
        </div>
        {connectionView()}
      </section>

      <section className="bg-white rounded-xl shadow p-4 sm:p-5 space-y-4">
        <div>
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            <Archive size={15} className="text-slate-400" />
            Sauvegardes
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Sauvegarde manuelle, restauration et suppression. Une restauration recharge la section Données ci-dessus.
          </p>
        </div>
        <BackupPanel namespace={namespace} component={component} onRestored={onRestored} />
      </section>
    </div>
  );

  function connectionView() {
    if (status === "connecting") {
      return <p className="text-sm text-slate-500">Connexion à la base...</p>;
    }

    if (status === "login") {
      const intro =
        error?.code === "db_credentials_required"
          ? "Aucun mot de passe n'est enregistré pour cette base : saisis ses identifiants."
          : credsRef.current
            ? "Identifiants refusés par la base."
            : "Le mot de passe enregistré pour cette base a été refusé (a-t-il été changé depuis, en SQL ?) : saisis ses identifiants.";
      return (
        <form onSubmit={submitLogin} className="max-w-sm space-y-3">
          <div className="flex items-center gap-2">
            <KeyRound size={15} className="text-slate-400" />
            <h2 className="text-sm font-semibold">Connexion à la base</h2>
          </div>
          <p className={`text-xs ${credsRef.current ? "text-red-600" : "text-slate-500"}`}>{intro}</p>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Utilisateur</label>
            <input
              required
              value={login.user}
              onChange={(e) => setLogin((l) => ({ ...l, user: e.target.value }))}
              autoComplete="off"
              className="w-full border border-slate-300 rounded-md px-3 py-1.5 text-sm font-mono"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Mot de passe</label>
            <input
              required
              autoFocus
              type="password"
              value={login.password}
              onChange={(e) => setLogin((l) => ({ ...l, password: e.target.value }))}
              autoComplete="off"
              className="w-full border border-slate-300 rounded-md px-3 py-1.5 text-sm font-mono"
            />
          </div>
          <p className="text-[11px] text-slate-400">Gardés en mémoire le temps de cette page seulement.</p>
          <button
            type="submit"
            disabled={loggingIn}
            className="w-full sm:w-auto bg-slate-900 text-white text-sm font-medium px-4 py-2.5 sm:py-2 rounded-md disabled:opacity-50"
          >
            {loggingIn ? "Connexion..." : "Se connecter"}
          </button>
        </form>
      );
    }

    if (status === "error") {
      return (
        <div className="space-y-3">
          <DbErrorBox error={error} />
          <button
            onClick={() => {
              setStatus("connecting");
              open(sessionRef.current?.database);
            }}
            className="flex items-center gap-1.5 text-xs font-medium text-slate-600 border border-slate-200 rounded-md px-3 py-1.5 hover:bg-slate-50"
          >
            <RefreshCw size={12} />
            Réessayer
          </button>
        </div>
      );
    }

    return (
      <div className="space-y-4">
        <DbErrorBox error={switchError} />

        {/* Les deux vues restent montées : changer d'onglet ne perd ni la table
            affichée ni le résultat (ou la transaction) de l'éditeur. Changer de
            database, ou restaurer une sauvegarde, les remet à zéro. */}
        <div key={`${session.database}-${dataVersion}`}>
          <div className={mode === "tables" ? "" : "hidden"}>
            <TableBrowser namespace={namespace} component={component} run={run} />
          </div>
          <div className={mode === "sql" ? "" : "hidden"}>
            <SqlEditor namespace={namespace} component={component} run={run} />
          </div>
        </div>
      </div>
    );
  }
}
