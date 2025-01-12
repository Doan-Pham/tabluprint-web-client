import React, { useState, useEffect, useRef, useCallback } from "react";
import "./Spreadsheet.css";

const fileManagementServiceHttpUrl = "http://localhost:3005";
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

const getColumnLabel = (index) =>
  String.fromCharCode("A".charCodeAt(0) + index);

const parseFormula = (input, data) => {
  if (!input.startsWith("=")) return input; // Return input directly if it's not a formula
  const match = input.match(/=([A-Z]+)(\d+)\s*\+\s*([A-Z]+)(\d+)/);
  if (match) {
    const [, col1, row1, col2, row2] = match;
    const value1 =
      data[parseInt(row1, 10) - 1][col1.charCodeAt(0) - "A".charCodeAt(0)]
        .tempValue;
    const value2 =
      data[parseInt(row2, 10) - 1][col2.charCodeAt(0) - "A".charCodeAt(0)]
        .tempValue;
    return (parseFloat(value1) || 0) + (parseFloat(value2) || 0);
  }
  return "Invalid formula"; // Return error message or handle more cases
};

const Spreadsheet = () => {
  const numRows = 20; // Fixed number of rows
  const numCols = 20; // Fixed number of columns

  const [data, setData] = useState(
    Array.from({ length: numRows }, () =>
      Array(numCols).fill({ value: "", tempValue: "" })
    )
  );

  const [clientId, setClientId] = useState(null);
  const wsRef = useRef(null);
  const hasInitialized = useRef(false); // Ref to track initialization

  const handleKeyPress = (rowIndex, colIndex, e) => {
    console.log("press" + e.keyCode);
    if (e.key === "Enter" || e.keyCode === 13) {
      e.preventDefault(); // Prevent default Enter key action
      setData((prevData) => {
        const newData = [...prevData];
        newData[rowIndex][colIndex] = {
          ...newData[rowIndex][colIndex],
          value: newData[rowIndex][colIndex].tempValue,
          tempValue: newData[rowIndex][colIndex].tempValue,
          displayValue: parseFormula(value, newData), // Parse formula
        };
        return newData;
      });

      const value = data[rowIndex][colIndex].tempValue;
      const position = `${rowIndex},${colIndex}`;
      const editData = { clientId, position, value };
      wsRef.current.send(JSON.stringify(editData));
    }
  };

  const updateUI = useCallback((updatedClients) => {
    setData((prevData) => {
      const newData = prevData.map((row) =>
        row.map((cell) => ({
          ...cell,
          color: null,
          bold: false,
        }))
      );

      updatedClients.forEach((client) => {
        if (!client.Position || client.Position === "") return;
        const [rowIndex, colIndex] = client.Position.split(",").map(Number);
        if (rowIndex < newData.length && colIndex < newData[0].length) {
          newData[rowIndex][colIndex] = {
            ...newData[rowIndex][colIndex],
            color: client.color, // Apply new color
            bold: true, // Set bold
          };
        }
      });

      return newData;
    });
  }, []);

  const handleEditUpdate = useCallback((editData) => {
    const { position, value } = editData;
    const [rowIndex, colIndex] = position.split(",").map(Number);
    setData((prevData) => {
      const newData = [...prevData];
      newData[rowIndex][colIndex] = {
        ...newData[rowIndex][colIndex],
        value: value,
        tempValue: value,
      };
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
      const response = JSON.parse(message.data); // Assuming message.data is the raw JSON string received

      if (response.clientId && response.position) {
        // This is an edit update
        handleEditUpdate(response);
      } else {
        // This is a selection update
        const clientsArray = Object.values(response).filter(
          (client) => client.ID
        );
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

      setData((prevData) => {
        const newData = [...prevData];
        newData[rowIndex][colIndex] = {
          ...newData[rowIndex][colIndex],
          tempValue: newData[rowIndex][colIndex].value, // Set tempValue to the last committed value
        };
        return newData;
      });
    }
  };

  const handleCellChange = (rowIndex, colIndex, value) => {
    const newData = [...data];
    newData[rowIndex][colIndex].tempValue = value;
    setData(newData);
  };

  const handleExportToExcel = async () => {
    try {
      const dataToSend = data.map((row) => row.map((cell) => cell.tempValue));
      const requestBody = JSON.stringify({
        data: dataToSend,
      });
      console.log("[WC] - /export excel - requestBody: " + requestBody);
      const response = await fetch(`${fileManagementServiceHttpUrl}/export`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept:
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        },
        body: requestBody, // Send only values for Excel
      });

      if (response.ok) {
        const blob = await response.blob();
        const downloadUrl = window.URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = downloadUrl;
        link.download = "exported_spreadsheet.xlsx";
        document.body.appendChild(link);
        link.click();
        link.remove();
      } else {
        console.error("Failed to export the spreadsheet");
      }
    } catch (error) {
      console.error("Error exporting spreadsheet:", error);
    }
  };

  return (
    <div className="spreadsheet-container">
      <button onClick={handleExportToExcel} className="export-button">
        Export to Excel
      </button>

      <table className="spreadsheet">
        <thead>
          <tr>
            <th></th> {/* Empty top-left corner cell */}
            {Array.from({ length: numCols }, (_, index) => (
              <th key={index}>{getColumnLabel(index)}</th> // Column headers A-Z
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, rowIndex) => (
            <tr key={rowIndex}>
              <th>{rowIndex + 1}</th> {/* Row headers 1-indexed */}
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
                    value={
                      cell.displayValue ||
                      parseFormula(cell.value, data) ||
                      cell.tempValue
                    }
                    onFocus={() => handleCellFocus(rowIndex, colIndex)}
                    onChange={(e) =>
                      handleCellChange(rowIndex, colIndex, e.target.value)
                    }
                    onKeyDown={(e) => handleKeyPress(rowIndex, colIndex, e)}
                  />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default Spreadsheet;
