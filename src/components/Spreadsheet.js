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
      const newData = data.map((row) =>
        row.map((cell) => ({ ...cell, color: null, bold: false }))
      );
      updatedClients.forEach((client) => {
        if (!client.Position || client.Position === "") return;
        const [rowIndex, colIndex] = client.Position.split(",").map(Number);
        if (rowIndex < newData.length && colIndex < newData[0].length) {
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

  const handleEditUpdate = useCallback((editData) => {
    const { position, value } = editData;
    const [rowIndex, colIndex] = position.split(",").map(Number);
    setData((prevData) => {
      const newData = [...prevData];
      newData[rowIndex][colIndex] = { ...newData[rowIndex][colIndex], value };
      return newData;
    });
  }, []);

  const handleSelectionUpdate = useCallback(
    (clientsArray) => {
      clientsArray = clientsArray
        .filter((client) => client.ID !== clientId)
        .sort((a, b) => (a.ID > b.ID ? 1 : -1));

      const updatedClients = clientsArray.map((client, index) => ({
        ...client,
        color: colors[index % colors.length],
      }));

      updateUI(updatedClients);
    },
    [clientId, updateUI]
  );

  const handleWebSocketData = useCallback(
    (message) => {
      const data = JSON.parse(message.data); // Assuming message.data is the raw JSON string received

      if (data.clientId && data.position) {
        // This is an edit update
        handleEditUpdate(data);
      } else {
        // This is a selection update
        const clientsArray = Object.values(data).filter((client) => client.ID);
        handleSelectionUpdate(clientsArray);
      }
    },
    [handleEditUpdate, handleSelectionUpdate]
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
            console.log("Received data:", event.data);
            handleWebSocketData(event);
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
    const position = `${rowIndex},${colIndex}`;
    newData[rowIndex][colIndex] = { ...newData[rowIndex][colIndex], value };
    setData(newData);

    // Send the updated cell data to the server for broadcasting
    if (wsRef.current && clientId) {
      const editData = { clientId, position, value };
      wsRef.current.send(JSON.stringify(editData));
    }
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
