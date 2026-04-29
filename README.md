# ragnard-le-barbare
Les aventures de Ragnard le Barbare pis Dame Lysandre — un livre web interactif

## Structure

- `content/story.md`: source principale de l'histoire (format markdown, facile a modifier)
- `story_raw.txt`: extraction brute du document `.docx` (trace de conversion)
- `web/index.html`: page du livre
- `web/styles.css`: style visuel "grand livre"
- `web/app.js`: chargement + navigation entre chapitres

## Lancer en local

Depuis la racine du projet:

```bash
python -m http.server 8000
```

Puis ouvrir:

- `http://localhost:8000/web/`

## Modifier l'histoire

1. Ouvrir `content/story.md`
2. Ajouter ou modifier des chapitres avec des titres qui commencent par `##`
3. Recharger la page web
