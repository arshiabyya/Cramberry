import React, { useEffect, useRef, useState } from "react";
import { v4 as uuid } from "uuid";

// Background Images
import CramberryLogo from "./images/CramberryLogo.png";
import LeftSidebar from "./images/LeftSidebar.png";
import BackgroundBubble from "./images/BackgroundBubble.png";
import RightSidebar from "./images/RightSidebar.png";
import GridBG from "./images/Grid.png";

import GridButton from "./Buttons";
import "./App.css";

export default function App() {
  const [message, setMessage] = useState("Loading...");
  const [error, setError] = useState(null);

  // ===== Split Preview =====
  const [activeDoc, setActiveDoc] = useState(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const openInPreview = (item) => {
    setActiveDoc(item);
    setIsPreviewOpen(true);
  };
  const closePreview = () => {
    setActiveDoc(null);
    setIsPreviewOpen(false);
  };

  // ===== Backend hello =====
  useEffect(() => {
    fetch(
      process.env.REACT_APP_NGROK_URL ||
        "https://00d9ffb38e24.ngrok-free.app/api/hello",
      { headers: { "ngrok-skip-browser-warning": "true" } }
    )
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP error! status: ${r.status}`);
        return r.json();
      })
      .then((d) => setMessage(d.message))
      .catch((err) => {
        console.error(err);
        setError(err.message);
        setMessage("Error loading message");
      });
  }, []);

  // ===== Refs =====
  const gridRef = useRef(null);
  const inputRef = useRef(null);

  // ===== Items (grid content) =====
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

  // ===== Coords helper =====
  const toGrid = (clientX, clientY) => {
    const rect = gridRef.current.getBoundingClientRect();
    return { x: clientX - rect.left, y: clientY - rect.top };
  };

  // ===== Upload helpers =====
  const API_BASE = process.env.REACT_APP_API_BASE || null;

  const uploadFile = async (file) => {
    if (!API_BASE) {
      return {
        url: URL.createObjectURL(file),
        originalName: file.name,
        mime: file.type,
      };
    }
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch(`${API_BASE}/api/upload`, {
      method: "POST",
      body: fd,
    });
    if (!res.ok) throw new Error("Upload failed");
    const data = await res.json();
    return {
      url: API_BASE ? `${API_BASE}${data.url}` : data.url,
      originalName: data.originalName,
      mime: data.mime,
    };
  };

  const addFilesAt = async (fileList, gx = 40, gy = 40) => {
    if (!fileList || !fileList.length) return;
    const files = Array.from(fileList);
    const metas = await Promise.all(files.map(uploadFile));
    const toAdd = metas.map((m, i) => ({
      id: uuid(),
      name: m.originalName,
      type: (m.mime || "").startsWith("image/") ? "image" : "file",
      url: m.url,
      mime: m.mime || "",
      x: gx + i * 24,
      y: gy + i * 24,
      parentFolderId: null,
    }));
    setItems((prev) => [...prev, ...toAdd]);
  };

  // ===== Drag/drop onto grid =====
  const onGridDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
  };

  const moveItemToGrid = (itemId, x, y) => {
    setItems((prevItems) => {
      let itemToMove = null;
      let newItems = [...prevItems];

      // Pull from folder children if needed
      newItems = newItems.map((item) => {
        if (item.type === "folder" && item.children) {
          const idx = item.children.findIndex((c) => c.id === itemId);
          if (idx !== -1) {
            itemToMove = { ...item.children[idx] };
            return {
              ...item,
              children: item.children.filter((c) => c.id !== itemId),
            };
          }
        }
        return item;
      });

      if (itemToMove) {
        newItems.push({
          ...itemToMove,
          x,
          y,
          parentFolderId: null,
        });
      } else {
        newItems = newItems.map((it) =>
          it.id === itemId ? { ...it, x, y } : it
        );
      }
      return newItems;
    });
  };

  const onGridDrop = (e) => {
    e.preventDefault();
    const { x, y } = toGrid(e.clientX, e.clientY);

    // If files dropped -> upload
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      addFilesAt(e.dataTransfer.files, x, y);
      return;
    }

    // Else moving existing item (from grid or folder)
    const data = e.dataTransfer.getData("text/plain");
    if (!data) return;

    // When dragging from folder children we set JSON; from grid we set id string
    try {
      const maybe = JSON.parse(data);
      if (maybe.folderId && maybe.childId) {
        moveItemToGrid(maybe.childId, x, y);
        return;
      }
    } catch {}
    moveItemToGrid(data, x, y);
  };

  // ===== File picker =====
  const openPicker = () => inputRef.current?.click();
  const onPick = (e) => addFilesAt(e.target.files);

  // ===== Folders =====
  const createFolder = (name) => ({
    id: uuid(),
    name: name || "New Folder",
    type: "folder",
    url: null,
    x: 40,
    y: 40,
    parentFolderId: null,
    children: [],
  });

  const [dragOverFolder, setDragOverFolder] = useState(null);

  const takeChildOut = (folderId, childId, x = 100, y = 100) => {
    setItems((prev) => {
      let childToMove = null;
      const updated = prev.map((item) => {
        if (item.id === folderId && item.type === "folder") {
          const idx = item.children.findIndex((c) => c.id === childId);
          if (idx !== -1) {
            childToMove = { ...item.children[idx] };
            return {
              ...item,
              children: item.children.filter((c) => c.id !== childId),
            };
          }
        }
        return item;
      });
      if (childToMove) {
        updated.push({ ...childToMove, parentFolderId: null, x, y });
      }
      return updated;
    });
  };

  const handleFolderDrop = (e, folderId) => {
    e.preventDefault();
    e.stopPropagation();

    const payload = e.dataTransfer.getData("text/plain");
    if (!payload || payload === folderId) return;

    setItems((prevItems) => {
      let fileToMove = null;
      let updatedItems = [...prevItems];

      // Remove from grid or from another folder
      updatedItems = updatedItems
        .map((item) => {
          if (item.id === payload && !item.parentFolderId) {
            fileToMove = { ...item };
            return null; // remove from top-level
          } else if (item.type === "folder" && item.children) {
            const idx = item.children.findIndex((c) => c.id === payload);
            if (idx !== -1) {
              fileToMove = { ...item.children[idx] };
              return {
                ...item,
                children: item.children.filter((c) => c.id !== payload),
              };
            }
          }
          return item;
        })
        .filter(Boolean);

      if (!fileToMove) return prevItems;

      // Add to target folder
      updatedItems = updatedItems.map((item) => {
        if (item.id === folderId && item.type === "folder") {
          return {
            ...item,
            children: [
              ...(item.children || []),
              { ...fileToMove, parentFolderId: folderId },
            ],
          };
        }
        return item;
      });

      return updatedItems;
    });

    setDragOverFolder(null);
  };

  // ===== Dragging items around grid =====
  const draggingId = useRef(null);
  const dragOffset = useRef({ x: 0, y: 0 });

  const onItemPointerDown = (e, itemId) => {
    const rect = e.currentTarget.getBoundingClientRect();
    dragOffset.current = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
    draggingId.current = itemId;
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };

  const onGridPointerMove = (e) => {
    if (!draggingId.current) return;
    const { x, y } = toGrid(e.clientX, e.clientY);
    setItems((prev) =>
      prev.map((it) =>
        it.id === draggingId.current
          ? { ...it, x: x - dragOffset.current.x, y: y - dragOffset.current.y }
          : it
      )
    );
  };

  const onGridPointerUp = (e) => {
    if (draggingId.current) {
      e.currentTarget.releasePointerCapture?.(e.pointerId);
    }
    draggingId.current = null;
  };

  // ===== Remove / Clear =====
  const removeItem = (id) => {
    setItems((prev) => {
      let updated = prev.filter((it) => it.id !== id);
      updated = updated.map((item) => {
        if (item.type === "folder" && item.children) {
          return {
            ...item,
            children: item.children.filter((c) => c.id !== id),
          };
        }
        return item;
      });
      try {
        localStorage.setItem("grid-items-v1", JSON.stringify(updated));
      } catch {}
      return updated;
    });
  };

  const clearAllItems = () => setItems([]);

  if (error) return <div>Error: {error}</div>;

  return (
    <div>
      <div className="container">
        {/* Background */}
        <img
          className="Background-Bubble"
          src={BackgroundBubble}
          alt="Background Bubble"
          style={{ zIndex: 1 }}
        />

        {/* Grid */}
        <div
          ref={gridRef}
          className="Grid Grid--interactive"
          style={{ zIndex: 2, backgroundImage: `url(${GridBG})` }}
          onDrop={onGridDrop}
          onDragOver={onGridDragOver}
          onPointerMove={onGridPointerMove}
          onPointerUp={onGridPointerUp}
        >
          <button className="grid-upload-btn" onClick={openPicker}>
            + Upload file
          </button>
          <button
            className="folder-create-btn"
            onClick={() => setItems((prev) => [...prev, createFolder()])}
          >
            + Create Folder
          </button>
          <input
            ref={inputRef}
            type="file"
            multiple
            onChange={onPick}
            style={{ display: "none" }}
          />

          {/* Render top-level items */}
          {items
            .filter((it) => it.parentFolderId == null)
            .map((it) => (
              <div
                key={it.id}
                className="grid-item"
                style={{ left: it.x, top: it.y }}
                draggable
                onPointerDown={(e) => onItemPointerDown(e, it.id)}
                onDragStart={(e) => {
                  // dragging from grid sends plain id
                  e.dataTransfer.setData("text/plain", it.id);
                }}
              >
                {it.type === "folder" ? (
                  <div className="grid-item-folder-wrapper">
                    <div className="grid-item-folder" title={it.name}>
                      📁 {it.name}
                    </div>

                    {/* Add-to-folder drop square */}
                    <div
                      className={`folder-drop-zone ${
                        dragOverFolder === it.id ? "drag-over" : ""
                      }`}
                      onDrop={(e) => handleFolderDrop(e, it.id)}
                      onDragOver={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                      }}
                      onDragEnter={(e) => {
                        e.preventDefault();
                        setDragOverFolder(it.id);
                      }}
                      onDragLeave={(e) => {
                        e.preventDefault();
                        setDragOverFolder(null);
                      }}
                    >
                      ➕
                    </div>

                    {/* Remove-from-folder (drop out) square */}
                    <div
                      className={`folder-remove-zone ${
                        dragOverFolder === it.id + "-remove" ? "drag-over" : ""
                      }`}
                      onDrop={(e) => {
                        e.preventDefault();
                        const data = e.dataTransfer.getData("text/plain");
                        if (!data) return;
                        const { folderId, childId } = (() => {
                          try {
                            return JSON.parse(data);
                          } catch {
                            return {};
                          }
                        })();
                        const { x, y } = toGrid(e.clientX, e.clientY);
                        if (folderId && childId) {
                          takeChildOut(folderId, childId, x, y);
                        } else if (childId) {
                          moveItemToGrid(childId, x, y);
                        }
                        setDragOverFolder(null);
                      }}
                      onDragOver={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                      }}
                      onDragEnter={(e) => {
                        e.preventDefault();
                        setDragOverFolder(it.id + "-remove");
                      }}
                      onDragLeave={(e) => {
                        e.preventDefault();
                        setDragOverFolder(null);
                      }}
                    >
                      ➖
                    </div>

                    {/* Render children inside folder */}
                    {it.children &&
                      it.children.map((child) => (
                        <div
                          key={child.id}
                          draggable
                          onDragStart={(e) => {
                            e.stopPropagation();
                            e.dataTransfer.setData(
                              "text/plain",
                              JSON.stringify({
                                folderId: it.id,
                                childId: child.id,
                              })
                            );
                          }}
                          title={child.name}
                        >
                          {child.type === "image" ? (
                            <>
                              <img
                                src={child.url}
                                alt={child.name}
                                className="grid-item-thumb"
                                draggable={false}
                              />
                              <div className="folder-child-name">
                                {child.name}
                              </div>
                            </>
                          ) : (
                            <>
                              <div
                                className="grid-item-file"
                                title={child.name}
                              >
                                📄 {child.name}
                              </div>
                              <div className="folder-child-name">
                                {child.name}
                              </div>
                            </>
                          )}
                        </div>
                      ))}
                  </div>
                ) : it.type === "image" ? (
                  <img
                    src={it.url}
                    alt={it.name}
                    className="grid-item-thumb"
                  />
                ) : (
                  <div className="grid-item-file" title={it.name}>
                    📄 {it.name}
                  </div>
                )}

                <div className="grid-item-row">
                  <div className="grid-item-name" title={it.name}>
                    {it.name}
                  </div>
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

        {/* Left Sidebar */}
        <div className="LeftSidebarWrapper">
          <img
            className="Left-Sidebar"
            src={LeftSidebar}
            alt="Left Sidebar"
            style={{ zIndex: 3 }}
          />
          <div className="SidebarFileList">
            {items
              .filter((it) => !it.parentFolderId)
              .map((it) => (
                <div key={it.id} className="file-row">
                  <span className="file-name">{it.name}</span>
                  <button
                    className="file-open-btn"
                    onClick={() => openInPreview(it)}
                  >
                    Open
                  </button>
                </div>
              ))}
          </div>
        </div>

        {/* Right Sidebar PNG and Logo */}
        <img
          className="Right-Sidebar"
          src={RightSidebar}
          alt="Right Sidebar"
          style={{ zIndex: 3 }}
        />
        <img
          className="Cramberry-Logo"
          src={CramberryLogo}
          alt="Cramberry Logo"
          style={{ zIndex: 4 }}
        />

        <GridButton
          style={{
            transform: "scale(0.5)",
            transformOrigin: "center",
            position: "absolute",
            top: "-5px",
            left: "1240px",
            zIndex: 10,
          }}
        />

        {/* Split Preview */}
        {isPreviewOpen && activeDoc && (
          <div className="PreviewPane" style={{ zIndex: 12 }}>
            <div className="preview-header">
              <div className="preview-title" title={activeDoc.name}>
                {activeDoc.name}
              </div>
              <div className="preview-actions">
                <a
                  className="preview-download"
                  href={activeDoc.url}
                  target="_blank"
                  rel="noreferrer"
                >
                  Open in new tab
                </a>
                <button className="preview-close" onClick={closePreview}>
                  ✕
                </button>
              </div>
            </div>
            <div className="preview-body">
              {activeDoc.type === "image" ? (
                <img
                  src={activeDoc.url}
                  alt={activeDoc.name}
                  className="preview-img"
                />
              ) : (
                <iframe
                  title={activeDoc.name}
                  className="preview-iframe"
                  src={activeDoc.url}
                />
              )}
            </div>
          </div>
        )}
      </div>

      <div>
        <h1>Message from backend: {message}</h1>
        <button onClick={clearAllItems}>Clear All Items</button>
      </div>
    </div>
  );
}
