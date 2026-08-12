"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import jsQR from "jsqr";
import {
  ArrowUpRight,
  Camera,
  CircleAlert,
  ImagePlus,
  Keyboard,
  Search,
  Usb,
  Wifi,
  WifiOff,
} from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { useAppData } from "@/lib/app-data";
import { evaluateLotScan, getSuggestedScanProducts } from "@/lib/stock-engine";
import { formatDate } from "@/lib/format";
import type { Lot, Product } from "@/types/domain";
import { Eyebrow, LotStatusChip, StatusChip } from "@/components/ui/kit";

type ScanSource = "scanner" | "camera";
type CamStatus =
  | "idle"
  | "starting"
  | "ready"
  | "https-required"
  | "unsupported"
  | "blocked";

type ScanCodeResult = { found: boolean; message: string; normalizedValue: string };

export default function ScanView({
  lot,
  product,
  onScanCode,
  onScanProduct,
  onOpenProduct,
  onPrimaryAction,
}: {
  lot?: Lot;
  product?: Product;
  onScanCode: (value: string) => Promise<ScanCodeResult>;
  onScanProduct: (productId: string) => void;
  onOpenProduct: (productId: string) => void;
  onPrimaryAction: (input: { quantity?: number; type: "Activation" | "Sortie" }) => Promise<void>;
}) {
  const { t } = useI18n();
  const { categories, isSyncing, lots, operationDate, products } = useAppData();

  const [source, setSource] = useState<ScanSource>("scanner");
  const [scannerConnected, setScannerConnected] = useState(true);
  const [quantityOut, setQuantityOut] = useState(1);
  const [unknownScan, setUnknownScan] = useState(false);
  const [manual, setManual] = useState("");
  const [scanMessage, setScanMessage] = useState("");
  const [actionFeedback, setActionFeedback] = useState("");
  const [camStatus, setCamStatus] = useState<CamStatus>("idle");
  const [isPhotoReading, setIsPhotoReading] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const lastScanRef = useRef("");
  const photoInputRef = useRef<HTMLInputElement>(null);
  const bufferRef = useRef("");
  const bufferTimerRef = useRef<number | null>(null);

  const category = categories.find((item) => item.id === product?.categoryId);
  const decision = lot
    ? evaluateLotScan({
        category,
        lot,
        lots,
        quantityOut,
        today: operationDate,
        unknownScan,
      })
    : {
        allowed: false,
        action: "Action bloquée" as const,
        reason: "Scannez un QR pour afficher un lot",
        severity: "warning" as const,
        canActivate: false,
        canExit: false,
      };
  const suggestions = getSuggestedScanProducts(products, product?.id ?? "");
  const actionBlocked = decision.severity === "blocked";

  const handleScanValue = useCallback(
    async (value: string) => {
      const candidate = value.trim();
      if (!candidate) return;
      setActionFeedback("");
      setScanMessage(t("Lecture en cours..."));
      setScannerConnected(true);
      try {
        const result = await onScanCode(candidate);
        setUnknownScan(!result.found);
        setScanMessage(result.message);
      } catch (error) {
        setUnknownScan(true);
        setScanMessage(error instanceof Error ? error.message : t("Lecture impossible."));
      }
    },
    [onScanCode, t],
  );

  // USB scanner: buffer fast keystrokes ending in Enter (HID behaviour).
  useEffect(() => {
    if (source !== "scanner" || !scannerConnected) return undefined;
    function onKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA")) return;
      if (event.key === "Enter") {
        if (bufferRef.current) {
          void handleScanValue(bufferRef.current);
          bufferRef.current = "";
        }
        return;
      }
      if (event.key.length === 1) {
        bufferRef.current += event.key;
        if (bufferTimerRef.current) window.clearTimeout(bufferTimerRef.current);
        bufferTimerRef.current = window.setTimeout(() => {
          bufferRef.current = "";
        }, 120);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [source, scannerConnected, handleScanValue]);

  // Camera lifecycle: getUserMedia + jsQR polling.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (source !== "camera") {
      stopCamera();
      setCamStatus("idle");
      return;
    }
    let active = true;
    let raf = 0;

    async function start() {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (!video || !canvas) return;
      if (!navigator.mediaDevices?.getUserMedia) {
        setCamStatus("unsupported");
        return;
      }
      if (
        typeof window !== "undefined" &&
        !window.isSecureContext &&
        window.location.hostname !== "localhost"
      ) {
        setCamStatus("https-required");
        return;
      }
      setCamStatus("starting");
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
        });
        if (!active) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        streamRef.current = stream;
        video.srcObject = stream;
        await video.play();
        setCamStatus("ready");
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        const tick = () => {
          if (!active) return;
          if (ctx && video.readyState === video.HAVE_ENOUGH_DATA) {
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const code = jsQR(image.data, image.width, image.height);
            if (code?.data && code.data !== lastScanRef.current) {
              lastScanRef.current = code.data;
              void handleScanValue(code.data);
            }
          }
          raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
      } catch {
        setCamStatus("blocked");
      }
    }

    function stopCamera() {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
    }

    void start();
    return () => {
      active = false;
      cancelAnimationFrame(raf);
      stopCamera();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source]);
  /* eslint-enable react-hooks/set-state-in-effect */

  async function handlePhoto(file?: File | null) {
    if (!file) return;
    setActionFeedback("");
    setIsPhotoReading(true);
    setScanMessage(t("Lecture de la photo..."));
    const imageUrl = URL.createObjectURL(file);
    try {
      const image = await new Promise<HTMLImageElement>((resolve, reject) => {
        const element = new Image();
        element.onload = () => resolve(element);
        element.onerror = () => reject(new Error(t("Image illisible.")));
        element.src = imageUrl;
      });
      const scale = Math.min(1, 1400 / Math.max(image.naturalWidth, image.naturalHeight));
      const width = Math.max(1, Math.round(image.naturalWidth * scale));
      const height = Math.max(1, Math.round(image.naturalHeight * scale));
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (!ctx) return;
      canvas.width = width;
      canvas.height = height;
      ctx.drawImage(image, 0, 0, width, height);
      const imageData = ctx.getImageData(0, 0, width, height);
      const decoded = jsQR(imageData.data, width, height, { inversionAttempts: "attemptBoth" });
      if (!decoded?.data) {
        setScanMessage(t("Aucun QR lisible sur la photo."));
        return;
      }
      await handleScanValue(decoded.data);
    } catch (error) {
      setScanMessage(error instanceof Error ? error.message : t("Image illisible."));
    } finally {
      setIsPhotoReading(false);
      URL.revokeObjectURL(imageUrl);
    }
  }

  async function runPrimaryAction() {
    if (actionBlocked) return;
    setActionFeedback("");
    try {
      if (decision.canActivate) {
        await onPrimaryAction({ type: "Activation" });
        setActionFeedback(t("Lot mis en service."));
      } else if (decision.canExit) {
        await onPrimaryAction({ type: "Sortie", quantity: quantityOut });
        setActionFeedback(t("Sortie enregistrée."));
      }
    } catch (error) {
      setActionFeedback(error instanceof Error ? error.message : t("Action impossible."));
    }
  }

  const camMessage: Record<CamStatus, string> = {
    idle: t("Caméra arrêtée"),
    starting: t("Ouverture caméra..."),
    ready: t("Caméra active."),
    "https-required": t("Caméra bloquée : HTTPS requis sur téléphone."),
    unsupported: t("Caméra indisponible"),
    blocked: t("Accès caméra refusé."),
  };

  const searchResults = useMemo(() => {
    const query = searchQuery.trim().toLocaleLowerCase("fr");
    return lots
      .map((candidate) => ({
        lot: candidate,
        product: products.find((item) => item.id === candidate.productId),
      }))
      .filter((entry): entry is { lot: Lot; product: Product } => {
        if (!entry.product || entry.lot.remainingQuantity <= 0) return false;
        if (!query) return true;
        return [entry.lot.code, entry.product.name, entry.product.unit]
          .join(" ")
          .toLocaleLowerCase("fr")
          .includes(query);
      })
      .slice(0, 8);
  }, [lots, products, searchQuery]);

  const canAct = decision.canActivate || decision.canExit;

  return (
    <div className="flex flex-col gap-8">
      <header className="view-head">
        <div>
          <Eyebrow>{t("Lecture lot")}</Eyebrow>
          <h1 className="view-title mt-3">{t("Scan")}</h1>
        </div>
        <button
          type="button"
          onClick={() => setScannerConnected((value) => !value)}
          className="flex items-center gap-2 text-[0.7rem] uppercase tracking-[0.16em] text-[var(--muted)] transition-colors hover:text-[var(--ink)]"
        >
          {scannerConnected ? (
            <Wifi size={15} strokeWidth={1.5} />
          ) : (
            <WifiOff size={15} strokeWidth={1.5} />
          )}
          {source === "scanner"
            ? scannerConnected
              ? t("Prêt")
              : t("Scanner USB non connecté")
            : camMessage[camStatus]}
        </button>
      </header>

      <div className="grid gap-10 lg:grid-cols-2">
        {/* Capture */}
        <section className="flex flex-col gap-5">
          <div className="inline-flex rounded-[2px] border border-[var(--line)] p-1">
            {(
              [
                { id: "scanner", label: t("USB"), icon: Usb },
                { id: "camera", label: t("Caméra"), icon: Camera },
              ] as const
            ).map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setSource(tab.id)}
                  className={`flex flex-1 items-center justify-center gap-2 px-4 py-2.5 text-[0.66rem] font-semibold uppercase tracking-[0.16em] transition-colors ${
                    source === tab.id
                      ? "bg-[var(--ink)] text-[var(--bg)]"
                      : "text-[var(--muted)]"
                  }`}
                >
                  <Icon size={14} strokeWidth={1.5} />
                  {tab.label}
                </button>
              );
            })}
          </div>

          {source === "camera" ? (
            <div className="card relative aspect-[4/3] overflow-hidden bg-black">
              <video ref={videoRef} playsInline muted className="h-full w-full object-cover" />
              <canvas ref={canvasRef} className="hidden" />
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                <div className="h-40 w-40 border border-white/70" />
              </div>
              {camStatus !== "ready" ? (
                <div className="absolute inset-0 flex items-center justify-center bg-black/70 px-6 text-center text-[0.82rem] text-[#f3efe6]">
                  {camMessage[camStatus]}
                </div>
              ) : null}
            </div>
          ) : (
            <div className="card flex flex-col items-center gap-4 px-6 py-12 text-center">
              <CircleAlert size={40} strokeWidth={1} className="text-[var(--muted)]" />
              <p className="text-sm text-[var(--muted)]">
                {scannerConnected
                  ? t("Entrée USB en attente")
                  : t("Scanner USB non connecté")}
              </p>
            </div>
          )}

          {/* Manual entry + photo */}
          <div className="card p-5">
            <span className="field-label">
              <Keyboard size={12} strokeWidth={1.5} className="mr-1 inline" />
              {t("Entrée manuelle")}
            </span>
            <div className="flex gap-2">
              <input
                value={manual}
                onChange={(e) => setManual(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && manual.trim()) {
                    void handleScanValue(manual.trim());
                    setManual("");
                  }
                }}
                placeholder={t("Code QR manuel")}
                className="input tabular"
              />
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={() => {
                  if (manual.trim()) {
                    void handleScanValue(manual.trim());
                    setManual("");
                  }
                }}
              >
                {t("Lire")}
              </button>
            </div>
            <button
              type="button"
              className="btn btn-line btn-sm mt-3 w-full"
              disabled={isPhotoReading}
              onClick={() => photoInputRef.current?.click()}
            >
              <ImagePlus size={14} strokeWidth={1.5} />
              {isPhotoReading ? t("Lecture...") : t("Photo QR")}
            </button>
            <input
              ref={photoInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => {
                void handlePhoto(e.target.files?.[0]);
                e.target.value = "";
              }}
            />
          </div>

          {scanMessage ? (
            <p className="text-[0.84rem] text-[var(--muted)]">{t(scanMessage)}</p>
          ) : null}

          {/* Manual lot search */}
          <div>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => setSearchOpen((value) => !value)}
            >
              <Search size={13} strokeWidth={1.5} />
              {t("Recherche lot")}
            </button>
            {searchOpen ? (
              <div className="card mt-2 p-4">
                <input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={t("Produit, lot, catégorie")}
                  className="input"
                />
                <ul className="mt-3 flex flex-col">
                  {searchResults.length === 0 ? (
                    <li className="py-3 text-[0.8rem] text-[var(--muted)]">
                      {t("Aucun lot trouvé.")}
                    </li>
                  ) : (
                    searchResults.map((entry) => (
                      <li
                        key={entry.lot.id}
                        className="flex items-center justify-between gap-3 border-b border-[var(--line)] py-2.5 last:border-0"
                      >
                        <span className="min-w-0">
                          <span className="block truncate text-[0.84rem]">
                            {entry.product.name}
                          </span>
                          <span className="tabular block truncate text-[0.7rem] text-[var(--muted)]">
                            {entry.lot.code} · {entry.lot.remainingQuantity} {entry.product.unit}
                          </span>
                        </span>
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm"
                          onClick={() => onScanProduct(entry.product.id)}
                        >
                          {t("Ouvrir")}
                        </button>
                      </li>
                    ))
                  )}
                </ul>
              </div>
            ) : null}
          </div>
        </section>

        {/* Result */}
        <section className="flex flex-col gap-5">
          <div key={lot?.id} className="card swap p-6">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <Eyebrow>{unknownScan ? t("QR inconnu") : t("Résultat")}</Eyebrow>
                <h2 className="display mt-2 truncate text-2xl">
                  {unknownScan ? t("QR inconnu") : product?.name}
                </h2>
                <p className="tabular mt-1 text-[0.82rem] text-[var(--muted)]">
                  {lot?.code ?? t("Aucune fiche lot")}
                </p>
                {lot && !unknownScan ? (
                  <p className="tabular mt-1 text-[0.78rem] text-[var(--muted)]">
                    {t("Récept.")} {formatDate(lot.receivedAt)}
                    {" · "}
                    {t("Exp.")} {formatDate(lot.expirationDate)}
                  </p>
                ) : null}
              </div>
              {lot ? <LotStatusChip status={lot.status} /> : null}
            </div>

            {lot && !unknownScan ? (
              <div className="mt-5 flex items-baseline gap-3">
                <span className="numeric text-[2.4rem] leading-none">
                  {lot.remainingQuantity}
                </span>
                <span className="text-sm text-[var(--muted)]">
                  / {lot.initialQuantity} {t("portions")}
                  {product?.unit ? ` (${product.unit})` : ""}
                </span>
                {product ? (
                  <span className="ml-auto">
                    <StatusChip status={product.status} />
                  </span>
                ) : null}
              </div>
            ) : null}

            {/* Decision */}
            <div
              className={`mt-5 flex items-center gap-3 rounded-[2px] px-4 py-3 text-[0.84rem] ${
                decision.severity === "ok"
                  ? "border border-[var(--line-strong)] text-[var(--muted)]"
                  : decision.severity === "warning"
                    ? "border border-[var(--ink)] text-[var(--ink)]"
                    : "bg-[var(--ink)] text-[var(--bg)]"
              }`}
            >
              <CircleAlert size={16} strokeWidth={1.5} />
              <span>{t(decision.reason)}</span>
            </div>

            {/* Actions */}
            <div className="mt-5 flex flex-col gap-3">
              {decision.canExit ? (
                <div className="flex flex-col gap-2">
                  <span className="field-label mb-0">{t("Portions à sortir")}</span>
                  <div className="flex items-center gap-2">
                    {[1, 6, 12].map((value) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => setQuantityOut(value)}
                        className={`btn btn-sm ${quantityOut === value ? "btn-primary" : "btn-line"}`}
                      >
                        -{value}
                      </button>
                    ))}
                    <input
                      type="number"
                      min="1"
                      max={lot?.remainingQuantity ?? undefined}
                      value={quantityOut}
                      onChange={(e) =>
                        setQuantityOut(Math.max(1, Number(e.target.value) || 1))
                      }
                      className="input tabular w-20"
                      aria-label={t("Portions à sortir")}
                    />
                  </div>
                </div>
              ) : null}

              <div className="flex flex-wrap gap-2">
                {canAct ? (
                  <button
                    type="button"
                    className="btn btn-primary flex-1"
                    disabled={isSyncing || actionBlocked}
                    onClick={() => void runPrimaryAction()}
                  >
                    {isSyncing ? t("Synchronisation...") : t(decision.action)}
                  </button>
                ) : (
                  <button type="button" className="btn btn-line flex-1" disabled>
                    {t(decision.action)}
                  </button>
                )}
                <button
                  type="button"
                  className="btn btn-line"
                  disabled={!product}
                  onClick={() => product && onOpenProduct(product.id)}
                >
                  {t("Fiche")}
                  <ArrowUpRight size={14} strokeWidth={1.5} />
                </button>
              </div>

              {decision.olderLot ? (
                <p className="text-[0.78rem] text-[var(--muted)]">
                  {t("Lot FEFO à utiliser en priorité.")} {decision.olderLot.code} ·{" "}
                  {formatDate(decision.olderLot.expirationDate)}
                </p>
              ) : null}

              {actionFeedback ? (
                <p className="text-[0.82rem] text-[var(--ink-soft)]">{t(actionFeedback)}</p>
              ) : null}
            </div>
          </div>

          {/* Suggestions */}
          <div className="card p-6">
            <Eyebrow>{t("À scanner ensuite")}</Eyebrow>
            {suggestions.length === 0 ? (
              <p className="mt-3 text-[0.8rem] text-[var(--muted)]">{t("Sous contrôle")}</p>
            ) : (
              <ul className="mt-3 flex flex-col">
                {suggestions.map((suggestion) => (
                  <li
                    key={suggestion.id}
                    className="flex items-center justify-between gap-3 border-b border-[var(--line)] py-3 last:border-0"
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-[0.86rem]">{suggestion.name}</span>
                      <span className="tabular block text-[0.72rem] text-[var(--muted)]">
                        {suggestion.quantity} {suggestion.unit}
                      </span>
                    </span>
                    <div className="flex items-center gap-2">
                      <StatusChip status={suggestion.status} />
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        onClick={() => onOpenProduct(suggestion.id)}
                      >
                        {t("Voir")}
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
