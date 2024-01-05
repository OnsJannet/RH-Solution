const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors"); 
const extractTimeSheetData = require("./Controllers/extractData");
const calculateFormulasFromFile = require("./Controllers/calculateFormulas");
const extractTeamData = require("./Controllers/extractTeam");
const extractVarTeamData = require("./Controllers/extractVarTeam");
const ExcelJS = require("exceljs"); 
const path = require("path");
const extractVarMachineData = require("./Controllers/extractVarMachine");
const saveToMongoDB = require("./Controllers/directionData");
const timeSheetRoutes = require("./routes/timeSheetRoutes");

const app = express();
const port = 3002;

app.use(bodyParser.json());
app.use(cors());

const staticExcelFilePath =
  "./Copy of  Incentive bp - Variables et formules-New.xlsx";
console.log("Absolute File Path:", path.resolve(staticExcelFilePath));
const sheetName = "TIME SHEET 22";
const teamSheetName = "MAP RH";
const teamVariableSheetName = "VAR RH";
const machineVariableSheetName = "VAR MACHINE";

// Function to read Excel file
const readExcelFile = async (filePath, sheetName) => {
  try {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(filePath);
    return filePath; // Return the file path
  } catch (error) {
    console.error(error);
    throw new Error("Error reading Excel file");
  }
};

/* 
  STEP1: Endpoint for extracting time sheet data from an Excel file
  DB Collection: timeSheetData 
*/

app.post("/extractTimeSheetData", async (req, res) => {
  try {
    // Read Excel file path
    const filePath = await readExcelFile(staticExcelFilePath, sheetName);

    // Process and send the data
    const result = await extractTimeSheetData(filePath, sheetName);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/* 
  STEP2: Endpoint for extracting team data from an Excel file 
  DB Collection: RH 
*/
app.post("/extractTeamData", async (req, res) => {
  console.log("Extract Team Data working working woriking");
  try {
    // Read Excel file path
    const filePath = await readExcelFile(staticExcelFilePath, teamSheetName);

    // Process and send the data
    const result = await extractTeamData(filePath, teamSheetName);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/* 
  STEP3: Endpoint for extracting RH Variables from an Excel file 
  DB Collection: RHVAR 
*/
app.post("/extractVarHR", async (req, res) => {
  console.log("Extract Team Data working working woriking");
  try {
    // Read Excel file path
    const filePath = await readExcelFile(
      staticExcelFilePath,
      teamVariableSheetName
    );

    // Process and send the data
    const result = await extractVarTeamData(filePath, teamVariableSheetName);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/* 
  STEP4: Endpoint for extracting Machine Variables from an Excel file 
  DB Collection: MachineData
*/
app.post("/extractVarMACHINE", async (req, res) => {
  console.log("Extract Team Data working working woriking");
  try {
    // Read Excel file path
    const filePath = await readExcelFile(
      staticExcelFilePath,
      machineVariableSheetName
    );

    // Process and send the data
    const result = await extractVarMachineData(
      filePath,
      machineVariableSheetName
    );
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/* 
  STEP5: Endpoint for Calculating homme/machine 
  Needs:
  {
    "DPT": "" , (string)
    "EMPLOYE":, (integer)
    "Machine": "", (string)
    "EQ": "", (string)
    "PUKG": 15, (integer)
    "AugProd": 0.3, (float / integer)
    "RedDechets": 0.2, (float / integer)
    "NbReclamation": 0 (float / integer)
  }
  DB Collection: MachineData
*/
app.post("/calculateFormulas", async (req, res) => {
  try {
    // Call the function to calculate formulas
    const result = await calculateFormulasFromFile(req.body);
    // Send the calculated result back to the client
    res.json({ result });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal server error" });
  }
});

/* 
  STEP6: Endpoint for Calculating PRIME INTERESSEMENT 
  Needs:
  {
    "nbrEmploye": 30,
    "budget": 100000
  }
  DB Collection: Direction_With_Calculations
*/
app.post("/saveWithCalculations", async (req, res) => {
  try {
    const jsonFilePath = "./Json/Direction.json";
    const collectionName = "Direction_With_Calculations";

    // Call the function to save to MongoDB with calculations

    const result = await saveToMongoDB(
      jsonFilePath,
      collectionName,
    );

    res.status(200).json({ result });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// New route to save JSON data to MongoDB
/*app.post("/saveToMongoDB", async (req, res) => {
  try {
    const jsonFilePath = 'Direction.json';
    const collectionName = 'Direction_Info';

    // Call the function to save to MongoDB
    await saveToMongoDB(jsonFilePath, collectionName);

    res.json({ message: 'Data saved to MongoDB successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});*/


app.use("/api/timeSheet", timeSheetRoutes);

app.listen(port, () => {
  console.log(`Server is running at http://localhost:${port}`);
});

module.exports = app;
