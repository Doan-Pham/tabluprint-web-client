import React, { useState, useEffect, useRef } from "react";
import "./Spreadsheet.css";

const realTimeServiceHttpUrl = "http://localhost:4949";
const realTimeServiceWsUrl = "ws://localhost:4949";

const Spreadsheet = () => {
  const numRows = 20; // Fixed number of rows
  const numCols = 20; // Fixed number of columns

  // Initialize data with empty strings for the fixed number of rows and columns
  const [data, setData] = useState(
    Array.from({ length: numRows }, () => Array(numCols).fill(""))
  );

  const [clientId, setClientId] = useState(null);
  const wsRef = useRef(null);
  const hasInitialized = useRef(false); // Ref to track initialization

  useEffect(() => {
    if (!hasInitialized.current) {
      // Fetch clientId from init API
      fetch(`${realTimeServiceHttpUrl}/init`, { method: "POST" })
        .then((response) => response.json())
        .then((data) => {
          setClientId(data.clientId);
          // Establish WebSocket connection
          const ws = new WebSocket(
            `${realTimeServiceWsUrl}/ws/${data.clientId}`
          );
          wsRef.current = ws;

          ws.onmessage = (event) => {
            const clients = JSON.parse(event.data);
            console.log("Received update from server:", clients);
            // Handle the updates from other clients, e.g., show their selections
          };

          ws.onclose = () => {
            console.log("WebSocket connection closed");
          };
        })
        .catch((error) => console.error("Error initializing client:", error));

      hasInitialized.current = true; // Mark as initialized
    }
  }, []);

  const handleCellFocus = (rowIndex, colIndex) => {
    if (clientId && wsRef.current) {
      const position = `${rowIndex},${colIndex}`;
      fetch(`${realTimeServiceHttpUrl}/updateSelection`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId, position }),
      });
    }
  };

  const handleCellChange = (rowIndex, colIndex, value) => {
    const newData = [...data];
    newData[rowIndex][colIndex] = value;
    setData(newData);
  };

  return (
    <table className="spreadsheet">
      <tbody>
        {data.map((row, rowIndex) => (
          <tr key={rowIndex}>
            {row.map((cell, colIndex) => (
              <td key={colIndex}>
                <input
                  value={cell}
                  onFocus={() => handleCellFocus(rowIndex, colIndex)}
                  onChange={(e) =>
                    handleCellChange(rowIndex, colIndex, e.target.value)
                  }
                />
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
};

export default Spreadsheet;
