// ============================================================
// Serveur Express pour l'application MindForge
// Gère l'authentification, les quiz, les dossiers, les fiches
// de révision et les cartes mentales
// ============================================================

const express = require('express');
const cors = require('cors');       // Permet les requêtes entre différents domaines
const fs = require('fs');           // Pour lire/écrire des fichiers
const path = require('path');       // Pour gérer les chemins de fichiers
const bcrypt = require('bcryptjs'); // Pour chiffrer les mots de passe
const jwt = require('jsonwebtoken'); // Pour créer des tokens de connexion
const crypto = require('crypto');   // Pour générer des identifiants uniques
const multer = require('multer');   // Pour gérer l'upload de fichiers
const mammoth = require('mammoth'); // Pour extraire le texte des fichiers Word (.docx)
const PPTX2Json = require('pptx2json'); // Pour extraire le texte des fichiers PowerPoint (.pptx)
const pdfParse = require('pdf-parse'); // Pour extraire le texte des fichiers PDF (.pdf)

const app = express();
// En production, le port est fourni par l'hébergeur via la variable d'environnement PORT
const PORT = process.env.PORT || 3000;
// En production, utiliser une variable d'environnement pour la clé secrète
const JWT_SECRET = process.env.JWT_SECRET || 'mindforge-secret-key-2026';
const DATA_DIR = path.join(__dirname, 'data'); // Dossier où sont stockées les données
const AVATARS_DIR = path.join(DATA_DIR, 'avatars'); // Dossier pour les photos de profil

// Créer les dossiers data et avatars s'ils n'existent pas
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}
if (!fs.existsSync(AVATARS_DIR)) {
  fs.mkdirSync(AVATARS_DIR, { recursive: true });
}

// ============ Helpers lecture/écriture JSON ============
// Ces fonctions lisent et écrivent les fichiers JSON dans le dossier data/
// C'est notre "base de données" simplifiée

// Lit un fichier JSON et retourne son contenu (ou un tableau vide si le fichier n'existe pas)
function readJSON(filename) {
  const filePath = path.join(DATA_DIR, filename);
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, '[]', 'utf-8');
    return [];
  }
  const content = fs.readFileSync(filePath, 'utf-8');
  return JSON.parse(content);
}

// Écrit des données dans un fichier JSON (format lisible avec indentation)
function writeJSON(filename, data) {
  const filePath = path.join(DATA_DIR, filename);
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
}

// ============ Middleware ============

app.use(cors());                               // Autorise les requêtes cross-origin
app.use(express.json({ limit: '5mb' }));       // Parse le JSON des requêtes (max 5 Mo)
app.use('/api/avatars', express.static(AVATARS_DIR)); // Sert les photos de profil

// Configuration de multer : stocke les fichiers uploadés en mémoire (pas sur le disque)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 } // Limite à 50 Mo
});

// Middleware d'authentification : vérifie le token JWT
// Si le token est valide, on ajoute req.userId pour les routes suivantes
function authenticate(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token manquant.' });
  }

  try {
    const token = header.split(' ')[1];
    const decoded = jwt.verify(token, JWT_SECRET);
    req.userId = decoded.userId;
    next();
  } catch {
    return res.status(401).json({ error: 'Token invalide ou expiré.' });
  }
}

// Middleware pour gérer les erreurs d'upload (fichier trop gros, etc.)
function handleUpload(req, res, next) {
  upload.single('file')(req, res, (err) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ error: 'Fichier trop volumineux. Taille maximale : 50 Mo.' });
      }
      return res.status(400).json({ error: 'Erreur lors de l\'upload du fichier.' });
    }
    next();
  });
}

// ============ Routes AUTH (connexion/inscription) ============

// ============ Route UPLOAD : extraction de texte depuis un fichier ============
// Accepte les fichiers .txt, .docx, .pptx et .pdf
// Retourne le texte extrait pour générer un quiz
app.post('/api/upload/extract-text', authenticate, handleUpload, async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Aucun fichier envoyé.' });
    }

    const originalName = req.file.originalname.toLowerCase();
    const buffer = req.file.buffer;
    let text = '';

    if (originalName.endsWith('.txt')) {
      // Fichier texte : on lit directement le contenu
      text = buffer.toString('utf-8');

    } else if (originalName.endsWith('.docx')) {
      // Fichier Word : mammoth extrait le texte brut
      const result = await mammoth.extractRawText({ buffer });
      text = result.value;

    } else if (originalName.endsWith('.pptx')) {
      // Fichier PowerPoint : on parse le JSON et on extrait le texte de chaque slide
      const pptx2json = new PPTX2Json();
      const json = await pptx2json.buffer2json(buffer);
      const parts = [];

      // Parcourir chaque slide
      if (json.slides && Array.isArray(json.slides)) {
        for (const slide of json.slides) {
          extractTextFromPptxNode(slide, parts);
        }
      }
      text = parts.join('\n');

    } else if (originalName.endsWith('.pdf')) {
      // Fichier PDF : pdf-parse extrait le texte de toutes les pages
      const pdfData = await pdfParse(buffer);
      text = pdfData.text;

    } else {
      return res.status(400).json({ error: 'Format non supporté. Utilisez .txt, .docx, .pptx ou .pdf' });
    }

    // Vérifie qu\'on a bien extrait du texte
    text = text.trim();
    if (!text) {
      return res.status(400).json({ error: 'Aucun texte n\'a pu être extrait du fichier.' });
    }

    res.json({ text });
  } catch (err) {
    console.error('Erreur extraction texte:', err);
    res.status(500).json({ error: 'Erreur lors de l\'extraction du texte.' });
  }
});

// Fonction récursive pour extraire le texte d'un noeud PowerPoint
function extractTextFromPptxNode(node, parts) {
  if (!node || typeof node !== 'object') return;

  // Si le noeud a du texte, on l'ajoute
  if (typeof node.text === 'string' && node.text.trim()) {
    parts.push(node.text.trim());
  }
  if (typeof node.content === 'string' && node.content.trim()) {
    parts.push(node.content.trim());
  }

  // Parcourir les enfants récursivement
  for (const key of Object.keys(node)) {
    const val = node[key];
    if (Array.isArray(val)) {
      for (const item of val) {
        extractTextFromPptxNode(item, parts);
      }
    } else if (typeof val === 'object' && val !== null) {
      extractTextFromPptxNode(val, parts);
    }
  }
}

// Inscription d'un nouvel utilisateur
app.post('/api/auth/register', async (req, res) => {
  const { email, displayName, password } = req.body;

  if (!email || !displayName || !password) {
    return res.status(400).json({ error: 'Tous les champs sont requis.' });
  }

  if (password.length < 6) {
    return res.status(400).json({ error: 'Le mot de passe doit faire au moins 6 caractères.' });
  }

  const users = readJSON('users.json');

  // Vérifie qu'aucun compte n'existe déjà avec cet email
  if (users.some(u => u.email === email.toLowerCase())) {
    return res.status(409).json({ error: 'Un compte avec cet email existe déjà.' });
  }

  // Chiffre le mot de passe (ne jamais stocker en clair !)
  const passwordHash = await bcrypt.hash(password, 10);
  const user = {
    id: crypto.randomUUID(),
    email: email.toLowerCase(),
    displayName,
    passwordHash,
    createdAt: new Date().toISOString()
  };

  users.push(user);
  writeJSON('users.json', users);

  // Crée un token JWT valable 7 jours
  const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '7d' });

  // Retourne le token et les infos publiques de l'utilisateur (sans le mot de passe)
  res.status(201).json({
    token,
    user: { id: user.id, email: user.email, displayName: user.displayName, createdAt: user.createdAt, avatarUrl: user.avatarUrl || null }
  });
});

// Connexion d'un utilisateur existant
app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email et mot de passe requis.' });
  }

  const users = readJSON('users.json');
  const user = users.find(u => u.email === email.toLowerCase());

  if (!user) {
    return res.status(401).json({ error: 'Email ou mot de passe incorrect.' });
  }

  // Vérifie que le mot de passe correspond au hash
  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    return res.status(401).json({ error: 'Email ou mot de passe incorrect.' });
  }

  const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '7d' });

  res.json({
    token,
    user: { id: user.id, email: user.email, displayName: user.displayName, createdAt: user.createdAt, avatarUrl: user.avatarUrl || null }
  });
});

// Récupère le profil de l'utilisateur connecté (utilisé pour restaurer la session)
app.get('/api/auth/profile', authenticate, (req, res) => {
  const users = readJSON('users.json');
  const user = users.find(u => u.id === req.userId);

  if (!user) {
    return res.status(404).json({ error: 'Utilisateur non trouvé.' });
  }

  res.json({ id: user.id, email: user.email, displayName: user.displayName, createdAt: user.createdAt, avatarUrl: user.avatarUrl || null });
});

// Met à jour le profil de l'utilisateur connecté (nom affiché et/ou email)
app.put('/api/auth/profile', authenticate, async (req, res) => {
  const { displayName, email } = req.body;
  if (!displayName && !email) {
    return res.status(400).json({ error: 'Aucune donnée à mettre à jour.' });
  }

  const users = readJSON('users.json');
  const index = users.findIndex(u => u.id === req.userId);
  if (index === -1) {
    return res.status(404).json({ error: 'Utilisateur non trouvé.' });
  }

  // Vérifier que le nouvel email n'est pas déjà utilisé par un autre compte
  if (email && email !== users[index].email) {
    const emailTaken = users.some(u => u.id !== req.userId && u.email === email);
    if (emailTaken) {
      return res.status(409).json({ error: 'Cet email est déjà utilisé.' });
    }
    users[index].email = email;
  }

  if (displayName) {
    users[index].displayName = displayName;
  }

  writeJSON('users.json', users);
  const user = users[index];
  res.json({ id: user.id, email: user.email, displayName: user.displayName, createdAt: user.createdAt, avatarUrl: user.avatarUrl || null });
});

// Upload de la photo de profil de l'utilisateur connecté
app.post('/api/auth/avatar', authenticate, handleUpload, (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'Aucun fichier envoyé.' });
  }

  // Vérifier que c'est bien une image
  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
  if (!allowedTypes.includes(req.file.mimetype)) {
    return res.status(400).json({ error: 'Format non supporté. Utilisez JPG, PNG, WebP ou GIF.' });
  }

  // Limiter la taille à 5 Mo pour les avatars
  if (req.file.size > 5 * 1024 * 1024) {
    return res.status(400).json({ error: 'Image trop volumineuse. Taille maximale : 5 Mo.' });
  }

  const users = readJSON('users.json');
  const user = users.find(u => u.id === req.userId);
  if (!user) {
    return res.status(404).json({ error: 'Utilisateur non trouvé.' });
  }

  // Supprimer l'ancien avatar s'il existe
  if (user.avatarUrl) {
    const oldFilename = path.basename(user.avatarUrl);
    const oldPath = path.join(AVATARS_DIR, oldFilename);
    if (fs.existsSync(oldPath)) {
      fs.unlinkSync(oldPath);
    }
  }

  // Sauvegarder le nouveau fichier avec un nom unique
  const ext = path.extname(req.file.originalname) || '.jpg';
  const filename = `${req.userId}-${Date.now()}${ext}`;
  fs.writeFileSync(path.join(AVATARS_DIR, filename), req.file.buffer);

  // Mettre à jour l'URL dans le profil utilisateur
  user.avatarUrl = `/api/avatars/${filename}`;
  writeJSON('users.json', users);

  res.json({ id: user.id, email: user.email, displayName: user.displayName, createdAt: user.createdAt, avatarUrl: user.avatarUrl });
});

// Supprime la photo de profil de l'utilisateur connecté
app.delete('/api/auth/avatar', authenticate, (req, res) => {
  const users = readJSON('users.json');
  const user = users.find(u => u.id === req.userId);
  if (!user) {
    return res.status(404).json({ error: 'Utilisateur non trouvé.' });
  }

  // Supprimer le fichier sur le disque
  if (user.avatarUrl) {
    const oldFilename = path.basename(user.avatarUrl);
    const oldPath = path.join(AVATARS_DIR, oldFilename);
    if (fs.existsSync(oldPath)) {
      fs.unlinkSync(oldPath);
    }
  }

  user.avatarUrl = null;
  writeJSON('users.json', users);

  res.json({ id: user.id, email: user.email, displayName: user.displayName, createdAt: user.createdAt, avatarUrl: null });
});

// Change le mot de passe de l'utilisateur connecté
app.put('/api/auth/password', authenticate, async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: 'Mot de passe actuel et nouveau mot de passe requis.' });
  }
  if (newPassword.length < 6) {
    return res.status(400).json({ error: 'Le nouveau mot de passe doit contenir au moins 6 caractères.' });
  }

  const users = readJSON('users.json');
  const user = users.find(u => u.id === req.userId);
  if (!user) {
    return res.status(404).json({ error: 'Utilisateur non trouvé.' });
  }

  // Vérifier le mot de passe actuel
  const valid = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!valid) {
    return res.status(401).json({ error: 'Mot de passe actuel incorrect.' });
  }

  user.passwordHash = await bcrypt.hash(newPassword, 10);
  writeJSON('users.json', users);
  res.json({ message: 'Mot de passe modifié avec succès.' });
});

// Récupère les statistiques de l'utilisateur connecté (nombre de quiz, fiches, cartes mentales)
app.get('/api/auth/stats', authenticate, (req, res) => {
  const quizzes = readJSON('quizzes.json').filter(q => q.userId === req.userId);
  const results = readJSON('results.json').filter(r => r.userId === req.userId);
  const decks = readJSON('flashcard-decks.json').filter(d => d.userId === req.userId);
  const mindmaps = readJSON('mindmaps.json').filter(m => m.userId === req.userId);
  const folders = readJSON('folders.json').filter(f => f.userId === req.userId);

  res.json({
    quizCount: quizzes.length,
    resultCount: results.length,
    deckCount: decks.length,
    mindmapCount: mindmaps.length,
    folderCount: folders.length
  });
});

// ============ Routes QUIZZES (quiz générés par l'IA) ============

// Récupère tous les quiz de l'utilisateur connecté
app.get('/api/quizzes', authenticate, (req, res) => {
  const quizzes = readJSON('quizzes.json');
  const userQuizzes = quizzes.filter(q => q.userId === req.userId);
  res.json(userQuizzes);
});

// Crée un nouveau quiz
app.post('/api/quizzes', authenticate, (req, res) => {
  const { title, sourceText, questions } = req.body;

  if (!title || !questions) {
    return res.status(400).json({ error: 'Titre et questions requis.' });
  }

  const quizzes = readJSON('quizzes.json');
  const quiz = {
    id: crypto.randomUUID(),
    userId: req.userId,
    title,
    sourceText: sourceText || '',
    questions,
    createdAt: new Date().toISOString()
  };

  quizzes.push(quiz);
  writeJSON('quizzes.json', quizzes);

  res.status(201).json(quiz);
});

// Supprime un quiz et ses résultats associés
app.delete('/api/quizzes/:id', authenticate, (req, res) => {
  let quizzes = readJSON('quizzes.json');
  const quiz = quizzes.find(q => q.id === req.params.id && q.userId === req.userId);

  if (!quiz) {
    return res.status(404).json({ error: 'Quiz non trouvé.' });
  }

  quizzes = quizzes.filter(q => q.id !== req.params.id);
  writeJSON('quizzes.json', quizzes);

  // Supprimer aussi les résultats liés
  let results = readJSON('results.json');
  results = results.filter(r => r.quizId !== req.params.id);
  writeJSON('results.json', results);

  res.json({ success: true });
});

// ============ Routes RESULTS (résultats de quiz) ============

// Récupère tous les résultats de l'utilisateur
app.get('/api/results', authenticate, (req, res) => {
  const results = readJSON('results.json');
  const userResults = results.filter(r => r.userId === req.userId);
  res.json(userResults);
});

// Sauvegarde un nouveau résultat de quiz
app.post('/api/results', authenticate, (req, res) => {
  const { quizId, quizTitle, answers, score, totalQuestions } = req.body;

  if (!quizId || answers === undefined || score === undefined) {
    return res.status(400).json({ error: 'Données du résultat incomplètes.' });
  }

  const results = readJSON('results.json');
  const result = {
    id: crypto.randomUUID(),
    userId: req.userId,
    quizId,
    quizTitle: quizTitle || '',
    answers,
    score,
    totalQuestions,
    completedAt: new Date().toISOString()
  };

  results.push(result);
  writeJSON('results.json', results);

  res.status(201).json(result);
});

// ============ Démarrage ============

// ============ Routes FOLDERS (dossiers de classement) ============

// Récupère tous les dossiers de l'utilisateur
app.get('/api/folders', authenticate, (req, res) => {
  const folders = readJSON('folders.json');
  res.json(folders.filter(f => f.userId === req.userId));
});

// Crée un nouveau dossier
app.post('/api/folders', authenticate, (req, res) => {
  const { name, parentId, color } = req.body;
  if (!name) return res.status(400).json({ error: 'Nom requis.' });

  const folders = readJSON('folders.json');
  const folder = {
    id: crypto.randomUUID(),
    userId: req.userId,
    name,
    parentId: parentId || null,
    color: color || '#6366f1',
    createdAt: new Date().toISOString()
  };
  folders.push(folder);
  writeJSON('folders.json', folders);
  res.status(201).json(folder);
});

// Modifie un dossier (nom, couleur, dossier parent)
app.put('/api/folders/:id', authenticate, (req, res) => {
  const folders = readJSON('folders.json');
  const idx = folders.findIndex(f => f.id === req.params.id && f.userId === req.userId);
  if (idx === -1) return res.status(404).json({ error: 'Dossier non trouvé.' });

  const { name, parentId, color } = req.body;
  if (name) folders[idx].name = name;
  if (parentId !== undefined) folders[idx].parentId = parentId;
  if (color) folders[idx].color = color;
  writeJSON('folders.json', folders);
  res.json(folders[idx]);
});

// Supprime un dossier et tous ses sous-dossiers
// Les éléments (fiches, cartes) des dossiers supprimés sont détachés (remis à la racine)
app.delete('/api/folders/:id', authenticate, (req, res) => {
  let folders = readJSON('folders.json');
  const folder = folders.find(f => f.id === req.params.id && f.userId === req.userId);
  if (!folder) return res.status(404).json({ error: 'Dossier non trouvé.' });

  // Récupère tous les IDs des sous-dossiers récursivement
  function getChildIds(parentId) {
    const children = folders.filter(f => f.parentId === parentId && f.userId === req.userId);
    let ids = children.map(c => c.id);
    for (const child of children) {
      ids = ids.concat(getChildIds(child.id));
    }
    return ids;
  }
  const allIds = [req.params.id, ...getChildIds(req.params.id)];

  folders = folders.filter(f => !allIds.includes(f.id));
  writeJSON('folders.json', folders);

  // Détache les fiches et cartes des dossiers supprimés (folderId → null)
  let decks = readJSON('flashcard-decks.json');
  decks = decks.map(d => allIds.includes(d.folderId) ? { ...d, folderId: null } : d);
  writeJSON('flashcard-decks.json', decks);

  let mindmaps = readJSON('mindmaps.json');
  mindmaps = mindmaps.map(m => allIds.includes(m.folderId) ? { ...m, folderId: null } : m);
  writeJSON('mindmaps.json', mindmaps);

  res.json({ success: true });
});

// ============ Routes FLASHCARD DECKS (paquets de fiches de révision) ============

// Récupère tous les paquets de fiches de l'utilisateur
app.get('/api/flashcard-decks', authenticate, (req, res) => {
  const decks = readJSON('flashcard-decks.json');
  res.json(decks.filter(d => d.userId === req.userId));
});

// Crée un nouveau paquet de fiches
app.post('/api/flashcard-decks', authenticate, (req, res) => {
  const { title, folderId, cards } = req.body;
  if (!title) return res.status(400).json({ error: 'Titre requis.' });

  const decks = readJSON('flashcard-decks.json');
  const deck = {
    id: crypto.randomUUID(),
    userId: req.userId,
    title,
    folderId: folderId || null,
    cards: cards || [],
    createdAt: new Date().toISOString()
  };
  decks.push(deck);
  writeJSON('flashcard-decks.json', decks);
  res.status(201).json(deck);
});

// Modifie un paquet de fiches (titre, dossier, cartes)
app.put('/api/flashcard-decks/:id', authenticate, (req, res) => {
  const decks = readJSON('flashcard-decks.json');
  const idx = decks.findIndex(d => d.id === req.params.id && d.userId === req.userId);
  if (idx === -1) return res.status(404).json({ error: 'Paquet non trouvé.' });

  const { title, folderId, cards } = req.body;
  if (title !== undefined) decks[idx].title = title;
  if (folderId !== undefined) decks[idx].folderId = folderId;
  if (cards !== undefined) decks[idx].cards = cards;
  writeJSON('flashcard-decks.json', decks);
  res.json(decks[idx]);
});

// Supprime un paquet de fiches
app.delete('/api/flashcard-decks/:id', authenticate, (req, res) => {
  let decks = readJSON('flashcard-decks.json');
  const deck = decks.find(d => d.id === req.params.id && d.userId === req.userId);
  if (!deck) return res.status(404).json({ error: 'Paquet non trouvé.' });

  decks = decks.filter(d => d.id !== req.params.id);
  writeJSON('flashcard-decks.json', decks);
  res.json({ success: true });
});

// ============ Routes MINDMAPS (cartes mentales) ============

// Récupère toutes les cartes mentales de l'utilisateur
app.get('/api/mindmaps', authenticate, (req, res) => {
  const mindmaps = readJSON('mindmaps.json');
  res.json(mindmaps.filter(m => m.userId === req.userId));
});

// Crée une nouvelle carte mentale
app.post('/api/mindmaps', authenticate, (req, res) => {
  const { title, folderId, root } = req.body;
  if (!title || !root) return res.status(400).json({ error: 'Titre et contenu requis.' });

  const mindmaps = readJSON('mindmaps.json');
  const mindmap = {
    id: crypto.randomUUID(),
    userId: req.userId,
    title,
    folderId: folderId || null,
    root,
    createdAt: new Date().toISOString()
  };
  mindmaps.push(mindmap);
  writeJSON('mindmaps.json', mindmaps);
  res.status(201).json(mindmap);
});

// Modifie une carte mentale (titre, dossier, arbre de noeuds)
app.put('/api/mindmaps/:id', authenticate, (req, res) => {
  const mindmaps = readJSON('mindmaps.json');
  const idx = mindmaps.findIndex(m => m.id === req.params.id && m.userId === req.userId);
  if (idx === -1) return res.status(404).json({ error: 'Carte mentale non trouvée.' });

  const { title, folderId, root } = req.body;
  if (title !== undefined) mindmaps[idx].title = title;
  if (folderId !== undefined) mindmaps[idx].folderId = folderId;
  if (root !== undefined) mindmaps[idx].root = root;
  writeJSON('mindmaps.json', mindmaps);
  res.json(mindmaps[idx]);
});

// Supprime une carte mentale
app.delete('/api/mindmaps/:id', authenticate, (req, res) => {
  let mindmaps = readJSON('mindmaps.json');
  const mindmap = mindmaps.find(m => m.id === req.params.id && m.userId === req.userId);
  if (!mindmap) return res.status(404).json({ error: 'Carte mentale non trouvée.' });

  mindmaps = mindmaps.filter(m => m.id !== req.params.id);
  writeJSON('mindmaps.json', mindmaps);
  res.json({ success: true });
});

// ============ Servir le frontend Angular en production ============
// Après les routes API, on sert les fichiers statiques du build Angular
const ANGULAR_DIST = path.join(__dirname, '..', 'dist', 'projetTest', 'browser');
if (fs.existsSync(ANGULAR_DIST)) {
  app.use(express.static(ANGULAR_DIST));
  // Toutes les routes non-API redirigent vers index.html (pour le routage Angular)
  // Express 5 utilise {*path} au lieu de * pour les wildcards
  app.get('{*path}', (req, res) => {
    res.sendFile(path.join(ANGULAR_DIST, 'index.html'));
  });
}

// ============ Démarrage du serveur ============
app.listen(PORT, () => {
  console.log(`✅ Serveur MindForge démarré sur http://localhost:${PORT}`);
  console.log(`📁 Données stockées dans ${DATA_DIR}`);
});
