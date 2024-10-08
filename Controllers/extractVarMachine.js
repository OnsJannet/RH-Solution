const fs = require("fs");
const ExcelJS = require("exceljs");
const { connectToDatabase, disconnectFromDatabase } = require("../database");

async function extractVarMachineData(excelFilePath, sheetName) {
  console.log("entered extract machine data");
  let client;
  try {
    const filePath = excelFilePath;

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(filePath);

    const sheet = workbook.getWorksheet(sheetName);
    const data = [];

    // Get the headers
    const headers = sheet.getRow(1).values;

    sheet.eachRow((row, rowNumber) => {
      if (rowNumber !== 1) {
        const rowData = {};
    
        row.eachCell((cell, colNumber) => {
          const columnHeader = headers[colNumber];
          
          // Use the columnHeader as the key
          rowData[columnHeader] = cell.value;
        });
    
        console.log("rowData:", rowData);
    
        data.push(rowData);
      }
    });

    // Connect to MongoDB
    ({ client, database } = await connectToDatabase());

    // Save data to MongoDB
    const collection = database.collection("MachineData"); // Adjust the collection name
    await collection.insertMany(data);

    const jsonFilePath = "Machine_data.json";
    fs.writeFileSync(jsonFilePath, JSON.stringify(data, null, 2));

    return { machineData: data, savedFilePath: jsonFilePath };
  } catch (error) {
    console.error(error);
    throw new Error("Internal server error");
  } finally {
    if (client) {
      // Disconnect from MongoDB
      await disconnectFromDatabase();
    }
  }
}

module.exports = extractVarMachineData;
