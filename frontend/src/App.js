import React, { useEffect, useState } from "react";
import CramberryLogo from "./images/CramberryLogo.png";
import LeftSidebar from "./images/LeftSidebar.png";
import BackgroundBubble from "./images/BackgroundBubble.png";
import RightSidebar from "./images/RightSidebar.png";
import Grid from "./images/Grid.png";
import GridButton from "./Buttons";

import "./App.css";

export default function App() {
  const [message, setMessage] = useState("Loading...");
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch("https://84136e4a024a.ngrok-free.app/api/hello", {
      headers: {
        'ngrok-skip-browser-warning': 'true'
      }
    })
      .then(response => {
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        return response.json();
      })
      .then(data => {
        setMessage(data.message);
      })
      .catch(error => {
        console.error('Error:', error);
        setError(error.message);
        setMessage('Error loading message');
      });
  }, []);

  if (error) {
    return <div>Error: {error}</div>;
  }

  return (
  <div>
    <div className="container">
      <img className="Background-Bubble" src={BackgroundBubble} alt="Background Bubble" style={{ zIndex: 1 }} />
      <img className="Grid" src={Grid} alt="Grid" style={{ zIndex: 2 }} />
      <img className="Left-Sidebar" src={LeftSidebar} alt="Left Sidebar" style={{ zIndex: 3 }} />
      <img className="Right-Sidebar" src={RightSidebar} alt="Right Sidebar" style={{ zIndex: 3 }} />
      <img className="Cramberry-Logo" src={CramberryLogo} alt="Cramberry Logo" style={{ zIndex: 4 }} />
      <GridButton style={{ position: "absolute", top: "0px", left: "1200px", zIndex: 10 }} />
    </div>

    <div>
      <h1>Message from backend: {message}</h1>
    </div>
  </div>
  );
}