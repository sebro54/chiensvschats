# 🚀 Déploiement sur Railway — Guide pas à pas

## Ce dont tu as besoin
- Un compte **GitHub** (gratuit) → https://github.com
- Un compte **Railway** (gratuit) → https://railway.app
- Une clé API **EulerStream** (gratuite) → https://eulerstream.com

---

## Étape 1 — Préparer les fichiers

Assure-toi d'avoir ces 4 fichiers dans un même dossier :
```
📁 chats-vs-chiens/
  ├── server.js
  ├── index.html
  ├── package.json
  └── .gitignore
```

---

## Étape 2 — Créer un dépôt GitHub

1. Va sur https://github.com/new
2. Nom du dépôt : `chats-vs-chiens`
3. Laisse tout par défaut → clique **"Create repository"**
4. Sur la page suivante, clique **"uploading an existing file"**
5. Glisse-dépose tes 4 fichiers
6. Clique **"Commit changes"**

---

## Étape 3 — Déployer sur Railway

1. Va sur https://railway.app → connecte-toi avec GitHub
2. Clique **"New Project"**
3. Choisis **"Deploy from GitHub repo"**
4. Sélectionne ton dépôt `chats-vs-chiens`
5. Railway détecte Node.js automatiquement → clique **"Deploy Now"**

---

## Étape 4 — Configurer la clé EulerStream

⚠️ **Sans cette étape, tu auras encore l'erreur 403 !**

1. Dans ton projet Railway, clique sur ton service
2. Va dans l'onglet **"Variables"**
3. Clique **"New Variable"**
4. Ajoute :
   - **Name** : `EULER_API_KEY`
   - **Value** : ta clé EulerStream (depuis https://eulerstream.com)
5. Clique **"Add"** → Railway redéploie automatiquement

---

## Étape 5 — Obtenir ton URL publique

1. Dans Railway, va dans l'onglet **"Settings"** de ton service
2. Section **"Networking"** → clique **"Generate Domain"**
3. Tu obtiens une URL comme :
   ```
   https://chats-vs-chiens-production.up.railway.app
   ```
4. **C'est cette URL que tu colles dans TikTok LIVE Studio !**

---

## Étape 6 — Ajouter dans TikTok LIVE Studio

1. Ouvre **TikTok LIVE Studio**
2. Clique **"+"** pour ajouter une source → **"Link"** (ou "Browser Source")
3. Colle ton URL Railway
4. Dimensions recommandées : **480 × 600 px**
5. Active le fond transparent si disponible

---

## ✅ C'est prêt !

Chaque fois que tu veux streamer :
1. Lance ton TikTok Live
2. L'overlay se connecte automatiquement quand tu saisis ton pseudo dans le jeu
3. Les votes et cadeaux sont comptés en temps réel 🎉

---

## ❓ En cas de problème

**L'app ne démarre pas sur Railway ?**
→ Vérifie les logs dans l'onglet "Deployments"

**Erreur 403 persistante ?**
→ Vérifie que la variable `EULER_API_KEY` est bien configurée dans Railway

**Le jeu ne reçoit pas les cadeaux ?**
→ Lance un live test, envoie un cadeau, et regarde les logs Railway pour voir le nom exact du cadeau reçu. Mets à jour `GIFT_CONFIG` dans `server.js` si nécessaire.
