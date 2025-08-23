// frontend/src/App.js
import React, { useEffect, useRef, useState } from "react";
import { v4 as uuid } from "uuid";

// PNG layers (unchanged)
import CramberryLogo from "./images/CramberryLogo.png";
import LeftSidebar from "./images/LeftSidebar.png";
import BackgroundBubble from "./images/BackgroundBubble.png";
import RightSidebar from "./images/RightSidebar.png";
import GridBG from "./images/Grid.png";

// Your existing button cluster (unchanged)
import GridButton from "./Buttons";

import "./App.css";

export default function App() {
  // -------------------------------
  // Backend “hello” message (unchanged)
  // -------------------------------
  const [message, setMessage] = useState("Loading...");
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch(process.env.REACT_APP_NGROK_URL || "https://84e34d8b1d56.ngrok-free.app/api/hello", {
      headers: { "ngrok-skip-browser-warning": "true" },
    })
      .then((response) => {
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        return response.json();
      })
      .then((data) => setMessage(data.message))
      .catch((err) => {
        console.error("Error:", err);
        setError(err.message);
        setMessage("Error loading message");
      });
  }, []);

  // -------------------------------
  // Grid: uploads + dragging
  // -------------------------------
  const gridRef = useRef(null);
  const inputRef = useRef(null);

  // each item: {id, name, type: 'image'|'file', url, x,y}
  const [items, setItems] = useState(() => {
    try {
      const raw = localStorage.getItem("grid-items-v1");
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem("grid-items-v1", JSON.stringify(items));
    } catch {}
  }, [items]);

  // convert screen coords to grid-local coords
  const toGrid = (clientX, clientY) => {
    const rect = gridRef.current.getBoundingClientRect();
    return { x: clientX - rect.left, y: clientY - rect.top };
  };

  const API_BASE = process.env.REACT_APP_API_BASE || null; // e.g. http://localhost:3001

  // Try uploading to server if API_BASE exists. Otherwise fall back to objectURL for preview only.
  const uploadFile = async (file) => {
    if (!API_BASE) {
      // client-only preview
      return {
        url: URL.createObjectURL(file),
        originalName: file.name,
        mime: file.type,
      };
    }
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch(`${API_BASE}/api/upload`, { method: "POST", body: fd });
    if (!res.ok) throw new Error("Upload failed");
    const data = await res.json(); // {url, originalName, mime, size}
    return {
      url: API_BASE ? `${API_BASE}${data.url}` : data.url,
      originalName: data.originalName,
      mime: data.mime,
    };
  };

  const addFilesAt = async (fileList, gx = 40, gy = 40) => {
    if (!fileList || !fileList.length) return;
    const files = Array.from(fileList);

    // Upload (or objectURL) in parallel:
    const metas = await Promise.all(files.map(uploadFile));

    const toAdd = metas.map((m, i) => ({
      id: uuid(),
      name: m.originalName,
      type: (m.mime || "").startsWith("image/") ? "image" : "file",
      url: m.url,
      x: gx + i * 24,
      y: gy + i * 24,
    }));
    setItems((prev) => [...prev, ...toAdd]);
  };

  // Drag & drop handlers on the grid
  const onGridDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
  };
  const onGridDrop = (e) => {
    e.preventDefault();
    const { x, y } = toGrid(e.clientX, e.clientY);
    addFilesAt(e.dataTransfer.files, x, y);
  };

  // Click-to-upload
  const openPicker = () => inputRef.current?.click();
  const onPick = (e) => addFilesAt(e.target.files);

  // Drag individual items around
  const draggingId = useRef(null);
  const dragOffset = useRef({ x: 0, y: 0 });

  const onItemPointerDown = (e, id) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    draggingId.current = id;
    const item = items.find((it) => it.id === id);
    const { x, y } = toGrid(e.clientX, e.clientY);
    dragOffset.current = { x: x - item.x, y: y - item.y };
  };

  const onGridPointerMove = (e) => {
    if (!draggingId.current) return;
    const { x, y } = toGrid(e.clientX, e.clientY);
    setItems((prev) =>
      prev.map((it) => (it.id === draggingId.current ? { ...it, x: x - dragOffset.current.x, y: y - dragOffset.current.y } : it))
    );
  };

  const onGridPointerUp = (e) => {
    if (draggingId.current) {
      e.currentTarget.releasePointerCapture?.(e.pointerId);
    }
    draggingId.current = null;
  };

  const removeItem = (id) => {
  setItems((prev) => {
    const updated = prev.filter((it) => it.id !== id);
    try {
      localStorage.setItem("grid-items-v1", JSON.stringify(updated));
    } catch {}
    console.log("Removing item:", id);
    return updated;
  });
};

  if (error) {
    return <div>Error: {error}</div>;
  }

  return (
    <div>
      <div className="container">
        {/* PNG background layers (unchanged visuals) */}
        <img className="Background-Bubble" src={BackgroundBubble} alt="Background Bubble" style={{ zIndex: 1 }} />

        {/* INTERACTIVE GRID — uses Grid.png as a background image */}
        <div
          ref={gridRef}
          className="Grid Grid--interactive"
          style={{ zIndex: 2, backgroundImage: `url(${GridBG})` }}
          onDrop={onGridDrop}
          onDragOver={onGridDragOver}
          onPointerMove={onGridPointerMove}
          onPointerUp={onGridPointerUp}
        >
          {/* Top-right helper to pick files */}
          <button className="grid-upload-btn" onClick={openPicker}>+ Add to grid</button>
          <input ref={inputRef} type="file" multiple onChange={onPick} style={{ display: "none" }} />

          {/* Render placed items */}
          {items.map((it) => (
            <div
              key={it.id}
              className="grid-item"
              style={{ left: it.x, top: it.y }}
              onPointerDown={(e) => {
                if (e.target.closest(".grid-item-del")) return; // Ignore clicks on delete button
                onItemPointerDown(e, it.id);
              }}
            >

              {it.type === "image" ? (
                <img src={it.url} alt={it.name} className="grid-item-thumb" />
              ) : (
                <div className="grid-item-file" title={it.name}>
                  <span role="img" aria-label="file">📄</span>
                </div>
              )}
              <div className="grid-item-row">
                <div className="grid-item-name" title={it.name}>{it.name}</div>
                <button
                  className="grid-item-del"
                  onClick={(e) => {
                    e.stopPropagation();
                    removeItem(it.id);
                  }}
                  title="Remove"
                >
                  ✕
                </button>


              </div>
            </div>
          ))}
        </div>

        {/* Other PNG layers */}
        <img className="Left-Sidebar" src={LeftSidebar} alt="Left Sidebar" style={{ zIndex: 3 }} />
        <img className="Right-Sidebar" src={RightSidebar} alt="Right Sidebar" style={{ zIndex: 3 }} />
        <img className="Cramberry-Logo" src={CramberryLogo} alt="Cramberry Logo" style={{ zIndex: 4 }} />

        {/* Your button cluster */}
        <GridButton style={{ position: "absolute", top: "0px", left: "1200px", zIndex: 10 }} />
      </div>

      <div>
        <h1>Message from backend: {message}</h1>
      </div>
    </div>
  );
}
