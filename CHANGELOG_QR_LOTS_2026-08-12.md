# Changements — QR lots (portions) — 12 août 2026

Inventaire des modifications réalisées dans les **dernières 24 h** (session web, scope B).  
État au moment de la rédaction : **non commités** (working tree).

---

## Objectif produit

Passer clairement au modèle **1 QR = 1 lot de portions** (plus 1 QR par unité), côté **web uniquement** :

- étiquette QR enrichie (produit, portions, expiration, réception) ;
- scan → saisir le nombre de **portions** à sortir ;
- archiver l’app mobile ;
- simplifier la livraison (plus d’unité visible, plus de lignes démo au démarrage) ;
- corriger l’impression multi-pages.

Les QR frigos / emplacements sont **reportés** (hors scope).

---

## 1. Archivage de l’app mobile

**Pourquoi :** ne maintenir que la web app ; le dossier Expo ne doit plus être dans le flux actif.

| Action | Détail |
|--------|--------|
| Renommage | `mobile/` → `mobile_archive/` |
| Marqueur | `mobile_archive/ARCHIVED.md` (dossier archivé, ne pas déployer) |
| TypeScript | `tsconfig.json` : exclusion de `mobile_archive` pour ne pas casser `tsc` |

**Fichiers touchés :**

- tout l’ancien arbre `mobile/**` (supprimé / déplacé)
- tout le nouvel arbre `mobile_archive/**` (+ `ARCHIVED.md`)
- [`tsconfig.json`](tsconfig.json)

---

## 2. Étiquette QR lot (livraison)

**Pourquoi :** une étiquette doit décrire un **lot de portions**, pas une unité isolée.

| Avant | Après |
|-------|--------|
| Qté + unité libre (`litre`, `kg`…) | Libellé **Portions** + nombre seul |
| Pas de date de réception | **Récept.** affichée |
| — | Expiration + lot inchangés |
| Payload | Toujours `lecarre://lot/<CODE>` |
| Copies | Duplicatas du **même** QR (pas 1 QR / unité) |

**Fichiers touchés :**

- [`src/components/delivery/QrLabel.tsx`](src/components/delivery/QrLabel.tsx)
- [`src/components/delivery/DeliveryView.tsx`](src/components/delivery/DeliveryView.tsx)
- [`src/lib/i18n.tsx`](src/lib/i18n.tsx) (clés `Portions`, `Récept.`, etc.)

---

## 3. Scan / sortie en portions

**Pourquoi :** après scan du QR lot, l’opérateur indique **combien de portions** il retire, puis confirme.

| Changement | Détail |
|------------|--------|
| Dates | Affiche **réception** + **expiration** |
| Stock | Restant / initial en **portions** |
| Action | Libellé **« Portions à sortir »** (à la place de « Qté ») |
| Logique métier | Inchangée (`quantityOut` + mouvement de sortie) |

**Fichiers touchés :**

- [`src/components/scan/ScanView.tsx`](src/components/scan/ScanView.tsx)
- [`src/lib/i18n.tsx`](src/lib/i18n.tsx)

---

## 4. Livraison : plus de champ Unité + plus de produits auto

**Pourquoi :**

- l’unité produit (`litre`, `kg`…) **perd son sens** dans un stock en portions ;
- le format utile (ex. `Casamancaise 1L`) doit aller dans le **nom du produit**, pas dans un champ unité ;
- les 2 lignes démo (`Filet de boeuf`, `Eau plate 50 cl`) polluaient chaque démarrage.

| Changement | Détail |
|------------|--------|
| UI | Champ **Unité** retiré du formulaire livraison |
| Donnée interne | `unit` forcé à `"portion"` à la validation / sélection produit |
| Démarrage | 1 ligne **vide** (plus de seed de 2 produits) |
| Seuil | **Oui** : si le produit existe déjà (nom exact), le seuil s’auto-remplit depuis le catalogue |

**Fichiers touchés :**

- [`src/app/page.tsx`](src/app/page.tsx) — suppression de `createInitialDeliveryLines`, `unit: "portion"`, ligne vide initiale
- [`src/components/delivery/DeliveryView.tsx`](src/components/delivery/DeliveryView.tsx)
- [`src/lib/i18n.tsx`](src/lib/i18n.tsx)

**Non fait (volontairement) :** suppression de la colonne `unit` en base Django — trop invasif (articles, mouvements, stock UI, alertes). La colonne reste, figée métier à `portion`.

---

## 5. Impression QR : pages blanches en trop

**Pourquoi :** l’ancien CSS print utilisait `visibility: hidden` sur tout le body. Les éléments restaient dans la pagination → plusieurs **pages blanches** (souvent ~4) en plus des étiquettes.

| Correction | Détail |
|------------|--------|
| CSS print | `display: none` sur le reste de l’app ; seule `.qr-label-grid` s’imprime |
| Bouton « Scanner » | Masqué à l’impression sur les cartes QR |

**Fichiers touchés :**

- [`src/app/globals.css`](src/app/globals.css) (bloc `@media print`)

---

## 6. Décisions reportées (hors scope de cette session)

- QR frigo / emplacements (`StorageLocation`)
- Emplacement fixe par produit (économe)
- Suppression DB de l’attribut `unit`
- Toute évolution mobile (dossier archivé)

---

## Récapitulatif des fichiers (session)

### Modifiés (web)

| Fichier | Rôle du changement |
|---------|-------------------|
| `src/components/delivery/QrLabel.tsx` | Étiquette : portions, réception ; plus d’unité affichée |
| `src/components/delivery/DeliveryView.tsx` | Plus de champ unité ; `portion` ; date réception vers le label |
| `src/components/scan/ScanView.tsx` | UX portions à sortir + dates |
| `src/app/page.tsx` | Plus de seed 2 produits ; validation `unit: "portion"` |
| `src/lib/i18n.tsx` | Nouvelles clés FR/EN |
| `src/app/globals.css` | Fix impression QR |
| `tsconfig.json` | Exclude `mobile_archive` |

### Archivés / déplacés

| Chemin | Rôle |
|--------|------|
| `mobile/` → `mobile_archive/` | App Expo mise de côté |
| `mobile_archive/ARCHIVED.md` | Notice d’archivage |

### Artefact / hors sujet éventuel

| Fichier | Note |
|---------|------|
| `tsconfig.tsbuildinfo` | Cache TypeScript (généré) |
| `src/components/ui/kit.tsx` | Diff présent dans le working tree (menus / selects) — **pas** le cœur du chantier QR lots ; à vérifier avant commit si ce n’était pas voulu dans la même session locale |

---

## Workflow cible (rappel)

```text
Livraison → 1 lot de portions → 1 QR lot
    → Scan QR → fiche lot (récept. / exp. / stock)
    → Saisir N portions → confirmer → stock décrémenté
```

Exemple : 30 poissons → 1 lot → 1 QR → scan → sortir 5 portions → reste 25.

---

## Suite possible

1. Commit dédié (ex. branche `cursor/qr-lot-portions-web`)
2. Smoke-test manuel : livraison → impression → scan → sortie
3. Plus tard : QR frigos + emplacement fixe produit
4. Plus tard (optionnel) : migration DB pour retirer `unit` si plus aucun écran ne s’en sert
