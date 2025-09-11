import React from "react";
import GridButtonImg from "./images/GridButton.png";

export default function GridButton({ style }) {
  const handleClick = () => alert("Grid Button Clicked!");
  return (
    <button
      onClick={handleClick}
      style={{
        background: "none",
        border: "none",
        padding: 0,
        cursor: "pointer",
        ...style, // merge the style passed from App.js
      }}
    >
      <img
        src={GridButtonImg}
        alt="Grid Button"
        style={{ width: "125px", height: "auto" }}
      />
    </button>
  );
}