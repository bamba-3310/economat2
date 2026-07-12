import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useCallback, useContext, useEffect, useState } from "react";

// Same convention as the web app: French strings are the keys,
// the dictionary provides the English translations.

const LANG_KEY = "economat.lang";

export type Lang = "fr" | "en";

const EN: Record<string, string> = {
  "Connexion": "Sign in",
  "Adresse du serveur": "Server address",
  "Email": "Email",
  "Mot de passe": "Password",
  "Se connecter": "Sign in",
  "Connexion...": "Signing in...",
  "Scanner": "Scan",
  "Stock": "Stock",
  "Réglages": "Settings",
  "Scanner un lot": "Scan a lot",
  "Autoriser la caméra": "Allow camera",
  "La caméra est nécessaire pour scanner les QR codes des lots.":
    "Camera access is required to scan lot QR codes.",
  "Saisie manuelle": "Manual entry",
  "Code du lot (LC-...)": "Lot code (LC-...)",
  "Rechercher": "Search",
  "Lecture en cours...": "Reading...",
  "QR non référencé": "Unknown QR code",
  "Lot": "Lot",
  "Qté restante": "Remaining qty",
  "Exp.": "Exp.",
  "En réserve": "In reserve",
  "En service": "In service",
  "Expiré": "Expired",
  "Mettre en service": "Put in service",
  "Enregistrer la sortie": "Record exit",
  "Quantité": "Quantity",
  "Lot activé.": "Lot activated.",
  "Sortie enregistrée.": "Exit recorded.",
  "Scanner à nouveau": "Scan again",
  "Rechercher un article": "Search an article",
  "Critique": "Critical",
  "Seuil bas": "Low",
  "Stable": "Stable",
  "Aucun article": "No articles",
  "Compte": "Account",
  "Serveur": "Server",
  "Langue": "Language",
  "Français": "French",
  "Anglais": "English",
  "Se déconnecter": "Sign out",
  "Version": "Version",
  "Lot conforme": "Lot compliant",
  "Règles conformes": "Rules compliant",
  "Lot expiré : sortie et activation interdites":
    "Expired lot: exit and activation forbidden",
  "Activation refusée : un lot plus ancien doit être utilisé en priorité.":
    "Activation refused: an older lot must be used first.",
  "Quantité supérieure au restant": "Quantity exceeds remaining stock",
  "Lot faible : activer un autre lot": "Lot running low: activate another lot",
  "Aucune action directe pour ce statut": "No direct action for this status",
  "Serveur non configuré": "Server not configured",
  "Serveur injoignable": "Server unreachable",
  "Session expirée": "Session expired",
  "Champs requis.": "All fields are required.",
  "Chargement...": "Loading...",
  "Réessayer": "Retry",
  "Annuler": "Cancel",
};

const I18nContext = createContext<{
  lang: Lang;
  t: (key: string) => string;
  setLang: (lang: Lang) => void;
}>({ lang: "fr", t: (key) => key, setLang: () => {} });

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>("fr");

  useEffect(() => {
    void AsyncStorage.getItem(LANG_KEY).then((stored) => {
      if (stored === "en" || stored === "fr") setLangState(stored);
    });
  }, []);

  const setLang = useCallback((next: Lang) => {
    setLangState(next);
    void AsyncStorage.setItem(LANG_KEY, next);
  }, []);

  const t = useCallback(
    (key: string) => (lang === "en" ? (EN[key] ?? key) : key),
    [lang],
  );

  return <I18nContext.Provider value={{ lang, t, setLang }}>{children}</I18nContext.Provider>;
}

export const useI18n = () => useContext(I18nContext);
