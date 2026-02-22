import React from "react";

function SidebarFileList({ items }) {
  const [expandedFolders, setExpandedFolders] = React.useState({
    "root-folder": true,
  });

  const toggleFolder = (id) => {
    setExpandedFolders(prev => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const renderItems = (parentId = null, indent = 0) =>
    items
      .filter(it => it.parentFolderId === parentId)
      .map(it => (
        <div key={it.id} style={{ paddingLeft: indent }}>
          {it.type === "folder" ? (
            <>
              <div
                onClick={() => toggleFolder(it.id)}
                style={{ cursor: "pointer" }}
              >
                {expandedFolders[it.id] ? "📂" : "📁"} {it.name}
              </div>
              {expandedFolders[it.id] && renderItems(it.id, indent + 16)}
            </>
          ) : (
            <div>📄 {it.name}</div>
          )}
        </div>
      ));

  return <div className="SidebarFileList">{renderItems()}</div>;
}

export default SidebarFileList;
