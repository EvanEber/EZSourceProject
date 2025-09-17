const express = require('express');
const path = require('path');
const fs = require('fs').promises;
const fsSync = require('fs');
const multer = require('multer');

const app = express();
const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = __dirname;
const RESOURCES_DIR = path.join(PUBLIC_DIR, 'Resources');
const PROPOSALS_JSON = path.join(RESOURCES_DIR, 'proposals.json');

// Ensure Resources directory exists
if (!fsSync.existsSync(RESOURCES_DIR)) {
  fsSync.mkdirSync(RESOURCES_DIR, { recursive: true });
}

// Multer storage: save uploaded .md files into Resources with a timestamped filename
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, RESOURCES_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const base = path.basename(file.originalname, ext).replace(/[^\w\-]/g, '_');
    const filename = `${Date.now()}-${base}${ext}`;
    cb(null, filename);
  }
});

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    if (!/\.md$/i.test(file.originalname)) {
      return cb(new Error('Only .md files are allowed'));
    }
    cb(null, true);
  },
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
});

// Serve static site files (upload.html, index.html, Resources, etc.)
app.use(express.static(PUBLIC_DIR));

// Upload endpoint
app.post('/upload', upload.single('file'), async (req, res) => {
  try {
    const { title, author, date, summary } = req.body;
    if (!title || !author || !date || !summary || !req.file) {
      // If multer rejected the file, req.file will be undefined
      return res.status(400).json({ success: false, message: 'Missing required fields or file' });
    }

    // Read existing proposals.json (create if missing)
    let proposalsData = { proposals: [] };
    try {
      const raw = await fs.readFile(PROPOSALS_JSON, 'utf8');
      proposalsData = JSON.parse(raw);
      if (!Array.isArray(proposalsData.proposals)) proposalsData.proposals = [];
    } catch (err) {
      // If file doesn't exist or is invalid, start fresh
      proposalsData = { proposals: [] };
    }

    const newEntry = {
      title: String(title).trim(),
      author: String(author).trim(),
      date: String(date).trim(),
      summary: String(summary).trim(),
      file: req.file.filename
    };

    proposalsData.proposals.push(newEntry);

    await fs.writeFile(PROPOSALS_JSON, JSON.stringify(proposalsData, null, 4), 'utf8');

    res.json({ success: true, message: 'Uploaded', entry: newEntry });
  } catch (err) {
    console.error('Upload error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Multer / other error handler (returns JSON instead of HTML)
app.use((err, req, res, next) => {
  console.error('Error handler:', err && err.message ? err.message : err);
  if (res.headersSent) return next(err);
  const status = err && err.statusCode ? err.statusCode : 400;
  res.status(status).json({ success: false, message: err.message || 'Upload error' });
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}/ (serving ${PUBLIC_DIR})`);
});