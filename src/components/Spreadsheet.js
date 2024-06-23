import React, { useState, useEffect, useRef, useCallback } from "react";
import "./Spreadsheet.css";

const realTimeServiceHttpUrl = "http://localhost:4949";
const realTimeServiceWsUrl = "ws://localhost:4949";

// Define getRandomColor function before using it
const getRandomColor = () => {
  const letters = "0123456789ABCDEF";
  let color = "#";
  for (let i = 0; i < 6; i++) {
    color += letters[Math.floor(Math.random() * 16)];
  }
  return color;
};

// Define colors as a global constant
const colors = Array.from({ length: 10 }, () => getRandomColor());

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

  const updateUI = useCallback(
    (updatedClients) => {
      // Clone the existing data
      const newData = data.map((row) =>
        row.map((cell) => ({ ...cell, color: null, bold: false }))
      );

      // Apply colors and bold text to the cells based on the positions of the clients
      updatedClients.forEach((client) => {
        if (client.Position === "") return;
        const [rowIndex, colIndex] = client.Position.split(",").map(Number);
        if (rowIndex < newData.length && colIndex < newData[0].length) {
          console.log(
            `update: ${rowIndex}, ${colIndex}, ${client.color}, ${newData[rowIndex][colIndex]}`
          );

          newData[rowIndex][colIndex] = {
            ...newData[rowIndex][colIndex],
            color: client.color,
            bold: true,
          };
        }
      });

      setData(newData);
    },
    [data]
  );

  const handleWebSocketData = useCallback(
    (sessionClients) => {
      // Remove the client's own clientId and sort the remaining clients

      const clientsArray = Object.values(sessionClients)
        .filter((client) => client.ClientId !== clientId)
        .sort((a, b) => (a.ClientId > b.ClientId ? 1 : -1));

      // Map each client to a color
      const updatedClients = clientsArray.map((client, index) => ({
        ...client,
        color: colors[index % colors.length],
      }));

      // Update the UI
      updateUI(updatedClients);
    },
    [clientId, updateUI]
  );

  useEffect(() => {
    if (!hasInitialized.current) {
      // Initialize colors array with 10 random colors
      fetch(`${realTimeServiceHttpUrl}/init`, { method: "POST" })
        .then((response) => response.json())
        .then((data) => {
          setClientId(data.clientId);
          const ws = new WebSocket(
            `${realTimeServiceWsUrl}/ws/${data.clientId}`
          );
          wsRef.current = ws;

          ws.onmessage = (event) => {
            const sessionClients = JSON.parse(event.data);
            handleWebSocketData(sessionClients);
          };

          ws.onclose = () => {
            console.log("WebSocket connection closed");
          };
        })
        .catch((error) => console.error("Error initializing client:", error));

      hasInitialized.current = true;
    }
  }, [handleWebSocketData]);

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
              <td
                key={colIndex}
                style={{
                  border: cell.color
                    ? `2px solid ${cell.color}`
                    : "1px solid #ddd",
                  fontWeight: cell.bold ? "bold" : "normal",
                }}
              >
                <input
                  value={cell.value}
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
