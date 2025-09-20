import React, { useEffect, useRef, useState } from "react";
import { v4 as uuid } from "uuid";

//Background Images
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

  const addFilesAt = async (fileList, gx = 40, gy = 40) => {
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
      parentFolderId: null,
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
  setItems((prevItems) => {
    let itemToMove = null;
    let newItems = [...prevItems];
    newItems = newItems.map((item) => {
      if(item.type === "folder" && item.children){
        const childIndex = item.children.findIndex(child => child.id === itemId);
        if (childIndex !== -1 ) {
          itemToMove = {...item.children[childIndex]};
          return {
            ...item,
            children: item.children.filter(child => child.id !== itemId)
          };
        }
      }
      return item;
    });
    
    if (itemToMove)
    {
      const updatedItem = {
        ...itemToMove,
        x: x,
        y: y,
        parentFolderId: null
      };
      newItems.push(updatedItem);
    }
      else
    {
      newItems = newItems.map(item =>
        item.id === itemId ? {...item, x: x, y: y } : item
      );
    }
       return newItems;
  });
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
    children: [],
  };
  return folder; // <--- must return it
};

//Folder drop handler

const [dragOverFolder, setDragOverFolder] = useState(null);

const [takeOutMode, setTakeOutMode] = useState(false);


const handleFolderDrop = (e, folderId) => {
  e.preventDefault();
  e.stopPropagation();

  
  const fileId = e.dataTransfer.getData("text/plain");
  if (!fileId || fileId === folderId) return;

  setItems((prevItems) => {
    let fileToMove = null;
    let updatedItems = [...prevItems];

    updatedItems = updatedItems.map((item) => {
      if (item.id === fileId && !item.parentFolderId)
      {
        fileToMove = {...item};
        return null;
      } 
      else if (item.type === "folder" && item.children)
      {
        const childIndex = item.children.findIndex(child => child.id === fileId);
        if (childIndex !== -1) {
          fileToMove = {...item.children[childIndex]};
          return{
            ...item,
            children: item.children.filter(child => child.id !== fileId)
          };
      }
    }
    return item;
    }).filter(Boolean);

    if (!fileToMove) return prevItems;

    updatedItems = updatedItems.map((item) => {
      if (item.id === folderId && item.type === "folder") {
        return {
          ...item,
          children: [
            ...(item.children || []),
            { ...fileToMove, parentFolderId: folderId }
          ]
        };
      }
      return item;
    });
    return updatedItems;
  });
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
          <button className="grid-upload-btn" onClick={openPicker}>+ Upload file</button>
          <button className="folder-create-btn" onClick={() => { const newFolder = createFolder(); setItems((prev) => [...prev, newFolder]);}}
>
  + Create Folder
</button>
  <input ref={inputRef} type="file" multiple onChange={onPick} style={{ display: "none" }} />

  {/* Render placed items */}
  {items
  .filter(it => it.parentFolderId === null || it.parentFolderId === undefined) // only top-level items
  .map((it) => (
    <div
      key={it.id}
      className="grid-item"
      style={{ left: it.x, top: it.y }}
      draggable={true}
      onPointerDown={(e) => onItemPointerDown(e, it.id)}
      onDragStart={(e) => {
        e.dataTransfer.setData("text/plain", it.id);
      }}
    >
      {it.type === "folder" ? (
        <div className="grid-item-folder-wrapper">
          <div className="grid-item-folder" title={it.name}>
            📁 {it.name}
          </div>

          {/* Square drop files in folder zone */}
          <div
            className={`folder-drop-zone ${dragOverFolder === it.id ? "drag-over" : ""}`}
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

          {/* Square remove-from-folder drop zone */}
          <div
            className={`folder-remove-zone ${dragOverFolder === it.id + "-remove" ? "drag-over" : ""}`}
            onDrop={(e) =>
              {
              e.preventDefault();
              const data = e.dataTransfer.getData("text/plain");
              if (!data) return;

              // Move file back to grid
              const { folderId, childId } = JSON.parse(data);
              const { x, y } = toGrid(e.clientX, e.clientY);
              if (folderId && childId)
              {
                takeChildOut(folderId, childId, x, y);
              }
              else
              {
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

          {/* Render children */}
          {it.children && it.children.map((child) => (
            <div
              key={child.id} 
              draggable
              onDragStart={(e) => {
              e.stopPropagation();
              // tell the drop zone which file & folder this came from
              e.dataTransfer.setData("text/plain", JSON.stringify({
                folderId: it.id,
                childId: child.id
              }));
            }}
            
            title={child.name}
            >
              {child.type === "image" ? (
                <>
                  <img
                    src={child.url}
                    alt={child.name}
                    className="grid-item-thumb"
                    draggable={false}  // 🚫 stops raw image dragging
                  />
                  <div className="folder-child-name">{child.name}</div>
                </>
              ) : (
                <>
                  <div className="grid-item-file" title={child.name}>
                    📄 {child.name}
                  </div>
                  <div className="folder-child-name">{child.name}</div>
                </>
              )}
            </div>
            ))}
          </div>
      ) : it.type === "image" ? (
        <img src={it.url} alt={it.name} className="grid-item-thumb" />
      ) : (
        <div className="grid-item-file" title={it.name}>
          📄 {it.name}
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
        <div className="LeftSidebarWrapper">
          <img className="Left-Sidebar" src={LeftSidebar} alt="Left Sidebar" style={{ zIndex: 3 }} />
          <div className="SidebarFileList">
          {items.filter(it => !it.parentFolderId).map((it) => (
            <div key={it.id} className="file-name">{it.name}</div>
          ))}
        </div>


        </div>

        <img className="Right-Sidebar" src={RightSidebar} alt="Right Sidebar" style={{ zIndex: 3 }} />
        <img className="Cramberry-Logo" src={CramberryLogo} alt="Cramberry Logo" style={{ zIndex: 4 }} />

        <GridButton style={{transform: "scale(0.5)", transformOrigin: "center", position: "absolute", top: "-5px", left: "1240px", zIndex: 10 }} />
      </div>

      <div>
        <h1>Message from backend: {message}</h1>
        <button onClick={clearAllItems}>Clear All Items</button>
      </div>
    </div>
  );
}
