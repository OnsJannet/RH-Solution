const { MongoClient } = require("mongodb");


const uri = "mongodb+srv://Incentive:ZwGK449N1aDZ1wcu@incentiverh.jvoa2rf.mongodb.net/"
//const uri = "mongodb://localhost:27017/"
const client = new MongoClient(uri, /*{ useNewUrlParser: true, useUnifiedTopology: true }*/);

const databaseName = "Incentive";

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
