"use client";

import { useState, type FormEvent } from "react";
import { Eye, EyeOff } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { useBranding } from "@/lib/branding";
import { useAppData } from "@/lib/app-data";
import { Eyebrow, Field, Select, TextInput } from "@/components/ui/kit";

type Mode = "login" | "request";

export default function LoginView() {
  const { t, lang, toggle } = useI18n();
  const { name: brandName } = useBranding();
  const { authNotice, isSyncing, login, registerUser } = useAppData();

  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("admin@lecarre.local");
  const [password, setPassword] = useState("admin");
  const [name, setName] = useState("");
  const [role, setRole] = useState<"Agent" | "Gestionnaire">("Agent");
  const [showPassword, setShowPassword] = useState(false);
  // Seed with any automatic-logout notice (e.g. inactivity) carried from Home.
  const [message, setMessage] = useState(authNotice ?? "");
  const isRequest = mode === "request";

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const result = isRequest
      ? await registerUser({ email, name, password, role })
      : await login({ email, password });
    setMessage(result.message);
  }

  return (
    <main className="relative min-h-screen overflow-hidden">
      {/* Language toggle available before login too. */}
      <button
        type="button"
        onClick={toggle}
        aria-label={lang === "fr" ? "Switch to English" : "Passer en français"}
        className="fixed right-4 top-4 z-10 inline-flex h-10 items-center justify-center rounded-[2px] border border-[var(--line-strong)] px-3 text-xs font-semibold uppercase tracking-[0.16em] transition-colors hover:border-[var(--ink)] hover:bg-[var(--ink)] hover:text-[var(--bg)]"
      >
        {lang === "fr" ? "EN" : "FR"}
      </button>

      <div className="mx-auto grid min-h-screen max-w-[1280px] items-center gap-10 px-6 py-12 lg:grid-cols-[1.1fr_minmax(380px,460px)] lg:gap-24 lg:px-12">
        {/* Brand */}
        <section className="order-2 lg:order-1">
          <Eyebrow>{t("Économat")}</Eyebrow>
          <h1 className="display mt-6 text-[clamp(3rem,8vw,5.8rem)] leading-[0.95]">
            {brandName}
          </h1>
          <div className="meander mt-7 w-40 max-w-full" />
          <p className="mt-7 max-w-md text-base leading-relaxed text-[var(--ink-soft)]">
            {t("Connexion au système interne")}
          </p>

          <dl className="mt-10 grid max-w-md grid-cols-3 gap-px overflow-hidden rounded-[3px] border border-[var(--line)] bg-[var(--line)]">
            {[
              ["Lots", t("Traçabilité")],
              ["QR", t("1 étiquette par lot physique")],
              ["FEFO", t("Règles actives")],
            ].map(([k, v]) => (
              <div key={k} className="bg-[var(--bg-2)] px-4 py-5">
                <dt className="numeric text-lg">{k}</dt>
                <dd className="mt-1 text-[0.62rem] uppercase tracking-[0.18em] text-[var(--muted)]">
                  {v}
                </dd>
              </div>
            ))}
          </dl>
        </section>

        {/* Form */}
        <section className="order-1 lg:order-2">
          <div className="card bg-[var(--paper)] p-7 shadow-[var(--shadow-soft)] sm:p-10">
            <div className="relative mb-8 grid grid-cols-2 border-b border-[var(--line)]">
              {(["login", "request"] as Mode[]).map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => {
                    setMode(value);
                    if (value === "request") {
                      setEmail("");
                      setPassword("");
                    } else {
                      setEmail("admin@lecarre.local");
                      setPassword("admin");
                    }
                    setMessage("");
                  }}
                  className={`relative z-10 h-12 text-[0.72rem] font-semibold uppercase tracking-[0.2em] transition-colors ${
                    mode === value ? "text-[var(--ink)]" : "text-[var(--faint)]"
                  }`}
                >
                  {value === "login" ? t("Connexion") : t("Demande")}
                </button>
              ))}
              <span
                aria-hidden="true"
                className="absolute bottom-[-1px] h-[2px] w-1/2 bg-[var(--ink)] transition-transform duration-300"
                style={{
                  transform: isRequest ? "translateX(100%)" : "translateX(0)",
                }}
              />
            </div>

            <form onSubmit={handleSubmit} className="flex flex-col gap-5">
              {isRequest ? (
                <Field label={t("Nom")}>
                  <TextInput
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder={t("Votre nom")}
                    autoComplete="name"
                  />
                </Field>
              ) : null}

              <Field label={t("E-mail")}>
                <TextInput
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={t("Entrez votre adresse e-mail")}
                  autoComplete="email"
                />
              </Field>

              <label className="block">
                <span className="field-label">{t("Mot de passe")}</span>
                <span className="relative block">
                  <TextInput
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={t("Entrez votre mot de passe")}
                    autoComplete={isRequest ? "new-password" : "current-password"}
                    className="pr-11"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((value) => !value)}
                    aria-label={
                      showPassword
                        ? t("Masquer le mot de passe")
                        : t("Afficher le mot de passe")
                    }
                    className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-[var(--muted)] transition-colors hover:text-[var(--ink)]"
                  >
                    {showPassword ? (
                      <EyeOff size={18} strokeWidth={1.5} />
                    ) : (
                      <Eye size={18} strokeWidth={1.5} />
                    )}
                  </button>
                </span>
              </label>

              {isRequest ? (
                <Field label={t("Rôle demandé")}>
                  <Select
                    value={role}
                    onChange={(e) =>
                      setRole(e.target.value as "Agent" | "Gestionnaire")
                    }
                  >
                    <option value="Agent">{t("Agent")}</option>
                    <option value="Gestionnaire">{t("Gestionnaire")}</option>
                  </Select>
                </Field>
              ) : null}

              {message ? (
                <p className="text-[0.82rem] text-[var(--ink-soft)]">{t(message)}</p>
              ) : null}

              <button
                type="submit"
                disabled={isSyncing}
                className="btn btn-primary btn-block mt-1"
              >
                {isSyncing
                  ? isRequest
                    ? t("Envoi...")
                    : t("Vérification...")
                  : isRequest
                    ? t("Envoyer la demande")
                    : t("Se connecter")}
              </button>
            </form>
          </div>
        </section>
      </div>
    </main>
  );
}
