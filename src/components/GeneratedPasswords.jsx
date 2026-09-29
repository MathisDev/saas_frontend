import { useState } from "react";
import { Copy, Check } from "lucide-react";

// GeneratedPasswords affiche le mot de passe auto-généré de chaque composant base de
// données créé sans mot de passe fourni (champ generatedPassword de la réponse API) -
// renvoyé une seule fois dans cette réponse, puis consultable dans le secret
// "<composant>-password" de l'environnement (voir SecretsPanel). Même présentation
// que la réinitialisation de mot de passe admin (voir Organisation.jsx).
export default function GeneratedPasswords({ components }) {
  const [copied, setCopied] = useState("");

  function copy(c) {
    navigator.clipboard.writeText(c.generatedPassword);
    setCopied(c.name);
    setTimeout(() => setCopied(""), 2000);
  }

  return (
    <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-3">
      <p className="text-xs text-amber-700 font-medium">
        {components.length > 1 ? "Mots de passe générés" : "Mot de passe généré"} — il reste consultable
        ensuite dans les secrets de l'environnement (&lt;composant&gt;-password) :
      </p>
      {components.map((c) => (
        <div key={c.name} className="space-y-1">
          <p className="text-xs text-amber-800 font-mono">{c.name}</p>
          <div className="flex items-center gap-2">
            <code className="flex-1 min-w-0 block bg-white rounded p-3 text-xs break-all">{c.generatedPassword}</code>
            <button
              type="button"
              onClick={() => copy(c)}
              className="shrink-0 p-3 border border-amber-300 rounded-md hover:bg-amber-100 transition"
              title="Copier"
            >
              {copied === c.name ? <Check size={16} className="text-green-600" /> : <Copy size={16} />}
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
