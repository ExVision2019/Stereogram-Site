const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const multer = require('multer');
const path = require('path');
const bodyParser = require('body-parser');
const fs = require('fs');

const app = express();
const port = 3000;

const { createCanvas, loadImage } = require('canvas');

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, 'public', 'uploads');
if (!fs.existsSync(uploadsDir)){
    fs.mkdirSync(uploadsDir, { recursive: true });
}

// Database setup
const db = new sqlite3.Database('templates.db');
db.run("CREATE TABLE IF NOT EXISTS templates (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, filename TEXT)");

// Middleware
app.use(bodyParser.json());
app.use(express.static('public'));
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// File upload configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname));
  }
});
const upload = multer({ storage: storage });

// Routes
app.get('/', (req, res) => {
  res.render('index');
});

app.get('/admin', (req, res) => {
  res.render('admin');
});

app.get('/api/templates', (req, res) => {
  db.all("SELECT * FROM templates", [], (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(rows);
  });
});

app.post('/api/templates', upload.single('image'), (req, res) => {
  const { name } = req.body;
  const filename = req.file.filename;
  
  db.run("INSERT INTO templates (name, filename) VALUES (?, ?)", [name, filename], function(err) {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json({ id: this.lastID, name, filename });
  });
});

app.delete('/api/templates/:id', (req, res) => {
  db.run("DELETE FROM templates WHERE id = ?", req.params.id, function(err) {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json({ message: "Template deleted successfully" });
  });
});

app.post('/generate-stereogram', upload.single('depthImage'), async (req, res) => {
  try {
    const { separation, depthStrength, templateId } = req.body;
    const depthImage = await loadImage(req.file.path);
    
    // Fetch template image
    const template = await new Promise((resolve, reject) => {
      db.get("SELECT filename FROM templates WHERE id = ?", templateId, (err, row) => {
        if (err) reject(err);
        else if (row) resolve(row.filename);
        else reject(new Error('Template not found'));
      });
    });
    const templateImage = await loadImage(path.join(uploadsDir, template));

    // Generate stereogram
    const stereogram = createStereogram(depthImage, parseInt(separation), parseInt(depthStrength), templateImage);

    // Send the generated stereogram
    res.set('Content-Type', 'image/png');
    stereogram.createPNGStream().pipe(res);
  } catch (error) {
    console.error('Error generating stereogram:', error);
    res.status(500).json({ error: 'An error occurred while generating the stereogram.' });
  }
});

app.post('/generate-stereogram', upload.single('depthImage'), async (req, res) => {
  try {
    const { separation, depthStrength, templateId } = req.body;
    const depthImage = await loadImage(req.file.path);
    
    // Fetch template image
    const template = await new Promise((resolve, reject) => {
      db.get("SELECT filename FROM templates WHERE id = ?", templateId, (err, row) => {
        if (err) reject(err);
        else if (row) resolve(row.filename);
        else reject(new Error('Template not found'));
      });
    });
    const templateImage = await loadImage(path.join(uploadsDir, template));

    // Generate stereogram
    const stereogram = createStereogram(depthImage, parseInt(separation), parseInt(depthStrength), templateImage);

    // Send the generated stereogram
    res.set('Content-Type', 'image/png');
    stereogram.createPNGStream().pipe(res);
  } catch (error) {
    console.error('Error generating stereogram:', error);
    res.status(500).json({ error: 'An error occurred while generating the stereogram.' });
  }
});

function createPattern(width, height, templateImage) {
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');

  if (templateImage) {
    const aspectRatio = templateImage.width / templateImage.height;
    const newHeight = width / aspectRatio;
    ctx.drawImage(templateImage, 0, 0, width, newHeight);
    
    // Repeat the pattern vertically if needed
    let y = newHeight;
    while (y < height) {
      ctx.drawImage(canvas, 0, 0, width, newHeight, 0, y, width, Math.min(newHeight, height - y));
      y += newHeight;
    }
  } else {
    // Create a random pattern if no template image is provided
    const imageData = ctx.createImageData(width, height);
    const data = imageData.data;
    for (let i = 0; i < data.length; i += 4) {
      const value = Math.floor(Math.random() * 256);
      data[i] = value;     // Red
      data[i+1] = value;   // Green
      data[i+2] = value;   // Blue
      data[i+3] = 255;     // Alpha
    }
    ctx.putImageData(imageData, 0, 0);
  }

  return canvas;
}

function createStereogram(depth, separation, depthStrength, templateImage) {
  const width = depth.width;
  const height = depth.height;

  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');

  const pattern = createPattern(separation, height, templateImage);
  const depthCanvas = createCanvas(width, height);
  const depthCtx = depthCanvas.getContext('2d');
  depthCtx.drawImage(depth, 0, 0);
  const depthData = depthCtx.getImageData(0, 0, width, height).data;

  // Draw initial pattern
  for (let x = 0; x < width; x += separation) {
    ctx.drawImage(pattern, x, 0);
  }

  const imageData = ctx.getImageData(0, 0, width, height);
  const pixels = imageData.data;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (x < separation) continue;

      const depthValue = depthData[(y * width + x) * 4] / 255.0;
      const shift = Math.floor(depthValue * separation * (depthStrength / 100));
      
      const leftPos = x - separation + shift;
      const rightPos = x;

      if (leftPos >= 0 && leftPos < width) {
        for (let i = 0; i < 3; i++) {
          pixels[(y * width + rightPos) * 4 + i] = pixels[(y * width + leftPos) * 4 + i];
        }
      }
    }
  }

  ctx.putImageData(imageData, 0, 0);
  return canvas;
}

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});