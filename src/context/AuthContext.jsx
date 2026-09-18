import { createContext, useContext, useEffect, useState } from "react";
import { setApiKey, getMe } from "../api";

const STORAGE_KEY = "saas_api_key";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [apiKey, setApiKeyState] = useState(() => {
    const stored = localStorage.getItem(STORAGE_KEY) || "";
    setApiKey(stored || null);
    return stored;
  });
  const [me, setMe] = useState(null);

  useEffect(() => {
    if (apiKey) {
      getMe()
        .then(setMe)
        .catch(() => setMe(null));
    } else {
      setMe(null);
    }
  }, [apiKey]);

  function login(key) {
    localStorage.setItem(STORAGE_KEY, key);
    setApiKey(key);
    setApiKeyState(key);
  }

  function logout() {
    localStorage.removeItem(STORAGE_KEY);
    setApiKey(null);
    setApiKeyState("");
  }

  return (
    <AuthContext.Provider
      value={{ apiKey, isAuthenticated: Boolean(apiKey), me, isAdmin: Boolean(me?.isAdmin), login, logout }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
