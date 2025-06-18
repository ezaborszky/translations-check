import { useEffect, useState } from "react";
import "./App.css";

function App() {
  const [files, setFiles] = useState([]);
  const [selectedFile, setSelectedFile] = useState(null);
  const [lines, setLines] = useState([]);
  const [verifiedLines, setVerifiedLines] = useState(new Set());

  const loadFiles = () => {
    fetch("/api/files")
      .then((res) => res.json())
      .then((data) => setFiles(data.files));
  };

  useEffect(() => {
    loadFiles();
  }, []);

  const openFile = (filePath) => {
    fetch(`http://localhost:3001/api/file?path=${encodeURIComponent(filePath)}`)
      .then((res) => res.json())
      .then((data) => {
        setSelectedFile(filePath);
        setLines(data.lines);
        setVerifiedLines(new Set());

        // Fix textarea heights after render
        setTimeout(() => {
          document.querySelectorAll("textarea").forEach((ta) => {
            ta.style.height = "auto";
            ta.style.height = ta.scrollHeight + "px";
          });
        }, 0);
      });
  };

  const verifyLine = (index) => {
    const text = lines[index].hu;
    fetch("http://localhost:3001/api/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ filePath: selectedFile, index, text }),
    }).then(() => {
      setVerifiedLines((prev) => new Set(prev).add(index));
      loadFiles();
    });
  };

  const resetVerification = () => {
    fetch("/api/reset", { method: "POST" }).then(() => {
      loadFiles();
      setVerifiedLines(new Set());
      setSelectedFile(null);
      setLines([]);
    });
  };

  return (
    <div className="app">
      <div className="sidebar">
        <button
          style={{ marginBottom: 12, background: "tomato", color: "white", cursor: "pointer" }}
          onClick={resetVerification}
          title="Reset all verification"
        >
          Reset Verification
        </button>

        {files.map((file) => (
          <div
            key={file.file}
            className={`file ${file.total === file.verified ? "green" : "red"}`}
            onClick={() => openFile(file.file)}
          >
            {file.file}
          </div>
        ))}
      </div>

      <div className="main">
        {selectedFile && (
          <>
            <h2>{selectedFile}</h2>

            {lines.map((line, idx) => (
              <div
                key={idx}
                className={`line ${verifiedLines.has(idx) ? "green" : ""}`}
                style={{ display: "flex", gap: "8px", alignItems: "stretch", marginBottom: 8 }}
              >
                {/* English readonly wrapped text */}

                <textarea
                  readOnly
                  value={line.en}
                  style={{
                    flexBasis: "50%",
                    minHeight: 80,
                    maxHeight: 200,
                    resize: "none",
                    borderRadius: 4,
                    border: "1px solid #ccc",
                    padding: "6px 8px",
                    fontFamily: "inherit",
                    fontSize: "1rem",
                    whiteSpace: "pre-wrap",
                    wordBreak: "break-word",
                    overflow: "auto",
                    backgroundColor: "#eee",
                    boxSizing: "border-box",
                  }}
                />


                {/* Hungarian editable multiline textarea */}

                <textarea
                  style={{
                    flexBasis: "50%",
                    minHeight: 80,
                    maxHeight: 200,
                    resize: "none",
                    borderRadius: 4,
                    border: "1px solid #ccc",
                    padding: "6px 8px",
                    fontFamily: "inherit",
                    fontSize: "1rem",
                    whiteSpace: "pre-wrap",
                    wordBreak: "break-word",
                    overflow: "auto", // <-- enable scrollbars
                    boxSizing: "border-box",
                  }}
                  value={line.hu}
                  onChange={(e) => {
                    const updated = [...lines];
                    updated[idx] = { ...updated[idx], hu: e.target.value };
                    setLines(updated);

                    setVerifiedLines((prev) => {
                      const copy = new Set(prev);
                      copy.delete(idx);
                      return copy;
                    });
                  }}
                />


                <button onClick={() => verifyLine(idx)}>✅</button>
              </div>
            ))}

          </>
        )}
      </div>
    </div>
  );
}

export default App;
