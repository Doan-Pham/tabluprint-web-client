import React, { useState } from "react";
import "./Spreadsheet.css";

const Spreadsheet = () => {
  const numRows = 20; // Fixed number of rows
  const numCols = 20; // Fixed number of columns

  // Initialize data with empty strings for the fixed number of rows and columns
  const [data, setData] = useState(
    Array.from({ length: numRows }, () => Array(numCols).fill(""))
  );

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
