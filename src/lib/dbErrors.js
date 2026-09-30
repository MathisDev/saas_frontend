// Messages du gestionnaire de données, par code d'erreur stable renvoyé par l'API
// (voir handlers/databases.go, writeDatabaseError). Une erreur SQL garde le
// message de Postgres, plus parlant que toute traduction.
const MESSAGES = {
  db_auth_failed: "Identifiants refusés par la base.",
  db_credentials_required: "Aucun mot de passe enregistré pour cette base.",
  db_unreachable: "Base injoignable : le pod est-il démarré ?",
  db_not_found: "Cette database n'existe pas (ou plus).",
  session_expired: "Session expirée.",
  connection_lost: "Connexion à la base perdue : la transaction en cours a été annulée.",
  table_not_found: "Table introuvable (supprimée entre-temps ?).",
  row_not_found: "La ligne a été modifiée ou supprimée entre-temps : recharge les données.",
  read_only: "Cette relation est en lecture seule.",
  timeout: "Délai dépassé : la requête a pris plus de 60 s.",
};

// dbError normalise une erreur axios : {code, message, detail, hint, sqlState}.
export function dbError(err) {
  const data = err?.response?.data || {};
  const code = data.code || "";
  const message = code === "sql_error" || code === "invalid_request" ? data.error : MESSAGES[code] || data.error || "Erreur inattendue";
  return { code, message, detail: data.detail, hint: data.hint, sqlState: data.sqlState };
}
