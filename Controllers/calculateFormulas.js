const { MongoClient } = require("mongodb");
const { formatTime } = require("../utils/utils");
const utils = require("../utils/utils");
const { connectToDatabase, disconnectFromDatabase } = require("../database");

/**
 * Performs calculations based on input data and stores the results in a MongoDB database.
 * 
 * @param {Object} reqBody - The request body containing various input parameters for the calculations.
 * @returns {Object} - An object containing the calculated results and total values.
 * 
 * @throws {Error} - If there is an error calculating the formulas or connecting to the database.
 */
async function calculateFormulasFromFile(reqBody) {
  let PUKG = reqBody.PUKG || 0.15;
  let AugProd = reqBody.AugProd || 0.3;
  let RedDechets = reqBody.RedDechets || 0.2;
  let NbReclamation = reqBody.NbReclamation || 0;

  const uri = "mongodb+srv://harry:er86NqaVCzAisEAY@cluster0.zlusx1s.mongodb.net/";
  const client = new MongoClient(uri, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  });

  try {
    await client.connect();
    console.log("Connected to MongoDB");

    const database = client.db("Incentive");

    // Extract filter parameters from the request body
    const { DPT, EMPLOYE, Machine, EQ } = reqBody;


    // Check if DPT is an empty string & Fetching data from MongoDB collections
    const defaultCollection = "timeSheetData";

    const collectionName =
      DPT.trim() === ""
        ? [defaultCollection]
        : DPT.toLowerCase() === "impression"
        ? ["timeSheetData_impression", "timeSheetData_IMPRESSION"]
        : [`timeSheetData_${DPT}`];

    const pipeline = [
      {
        $match: {}, // Add your match conditions if needed
      },
    ];

    let data = [];

    for (const collection of collectionName) {
      const collectionData = await database
        .collection(collection)
        .aggregate(pipeline)
        .toArray();

      data = data.concat(collectionData);
    }

    // Fetch all data from "RHVAR" collection
    const rhVarData = await database.collection("RHVAR").find().toArray();

    const categoryData = {};
    rhVarData.forEach((entry) => {
      const category = entry["Catégorie"];
      const part = entry["Part"];
      const departement = entry["DPT"];

      if (category && part !== undefined && departement) {
        // Map old department keys to new keys
        let updatedDepartement;
        switch (departement) {
          case "extru":
            updatedDepartement = "EXTRUSION";
            break;
          case "imp":
            updatedDepartement = "IMPRESSION";
            break;
          case "soud":
            updatedDepartement = "SOUDURE";
            break;

          default:
            updatedDepartement = departement;
            break;
        }

        // Initialize the department key if not present
        if (!categoryData[updatedDepartement]) {
          categoryData[updatedDepartement] = {};
        }

        // Assign the values to the updated keys
        categoryData[updatedDepartement][category] = part;
      }
    });

    // Fetch all data from "MachineData" collection
    const productivityData = await database
      .collection("MachineData")
      .find()
      .toArray();

    const designationData = {};
    productivityData.forEach((entry) => {
      const designation = entry["DESIGNATION"];
      const percentDechet = entry["% DE DECHET"];
      if (typeof designation === "string" && percentDechet !== undefined) {
        designationData[designation.toUpperCase()] =
          parseFloat(percentDechet.replace("%", "")) / 100;
      }
    });

    const MachineProductivity = {};
    productivityData.forEach((entry) => {
      const designation = entry["DESIGNATION"];
      const productivite = entry["PRODUCTIVITE"];
      if (typeof designation === "string" && productivite !== undefined) {
        MachineProductivity[designation.toUpperCase()] = productivite;
      }
    });

    // Filter data based on EMPLOYE and Machine
    let filteredData = data;

    if (EMPLOYE) {
      filteredData = filteredData.filter(
        (entry) => entry["EMPLOYE"] === EMPLOYE
      );
    }

    if (Machine) {
      filteredData = filteredData.filter(
        (entry) => entry["Machine"]?.toLowerCase() === Machine.toLowerCase()
      );
    }

    // Initialize result array
    const results = [];

    // Group the entries by machine and EMPLOYE
    const groupedData = {};

    filteredData.forEach((entry) => {
      const machine = entry["Machine"]?.toLowerCase();
      const emp = entry["EMPLOYE"];

      if (!machine) {
        return;
      }

      const key = `${machine}-${emp}`;
      if (!groupedData[key]) {
        groupedData[key] = {
          entries: [],
          machine,
          EMPLOYE: emp,
        };
      }

      groupedData[key].entries.push(entry);
    });

    // Initialize total variables
    let totalChefDept = 0;
    let totalChefEq = 0;
    let totalExtrudeur = 0;
    let totalOperateur = 0;

    // Iterate through grouped data for calculations
    Object.values(groupedData).forEach((group) => {
      const machine = group.machine;
      const emp = group.EMPLOYE;
      const entries = group.entries;

      // Initialize variables for calculations
      let totalProdM = 0;
      let totalProdKg = 0;
      let totalDechets = 0;
      let totalTemps = 0;

      // Perform calculations based on each entry
      entries.forEach((entry) => {
        if (DPT === "SOUDURE" || DPT === "soudure") {
          if (
            typeof entry["PCS"] === "object" &&
            "result" in entry["PCS"] &&
            typeof entry["PCS"].result === "number"
          ) {
            totalProdM += entry["PCS"].result;
          } else if (typeof entry["PCS"] === "number") {
            totalProdM += entry["PCS"];
          }
        } else {
          if (
            typeof entry["METRAGE"] === "object" &&
            "result" in entry["METRAGE"] &&
            typeof entry["METRAGE"].result === "number"
          ) {
            totalProdM += entry["METRAGE"].result;
          } else if (typeof entry["METRAGE"] === "number") {
            totalProdM += entry["METRAGE"];
          }
        }

        if (
          typeof entry["Poids Net"] === "object" &&
          "result" in entry["Poids Net"] &&
          typeof entry["Poids Net"].result === "number"
        ) {
          totalProdKg += entry["Poids Net"].result;
        } else if (typeof entry["Poids Net"] === "number") {
          totalProdKg += entry["Poids Net"];
        }

        if (DPT === "SOUDURE") {
          totalDechets += (entry["MOE"] || 0) + (entry["SOUD"] || 0);
        }

        if (DPT !== "SOUDURE") {
          totalDechets += entry["IMP"] || 0;
        }

        if (
          typeof entry["Temps"] === "string" &&
          entry["Temps"].includes(":")
        ) {
          const [hours, minutes] = entry["Temps"].split(":").map(Number);
          totalTemps += hours * 60 + minutes;
        }
      });

      const percentageDechets =
        totalProdM === 0 ? 0 : parseFloat((totalDechets / totalProdKg) * 100);

      const calculatedValue =
        totalTemps / 60 === 0
          ? 0
          : (
              (totalProdKg * (1 + AugProd)).toFixed(0) /
              (totalTemps / 60)
            ).toFixed(0);
      const déchetsSimul = percentageDechets * (1 - RedDechets);
      const ProdSimul = (totalProdKg * (1 + AugProd)).toFixed(0);
      const calculationResult = {
        Machine: machine,
        EMPLOYE: emp,
        Prod: {
          "Prod (m)":
            typeof totalProdM === "number" ? totalProdM.toFixed(3) : totalProdM,
          "Prod (kg)":
            typeof totalProdKg === "number"
              ? totalProdKg.toFixed(3)
              : totalProdKg,
        },
        totalDechets: totalDechets || 0,
        "Durée mn": formatTime(totalTemps),
        "Duree h": (totalTemps / 60).toFixed(2),
        "Producté (m/h)":
          totalTemps === 0 ? 0 : (totalProdM / (totalTemps / 60)).toFixed(0),
        "Producté (kg/h)":
          totalTemps === 0 ? 0 : (totalProdKg / (totalTemps / 60)).toFixed(0),
        "% déchets": percentageDechets,
        "Prod (kg) Simul": (totalProdKg * (1 + AugProd)).toFixed(0),

        "Producté (kg/h) Simul":
          totalTemps / 60 === 0
            ? 0
            : (
                (totalProdKg * (1 + AugProd)).toFixed(0) /
                (totalTemps / 60)
              ).toFixed(0),
        "% déchets Simul": percentageDechets * (1 - RedDechets),
        "Chef dept": calculateCategoryValue(
          DPT.toUpperCase() !== "CCP"
            ? categoryData[DPT.toUpperCase()]["Chef de département"]
            : categoryData["EXTRUSION"]["Chef de département"],
          designationData[machine.toUpperCase()],
          MachineProductivity[machine.toUpperCase()],
          NbReclamation,
          ProdSimul,
          calculatedValue,
          parseFloat(totalTemps) / 60,
          PUKG,
          déchetsSimul
        ),
        "Chef eq": calculateCategoryValue(
          DPT.toUpperCase() !== "CCP"
            ? categoryData[DPT.toUpperCase()]["Chef d'équipe"]
            : categoryData["EXTRUSION"]["Chef d'équipe"],
          designationData[machine.toUpperCase()],
          MachineProductivity[machine.toUpperCase()],
          NbReclamation,
          ProdSimul,
          calculatedValue,
          parseFloat(totalTemps) / 60,
          PUKG,
          déchetsSimul
        ),
        Extrudeur: calculateCategoryValue(
          DPT.toUpperCase() !== "IMPRESSION" && DPT.toUpperCase() !== "CCP" && DPT.toUpperCase() !== "SOUDURE"
            ? categoryData[DPT.toUpperCase()]["Extrudeur"]
            : categoryData["EXTRUSION"]["Extrudeur"],
          designationData[machine.toUpperCase()],
          MachineProductivity[machine.toUpperCase()],
          NbReclamation,
          ProdSimul,
          calculatedValue,
          parseFloat(totalTemps) / 60,
          PUKG,
          déchetsSimul
        ),
        Opérateur: calculateCategoryValue(
          DPT.toUpperCase() !== "IMPRESSION" && DPT.toUpperCase() !== "CCP"
            ? categoryData[DPT.toUpperCase()]["Opérateur"]
            : categoryData["EXTRUSION"]["Opérateur"],
          designationData[machine.toUpperCase()],
          MachineProductivity[machine.toUpperCase()],
          NbReclamation,
          ProdSimul,
          parseFloat(calculatedValue),
          parseFloat(totalTemps) / 60,
          PUKG,
          déchetsSimul
        ),
      };

      // Update total values
      totalChefDept += calculationResult["Chef dept"];
      totalChefEq += calculationResult["Chef eq"];
      totalExtrudeur += calculationResult.Extrudeur;
      totalOperateur += calculationResult.Opérateur;
      total = totalChefDept + totalChefEq + totalExtrudeur + totalOperateur;

      console.log("calculationResult", calculationResult)

      results.push(calculationResult);
    });



    const overallTotal =
      totalChefDept + totalChefEq + totalExtrudeur + totalOperateur;

    // Append total values to the final result
    const totalResult = {
      "Total Chef dept": totalChefDept.toFixed(2),
      "Total eq": totalChefEq.toFixed(2),
      "Total Extrudeur": totalExtrudeur.toFixed(2),
      "Total Opérateur": totalOperateur.toFixed(2),
      Prime: overallTotal.toFixed(2),
    };

    const primeData = {
      [`Prime_Totale_${DPT}`]: {
        "Total Chef dept": totalChefDept.toFixed(2),
        "Total eq": totalChefEq.toFixed(2),
        "Total Extrudeur": totalExtrudeur.toFixed(2),
        "Total Opérateur": totalOperateur.toFixed(2),
        Prime: overallTotal.toFixed(2),
      },
    };

    function calculateCategoryValue(
      categoryData,
      designationPercentDechet,
      machineProductivity,
      NbReclamation,
      ProdSimul,
      calculatedValue,
      totalTemps,
      PUKG,
      déchetsSimul
    ) {
      const C9 = 1;
      const S = calculatedValue;
      const T = déchetsSimul / 100;
      const B19 = machineProductivity;
      const B4 = PUKG;
      const C19 = designationPercentDechet?.toFixed(4);
      const B9 = categoryData;

      console.log("Formula Elements:", {
        ProdSimul: ProdSimul,
        PUKG: B4,
        déchetsSimulT: T,
        designationPercentDechet: C19,
        categoryData: B9,
        C9: C9,
        machineProductivity: B19,
        S: calculatedValue,
        NbReclamation: NbReclamation,
        totalTemps: totalTemps,
      });

      return NbReclamation < C9 && parseFloat(S) > B19
        ? parseFloat(ProdSimul) *
            (B4 - B4 * (T / parseFloat(C19))) *
            (B9 / 1000)
        : 0;
    }

    // Create the new collection and insert/update the results
    const calculationCollection = `calculation_${collectionName}`;
    for (const result of results) {
      console.log("result.Machine", result.Machine)
      console.log("result.EMPLOYE", result.EMPLOYE)
      console.log("result", result)
      await database
        .collection(calculationCollection)
        .updateOne(
          { Machine: result.Machine, EMPLOYE: result.EMPLOYE },
          { $set: result },
          { upsert: true }
        );
    }

    const primeCollection = database.collection("Prime");
    // Insert or update the Prime data in the collection
    await primeCollection.updateOne(
      {
        /* Add any specific conditions for updating */
      },
      { $set: primeData },
      { upsert: true }
    );

    return { Calcul: results, Total: totalResult };
  } catch (error) {
    console.error("Error calculating formulas:", error);
    throw new Error("Internal server error");
  } finally {
    await client.close();
    console.log("Disconnected from MongoDB");
  }
}

module.exports = calculateFormulasFromFile;
