"use client";

/**
 * Bilingual (French / English) support for the Le Carré web app.
 *
 * WHY: the whole UI was hardcoded in French. The user asked for the app to
 * support both English and French. WHEN: added during the "fix frontend +
 * make it usable + bilingual" pass.
 *
 * DESIGN:
 *  - French stays the *canonical* language: the data stored in the database
 *    (statuses, roles, movement types, ...) keeps its French values, and the
 *    French string is used as the translation KEY. This means:
 *      1. Any string not yet translated falls back to French automatically.
 *      2. The source code stays readable (you see the real French text, not an
 *         opaque key like "scan.error.camera").
 *  - `t(frenchString)` returns the French string when the language is "fr"
 *    (identity) and the English translation when the language is "en".
 *  - The chosen language is persisted in localStorage so it survives reloads.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type Language = "fr" | "en";

const STORAGE_KEY = "lecarre.lang";

// French source string -> English translation.
// Keys MUST match the exact French text used at the call site (same accents
// and punctuation). Apostrophes are written as real "'" (not the &apos; HTML
// entity) because the strings are passed through JS, not parsed as JSX text.
const EN: Record<string, string> = {
  // --- Domain: stock status ---
  Stable: "Stable",
  "Seuil bas": "Low threshold",
  Critique: "Critical",
  "Bientôt expiré": "Expiring soon",
  Expiré: "Expired",
  // --- Domain: batch (lot) status ---
  "En réserve": "In reserve",
  "En service": "In service",
  "Bientôt épuisé": "Running low",
  Épuisé: "Depleted",
  // --- Domain: alert type ---
  "Stock critique": "Critical stock",
  "Produit expiré": "Expired product",
  "Produit bientôt expiré": "Product expiring soon",
  // --- Domain: priority / severity ---
  Attention: "Attention",
  Urgent: "Urgent",
  Bloquant: "Blocking",
  Bloquantes: "Blocking",
  Urgentes: "Urgent",
  // --- Domain: roles ---
  Admin: "Admin",
  Gestionnaire: "Manager",
  Agent: "Agent",
  // --- Domain: user status ---
  "En attente": "Pending",
  Actif: "Active",
  Refusé: "Rejected",
  Désactivé: "Disabled",
  // --- Domain: category mode ---
  "FEFO strict": "FEFO strict",
  "Multi-lots": "Multi-batch",
  Standard: "Standard",
  // --- Domain: movement type ---
  Entrée: "Inbound",
  Sortie: "Outbound",
  Activation: "Activation",
  Correction: "Correction",
  // --- Domain: delivery status ---
  Brouillon: "Draft",
  Validée: "Validated",
  Annulée: "Cancelled",
  // --- Seed category names ---
  Tous: "All",
  Toutes: "All",
  Viande: "Meat",
  Poisson: "Fish",
  Boissons: "Beverages",
  "Produits secs": "Dry goods",
  Conserves: "Canned goods",

  // --- Navigation / sections ---
  Dashboard: "Dashboard",
  Livraison: "Delivery",
  Stock: "Stock",
  Scan: "Scan",

  // --- Auth / login ---
  "Le Carré": "Le Carré",
  "Connexion au système interne": "Sign in to the internal system",
  Connexion: "Sign in",
  Demande: "Request",
  Nom: "Name",
  "Votre nom": "Your name",
  "E-mail": "E-mail",
  Email: "Email",
  "Entrez votre adresse e-mail": "Enter your e-mail address",
  "Mot de passe": "Password",
  "Entrez votre mot de passe": "Enter your password",
  "Afficher le mot de passe": "Show password",
  "Masquer le mot de passe": "Hide password",
  "Rôle demandé": "Requested role",
  "Mode d'accès": "Access mode",
  "Envoi...": "Sending...",
  "Vérification...": "Verifying...",
  "Envoyer la demande": "Send the request",
  "Se connecter": "Sign in",
  "Connexion refusée.": "Login refused.",
  "Déconnecté après une période d'inactivité.":
    "Signed out after a period of inactivity.",
  "Session expirée. Veuillez vous reconnecter.":
    "Session expired. Please log in again.",
  "lot": "batch",
  "Supprimer la catégorie": "Delete the category",
  "Supprimer le compte": "Delete the account",
  "Supprimer définitivement le compte de": "Permanently delete the account of",
  "La catégorie contient encore des produits.": "The category still has products.",

  // --- Branding (restaurant name) + database wipe (settings panel) ---
  "Identité": "Identity",
  "Nom du restaurant": "Restaurant name",
  "Ce nom s'affiche sur l'écran de connexion, la barre supérieure et les étiquettes. Laissez-le par défaut ou personnalisez-le.":
    "This name appears on the login screen, the top bar and the labels. Keep the default or customize it.",
  "Restaurer le nom par défaut": "Restore the default name",
  "Nom requis.": "Name required.",
  "Nom enregistré.": "Name saved.",
  "Nom par défaut restauré.": "Default name restored.",
  "Mise à jour impossible.": "Update failed.",
  "Zone sensible": "Danger zone",
  "Réinitialiser la base": "Reset the database",
  "Supprime tous les produits, lots, mouvements, livraisons, catégories, fournisseurs et alertes, ainsi que les comptes non-admin. Les comptes administrateurs sont conservés. Action irréversible.":
    "Deletes all products, batches, movements, deliveries, categories, suppliers and alerts, as well as non-admin accounts. Administrator accounts are kept. This cannot be undone.",
  "Tapez": "Type",
  "pour confirmer": "to confirm",
  "Base réinitialisée. Comptes admin conservés.": "Database reset. Admin accounts kept.",
  "Réinitialisation impossible.": "Reset failed.",
  "Demande envoyée. Un admin doit approuver le compte.":
    "Request sent. An admin must approve the account.",
  "Demande non envoyée.": "Request not sent.",

  // --- Top bar / general chrome ---
  "Carnet économat": "Steward ledger",
  Économat: "Steward office",
  "Base restaurant": "Restaurant base",
  Connecté: "Connected",
  "Non connecté": "Not connected",
  "Hors ligne": "Offline",
  Serveur: "Server",
  "Serveur hors ligne": "Server offline",
  "Serveur local visible": "Local server visible",
  LOCAL: "LOCAL",
  Alertes: "Alerts",
  Utilisateurs: "Users",
  Paramètres: "Settings",
  Profil: "Profile",
  "Profil utilisateur": "User profile",
  Déconnexion: "Sign out",
  Fermer: "Close",
  "Fermer le panneau": "Close the panel",
  Ouvrir: "Open",
  Réduire: "Collapse",

  // --- Generic actions / labels ---
  Ajouter: "Add",
  "Ajouter une ligne": "Add a line",
  Annuler: "Cancel",
  Enregistrer: "Save",
  "Enregistrement...": "Saving...",
  Créer: "Create",
  Création: "Creation",
  Modifier: "Edit",
  Supprimer: "Delete",
  Copier: "Copy",
  "Lien copié.": "Link copied.",
  "Copie impossible.": "Copy failed.",
  Exporter: "Export",
  "Export CSV": "CSV export",
  Restaurer: "Restore",
  Réinitialiser: "Reset",
  Régénérer: "Regenerate",
  Rechercher: "Search",
  Recherche: "Search",
  Approuver: "Approve",
  Refuser: "Reject",
  Bloquer: "Block",
  Désactiver: "Disable",
  Réactiver: "Reactivate",
  Activer: "Activate",
  Valider: "Validate",
  Traiter: "Process",
  Lire: "Read",
  Ouverture: "Opening",
  Date: "Date",
  Contact: "Contact",
  "Aucun contact": "No contact",
  Téléphone: "Phone",
  Mode: "Mode",
  État: "Status",
  Statut: "Status",
  Total: "Total",
  Résultat: "Result",
  Disponible: "Available",
  Actuel: "Current",
  Nouveau: "New",
  Erreur: "Error",
  "Action impossible.": "Action failed.",
  Zoom: "Zoom",
  Horizontal: "Horizontal",
  Vertical: "Vertical",

  // --- Theme / appearance ---
  Apparence: "Appearance",
  Clair: "Light",
  Sombre: "Dark",
  Auto: "Auto",
  Système: "System",
  Matin: "Morning",
  Midi: "Noon",
  Soir: "Evening",
  Nuit: "Night",

  // --- Alerts panel ---
  "Alertes seuil": "Threshold alerts",
  Priorité: "Priority",
  Priorités: "Priorities",
  "Priorité opérationnelle": "Operational priority",
  "File d'intervention": "Action queue",
  "File d’attention": "Watch queue",
  "Ce qui demande une décision ou une vérification.":
    "What needs a decision or a check.",
  "Voir alertes": "View alerts",
  "Voir tout": "View all",
  Décision: "Decision",
  "Prochaine action": "Next action",
  "Activer lot": "Activate batch",

  // --- Users / permissions panel ---
  Comptes: "Accounts",
  "Approuver comptes": "Approve accounts",
  "Gérer utilisateurs": "Manage users",
  "Gérer catégories": "Manage categories",
  "Accès et permissions": "Access and permissions",
  "Permissions personnalisées": "Custom permissions",
  Droits: "Rights",
  droits: "rights",
  "Droits actifs": "Active rights",
  Rôle: "Role",
  "L’admin conserve l’accès complet par défaut.":
    "The admin keeps full access by default.",
  "Modifier stock": "Edit stock",
  "Modifier lots": "Edit batches",
  "Modifier seuils": "Edit thresholds",
  "Modifier expirations": "Edit expirations",
  "Valider livraisons": "Validate deliveries",

  // --- Settings panel ---
  "Réglages métier": "Business settings",
  "Nouvelle catégorie": "New category",
  "Nom de la catégorie": "Category name",
  "Catégorie créée.": "Category created.",
  "Catégorie non créée.": "Category not created.",
  "Nom de catégorie requis.": "Category name required.",
  "Une catégorie porte déjà ce nom.": "A category already has this name.",
  "Mode de gestion": "Management mode",
  "Catégorie active": "Active category",
  "Seuil catégorie": "Category threshold",
  "Seuil produit": "Product threshold",
  "Seuils stock": "Stock thresholds",
  "Seuil de bascule": "Switch threshold",
  "Niveau critique": "Critical level",
  "Expiration auto": "Auto expiration",
  "Règle enregistrée.": "Rule saved.",
  "Réglage impossible.": "Setting failed.",
  Règle: "Rule",
  "Règles actives": "Active rules",
  "Règles mixtes": "Mixed rules",
  "Le seuil catégorie est appliqué aux produits existants de cette catégorie.":
    "The category threshold is applied to existing products in this category.",
  "Quand un lot en service arrive à ce niveau, l'app suggère d'activer un autre lot sans attendre zéro.":
    "When an in-service batch reaches this level, the app suggests activating another batch without waiting for zero.",
  "Sauvegarde locale": "Local backup",
  "Sauvegarde impossible.": "Backup failed.",
  "Restauration impossible.": "Restore failed.",
  "La restauration remplace les produits, lots, utilisateurs, livraisons et mouvements par ceux du fichier choisi.":
    "Restoring replaces the products, batches, users, deliveries and movements with those from the chosen file.",
  "Accès téléphone": "Phone access",
  "Adresse réseau en attente": "Network address pending",
  "Adresse téléphone indisponible.": "Phone address unavailable.",
  "HTTPS requis": "HTTPS required",
  "Mode iPad paysage requis": "iPad landscape mode required",
  "Tournez l'iPad pour garder l'interface large.":
    "Rotate the iPad to keep the interface wide.",

  // --- Suppliers ---
  Fournisseur: "Supplier",
  Fournisseurs: "Suppliers",
  "Fiche fournisseur": "Supplier record",
  "Statut fournisseur non modifié.": "Supplier status not changed.",
  "Ajouter un fournisseur": "Add a supplier",
  "Nouveau fournisseur": "New supplier",
  "Nom fournisseur": "Supplier name",
  "Statut fournisseur": "Supplier status",
  "Fournisseur non ajouté.": "Supplier not added.",
  "Fournisseur non enregistré.": "Supplier not saved.",
  "Marché Central": "Central Market",

  // --- Profile panel ---
  "Changer photo": "Change photo",
  "Aperçu photo": "Photo preview",
  "Rogner la photo": "Crop the photo",
  "Mot de passe non modifié.": "Password not changed.",
  "Modifications non enregistrées.": "Unsaved changes.",
  "Aucune modification à appliquer.": "No change to apply.",

  // --- Dashboard ---
  "Activité récente": "Recent activity",
  "Derniers gestes": "Latest actions",
  "Couverture stock": "Stock coverage",
  "Stock sous contrôle": "Stock under control",
  "Sous contrôle": "Under control",
  Ensemble: "Overall",
  "Lots ouverts": "Open batches",
  "Lots en service": "Batches in service",
  "Lots en réserve": "Batches in reserve",
  "Cycle lots": "Batch cycle",
  "Prochaine expiration": "Next expiration",
  Prévoir: "Plan ahead",
  "À surveiller": "To watch",
  "À suivre": "To follow",
  "À valider": "To validate",
  "À vérifier": "To check",
  "À compléter": "To complete",
  "À scanner ensuite": "To scan next",
  "À jour": "Up to date",
  "À jour.": "Up to date.",
  "Afficher les produits à surveiller": "Show products to watch",

  // --- Delivery view ---
  Réception: "Receiving",
  "Nouvelle réception": "New receiving",
  "Contrôle réception": "Receiving control",
  "Date de livraison": "Delivery date",
  "Livraisons du jour": "Today's deliveries",
  "Livraison validée": "Delivery validated",
  "Livraison non validée.": "Delivery not validated.",
  Référence: "Reference",
  "Nouvelle référence": "New reference",
  "Régénérer la référence": "Regenerate the reference",
  "Référence déjà utilisée : générer une nouvelle référence.":
    "Reference already used: generate a new reference.",
  "Fournisseur, référence et date sont requis.":
    "Supplier, reference and date are required.",
  "Choisir ou saisir": "Choose or enter",
  "Choisir un fournisseur": "Choose a supplier",
  "Ajoute un produit pour préparer les lots.":
    "Add a product to prepare batches.",
  "Aucune ligne complète à valider.": "No complete line to validate.",
  "Sélectionnez un fournisseur.": "Select a supplier.",
  "Référence et date requises.": "Reference and date required.",
  "Complétez une ligne : produit, unité, quantité, lot.":
    "Complete a line: product, unit, quantity, batch.",
  "Valider et créer les lots": "Validate and create the batches",
  "Validation...": "Validating...",
  Lignes: "Lines",
  "Lots préparés": "Prepared batches",
  Imprimable: "Printable",
  "Expiration saisie en livraison.": "Expiration entered at delivery.",
  "Ces informations alimentent la livraison et l'historique.":
    "This information feeds the delivery and the history.",
  "Eau plate 50 cl": "Still water 50 cl",
  "Filet de boeuf": "Beef fillet",
  "Viande, poisson": "Meat, fish",
  "Conserves, produits secs": "Canned and dry goods",
  "Expiration J+3": "Expiration D+3",
  "J+3 appliqué si viande ou poisson": "D+3 applied if meat or fish",

  // --- QR label / printing ---
  "Étiquettes QR": "QR labels",
  "Imprimer QR": "Print QR",
  "Copies par lot": "Copies per batch",
  "Impression navigateur": "Browser printing",
  Impression: "Printing",
  "Le Carré · lot": "Le Carré · batch",
  "Lot généré": "Batch generated",
  "Pas de QR par unité : uniquement des duplicatas d'étiquette.":
    "No QR per unit: only label duplicates.",
  "1 étiquette par lot physique": "1 label per physical batch",

  // --- Stock view ---
  "Lecture stock": "Stock reading",
  "Carte stock": "Stock map",
  "Correction stock": "Stock correction",
  "Index produits": "Product index",
  "Produits visibles": "Visible products",
  "Aucun produit visible": "No visible product",
  "Répartition du stock par produit": "Stock breakdown by product",
  "Répartition par produit": "Breakdown by product",
  "La recherche ou le statut isole trop le stock.":
    "The search or status filters the stock too narrowly.",
  "Réessayer ou rechercher": "Retry or search",
  Quantité: "Quantity",
  "Quantité restante": "Remaining quantity",
  "Quantité totale": "Total quantity",
  Restant: "Remaining",
  Reçu: "Received",
  Unité: "Unit",
  Qté: "Qty",
  Catégorie: "Category",
  Produit: "Product",
  Produits: "Products",
  "Produit actif": "Active product",
  "PRODUIT ACTIF": "ACTIVE PRODUCT",
  "Produit, lot, catégorie": "Product, batch, category",
  "Fiche produit": "Product record",
  "Réduire la fiche produit": "Collapse the product record",
  Seuil: "Threshold",
  Expiration: "Expiration",
  "Aucune expiration": "No expiration",
  "Expire bientôt": "Expiring soon",
  Bientôt: "Soon",
  "Enregistrer correction": "Save correction",
  "Supprimer le lot": "Delete batch",
  "Supprimer le produit": "Delete product",
  "Supprimer ce lot ?": "Delete this batch?",
  "Supprimer ce produit ?": "Delete this product?",
  "Lot supprimé.": "Batch deleted.",
  "Produit supprimé.": "Product deleted.",
  "Suppression impossible.": "Deletion failed.",
  "Impossible de supprimer : le produit a un historique.":
    "Cannot delete: the product has history.",
  "Correction enregistrée et tracée.": "Correction saved and logged.",
  "Correction impossible.": "Correction failed.",
  "Sortie enregistrée.": "Outbound saved.",
  "Sorties du jour": "Today's outbound",
  Traçabilité: "Traceability",
  "État du lot": "Batch status",
  "Lot mis en service.": "Batch put into service.",
  "Lot introuvable.": "Batch not found.",
  Réserve: "Reserve",
  Service: "Service",

  // --- Lots / batches ---
  Lot: "Batch",
  Lots: "Batches",
  "Aucun lot ouvert": "No open batch",
  "Aucun lot trouvé.": "No batch found.",
  "Aucune fiche": "No record",
  "Aucune fiche lot": "No batch record",
  Fiche: "Record",
  "Recherche lot": "Batch search",

  // --- Scan view ---
  "Mode de scan": "Scan mode",
  "Mode scan": "Scan mode",
  "Lecture lot": "Batch reading",
  "Lecture avant validation": "Read before validation",
  "Lecture visuelle": "Visual reading",
  "Lecture manuelle": "Manual reading",
  Lecture: "Reading",
  "Lecture...": "Reading...",
  "Lecture en cours...": "Reading in progress...",
  "Lecture de la photo...": "Reading the photo...",
  "Lecture impossible.": "Reading failed.",
  "Lecture photo impossible.": "Photo reading failed.",
  "Lecture image indisponible.": "Image reading unavailable.",
  "Lecture caméra interrompue.": "Camera reading interrupted.",
  Écoute: "Listening",
  Scanner: "Scan",
  Scans: "Scans",
  "Scans du jour": "Today's scans",
  "Scanner 1er lot": "Scan 1st batch",
  "Scanner USB non connecté": "USB scanner not connected",
  "Scanner non détecté": "Scanner not detected",
  "Entrée USB": "USB input",
  "Entrée USB en attente": "USB input pending",
  "Entrée manuelle": "Manual entry",
  "Code QR manuel": "Manual QR code",
  "Code QR illisible.": "Unreadable QR code.",
  "Code scanner": "Scanner code",
  "Saisir le code du lot manuellement.": "Enter the batch code manually.",
  "Saisir le code manuellement.": "Enter the code manually.",
  "Photo QR": "QR photo",
  "File QR": "QR queue",
  "QR détecté.": "QR detected.",
  "QR inconnu": "Unknown QR",
  "QR non référencé": "Unreferenced QR",
  "QR préparé": "QR prepared",
  "Aucun QR lisible sur la photo.": "No readable QR in the photo.",
  "Aucun code reçu.": "No code received.",
  "Aucune entrée détectée": "No input detected",
  "Image illisible.": "Unreadable image.",
  "Importer ou prendre une photo QR quand la caméra directe est bloquée.":
    "Import or take a QR photo when the direct camera is blocked.",
  "Secours si QR abîmé ou caméra indisponible":
    "Fallback if QR damaged or camera unavailable",
  "Secours si la caméra directe est bloquée.":
    "Fallback if the direct camera is blocked.",
  Réessayer: "Retry",
  "Scanner 1er lot ": "Scan 1st batch ",

  // --- Camera ---
  Caméra: "Camera",
  "Caméra active.": "Camera active.",
  "Caméra arrêtée": "Camera stopped",
  Arrêtée: "Stopped",
  "Caméra en écoute.": "Camera listening.",
  "Caméra indisponible": "Camera unavailable",
  "Caméra indisponible.": "Camera unavailable.",
  "Caméra indisponible sur cet appareil.": "Camera unavailable on this device.",
  "Caméra active, détection QR non disponible.":
    "Camera active, QR detection unavailable.",
  "Caméra bloquée : HTTPS requis sur téléphone.":
    "Camera blocked: HTTPS required on phone.",
  "Caméra téléphone autorisée. Le scan peut utiliser USB, caméra ou saisie manuelle.":
    "Phone camera allowed. Scanning can use USB, camera or manual entry.",
  "Accès caméra refusé.": "Camera access denied.",
  "Autorisation bloquée": "Permission blocked",
  "Autorisation caméra en attente.": "Camera permission pending.",
  "Ouverture caméra...": "Opening camera...",
  "En HTTP sur téléphone, la caméra peut être bloquée. USB et saisie manuelle restent disponibles.":
    "On HTTP on a phone, the camera may be blocked. USB and manual entry remain available.",
  "Sur téléphone, le navigateur bloque la caméra en HTTP. Utiliser HTTPS, USB ou saisie manuelle.":
    "On a phone, the browser blocks the camera over HTTP. Use HTTPS, USB or manual entry.",
  USB: "USB",
  Manuel: "Manual",
  Prêt: "Ready",
  Prête: "Ready",

  // --- stock-engine: alert messages (static) ---
  "Prévoir l'activation d'un nouveau lot.": "Plan the activation of a new batch.",
  "Lot FEFO à utiliser en priorité.": "FEFO batch to use first.",
  // --- stock-engine: business-decision action / reason (static) ---
  "Créer anomalie": "Create anomaly",
  "QR absent de la base": "QR not in the database",
  "Action bloquée": "Action blocked",
  "Lot expiré : sortie et activation interdites":
    "Batch expired: outflow and activation forbidden",
  "Activation refusée : un lot plus ancien doit être utilisé en priorité.":
    "Activation denied: an older batch must be used first.",
  "Quantité supérieure au restant": "Quantity exceeds remaining",
  "Mettre en service": "Put into service",
  "Lot conforme": "Batch compliant",
  "Enregistrer sortie": "Record outflow",
  "Lot faible : activer un autre lot": "Low batch: activate another batch",
  "Règles conformes": "Rules compliant",
  "Vérifier lot": "Check batch",
  "Aucune action directe pour ce statut": "No direct action for this status",
  // --- stock-engine: getCategoryRuleLabel ---
  standard: "standard",
  "multi-lots": "multi-batch",

  // --- Server / API response messages (returned by the Next.js API routes) ---
  "Identifiants incorrects.": "Incorrect credentials.",
  "Compte déjà connecté sur un autre appareil.":
    "Account already logged in on another device.",
  "Email et mot de passe requis.": "Email and password required.",
  "Compte en attente d’approbation admin.": "Account awaiting admin approval.",
  "Compte inactif ou introuvable.": "Account inactive or not found.",
  "Compte désactivé.": "Account disabled.",
  "Compte refusé.": "Account rejected.",
  "Compte créé": "Account created",
  "Compte mis à jour": "Account updated",
  "Un compte existe déjà avec cet email.":
    "An account already exists with this email.",
  "Rôle invalide.": "Invalid role.",
  "Utilisateur introuvable.": "User not found.",
  "Session utilisateur requise.": "User session required.",
  "Mot de passe actuel incorrect.": "Current password incorrect.",
  "Mot de passe mis à jour.": "Password updated.",
  "Mot de passe trop court.": "Password too short.",
  "Catégorie introuvable.": "Category not found.",
  "Fournisseur introuvable.": "Supplier not found.",
  "Nom fournisseur requis.": "Supplier name required.",
  "Un fournisseur porte déjà ce nom.": "A supplier already has this name.",
  "Produit ou lot introuvable.": "Product or batch not found.",
  "Quantite de sortie requise.": "Outflow quantity required.",
  "Statut de lot invalide.": "Invalid batch status.",
  "Sauvegarde Le Carré invalide.": "Invalid Le Carré backup.",
  "name est requis.": "name is required.",
  "name, email, password et role sont requis.":
    "name, email, password and role are required.",
  "productId est requis.": "productId is required.",
  "supplierId est requis.": "supplierId is required.",
  "userId est requis.": "userId is required.",
  "userId et action sont requis.": "userId and action are required.",
  "userId, currentPassword et newPassword sont requis.":
    "userId, currentPassword and newPassword are required.",
  "categoryId métier requis.": "Business categoryId required.",
  "lotId et type sont requis.": "lotId and type are required.",
  "supplier, reference, deliveredAt et lines sont requis.":
    "supplier, reference, deliveredAt and lines are required.",

  // --- Dynamic message fragments (composed inside template literals) ---
  "détecté.": "detected.",
  "Code lot répété dans la livraison :": "Batch code repeated in the delivery:",
  "Code lot déjà existant :": "Batch code already exists:",
  produits: "products",
  lots: "batches",
  "lots.": "batches.",
  "lots sauvegardés.": "batches saved.",
  "Base restaurée :": "Database restored:",
  catégories: "categories",
  catégorie: "category",
  "ajouté.": "added.",
  "mis à jour.": "updated.",
  "réactivé.": "reactivated.",
  "désactivé.": "deactivated.",
  "lots créés": "batches created",
  "à approuver": "to approve",
  "Ouvrir la fiche": "Open the record",
  "Dernier lot :": "Last batch:",
  "Le niveau critique impose une lecture immédiate du détail.":
    "The critical level calls for reading the detail immediately.",
  "entrée validée au serveur": "entry validated on the server",
  "lots dans cette réception.": "batches in this delivery.",
  urgences: "urgent",
  "à surveiller": "to watch",
  visibles: "visible",
  "produits visibles": "visible products",
  "Crit.": "Crit.",
  restant: "remaining",
  Imprimer: "Print",
  "lot créé": "batch created",
  "QR prêts pour impression et scan.": "QR codes ready for printing and scanning.",

  // --- Misc state words ---
  Détail: "Detail",
  "non définie": "not set",
  "lot à confirmer": "batch to confirm",
  "unités sorties": "units out",
  expiration: "expiration",
  prêt: "ready",
  prêtes: "ready",
  "à confirmer": "to confirm",
  "à dater": "to date",
  "à générer": "to generate",
  "à valider": "to validate",
  "à vérifier": "to check",
  "Exp.": "Exp.",
  "Livr.": "Deliv.",
  // --- redesign components ---
  Charger: "Load",
  "Synchronisation...": "Synchronizing...",
  Voir: "View",
  activations: "activations",
  ouverts: "open",
  urgentes: "urgent",
};

// Alert messages built by the stock engine sometimes interpolate a product
// name or batch code (e.g. "Filet de boeuf sous seuil critique."). These can't
// be exact dictionary keys, so they are matched by pattern and rebuilt in
// English, preserving the dynamic part. The engine keeps emitting French
// (it is shared with the backend), so translation happens only at render.
const MESSAGE_PATTERNS: Array<[RegExp, (m: RegExpMatchArray) => string]> = [
  [/^(.*) sous seuil critique\.$/, (m) => `${m[1]} below critical threshold.`],
  [/^(.*) proche du seuil\.$/, (m) => `${m[1]} near threshold.`],
  [/^(.*) expiré, sortie bloquée\.$/, (m) => `${m[1]} expired — outflow blocked.`],
  [/^(.*) arrive bientôt à expiration\.$/, (m) => `${m[1]} expiring soon.`],
];

type I18nContextValue = {
  lang: Language;
  setLang: (lang: Language) => void;
  toggle: () => void;
  t: (fr: string) => string;
  /** Translate a (possibly interpolated) message produced by the stock engine. */
  tm: (fr: string) => string;
};

const I18nContext = createContext<I18nContextValue | null>(null);

// Module-level mirror of the active language, kept in sync by the provider on
// every render. WHY: helper functions like formatDate() are not React
// components and cannot call the useI18n() hook, but they still need to know
// the language to localize dates. Because almost every component now consumes
// the i18n context, a language switch re-renders the tree and these helpers are
// re-invoked with the updated value. WHEN: added with the bilingual pass.
let activeLanguage: Language = "fr";

/** Intl locale string for the active language (e.g. for Intl.DateTimeFormat). */
export function activeLocale(): string {
  return activeLanguage === "en" ? "en-GB" : "fr-FR";
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  // Default to French (the canonical language). The persisted choice is read
  // in an effect so the server-rendered HTML and the first client render match
  // (localStorage is not available during SSR).
  const [lang, setLangState] = useState<Language>("fr");

  // Keep the module-level mirror in sync with the rendered language so
  // non-component helpers (formatDate, ...) localize correctly on the same
  // render that switches language.
  activeLanguage = lang;

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved === "en" || saved === "fr") setLangState(saved);
    } catch {
      // localStorage may be unavailable (private mode); keep the default.
    }
  }, []);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const setLang = useCallback((next: Language) => {
    setLangState(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // ignore persistence failures
    }
  }, []);

  const toggle = useCallback(() => {
    setLangState((current) => {
      const next = current === "fr" ? "en" : "fr";
      try {
        window.localStorage.setItem(STORAGE_KEY, next);
      } catch {
        // ignore persistence failures
      }
      return next;
    });
  }, []);

  // t() translates a French string. It first tries the exact dictionary, then
  // the interpolated-message patterns (so engine/server messages that embed a
  // product name or code still translate), then falls back to the French text.
  const t = useCallback(
    (fr: string) => {
      if (lang !== "en" || !fr) return fr;
      if (EN[fr]) return EN[fr];
      for (const [pattern, build] of MESSAGE_PATTERNS) {
        const match = fr.match(pattern);
        if (match) return build(match);
      }
      return fr;
    },
    [lang],
  );

  // tm is kept as an alias of t for call sites that translate engine messages.
  const tm = t;

  const value = useMemo(
    () => ({ lang, setLang, toggle, t, tm }),
    [lang, setLang, toggle, t, tm],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const value = useContext(I18nContext);

  if (!value) {
    throw new Error("useI18n must be used within a LanguageProvider");
  }

  return value;
}
