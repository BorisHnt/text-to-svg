# Local Vector Tools

Application web 100 % frontend pour :

- convertir du texte en vrai SVG vectoriel à partir d’une police locale
- convertir un fichier SVG local en DXF ASCII téléchargeable

Le projet fonctionne sans backend, sans API et sans upload distant.

## Stack

- `HTML`
- `CSS`
- `JavaScript vanilla` modulaire
- `opentype.js` vendored localement pour parser la police et générer les contours vectoriels des glyphes

## Fonctionnalités

### Text to SVG

- chargement de police locale via input file ou drag and drop
- saisie texte mono-ligne et multi-lignes
- réglages `font size`, `letter spacing`, `line height`, `padding`, `alignement`
- styles `gras`, `oblique` et `italique` appliqués localement
- couleur de remplissage, contour optionnel, épaisseur du contour
- aperçu SVG en direct
- export principal en `SVG paths`
- export secondaire en `SVG texte` avec police embarquée en base64
- états vides, erreurs UI, avertissements sur glyphes manquants
- option d’aperçu avec fond clair et affichage des bounding boxes
- bouton `Reset` et bouton `Exemple`

### SVG to DXF

- topbar avec navigation `Text to SVG` / `SVG to DXF`
- import local d’un fichier `.svg` via bouton ou drag and drop
- aperçu du SVG original
- conversion côté client vers DXF ASCII
- réglage de précision `faible / moyenne / élevée`
- téléchargement du fichier `.dxf`
- résumé des éléments détectés et avertissements sur les éléments non supportés

## Lancement local

Aucune installation npm n’est nécessaire.

Option simple avec un serveur statique local :

```bash
python3 -m http.server 8000
```

Puis ouvrez `http://localhost:8000`.

Le projet peut être déployé tel quel sur GitHub Pages ou tout autre hébergement statique.

## Utilisation

### Text to SVG

1. Chargez une police `.ttf` ou `.otf`.
2. Saisissez votre texte.
3. Ajustez les paramètres typographiques.
4. Vérifiez l’aperçu SVG à droite.
5. Exportez le SVG vectorisé via `Export SVG paths`.

### SVG to DXF

1. Ouvrez l’onglet `SVG to DXF`.
2. Chargez un fichier `.svg`.
3. Vérifiez l’aperçu et le résumé des éléments.
4. Choisissez la précision de conversion.
5. Lancez `Convert to DXF`.
6. Téléchargez le fichier via `Download DXF`.

## Structure du projet

```text
.
├── index.html
├── vendor
│   └── opentype.js
├── src
│   ├── main.js
│   ├── styles.css
│   └── js
│       ├── constants.js
│       ├── font-loader.js
│       ├── layout.js
│       ├── navigation.js
│       ├── preview.js
│       ├── state.js
│       ├── svg.js
│       ├── svg-to-dxf-ui.js
│       ├── svg-to-dxf.js
│       ├── ui.js
│       └── utils.js
└── README.md
```

## Architecture

- `font-loader.js` : validation des fichiers, lecture locale, parsing `opentype.js`, extraction des métadonnées
- `layout.js` : calcul typographique, baselines, multiline, alignement, bounding box réelle et dimensions finales du SVG
- `navigation.js` : navigation frontend légère entre les deux vues via hash
- `svg.js` : génération du SVG vectorisé et du SVG texte embarquant la police
- `svg-to-dxf.js` : parsing SVG, échantillonnage des formes, approximation des courbes et génération DXF ASCII
- `svg-to-dxf-ui.js` : import SVG, aperçu, états d’erreur, lancement de conversion et téléchargement DXF
- `ui.js` : gestion des interactions, états d’erreur, aperçu, export
- `styles.css` : layout, responsive et habillage inspiré du site de référence

## Choix techniques

- `opentype.js` est adapté ici car il permet de parser des polices locales directement côté navigateur et d’obtenir les paths des glyphes sans serveur.
- Le projet est livré sans build ni backend pour rester directement hébergeable en statique, y compris sur un disque ou un hébergement qui ne permet pas d’exécuter des binaires Node.
- Le SVG exporté en paths est calculé à partir de la bounding box réelle des contours puis recentré avec le padding configuré pour éviter les coupes sur les ascenders, descenders et débords latéraux.
- Le `gras`, l’`oblique` et l’`italique` sont synthétiques pour rester compatibles avec une seule police importée. L’inclinaison est appliquée directement aux contours exportés, avec un angle plus léger pour l’oblique.
- Pour le DXF, les formes SVG sont converties en polylignes ASCII simples. Les courbes sont approximées en segments selon un niveau de précision choisi pour privilégier un export CAD robuste.

## Hypothèses et limites connues

- Les tabulations sont normalisées en quatre espaces pour garder un comportement stable.
- Le moteur repose sur les métriques d’`opentype.js` et ne couvre pas la composition OpenType avancée la plus complexe.
- Le `gras`, l’`oblique` et l’`italique` ne remplacent pas une vraie variante de police dédiée si vous avez besoin d’une fidélité typographique absolue.
- Si un caractère n’existe pas dans la police, l’application l’indique en avertissement. Selon la police, un glyphe `.notdef` peut quand même être rendu.
- L’export `SVG texte` embarque la police en base64 pour rester autonome, mais l’export recommandé reste `SVG paths`.
- La conversion `SVG -> DXF` cible prioritairement `path`, `rect`, `circle`, `ellipse`, `line`, `polyline`, `polygon` et les transformations simples.
- Les courbes, arcs et paths complexes sont exportés en polylignes approximées. C’est un compromis volontaire pour obtenir un DXF simple et compatible.
- Les éléments tels que `text`, `image`, `use` ou `foreignObject` ne sont pas convertis automatiquement et sont signalés comme non supportés.
