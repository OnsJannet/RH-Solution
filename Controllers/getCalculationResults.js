const { MongoClient } = require("mongodb");

async function getCalculationResults(filters) {
  const uri = "mongodb+srv://Incentive:ZwGK449N1aDZ1wcu@incentiverh.jvoa2rf.mongodb.net/";
  const client = new MongoClient(uri);

  try {
    await client.connect();
    console.log("Connected to MongoDB");

    const database = client.db("Incentive6");

    // Construct the dynamic collection name based on DPT value
    const collectionName = `calculation_timeSheetData_${filters.DPT || 'default'}`;
    console.log("collectionName: ", collectionName)

    // Exclude "DPT" from the query
    const { DPT, ...query } = filters;

    // Convert EMPLOYE to integer
    if (query.EMPLOYE) {
      query.EMPLOYE = parseInt(query.EMPLOYE, 10);
    }

    console.log("query", query)

    const results = await database
      .collection(collectionName)
      .find(query)
      .toArray();

    return results;
  } catch (error) {
    console.error("Error retrieving data:", error);
    throw new Error("Internal server error");
  } finally {
    await client.close();
    console.log("Disconnected from MongoDB");
  }
}

module.exports = getCalculationResults;
