const fs = require("fs");
const ExcelJS = require("exceljs");


function calculateFormulas(data) {
  const result = {};

  console.log("Entering calculateFormulas");

  // Iterate through the data to calculate values for each machine and EMPLOYE
  data.forEach((entry) => {
    const machine = entry["Machine"]?.toLowerCase(); // Use optional chaining
    const EMPLOYE = entry["EMPLOYE"];

    // Skip this entry if 'Machine ' is not defined
    if (!machine) {
      return;
    }

    // Create a nested structure if it doesn't exist
    if (!result[machine]) {
      result[machine] = {};
    }

    if (!result[machine][EMPLOYE]) {
      result[machine][EMPLOYE] = {};
    }

    // Initialize variables for calculations
    let totalProdM = 0;
    let totalProdKg = 0;
    let totalDechets = 0;
    let totalTemps = 0;

    // Filter data for the current machine and EMPLOYE
    const filteredData = data.filter(
      (e) =>
        e["Machine "]?.toLowerCase() === machine && e["EMPLOYE"] === EMPLOYE
    );

    // Iterate through filtered data for calculations
    filteredData.forEach((e) => {
      if (typeof e["METRAGE"] === "object" && "result" in e["METRAGE"]) {
        totalProdM += e["METRAGE"].result || 0;
      } else {
        totalProdM += e["METRAGE"] || 0;
      }

      // Check if 'Poids Net' is an object with a 'result' property
      if (typeof e["Poids Net"] === "object" && "result" in e["Poids Net"]) {
        totalProdKg += e["Poids Net"].result || 0;
      } else {
        totalProdKg += e["Poids Net"] || 0;
      }

      totalDechets += e["Imp"] || 0;

      // Check if Temps is a string and in the format 'hh:mm'
      if (typeof e["Temps"] === "string" && e["Temps"].includes(":")) {
        const [hours, minutes] = e["Temps"].split(":").map(Number);
        // Adjust the calculation of totalTemps
        totalTemps += hours * 60 + minutes;
      }

      console.log("Filtered Data:", filteredData);
      console.log("Total ProdM:", totalProdM);
      console.log("Total ProdKg:", totalProdKg);
      console.log("Total Dechets:", totalDechets);
      console.log("Total Temps:", totalTemps);
    });

    // Perform calculations based on formulas
    result[machine][EMPLOYE] = {
      Prod: {
        "Prod (m)":
          typeof totalProdM === "number" ? totalProdM.toFixed(6) : totalProdM,
        "Prod (kg)":
          typeof totalProdKg === "number"
            ? totalProdKg.toFixed(6)
            : totalProdKg,
      },
      "Total déchets": totalDechets,
      "Durée mn": formatTime(totalTemps), // Format the total time
      "Duree h": (totalTemps / 60).toFixed(2),
      "Producté (m/h)":
        totalTemps === 0 ? 0 : (totalProdM / (totalTemps / 60)).toFixed(8),
      "Producté (kg/h)":
        totalTemps === 0 ? 0 : (totalProdKg / (totalTemps / 60)).toFixed(8),
      "% déchets":
        totalProdM === 0
          ? 0
          : ((totalDechets / totalProdM) * 100).toFixed(2) + "%",
    };
  });

  return result;
}

function formatTime(minutes) {
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return `${hours}:${remainingMinutes < 10 ? "0" : ""}${remainingMinutes}`;
}

/*async function sumDataFromCollections(database) {
  console.log(database)
  console.log(database.listCollections())
  let totals = {
    "Chef dept": 0,
    "Chef eq": 0,
    "Extrudeur": 0,
    "Opérateur": 0,
  };

  const collectionsCursor = await database.listCollections();
  const collections = await collectionsCursor.toArray();

  for (const collectionInfo of collections) {
    const collectionName = collectionInfo.name;

    // You can add additional conditions to filter collections if needed
    if (collectionName.startsWith("calculation_timeSheetData_")) {
      const collection = database.collection(collectionName);
      const data = await collection.find().toArray();

      data.forEach((entry) => {
        totals["Chef dept"] += entry["Chef dept"] || 0;
        totals["Chef eq"] += entry["Chef eq"] || 0;
        totals["Extrudeur"] += entry["Extrudeur"] || 0;
        totals["Opérateur"] += entry["Opérateur"] || 0;
      });
    }
  }

  return totals;
}*/


// Function to calculate direction totals
/*function calculateDirectionTotals(totals) {
  const directionTotal = Object.values(totals).reduce((acc, value) => acc + value, 0);
  const directionAdmin = 0.1 * directionTotal;
  const directionProduction = 0.4 * directionTotal;

  return {
    directionTotal,
    directionAdmin,
    directionProduction,
    individuel: directionTotal / 2,
  };
}*/

// Function to create the "Prime" collection
/*async function createPrimeCollection(database, totals, directionTotals) {
  const primeCollection = database.collection("Prime");

  const primeData = {
    "Total Chef dept": totals["Chef dept"],
    "Total Chef eq": totals["Chef eq"],
    "Total Extrudeur": totals["Extrudeur"],
    "Total Opérateur": totals["Opérateur"],
    "Total": directionTotals.directionTotal,
    "Direction": directionTotals.directionTotal / 2,
    "Direction Administrative": directionTotals.directionAdmin,
    "Direction Production": directionTotals.directionProduction,
    "Individuel": directionTotals.individuel,
  };

  await primeCollection.insertOne(primeData);
}*/


module.exports = { 
  calculateFormulas, 
  formatTime,
  /*sumDataFromCollections,
  calculateDirectionTotals,
  createPrimeCollection,*/
};
