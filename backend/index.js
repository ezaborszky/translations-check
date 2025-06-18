const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = 3001;

const ROOT_DIR = path.resolve(__dirname, "../tsv-root");
const TRACKER_PATH = path.join(__dirname, "tracker.txt");

app.use(cors());
app.use(express.json());

// Recursively find all .tsv files
function getAllTsvFiles(dir, fileList = []) {
  const files = fs.readdirSync(dir);
  files.forEach((file) => {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      getAllTsvFiles(fullPath, fileList);
    } else if (file.endsWith(".tsv")) {
      fileList.push(path.relative(ROOT_DIR, fullPath));
    }
  });
  return fileList.sort();
}

// Load verified lines from tracker.txt
function loadTracker() {
  const map = {};
  if (!fs.existsSync(TRACKER_PATH)) return map;
  const lines = fs.readFileSync(TRACKER_PATH, "utf8").split("\n");
  for (const line of lines) {
    const [file, index] = line.trim().split("\t");
    if (!file || index === undefined) continue;
    if (!map[file]) map[file] = new Set();
    map[file].add(parseInt(index));
  }
  return map;
}

// Append to tracker.txt
function saveToTracker(file, index) {
  fs.appendFileSync(TRACKER_PATH, `${file}\t${index}\n`);
}

// List all files with verification status
app.get("/api/files", (req, res) => {
  const files = getAllTsvFiles(ROOT_DIR);
  const tracker = loadTracker();

  const fileStatus = files.map((file) => {
    const fullPath = path.join(ROOT_DIR, file);
    const lines = fs.readFileSync(fullPath, "utf8").split("\n").filter(Boolean);
    const total = lines.length - 1; // excluding header
    const verified = tracker[file] ? tracker[file].size : 0;
    return { file, total, verified };
  });

  res.json({ files: fileStatus });
});

// Get hu and en lines from file (adding hu column if needed)
app.get("/api/file", (req, res) => {
  const relPath = req.query.path;
  const fullPath = path.join(ROOT_DIR, relPath);

  if (!fs.existsSync(fullPath)) return res.status(404).send("File not found");

  let rows = fs.readFileSync(fullPath, "utf8").split("\n").filter(Boolean);
  let headers = rows[0].split("\t");
  const enIndex = headers.indexOf("en");
  let huIndex = headers.indexOf("hu");

  if (enIndex === -1) return res.status(400).send("Missing 'en' column");

  // Add hu column if missing
  if (huIndex === -1) {
    headers.push("hu");
    huIndex = headers.length - 1;

    rows = [headers.join("\t")].concat(
      rows.slice(1).map((line) => {
        const cols = line.split("\t");
        while (cols.length < headers.length) cols.push(""); // pad hu
        return cols.join("\t");
      })
    );

    fs.writeFileSync(fullPath, rows.join("\n"));
  }

  // Extract line-by-line hu + en for frontend
  const lines = rows.slice(1).map((line) => {
    const cols = line.split("\t");
    return {
      hu: cols[huIndex] || "",
      en: cols[enIndex] || "",
    };
  });

  res.json({ lines });
});

// Verify a line: update 'hu' column only

app.post("/api/verify", (req, res) => {
  const { filePath, index, text } = req.body;
  const fullPath = path.join(ROOT_DIR, filePath);
  if (!fs.existsSync(fullPath)) return res.status(404).send("File not found");

  const content = fs.readFileSync(fullPath, "utf8");
  const rows = content.split("\n");
  if (rows[rows.length - 1].trim() === "") rows.pop(); // remove empty trailing line

  const headers = rows[0].split("\t");
  const huIndex = headers.indexOf("hu");

  if (huIndex === -1) return res.status(400).send("No 'hu' column found");

  const targetRow = rows[index + 1].split("\t");

  // Make sure the row has enough columns
  while (targetRow.length < headers.length) {
    targetRow.push("");
  }

  targetRow[huIndex] = text;
  rows[index + 1] = targetRow.join("\t");

  fs.writeFileSync(fullPath, rows.join("\n"));
  saveToTracker(filePath, index);

  res.sendStatus(200);
});


// Reset all verification
app.post("/api/reset", (req, res) => {
  try {
    if (fs.existsSync(TRACKER_PATH)) {
      fs.writeFileSync(TRACKER_PATH, ""); // Clear the tracker file
    }
    res.sendStatus(200);
  } catch (err) {
    console.error("Error resetting tracker:", err);
    res.status(500).send("Could not reset tracker");
  }
});


// Start server
app.listen(PORT, () => {
  console.log(`TSV verifier backend running on http://localhost:${PORT}`);
});
