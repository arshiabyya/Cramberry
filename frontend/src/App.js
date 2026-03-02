import React, { useEffect, useRef, useState } from "react";
import { v4 as uuid } from "uuid";

//Background Images
import LogoImage from "./assets/LogoImage.png"; // New logo image import
import Canvas from "./assets/Canvas.png";
import LeftSidebar from "./assets/LeftSidebar.png";
import GridBG from "./assets/Grid.png";
import FolderBackground from "./assets/FolderBackground.png";
import FolderNameBubble from "./assets/FolderNameBubble.png";
import CollapseFolderButton from "./assets/CollapseFolderButton.png";
import ExpandFolderButton from "./assets/CollapseFolderButton.png";
import AddFolderButton from "./assets/AddFileLogo.png";
import RemoveFolderButton from "./assets/RemoveFileLogo.png";

import GridButton from "./Buttons";

import SidebarFileList from "./SidebarFileList";

import "./App.css";

export default function App() {
  const [message, setMessage] = useState("Loading...");
  const [error, setError] = useState(null);
  const [expandedFolders, setExpandedFolders] = React.useState({});

  useEffect(() => {
    setItems(prev => {
      const filtered = prev.filter(
        item => !(item.id === "root-folder" && item.parentFolderId !== null)
      );
    
    if (!filtered.find(item => item.id === "root-folder")) {
      return [
        {
          id: "root-folder",
          name: "My Files",
          type: "folder",
          x: 40,
          y: 40,
          parentFolderId: null,
        },
        ...filtered,
      ];
    }
    return filtered;
  });

    fetch(process.env.REACT_APP_NGROK_URL || "https://4887-2601-646-9900-2ad0-9df7-3cf3-3a5-67c5.ngrok-free.app/api/hello", {
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

// Grid Uploads

  const gridRef = useRef(null);
  const inputRef = useRef(null);

//Item storage

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

//Convert screen coords to grid-local coords

  const toGrid = (clientX, clientY) =>
  {
    const rect = gridRef.current.getBoundingClientRect();
    return { x: clientX - rect.left, y: clientY - rect.top };
  };

  const API_BASE = process.env.REACT_APP_API_BASE || null;

//Upload function

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
    const res = await fetch(`${API_BASE}/api/upload`, { method: "POST", body: fd });
    if (!res.ok) throw new Error("Upload failed");
    const data = await res.json();
    return {
      url: API_BASE ? `${API_BASE}${data.url}` : data.url,
      originalName: data.originalName,
      mime: data.mime,
    };
  };

 const addFilesAt = async (fileList, gx = 40, gy = 40, folderId = "root-folder") => {
    if (!fileList || !fileList.length) return;
    const files = Array.from(fileList);

    const metas = await Promise.all(files.map(uploadFile));

    const toAdd = metas.map((m, i) => ({
      id: uuid(),
      name: m.originalName,
      type: (m.mime || "").startsWith("image/") ? "image" : "file",
      url: m.url,
      x: gx + i * 24,
      y: gy + i * 24,
      parentFolderId: "root-folder", // assign folder dynamically
    }));

    setItems((prev) => [...prev, ...toAdd]);
  };


// Grid drag and drop

  const onGridDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
  };
  const onGridDrop = (e) => {
    e.preventDefault();
    const { x, y } = toGrid(e.clientX, e.clientY);


//Check if files are being dropped or being moved out of folder

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0)
    {
      addFilesAt(e.dataTransfer.files, x, y);
    }
    else
    {
      const itemId = e.dataTransfer.getData("text/plain");
      if(itemId)
      {
        moveItemToGrid(itemId, x, y);
      }
    }
  };

//Moving item out off folder method

const moveItemToGrid = (itemId, x, y) => {
  setItems(prevItems =>
    prevItems.map(item =>
      item.id === itemId
        ? { ...item, x, y, parentFolderId: null } // remove from folder
        : item
    )
  );
};


//File picker

  const openPicker = () => inputRef.current?.click();
  const onPick = (e) => addFilesAt(e.target.files);

//Create folder
  
  const createFolder = (name) => {
  const folder = {
    id: uuid(),
    name: name || "New Folder",
    type: "folder",   // <--- put this back
    url: null,
    x: 40,
    y: 40,
    parentFolderId: null,
  };
  return folder; // <--- must return it
};

//Folder drop handler

const [dragOverFolder, setDragOverFolder] = useState(null);

const [takeOutMode, setTakeOutMode] = useState(false);


const handleFolderDrop = (e, folderId) => {
  e.preventDefault();
  e.stopPropagation();

  const data = e.dataTransfer.getData("text/plain");
  if (!data) return;

  let childId;
  try {
    // If dragging from a folder, data is JSON
    const parsed = JSON.parse(data);
    childId = parsed.childId;
  } catch {
    // If dragging from grid, data is just the file id
    childId = data;
  }

  setItems(prev =>
    prev.map(it =>
      it.id === childId ? { ...it, parentFolderId: folderId } : it
    )
  );

  setDragOverFolder(null);
};

  // Drag individual items around
  const draggingId = useRef(null);
  const dragOffset = useRef({ x: 0, y: 0 });

  const onItemPointerDown = (e, itemId) => {
    const itemRect = e.currentTarget.getBoundingClientRect();
    dragOffset.current = { x: e.clientX - itemRect.left, y: e.clientY - itemRect.top };
    draggingId.current = itemId;
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };

  <button onClick={() => setTakeOutMode((prev) => !prev)} style={{ background: takeOutMode ? "lightcoral" : "lightgray" }}>
    ➖ Take Out Mode {takeOutMode ? "ON" : "OFF"}
  </button>

  const clearAllItems = () => {
  setItems([]); // This clears everything from the grid
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

  const takeChildOut = (folderId, childId, x = 100, y = 100) => {
  setItems((prev) => {
    let childToMove = null;
    const updated = prev.map((item) => {
      if (item.id === folderId && item.type === "folder") {
        const childIndex = item.children.findIndex(c => c.id === childId);
        if (childIndex !== -1) {
          childToMove = { ...item.children[childIndex] };
          return {
            ...item,
            children: item.children.filter(c => c.id !== childId),
          };
        }
      }
      return item;
    });

    if (childToMove) {
      updated.push({
        ...childToMove,
        parentFolderId: null,
        x,
        y,
      });
    }
    return updated;
  });
};

  const removeItem = (id) => {
  setItems((prev) => {
    let updated = prev.filter((it) => it.id !== id);
    updated = updated.map((item) => {
      if (item.type === "folder" && item.children) {
        return {
          ...item,
          children: item.children.filter(child => child.id !== id)
        };
      }
      return item;
    });
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
          <button className="grid-upload-btn" onClick={openPicker}>+ Upload file</button>
          <button className="folder-create-btn" onClick={() => { const newFolder = createFolder(); setItems((prev) => [...prev, newFolder]);}}
>
  + Create Folder
</button>
  <input ref={inputRef} type="file" multiple onChange={onPick} style={{ display: "none" }} />

{/* Render folders with drop zones and children */}
{items
  .filter(it => it.type === "folder" && it.parentFolderId === null)
  .map(folder => {
    const children = items.filter(it => it.parentFolderId === folder.id);
    const isExpanded = expandedFolders[folder.id] ?? true;

    return (
      <div
        key={folder.id}
        style={{
          left: folder.x,
          top: folder.y,
          position: "absolute",
          width: 120, // adjust bubble width
          height: 120, // dynamic height
          cursor: "grab",
        }}
        draggable
        onPointerDown={(e) => onItemPointerDown(e, folder.id)}
        onDragStart={(e) => e.dataTransfer.setData("text/plain", folder.id)}
      >
        {/* Collapse / Expand button */}
        <img
          className="folder-toggle-button"
          src={expandedFolders[folder.id] ? CollapseFolderButton : ExpandFolderButton}
          alt="Toggle"
          onClick={() =>
            setExpandedFolders((prev) => ({
              ...prev,
              [folder.id]: !prev[folder.id],
            }))
          }
        />


        {/* Folder Bubble */}
        <img src={FolderBackground} alt="Folder" className="folder-background" />

        {/* Add file to Folder Zone */}
        <img
          src={AddFolderButton}
          alt="Add File"
          className={`folder-drop-zone ${dragOverFolder === folder.id ? "drag-over" : ""}`}
          onDrop={(e) => handleFolderDrop(e, folder.id)}
          onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
          onDragEnter={(e) => { e.preventDefault(); setDragOverFolder(folder.id); }}
          onDragLeave={(e) => { e.preventDefault(); setDragOverFolder(null); }}
        />

        {/* Remove file from folder Zone */}
        <img
          src={RemoveFolderButton}
          alt="Remove File"
          className={`folder-remove-zone ${dragOverFolder === folder.id + "-remove" ? "drag-over" : ""}`}
          onDrop={(e) => {
            e.preventDefault();
            const data = e.dataTransfer.getData("text/plain");
            if (!data) return;

            let childId;
            try {
              const parsed = JSON.parse(data);
              childId = parsed.childId || parsed;
            } catch {
              childId = data;
            }

            const { x, y } = toGrid(e.clientX, e.clientY);
            moveItemToGrid(childId, x, y);
            setDragOverFolder(null);
          }}
          onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
          onDragEnter={(e) => { e.preventDefault(); setDragOverFolder(folder.id + "-remove"); }}
          onDragLeave={(e) => { e.preventDefault(); setDragOverFolder(null); }}
        />

        {/* Folder Name Bubble */}
        <img src={FolderNameBubble} alt="Name Bubble" className="folder-name-bubble" />
        <div className="folder-name-text">{folder.name}</div>

        {/* Render Children Inside Folder */}
        {isExpanded &&
          children.map((child, index) => (
            <div
              key={child.id}
              className="grid-item"
              style={{
                position: "absolute",
                left: -3.5, // offset inside folder bubble
                top: 105 + 50 * index, // adjust stack of children below the folder name bubble
              }}
              draggable
              onPointerDown={(e) => onItemPointerDown(e, child.id)}
              onDragStart={(e) => {
                e.stopPropagation();
                e.dataTransfer.setData(
                  "text/plain",
                  JSON.stringify({ folderId: folder.id, childId: child.id })
                );
              }}
            >
              {child.type === "image" ? (
                <>
                  <img src={child.url} alt={child.name} className="grid-item-thumb" />
                  <div className="file-name-text">{child.name}</div> {/* Added file name */}
                </>
              ) : (
                <div className="grid-item-file" title={child.name}>📄 {child.name}</div>
              )}
            </div>
          ))}
      </div>
    );
  })}


{/* Render top-level files not in any folder */}
{items
  .filter(it => it.parentFolderId === null && it.type !== "folder")
  .map(file => (
    <div
      key={file.id}
      className="grid-item"
      style={{ left: file.x, top: file.y }}
      draggable
      onPointerDown={(e) => onItemPointerDown(e, file.id)}
      onDragStart={(e) => e.dataTransfer.setData("text/plain", file.id)}
    >
      {file.type === "image" ? (
        <>
          <img src={file.url} alt={file.name} className="grid-item-thumb" />
          <div className="file-name-text">{file.name}</div> {/* Added file name */}
        </>
      ) : (
        <div className="grid-item-file" title={file.name}>📄 {file.name}</div>
      )}
    </div>
  ))}



</div>

<div
  className="delete-zone"
  style={{
    position: "absolute",
    top: 10,
    left: 200,
    width: 80,
    height: 80,
    background: "red",
    color: "white",
    borderRadius: "8px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1000,
    cursor: "pointer",
  }}
  onDragOver={(e) => e.preventDefault()} // allow drop
  onDrop={(e) => {
    e.preventDefault();
    const id = e.dataTransfer.getData("text/plain"); // item id
    if (id) {
      removeItem(id); // delete item
      console.log("Deleted via trash:", id);
    }
  }}
>
  🗑 Delete
</div>

        {/* Other PNG layers */}
        <div className="LeftSidebarWrapper">
          <img 
          src={LeftSidebar} 
          alt="LeftSidebar" 
          draggable={false}  // prevents dragging the image
          className="left-sidebar"  // optional CSS styling
          />
          <SidebarFileList items={items} />
        </div>

        <img 
          src={LogoImage} 
          alt="LogoImage" 
          draggable={false}  // prevents dragging the image
          className="logo-image"  // optional CSS styling
        />

        <img 
          src={Canvas} 
          alt="CanvasImage" 
          draggable={false}  // prevents dragging the image
          className="canvas-image"  // optional CSS styling
        />

        <GridButton style={{transform: "scale(0.5)", transformOrigin: "center", position: "absolute", top: "-5px", left: "1240px", zIndex: 10 }} />
      </div>

      <div>
        <h1>Message from backend: {message}</h1>
        <button onClick={clearAllItems}>Clear All Items</button>
      </div>
    </div>
  );
}
