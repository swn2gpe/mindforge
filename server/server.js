// ============================================================
// Serveur Express pour l'application MindForge
// Supporte MongoDB (production) ou fichiers JSON (développement local)
// ============================================================

const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const multer = require('multer');
const mammoth = require('mammoth');
const PPTX2Json = require('pptx2json');
const pdfParse = require('pdf-parse');
const { MongoClient } = require('mongodb');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'mindforge-secret-key-2026';

// Mode de stockage : MongoDB si MONGODB_URI est défini, sinon fichiers JSON
const MONGODB_URI = process.env.MONGODB_URI;
const USE_MONGO = !!MONGODB_URI;
let db; // Instance de la base MongoDB (null en mode JSON)

// Dossiers pour le mode JSON (développement local)
const DATA_DIR = path.join(__dirname, 'data');
const AVATARS_DIR = path.join(DATA_DIR, 'avatars');

if (!USE_MONGO) {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(AVATARS_DIR)) fs.mkdirSync(AVATARS_DIR, { recursive: true });
}

// ============ Accès aux données (MongoDB ou JSON) ============

// Mapping noms de collections → fichiers JSON
const COL_FILES = {
  users: 'users.json',
  quizzes: 'quizzes.json',
  results: 'results.json',
  folders: 'folders.json',
  flashcardDecks: 'flashcard-decks.json',
  mindmaps: 'mindmaps.json'
};

// Lit un fichier JSON (mode local uniquement)
function readJSON(filename) {
  const filePath = path.join(DATA_DIR, filename);
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, '[]', 'utf-8');
    return [];
  }
  return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
}

// Écrit dans un fichier JSON (mode local uniquement)
function writeJSON(filename, data) {
  fs.writeFileSync(path.join(DATA_DIR, filename), JSON.stringify(data, null, 2), 'utf-8');
}

// Lit toutes les données d'une collection
async function readData(collection) {
  if (USE_MONGO) {
    return db.collection(collection).find({}, { projection: { _id: 0 } }).toArray();
  }
  return readJSON(COL_FILES[collection]);
}

// Écrit toutes les données d'une collection (remplace le contenu)
async function writeData(collection, data) {
  if (USE_MONGO) {
    const col = db.collection(collection);
    await col.deleteMany({});
    if (data.length > 0) {
      await col.insertMany(data.map(d => ({ ...d })));
    }
    return;
  }
  writeJSON(COL_FILES[collection], data);
}

// ============ Middleware ============

app.use(cors());
app.use(express.json({ limit: '5mb' }));

// En mode JSON, servir les avatars depuis le dossier data/avatars
if (!USE_MONGO) {
  app.use('/api/avatars', express.static(AVATARS_DIR));
}

// Configuration de multer : stocke les fichiers en mémoire
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }
});

// Vérifie le token JWT et extrait l'identifiant utilisateur
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

// Gère l'upload avec gestion d'erreur (fichier trop gros, etc.)
function handleUpload(req, res, next) {
  upload.single('file')(req, res, (err) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ error: 'Fichier trop volumineux. Taille maximale : 50 Mo.' });
      }
      return res.status(400).json({ error: "Erreur lors de l'upload du fichier." });
    }
    next();
  });
}

// ============ Route UPLOAD : extraction de texte depuis un fichier ============

app.post('/api/upload/extract-text', authenticate, handleUpload, async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Aucun fichier envoyé.' });
    }

    const originalName = req.file.originalname.toLowerCase();
    const buffer = req.file.buffer;
    let text = '';

    if (originalName.endsWith('.txt')) {
      text = buffer.toString('utf-8');
    } else if (originalName.endsWith('.docx')) {
      const result = await mammoth.extractRawText({ buffer });
      text = result.value;
    } else if (originalName.endsWith('.pptx')) {
      const pptx2json = new PPTX2Json();
      const json = await pptx2json.buffer2json(buffer);
      const parts = [];
      if (json.slides && Array.isArray(json.slides)) {
        for (const slide of json.slides) {
          extractTextFromPptxNode(slide, parts);
        }
      }
      text = parts.join('\n');
    } else if (originalName.endsWith('.pdf')) {
      const pdfData = await pdfParse(buffer);
      text = pdfData.text;
    } else {
      return res.status(400).json({ error: 'Format non supporté. Utilisez .txt, .docx, .pptx ou .pdf' });
    }

    text = text.trim();
    if (!text) {
      return res.status(400).json({ error: "Aucun texte n'a pu être extrait du fichier." });
    }
    res.json({ text });
  } catch (err) {
    console.error('Erreur extraction texte:', err);
    res.status(500).json({ error: "Erreur lors de l'extraction du texte." });
  }
});

// Fonction récursive pour extraire le texte d'un noeud PowerPoint
function extractTextFromPptxNode(node, parts) {
  if (!node || typeof node !== 'object') return;
  if (typeof node.text === 'string' && node.text.trim()) {
    parts.push(node.text.trim());
  }
  if (typeof node.content === 'string' && node.content.trim()) {
    parts.push(node.content.trim());
  }
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

// ============ Route AVATARS (mode MongoDB) ============
// En mode MongoDB, les avatars sont stockés en base, pas sur le disque

app.get('/api/avatars/:userId', async (req, res) => {
  if (!USE_MONGO) {
    // En mode JSON, express.static gère déjà ce chemin
    return res.status(404).json({ error: 'Avatar non trouvé.' });
  }
  try {
    const avatar = await db.collection('avatars').findOne({ userId: req.params.userId });
    if (!avatar || !avatar.data) {
      return res.status(404).json({ error: 'Avatar non trouvé.' });
    }
    res.set('Content-Type', avatar.mimeType || 'image/jpeg');
    res.set('Cache-Control', 'public, max-age=86400');
    const buf = Buffer.isBuffer(avatar.data) ? avatar.data : Buffer.from(avatar.data.buffer);
    res.send(buf);
  } catch (err) {
    console.error('Erreur avatar:', err);
    res.status(500).json({ error: 'Erreur serveur.' });
  }
});

// ============ Routes AUTH (inscription / connexion / profil) ============

// Inscription
app.post('/api/auth/register', async (req, res) => {
  const { email, displayName, password } = req.body;
  if (!email || !displayName || !password) {
    return res.status(400).json({ error: 'Tous les champs sont requis.' });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: 'Le mot de passe doit faire au moins 6 caractères.' });
  }

  const users = await readData('users');
  if (users.some(u => u.email === email.toLowerCase())) {
    return res.status(409).json({ error: 'Un compte avec cet email existe déjà.' });
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const user = {
    id: crypto.randomUUID(),
    email: email.toLowerCase(),
    displayName,
    passwordHash,
    createdAt: new Date().toISOString()
  };
  users.push(user);
  await writeData('users', users);

  const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '7d' });
  res.status(201).json({
    token,
    user: { id: user.id, email: user.email, displayName: user.displayName, createdAt: user.createdAt, avatarUrl: user.avatarUrl || null }
  });
});

// Connexion
app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email et mot de passe requis.' });
  }

  const users = await readData('users');
  const user = users.find(u => u.email === email.toLowerCase());
  if (!user) {
    return res.status(401).json({ error: 'Email ou mot de passe incorrect.' });
  }

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

// Profil de l'utilisateur connecté
app.get('/api/auth/profile', authenticate, async (req, res) => {
  const users = await readData('users');
  const user = users.find(u => u.id === req.userId);
  if (!user) return res.status(404).json({ error: 'Utilisateur non trouvé.' });
  res.json({ id: user.id, email: user.email, displayName: user.displayName, createdAt: user.createdAt, avatarUrl: user.avatarUrl || null });
});

// Mise à jour du profil (nom, email)
app.put('/api/auth/profile', authenticate, async (req, res) => {
  const { displayName, email } = req.body;
  if (!displayName && !email) {
    return res.status(400).json({ error: 'Aucune donnée à mettre à jour.' });
  }

  const users = await readData('users');
  const index = users.findIndex(u => u.id === req.userId);
  if (index === -1) return res.status(404).json({ error: 'Utilisateur non trouvé.' });

  if (email && email !== users[index].email) {
    if (users.some(u => u.id !== req.userId && u.email === email)) {
      return res.status(409).json({ error: 'Cet email est déjà utilisé.' });
    }
    users[index].email = email;
  }
  if (displayName) users[index].displayName = displayName;

  await writeData('users', users);
  const user = users[index];
  res.json({ id: user.id, email: user.email, displayName: user.displayName, createdAt: user.createdAt, avatarUrl: user.avatarUrl || null });
});

// Upload de la photo de profil
app.post('/api/auth/avatar', authenticate, handleUpload, async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Aucun fichier envoyé.' });

  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
  if (!allowedTypes.includes(req.file.mimetype)) {
    return res.status(400).json({ error: 'Format non supporté. Utilisez JPG, PNG, WebP ou GIF.' });
  }
  if (req.file.size > 5 * 1024 * 1024) {
    return res.status(400).json({ error: 'Image trop volumineuse. Taille maximale : 5 Mo.' });
  }

  const users = await readData('users');
  const idx = users.findIndex(u => u.id === req.userId);
  if (idx === -1) return res.status(404).json({ error: 'Utilisateur non trouvé.' });

  if (USE_MONGO) {
    // Stocker l'avatar en base de données
    await db.collection('avatars').updateOne(
      { userId: req.userId },
      { $set: { userId: req.userId, data: req.file.buffer, mimeType: req.file.mimetype } },
      { upsert: true }
    );
    users[idx].avatarUrl = `/api/avatars/${req.userId}`;
  } else {
    // Supprimer l'ancien avatar s'il existe
    if (users[idx].avatarUrl) {
      const oldPath = path.join(AVATARS_DIR, path.basename(users[idx].avatarUrl));
      if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
    }
    const ext = path.extname(req.file.originalname) || '.jpg';
    const filename = `${req.userId}-${Date.now()}${ext}`;
    fs.writeFileSync(path.join(AVATARS_DIR, filename), req.file.buffer);
    users[idx].avatarUrl = `/api/avatars/${filename}`;
  }

  await writeData('users', users);
  const user = users[idx];
  res.json({ id: user.id, email: user.email, displayName: user.displayName, createdAt: user.createdAt, avatarUrl: user.avatarUrl });
});

// Suppression de la photo de profil
app.delete('/api/auth/avatar', authenticate, async (req, res) => {
  const users = await readData('users');
  const idx = users.findIndex(u => u.id === req.userId);
  if (idx === -1) return res.status(404).json({ error: 'Utilisateur non trouvé.' });

  if (USE_MONGO) {
    await db.collection('avatars').deleteOne({ userId: req.userId });
  } else {
    if (users[idx].avatarUrl) {
      const oldPath = path.join(AVATARS_DIR, path.basename(users[idx].avatarUrl));
      if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
    }
  }

  users[idx].avatarUrl = null;
  await writeData('users', users);
  const user = users[idx];
  res.json({ id: user.id, email: user.email, displayName: user.displayName, createdAt: user.createdAt, avatarUrl: null });
});

// Changement de mot de passe
app.put('/api/auth/password', authenticate, async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: 'Mot de passe actuel et nouveau mot de passe requis.' });
  }
  if (newPassword.length < 6) {
    return res.status(400).json({ error: 'Le nouveau mot de passe doit contenir au moins 6 caractères.' });
  }

  const users = await readData('users');
  const user = users.find(u => u.id === req.userId);
  if (!user) return res.status(404).json({ error: 'Utilisateur non trouvé.' });

  const valid = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!valid) return res.status(401).json({ error: 'Mot de passe actuel incorrect.' });

  const idx = users.findIndex(u => u.id === req.userId);
  users[idx].passwordHash = await bcrypt.hash(newPassword, 10);
  await writeData('users', users);
  res.json({ message: 'Mot de passe modifié avec succès.' });
});

// Statistiques de l'utilisateur
app.get('/api/auth/stats', authenticate, async (req, res) => {
  const [quizzes, results, decks, mindmaps, folders] = await Promise.all([
    readData('quizzes'),
    readData('results'),
    readData('flashcardDecks'),
    readData('mindmaps'),
    readData('folders')
  ]);

  res.json({
    quizCount: quizzes.filter(q => q.userId === req.userId).length,
    resultCount: results.filter(r => r.userId === req.userId).length,
    deckCount: decks.filter(d => d.userId === req.userId).length,
    mindmapCount: mindmaps.filter(m => m.userId === req.userId).length,
    folderCount: folders.filter(f => f.userId === req.userId).length
  });
});

// ============ Routes QUIZZES ============

app.get('/api/quizzes', authenticate, async (req, res) => {
  const quizzes = await readData('quizzes');
  res.json(quizzes.filter(q => q.userId === req.userId));
});

app.post('/api/quizzes', authenticate, async (req, res) => {
  const { title, sourceText, questions } = req.body;
  if (!title || !questions) return res.status(400).json({ error: 'Titre et questions requis.' });

  const quizzes = await readData('quizzes');
  const quiz = {
    id: crypto.randomUUID(),
    userId: req.userId,
    title,
    sourceText: sourceText || '',
    questions,
    createdAt: new Date().toISOString()
  };
  quizzes.push(quiz);
  await writeData('quizzes', quizzes);
  res.status(201).json(quiz);
});

app.delete('/api/quizzes/:id', authenticate, async (req, res) => {
  let quizzes = await readData('quizzes');
  const quiz = quizzes.find(q => q.id === req.params.id && q.userId === req.userId);
  if (!quiz) return res.status(404).json({ error: 'Quiz non trouvé.' });

  quizzes = quizzes.filter(q => q.id !== req.params.id);
  await writeData('quizzes', quizzes);

  let results = await readData('results');
  results = results.filter(r => r.quizId !== req.params.id);
  await writeData('results', results);

  res.json({ success: true });
});

// ============ Routes RESULTS ============

app.get('/api/results', authenticate, async (req, res) => {
  const results = await readData('results');
  res.json(results.filter(r => r.userId === req.userId));
});

app.post('/api/results', authenticate, async (req, res) => {
  const { quizId, quizTitle, answers, score, totalQuestions } = req.body;
  if (!quizId || answers === undefined || score === undefined) {
    return res.status(400).json({ error: 'Données du résultat incomplètes.' });
  }

  const results = await readData('results');
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
  await writeData('results', results);
  res.status(201).json(result);
});

// ============ Routes FOLDERS ============

app.get('/api/folders', authenticate, async (req, res) => {
  const folders = await readData('folders');
  res.json(folders.filter(f => f.userId === req.userId));
});

app.post('/api/folders', authenticate, async (req, res) => {
  const { name, parentId, color } = req.body;
  if (!name) return res.status(400).json({ error: 'Nom requis.' });

  const folders = await readData('folders');
  const folder = {
    id: crypto.randomUUID(),
    userId: req.userId,
    name,
    parentId: parentId || null,
    color: color || '#6366f1',
    createdAt: new Date().toISOString()
  };
  folders.push(folder);
  await writeData('folders', folders);
  res.status(201).json(folder);
});

app.put('/api/folders/:id', authenticate, async (req, res) => {
  const folders = await readData('folders');
  const idx = folders.findIndex(f => f.id === req.params.id && f.userId === req.userId);
  if (idx === -1) return res.status(404).json({ error: 'Dossier non trouvé.' });

  const { name, parentId, color } = req.body;
  if (name) folders[idx].name = name;
  if (parentId !== undefined) folders[idx].parentId = parentId;
  if (color) folders[idx].color = color;
  await writeData('folders', folders);
  res.json(folders[idx]);
});

app.delete('/api/folders/:id', authenticate, async (req, res) => {
  let folders = await readData('folders');
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
  await writeData('folders', folders);

  // Détache les fiches/cartes des dossiers supprimés
  let decks = await readData('flashcardDecks');
  decks = decks.map(d => allIds.includes(d.folderId) ? { ...d, folderId: null } : d);
  await writeData('flashcardDecks', decks);

  let mindmaps = await readData('mindmaps');
  mindmaps = mindmaps.map(m => allIds.includes(m.folderId) ? { ...m, folderId: null } : m);
  await writeData('mindmaps', mindmaps);

  res.json({ success: true });
});

// ============ Routes FLASHCARD DECKS ============

app.get('/api/flashcard-decks', authenticate, async (req, res) => {
  const decks = await readData('flashcardDecks');
  res.json(decks.filter(d => d.userId === req.userId));
});

app.post('/api/flashcard-decks', authenticate, async (req, res) => {
  const { title, folderId, cards } = req.body;
  if (!title) return res.status(400).json({ error: 'Titre requis.' });

  const decks = await readData('flashcardDecks');
  const deck = {
    id: crypto.randomUUID(),
    userId: req.userId,
    title,
    folderId: folderId || null,
    cards: cards || [],
    createdAt: new Date().toISOString()
  };
  decks.push(deck);
  await writeData('flashcardDecks', decks);
  res.status(201).json(deck);
});

app.put('/api/flashcard-decks/:id', authenticate, async (req, res) => {
  const decks = await readData('flashcardDecks');
  const idx = decks.findIndex(d => d.id === req.params.id && d.userId === req.userId);
  if (idx === -1) return res.status(404).json({ error: 'Paquet non trouvé.' });

  const { title, folderId, cards } = req.body;
  if (title !== undefined) decks[idx].title = title;
  if (folderId !== undefined) decks[idx].folderId = folderId;
  if (cards !== undefined) decks[idx].cards = cards;
  await writeData('flashcardDecks', decks);
  res.json(decks[idx]);
});

app.delete('/api/flashcard-decks/:id', authenticate, async (req, res) => {
  let decks = await readData('flashcardDecks');
  const deck = decks.find(d => d.id === req.params.id && d.userId === req.userId);
  if (!deck) return res.status(404).json({ error: 'Paquet non trouvé.' });

  decks = decks.filter(d => d.id !== req.params.id);
  await writeData('flashcardDecks', decks);
  res.json({ success: true });
});

// ============ Routes MINDMAPS ============

app.get('/api/mindmaps', authenticate, async (req, res) => {
  const mindmaps = await readData('mindmaps');
  res.json(mindmaps.filter(m => m.userId === req.userId));
});

app.post('/api/mindmaps', authenticate, async (req, res) => {
  const { title, folderId, root } = req.body;
  if (!title || !root) return res.status(400).json({ error: 'Titre et contenu requis.' });

  const mindmaps = await readData('mindmaps');
  const mindmap = {
    id: crypto.randomUUID(),
    userId: req.userId,
    title,
    folderId: folderId || null,
    root,
    createdAt: new Date().toISOString()
  };
  mindmaps.push(mindmap);
  await writeData('mindmaps', mindmaps);
  res.status(201).json(mindmap);
});

app.put('/api/mindmaps/:id', authenticate, async (req, res) => {
  const mindmaps = await readData('mindmaps');
  const idx = mindmaps.findIndex(m => m.id === req.params.id && m.userId === req.userId);
  if (idx === -1) return res.status(404).json({ error: 'Carte mentale non trouvée.' });

  const { title, folderId, root } = req.body;
  if (title !== undefined) mindmaps[idx].title = title;
  if (folderId !== undefined) mindmaps[idx].folderId = folderId;
  if (root !== undefined) mindmaps[idx].root = root;
  await writeData('mindmaps', mindmaps);
  res.json(mindmaps[idx]);
});

app.delete('/api/mindmaps/:id', authenticate, async (req, res) => {
  let mindmaps = await readData('mindmaps');
  const mindmap = mindmaps.find(m => m.id === req.params.id && m.userId === req.userId);
  if (!mindmap) return res.status(404).json({ error: 'Carte mentale non trouvée.' });

  mindmaps = mindmaps.filter(m => m.id !== req.params.id);
  await writeData('mindmaps', mindmaps);
  res.json({ success: true });
});

// ============ Servir le frontend Angular en production ============

const ANGULAR_DIST = path.join(__dirname, '..', 'dist', 'projetTest', 'browser');
if (fs.existsSync(ANGULAR_DIST)) {
  app.use(express.static(ANGULAR_DIST));
  app.get('{*path}', (req, res) => {
    res.sendFile(path.join(ANGULAR_DIST, 'index.html'));
  });
}

// ============ Démarrage du serveur ============

async function startServer() {
  if (USE_MONGO) {
    try {
      const client = new MongoClient(MONGODB_URI);
      await client.connect();
      db = client.db();
      console.log('✅ Connecté à MongoDB');

      // Créer les index pour les performances
      await db.collection('users').createIndex({ id: 1 }, { unique: true });
      await db.collection('users').createIndex({ email: 1 }, { unique: true });
      await db.collection('quizzes').createIndex({ userId: 1 });
      await db.collection('results').createIndex({ userId: 1 });
      await db.collection('folders').createIndex({ userId: 1 });
      await db.collection('flashcardDecks').createIndex({ userId: 1 });
      await db.collection('mindmaps').createIndex({ userId: 1 });
      await db.collection('avatars').createIndex({ userId: 1 }, { unique: true });
    } catch (err) {
      console.error('❌ Impossible de se connecter à MongoDB:', err.message);
      process.exit(1);
    }
  }

  app.listen(PORT, () => {
    console.log(`✅ Serveur MindForge démarré sur http://localhost:${PORT}`);
    console.log(`📦 Mode stockage : ${USE_MONGO ? 'MongoDB' : 'Fichiers JSON (local)'}`);
  });
}

startServer().catch(err => {
  console.error('❌ Erreur de démarrage:', err);
  process.exit(1);
});
