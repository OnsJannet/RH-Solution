const fs = require("fs");
const ExcelJS = require("exceljs");
const { formatTime } = require("../utils/utils");
const { connectToDatabase, disconnectFromDatabase } = require("../database");

async function extractTimeSheetData(excelFilePath, sheetName) {
  let client;
  try {
    const filePath = excelFilePath;

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(filePath);

    const sheet = workbook.getWorksheet(sheetName);
    const data = [];

    sheet.eachRow((row, rowNumber) => {
      if (rowNumber !== 1) {
        const rowData = {};
        row.eachCell((cell, colNumber) => {
          const columnHeader = sheet.getRow(1).getCell(colNumber).value;

          if (columnHeader === "Temps" && typeof cell.value === "object") {
            rowData[columnHeader] = new Date(cell.value)
              .toISOString()
              .slice(11, 16);
          } else {
            rowData[columnHeader] = cell.value;
          }

          if (
            [
              "PCS",
              "MOE",
              "EXTRU",
              "IMP",
              "SOUD",
              "CCS",
              "EMB",
              "TECH",
            ].includes(columnHeader)
          ) {
            rowData[columnHeader] =
              rowData[columnHeader] !== null &&
              rowData[columnHeader] !== undefined &&
              String(rowData[columnHeader]).trim() !== ""
                ? rowData[columnHeader]
                : 0;
          }
        });

        ["IMP", "SOUD", "CCS", "EMB", "TECH"].forEach((col) => {
          rowData[col] =
            rowData[col] !== null &&
            rowData[col] !== undefined &&
            String(rowData[col]).trim() !== ""
              ? rowData[col]
              : 0;
        });

        data.push(rowData);
      }
    });

    // Connect to MongoDB
    ({ client, database } = await connectToDatabase());

    // Save data to MongoDB
    const collection = database.collection("timeSheetData");
    await collection.insertMany(data);

    // Group data by DPT
    const groupedData = data.reduce((result, item) => {
      const dpt = item.DPT;
      if (!result[dpt]) {
        result[dpt] = [];
      }
      result[dpt].push(item);
      return result;
    }, {});

    // Insert grouped data into separate collections
    for (const dpt in groupedData) {
      const dptCollection = database.collection(`timeSheetData_${dpt}`);
      await dptCollection.insertMany(groupedData[dpt]);
    }

    const jsonFilePath = "timeSheetData2.json";
    fs.writeFileSync(jsonFilePath, JSON.stringify(data, null, 2));

    return { timeSheetData: data, savedFilePath: jsonFilePath };
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

module.exports = extractTimeSheetData;
