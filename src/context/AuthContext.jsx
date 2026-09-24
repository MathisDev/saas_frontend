import { createContext, useContext, useEffect, useState } from "react";
import { setCredential, getMe } from "../api";

const STORAGE_KEY = "saas_credential";

const AuthContext = createContext(null);

function loadStoredCredential() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }) {
  const [credential, setCredentialState] = useState(() => {
    const stored = loadStoredCredential();
    setCredential(stored);
    return stored;
  });
  const [me, setMe] = useState(null);

  useEffect(() => {
    if (credential) {
      getMe()
        .then(setMe)
        .catch(() => setMe(null));
    } else {
      setMe(null);
    }
  }, [credential]);

  // login connecte la session avec un token émis par POST /auth/login ou
  // POST /clients (inscription) - le flux normal désormais.
  function login(token) {
    const cred = { type: "token", value: token };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cred));
    setCredential(cred);
    setCredentialState(cred);
  }

  // loginWithApiKey conserve la possibilité de se connecter en collant
  // directement une clé API (compte créé avant le login email/mot de passe,
  // ou usage avancé).
  function loginWithApiKey(key) {
    const cred = { type: "apikey", value: key };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cred));
    setCredential(cred);
    setCredentialState(cred);
  }

  function logout() {
    localStorage.removeItem(STORAGE_KEY);
    setCredential(null);
    setCredentialState(null);
  }

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated: Boolean(credential),
        credentialType: credential?.type ?? null,
        me,
        isAdmin: Boolean(me?.isAdmin),
        login,
        loginWithApiKey,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
