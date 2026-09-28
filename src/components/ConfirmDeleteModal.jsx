import { useEffect, useState } from "react";
import { AlertTriangle, X } from "lucide-react";

// ConfirmDeleteModal remplace window.confirm() pour toute suppression -
// l'utilisateur doit retaper exactement `confirmText` pour activer le bouton,
// ce qui rend une suppression accidentelle par clic réflexe beaucoup moins
// probable qu'une simple boîte de dialogue navigateur.
export default function ConfirmDeleteModal({
  open,
  title,
  description,
  confirmText,
  confirmLabel = "Tape le nom pour confirmer",
  actionLabel = "Supprimer",
  loading = false,
  error = "",
  onConfirm,
  onCancel,
}) {
  const [value, setValue] = useState("");

  useEffect(() => {
    if (open) setValue("");
  }, [open]);

  if (!open) return null;

  const matches = value === confirmText;

  function handleSubmit(e) {
    e.preventDefault();
    if (matches && !loading) onConfirm();
  }

  return (
    <div
      className="modal-backdrop"
      onClick={(e) => e.target === e.currentTarget && !loading && onCancel()}
    >
      <div className="modal-panel">
        <div className="sheet-grabber" />
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-full bg-red-50 text-red-600 flex items-center justify-center shrink-0">
              <AlertTriangle size={18} />
            </div>
            <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
          </div>
          <button
            onClick={onCancel}
            disabled={loading}
            aria-label="Fermer"
            className="text-slate-400 hover:text-slate-600 transition disabled:opacity-40 -m-2 p-2"
          >
            <X size={16} />
          </button>
        </div>

        <p className="text-sm text-slate-500 mb-4">{description}</p>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-xs text-slate-500 mb-1">
              {confirmLabel} : <span className="font-mono font-semibold text-slate-700 break-all">{confirmText}</span>
            </label>
            <input
              autoFocus
              value={value}
              onChange={(e) => setValue(e.target.value)}
              disabled={loading}
              className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-400 disabled:opacity-50"
              placeholder={confirmText}
            />
          </div>

          {error && <p className="text-xs text-red-600">{error}</p>}

          <div className="flex flex-col-reverse sm:flex-row gap-2 pt-1">
            <button
              type="submit"
              disabled={!matches || loading}
              className="flex-1 bg-red-600 text-white text-sm font-medium px-4 py-3 sm:py-2 rounded-lg sm:rounded-md hover:bg-red-700 transition disabled:opacity-40 disabled:hover:bg-red-600"
            >
              {loading ? "Suppression..." : actionLabel}
            </button>
            <button
              type="button"
              onClick={onCancel}
              disabled={loading}
              className="text-sm text-slate-500 px-4 py-3 sm:py-2 hover:bg-slate-50 rounded-lg sm:rounded-md transition disabled:opacity-40"
            >
              Annuler
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
