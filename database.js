const { MongoClient } = require("mongodb");


//const uri = "mongodb+srv://incentive:incentive2024@cluster0.zlusx1s.mongodb.net/incentiveDB?retryWrites=true&w=majority"
const uri = "mongodb://localhost:27017/"
const client = new MongoClient(uri, /*{ useNewUrlParser: true, useUnifiedTopology: true }*/);

const databaseName = "Incentive14";

async function connectToDatabase() {
  try {
    await client.connect();
    console.log("Connected to MongoDB");

    // Specify the database to use
    const database = client.db(databaseName);
    

    return { client, database };  // Return client and database
  } catch (error) {
    console.error("Error connecting to MongoDB:", error);
    throw error;
  }
}

async function disconnectFromDatabase() {
  await client.close();
  console.log("Disconnected from MongoDB");
}

module.exports = { connectToDatabase, disconnectFromDatabase };
