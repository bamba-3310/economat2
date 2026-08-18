# Plan de modification - Déplacement du bouton "Ajouter une ligne"

## Contexte
Le bouton "Ajouter une ligne" dans l'onglet livraison est actuellement positionné en haut de la liste des produits, ce qui oblige l'utilisateur à remonter en haut de la page à chaque fois qu'il souhaite ajouter un nouveau produit.

## Objectif
Déplacer le bouton "Ajouter une ligne" en bas de la liste des produits pour améliorer l'expérience utilisateur en évitant de devoir scroller vers le haut.

## Fichier concerné
- `src/components/delivery/DeliveryView.tsx`

## Modification à effectuer

### Position actuelle (lignes 410-416)
```tsx
<div className="flex items-center justify-between">
  <Eyebrow>{t("Lignes")}</Eyebrow>
  <button type="button" className="btn btn-line btn-sm" onClick={onAddLine}>
    <Plus size={14} strokeWidth={1.5} />
    {t("Ajouter une ligne")}
  </button>
</div>
```

### Nouvelle position (après la ligne 507)
Le bouton sera déplacé après la boucle `lines.map` qui affiche la liste des produits, mais avant la section des actions (impression, export, validation).

### Changements spécifiques

1. **Supprimer le bouton de sa position actuelle** (lignes 412-415)
   - Retirer le bouton du `div` avec `className="flex items-center justify-between"`
   - Ne conserver que l'`Eyebrow` pour le titre "Lignes"

2. **Ajouter le bouton en bas de la liste** (après la ligne 507)
   - Insérer le bouton après la fermeture de la `div` contenant la boucle `lines.map`
   - Garder exactement le même code du bouton avec ses classes et fonctionnalités
   - Placer le bouton dans un conteneur approprié pour maintenir l'alignement

### Code du bouton à déplacer (inchangé)
```tsx
<button type="button" className="btn btn-line btn-sm" onClick={onAddLine}>
  <Plus size={14} strokeWidth={1.5} />
  {t("Ajouter une ligne")}
</button>
```

## Conservation du design
- **Style** : Le bouton conserve ses classes `btn btn-line btn-sm`
- **Couleurs** : Aucune modification des couleurs
- **Icône** : L'icône `Plus` avec les mêmes dimensions (size={14}, strokeWidth={1.5})
- **Fonctionnalité** : Le gestionnaire `onClick={onAddLine}` reste identique
- **Texte** : Le libellé `{t("Ajouter une ligne")}` reste inchangé

## Avantages de cette modification
- L'utilisateur n'a plus besoin de remonter en haut de la liste pour ajouter un produit
- Meilleure ergonomie lors de la saisie de nombreux produits
- Le bouton reste facilement accessible après avoir rempli les champs du dernier produit
- Aucun impact sur le design existant

## Validation
Après modification, vérifier que :
- Le bouton s'affiche correctement en bas de la liste des produits
- Le bouton fonctionne toujours (ajoute bien une nouvelle ligne)
- Le design et les couleurs sont identiques à l'original
- L'alignement et l'espacement sont cohérents avec le reste de l'interface
