// timeSheetController.js

const mongoose = require("mongoose");
const { connectToDatabase, disconnectFromDatabase } = require("../database");

// Define the schema
const timeSheetDataSchema = new mongoose.Schema({
  OF: String,
  Client: String,
  Matiere: String,
  DPT: String,
  Machine: String,
  date: Date,
  EMPLOYE: String,
  "LOT BOB": Number,
  METRAGE: Number,
  "Poids Net": Number,
  TOTAL: {
    sharedFormula: String,
  },
  "%": {
    sharedFormula: String,
  },
  IMP: Number,
  SOUD: Number,
  CCS: Number,
  EMB: Number,
  TECH: Number,
  RECLAMATION: Number,
});

// Before saving, parse the date string to a Date object
timeSheetDataSchema.pre("save", function (next) {
  console.log("entered");
  if (this.date && this.date["$date"]) {
    const dateString = this.date["$date"];
    const parsedDate = new Date(dateString);
    this.date = parsedDate;
    console.log("date", this.date);
  }
  next();
});

// Create the model once during initialization
const TimeSheetData = mongoose.model("timeSheetData", timeSheetDataSchema);

// Request handler for uploading data
/**
 * Handles the request for uploading data to a MongoDB database.
 * Connects to the database, saves the provided data to a specific collection based on the category,
 * and then disconnects from the database. If any error occurs during the process, an appropriate error message is returned.
 * 
 * @param {Object} req - The request object containing the data and category in the body property.
 * @param {Object} res - The response object used to send the status code and response data.
 * @returns {Promise<void>} - A promise that resolves when the data is successfully uploaded or rejects with an error.
 */
const uploadData = async (req, res) => {
    try {
      const { data } = req.body;
      const { client, database } = await connectToDatabase();
      console.log(data)
  
      try {
        console.log("Inserting Data");
  
        // Save array of data to MongoDB
        const collection = database.collection(`timeSheetData_${req.body.category}`);
        await collection.insertMany(data);
  
        console.log("Data saved successfully");
  
        res.status(200).json({ success: true, message: "Data saved successfully" });
      } finally {
        // Disconnect from MongoDB
        if (client) {
          await disconnectFromDatabase();
        }
      }
    } catch (error) {
      console.error("Error:", error);
  
      if (error.name === "MongoError" && error.code === 16500) {
        console.error("BulkWriteError - Duplicate Key:", error.writeErrors);
      }
  
      res.status(500).json({ success: false, message: "Internal server error" });
    }
};

const fetchData = async (req, res) => {
  /**
   * Fetches paginated data from a MongoDB database and sends it to the frontend.
   * 
   * @param {object} req - The request object containing query parameters.
   * @param {object} res - The response object used to send the paginated data to the frontend.
   * @returns {void}
   */
  try {
    const { client, database } = await connectToDatabase();
  
    try {
      let { page = 1, pageSize = 10 } = req.query;

      // Validate and enforce a maximum limit of 20 for pageSize
      pageSize = Math.min(parseInt(pageSize), 20);

      // Calculate skip based on pagination parameters
      const skip = (page - 1) * pageSize;

      // Fetch data from MongoDB with pagination
      const collection = database.collection(`timeSheetData_${req.params.category}`);
      const data = await collection.find({}).skip(skip).limit(pageSize).toArray();
  
      // Send the paginated data to the frontend
      res.status(200).json({ success: true, data });
    } finally {
      // Disconnect from MongoDB
      if (client) {
        await disconnectFromDatabase();
      }
    }
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

  
  module.exports = {
    uploadData,
    fetchData,
  };

