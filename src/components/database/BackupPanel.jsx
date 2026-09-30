import { useCallback, useEffect, useRef, useState } from "react";
import { Archive, CalendarClock, HardDrive, Loader2, RefreshCw, RotateCcw, Trash2, X } from "lucide-react";
import {
  listDatabaseBackups,
  createDatabaseBackup,
  restoreDatabaseBackup,
  deleteDatabaseBackup,
  updateComponent,
} from "../../api";
import { dbError } from "../../lib/dbErrors";
import DbErrorBox from "./DbErrorBox";

// BackupPanel est la vue "Sauvegardes" du gestionnaire de données : sauvegardes du
// volume <composant>-backups (voir handlers/backups.go côté API). Création et
// restauration tournent en tâche de fond côté API : la liste est rechargée toutes
// les 2 s tant qu'une opération est en cours. onRestored est appelée à la fin d'une
// restauration réussie (le navigateur de tables et l'éditeur se rechargent).

const KIND_LABEL = {
  manual: { label: "Manuelle", className: "bg-slate-100 text-slate-600" },
  auto: { label: "Automatique", className: "bg-indigo-50 text-indigo-700" },
  prerestore: { label: "Avant restauration", className: "bg-amber-50 text-amber-700" },
};

function formatBytes(n) {
  if (!n) return "0 o";
  const units = ["o", "Ko", "Mo", "Go"];
  let i = 0;
  while (n >= 1024 && i < units.length - 1) {
    n /= 1024;
    i++;
  }
  return `${n.toLocaleString("fr-FR", { maximumFractionDigits: i === 0 ? 0 : 1 })} ${units[i]}`;
}

function formatDate(iso) {
  return new Date(iso).toLocaleString("fr-FR", { dateStyle: "medium", timeStyle: "short" });
}

function operationLabel(op) {
  if (op.type === "restore") return `Restauration de ${op.database}`;
  if (op.kind === "auto") return `Sauvegarde automatique de ${op.database}`;
  return `Sauvegarde de ${op.database}`;
}

export default function BackupPanel({ namespace, component, onRestored }) {
  const [data, setData] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [actionError, setActionError] = useState(null);
  const [database, setDatabase] = useState("");
  const [starting, setStarting] = useState(false);
  const [restoring, setRestoring] = useState(null); // sauvegarde à confirmer
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [addingVolume, setAddingVolume] = useState(false);
  const [volumeRequested, setVolumeRequested] = useState(false);
  // dismissed : dernière opération dont le résultat a été fermé par l'utilisateur.
  const [dismissed, setDismissed] = useState(null);

  const mounted = useRef(true);
  const lastRunning = useRef(null);
  const onRestoredRef = useRef(onRestored);
  onRestoredRef.current = onRestored;

  const load = useCallback(async () => {
    try {
      const d = await listDatabaseBackups(namespace, component);
      if (!mounted.current) return;
      // Une restauration vient de se terminer avec succès : les vues des données
      // sont périmées.
      const was = lastRunning.current;
      if (was?.type === "restore" && !d.running && d.last?.type === "restore" && d.last.status === "succeeded" && d.last.startedAt === was.startedAt) {
        onRestoredRef.current?.();
      }
      lastRunning.current = d.running;
      setData(d);
      setLoadError(null);
      setDatabase((current) => current || d.defaultDatabase);
    } catch (err) {
      if (mounted.current) setLoadError(dbError(err));
    }
  }, [namespace, component]);

  useEffect(() => {
    mounted.current = true;
    load();
    return () => {
      mounted.current = false;
    };
  }, [load]);

  // Rechargement : toutes les 2 s pendant une opération, toutes les 5 s en attendant
  // le volume demandé (redémarrage de la base).
  const polling = data?.running ? 2000 : volumeRequested && data && !data.volumeReady ? 5000 : 0;
  useEffect(() => {
    if (!polling) return;
    const id = setInterval(load, polling);
    return () => clearInterval(id);
  }, [polling, load]);

  async function startBackup() {
    setStarting(true);
    setActionError(null);
    try {
      await createDatabaseBackup(namespace, component, database);
      await load();
    } catch (err) {
      setActionError(dbError(err));
    } finally {
      setStarting(false);
    }
  }

  async function startRestore(backup, safetyBackup) {
    setActionError(null);
    try {
      lastRunning.current = await restoreDatabaseBackup(namespace, component, backup.id, safetyBackup);
      setRestoring(null);
      await load();
    } catch (err) {
      setRestoring(null);
      setActionError(dbError(err));
    }
  }

  async function remove(backup) {
    setConfirmDelete(null);
    setActionError(null);
    try {
      await deleteDatabaseBackup(namespace, component, backup.id);
      await load();
    } catch (err) {
      setActionError(dbError(err));
    }
  }

  async function addVolume() {
    setAddingVolume(true);
    setActionError(null);
    try {
      await updateComponent(namespace, component, {});
      setVolumeRequested(true);
    } catch (err) {
      setActionError({ message: err.response?.data?.error || "Erreur lors de la régénération du composant" });
    } finally {
      setAddingVolume(false);
    }
  }

  if (!data && !loadError) {
    return <p className="text-sm text-slate-500">Chargement des sauvegardes...</p>;
  }

  if (!data) {
    return (
      <div className="space-y-3">
        <DbErrorBox error={loadError} />
        <button
          onClick={load}
          className="flex items-center gap-1.5 text-xs font-medium text-slate-600 border border-slate-200 rounded-md px-3 py-1.5 hover:bg-slate-50"
        >
          <RefreshCw size={12} />
          Réessayer
        </button>
      </div>
    );
  }

  if (!data.volumeReady) {
    return (
      <div className="max-w-xl space-y-3">
        <div className="flex items-center gap-2">
          <HardDrive size={15} className="text-slate-400" />
          <h2 className="text-sm font-semibold">Volume de sauvegardes</h2>
        </div>
        {volumeRequested ? (
          <p className="text-xs text-slate-500 flex items-center gap-1.5">
            <Loader2 size={12} className="animate-spin" />
            La base redémarre avec son volume de sauvegardes (5 Go)...
          </p>
        ) : (
          <>
            <p className="text-xs text-slate-500">
              Cette base a été créée avant les sauvegardes : elle n'a pas encore de volume pour les stocker (5 Go). L'ajouter
              régénère le composant, ce qui redémarre la base (quelques secondes d'indisponibilité).
            </p>
            <button
              onClick={addVolume}
              disabled={addingVolume}
              className="bg-slate-900 text-white text-sm font-medium px-4 py-2.5 sm:py-2 rounded-md disabled:opacity-50"
            >
              {addingVolume ? "Régénération..." : "Ajouter le volume de sauvegardes"}
            </button>
          </>
        )}
        <DbErrorBox error={actionError} />
      </div>
    );
  }

  const { running, last } = data;
  const lastKey = last ? `${last.type}-${last.startedAt}` : null;
  const showLast = last && !running && lastKey !== dismissed && (last.status === "failed" || last.type === "restore");
  const usedPct = Math.min(100, (data.usedBytes / data.limitBytes) * 100);
  const databases = data.databases.length ? data.databases : [data.defaultDatabase];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-1.5 min-w-[12rem]">
          <div className="flex items-center justify-between gap-3 text-[11px] text-slate-500">
            <span className="flex items-center gap-1.5">
              <HardDrive size={12} />
              {formatBytes(data.usedBytes)} sur {formatBytes(data.limitBytes)}
            </span>
          </div>
          <div className="h-1.5 w-56 max-w-full bg-slate-100 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full ${usedPct >= 90 ? "bg-red-500" : usedPct >= 70 ? "bg-amber-500" : "bg-slate-900"}`}
              style={{ width: `${usedPct}%` }}
            />
          </div>
          <p className="flex items-center gap-1.5 text-[11px] text-slate-400">
            <CalendarClock size={12} />
            Une sauvegarde automatique par jour et par database (7 gardées)
            {data.nextAutoBackupAt && ` · prochaine le ${formatDate(data.nextAutoBackupAt)}`}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={database}
            onChange={(e) => setDatabase(e.target.value)}
            disabled={!!running || starting}
            className="border border-slate-200 rounded-md px-2 py-1.5 text-xs font-mono bg-white max-w-[12rem]"
            aria-label="Database à sauvegarder"
          >
            {databases.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
          <button
            onClick={startBackup}
            disabled={!!running || starting}
            className="flex items-center gap-1.5 bg-slate-900 text-white text-xs font-medium px-3 py-2 rounded-md disabled:opacity-50"
          >
            <Archive size={13} />
            {starting ? "Lancement..." : "Sauvegarder maintenant"}
          </button>
        </div>
      </div>

      {running && (
        <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2.5 text-xs text-slate-700">
          <Loader2 size={14} className="animate-spin text-slate-400 shrink-0" />
          <span>
            {operationLabel(running)} en cours...
            {running.type === "restore" && " Les applications connectées à la base peuvent être ralenties."}
          </span>
        </div>
      )}

      {showLast &&
        (last.status === "failed" ? (
          <DbErrorBox error={{ message: `${operationLabel(last)} : échec`, detail: last.error }}>
            <button onClick={() => setDismissed(lastKey)} className="text-red-700 underline">
              Fermer
            </button>
          </DbErrorBox>
        ) : (
          <div className="flex items-center justify-between gap-3 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2.5 text-xs text-emerald-800">
            <span>
              {operationLabel(last)} terminée ({formatDate(last.finishedAt)}).
            </span>
            <button onClick={() => setDismissed(lastKey)} aria-label="Fermer" className="text-emerald-600 -m-1 p-1">
              <X size={13} />
            </button>
          </div>
        ))}

      <DbErrorBox error={actionError} />

      {data.backups.length === 0 ? (
        <p className="text-sm text-slate-500 py-6 text-center">Aucune sauvegarde pour l'instant.</p>
      ) : (
        <div className="border border-slate-200 rounded-lg divide-y divide-slate-100">
          {data.backups.map((b) => {
            const kind = KIND_LABEL[b.kind] || KIND_LABEL.manual;
            const inUse = running?.backupId === b.id;
            return (
              <div key={b.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-3 py-2.5">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm text-slate-900">{formatDate(b.createdAt)}</span>
                    <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${kind.className}`}>{kind.label}</span>
                  </div>
                  <p className="text-[11px] text-slate-400">
                    <span className="font-mono">{b.database}</span> · {formatBytes(b.sizeBytes)}
                  </p>
                </div>
                {confirmDelete === b.id ? (
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-slate-500">Supprimer ?</span>
                    <button onClick={() => remove(b)} className="font-medium text-red-600 px-2 py-1 rounded hover:bg-red-50">
                      Supprimer
                    </button>
                    <button onClick={() => setConfirmDelete(null)} className="text-slate-500 px-2 py-1 rounded hover:bg-slate-50">
                      Annuler
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setRestoring(b)}
                      disabled={!!running}
                      className="flex items-center gap-1.5 text-xs font-medium text-slate-700 border border-slate-200 rounded-md px-2.5 py-1.5 hover:bg-slate-50 disabled:opacity-40"
                    >
                      <RotateCcw size={12} />
                      Restaurer
                    </button>
                    <button
                      onClick={() => setConfirmDelete(b.id)}
                      disabled={!!running || inUse}
                      aria-label="Supprimer la sauvegarde"
                      className="text-slate-400 hover:text-red-600 p-1.5 rounded-md hover:bg-red-50 disabled:opacity-40"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {restoring && <RestoreModal backup={restoring} onClose={() => setRestoring(null)} onConfirm={startRestore} />}
    </div>
  );
}

function RestoreModal({ backup, onClose, onConfirm }) {
  const [safety, setSafety] = useState(true);
  const [busy, setBusy] = useState(false);

  async function confirm() {
    setBusy(true);
    await onConfirm(backup, safety);
  }

  return (
    <div className="modal-backdrop" onClick={(e) => e.target === e.currentTarget && !busy && onClose()}>
      <div className="modal-panel sm:max-w-md">
        <div className="sheet-grabber" />
        <div className="flex items-center justify-between gap-3 mb-4">
          <h2 className="text-sm font-semibold text-slate-900">Restaurer la sauvegarde</h2>
          <button onClick={onClose} disabled={busy} aria-label="Fermer" className="text-slate-400 hover:text-slate-600 -m-2 p-2">
            <X size={16} />
          </button>
        </div>
        <div className="space-y-3 text-xs text-slate-600">
          <p>
            La database <span className="font-mono text-slate-900">{backup.database}</span> revient à son état du{" "}
            <span className="text-slate-900">{formatDate(backup.createdAt)}</span>. Les tables et objets de la sauvegarde sont
            remplacés ; ceux créés depuis sont conservés.
          </p>
          <p>
            La restauration se fait en une seule transaction : si elle échoue, rien n'est modifié. Les sessions ouvertes dans
            le gestionnaire de données sont fermées.
          </p>
          <label className="flex items-start gap-2 text-slate-700">
            <input type="checkbox" checked={safety} onChange={(e) => setSafety(e.target.checked)} className="mt-0.5" />
            <span>Sauvegarder d'abord l'état actuel (sauvegarde « Avant restauration »)</span>
          </label>
        </div>
        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-5">
          <button
            onClick={onClose}
            disabled={busy}
            className="text-sm text-slate-500 px-4 py-3 sm:py-2 hover:bg-slate-50 rounded-lg sm:rounded-md transition disabled:opacity-40"
          >
            Annuler
          </button>
          <button
            onClick={confirm}
            disabled={busy}
            className="bg-slate-900 text-white text-sm font-medium px-4 py-3 sm:py-2 rounded-lg sm:rounded-md disabled:opacity-50"
          >
            {busy ? "Lancement..." : "Restaurer"}
          </button>
        </div>
      </div>
    </div>
  );
}
