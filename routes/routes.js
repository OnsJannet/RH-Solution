const fs = require("fs");
const { calculateFormulas } = require("../utils/utils");

function setupRoutes(app) {
  app.post("/extractTimeSheetData", async (req, res) => {
    try {
      const { extractTimeSheetData } = require("../utils/utils");
      const { connectToDatabase } = require("../database");

      // Connect to MongoDB
      await connectToDatabase();

      // Extract data and save to MongoDB
      const { timeSheetData, savedInDatabase } = await extractTimeSheetData();

      res.json({ timeSheetData, savedInDatabase });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.post("/extractTeamData", async (req, res) => {
    console.log("Extracting Workings...")
    try {
      const { extractTeamData } = require("./extractTeam");
      const { connectToDatabase } = require("../database");
  
      // Connect to MongoDB
      await connectToDatabase();
  
      // Extract data and save to MongoDB
      const { teamData, savedInDatabase } = await extractTeamData();
  
      res.json({ teamData, savedInDatabase });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.post("/calculateFormulas", async (req, res) => {
    console.log("Calculating Formulas...")
    try {
      // Call the function to calculate formulas
      const result = await calculateFormulas();
  
      // Send the calculated result back to the client
      res.json({ result });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });
}



async function readDataFromDatabase() {
  // Implement logic to read data from MongoDB
  return { timeSheetData: [] };
}

async function saveResultsToDatabase(results) {
  // Implement logic to save results to MongoDB
}

module.exports = { setupRoutes };
