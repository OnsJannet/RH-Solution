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

  const uri =
    "mongodb+srv://Incentive:ZwGK449N1aDZ1wcu@incentiverh.jvoa2rf.mongodb.net/";
  const client = new MongoClient(uri, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  });

  try {
    await client.connect();
    console.log("Connected to MongoDB");

    const database = client.db("Incentive");

    const machineData = await fetchAndSaveData("MachineData", "https://benplast-api.incentivesolutions.tech/api/Machines/RhSolutionGetVarMachine", database);
    const rhvarData = await fetchAndSaveData("RHVAR", "https://benplast-api.incentivesolutions.tech/api/Rhvars/RhSolutionGetRhvar", database);
    const rhData = await fetchAndSaveData("RH", "https://benplast-api.incentivesolutions.tech/api/Rhs/RhSolutionGetRh", database);

    const { EMPLOYE, Machine, EQ, Mois, Annee } = reqBody;

    const dptArray = Array.isArray(reqBody.DPT) ? reqBody.DPT : [reqBody.DPT];
    console.log("dptArray", dptArray)

    const allResults = [];

    for (const currentDPT of dptArray) {
      const defaultCollection = "timeSheetData";
      console.log("currentDPT", currentDPT)

      const collectionName =
        currentDPT.trim() === ""
          ? [defaultCollection]
          : currentDPT.toLowerCase() === "impression"
          ? ["timeSheetData_impression"]
          : [`timeSheetData_${currentDPT}`];

      const pipeline = [{ $match: {} }];

      let data = [];

      for (const collection of collectionName) {
        const collectionData = await database
          .collection(collection)
          .aggregate(pipeline)
          .toArray();

        data = data.concat(collectionData);
      }

      const rhVarData = await database.collection("RHVAR").find().toArray();

      const categoryData = {};
      rhVarData.forEach((entry) => {
        const category = entry["Catégorie"];
        const part = entry["Part"];
        const departement = entry["DPT"];

        console.log("categoryData", categoryData)

        if (category && part !== undefined && departement) {
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

          if (!categoryData[updatedDepartement]) {
            categoryData[updatedDepartement] = {};
          }

          categoryData[updatedDepartement][category] = part;
        }
      });

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

      let filteredData = data;

      if (EMPLOYE) {
        filteredData = filteredData.filter(
          (entry) => entry["EMPLOYE"] === EMPLOYE
        );
      }

      if (Machine) {
        filteredData = filteredData.filter(
          (entry) =>
            entry["Machine"]?.toLowerCase() === Machine.toLowerCase()
        );
      }

      if (Mois) {
        const targetMonth = parseInt(Mois, 10) - 1;

        filteredData = filteredData.filter((entry) => {
          const entryDateParts = entry["date"].split("/");
          const entryMonth = parseInt(entryDateParts[1], 10) - 1;
          return entryMonth === targetMonth;
        });
      }

      if (Annee) {
        filteredData = filteredData.filter((entry) => {
          const entryDateParts = entry["date"].split("/");
          const entryYear = entryDateParts[2];
          return parseInt(entryYear, 10) === Annee;
        });
      }

      const results = [];

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

      let totalChefDept = 0;
      let totalChefEq = 0;
      let totalExtrudeur = 0;
      let totalOperateur = 0;

      Object.values(groupedData).forEach((group) => {
        const machine = group.machine;
        const emp = group.EMPLOYE;
        const entries = group.entries;

        let totalProdM = 0;
        let totalProdKg = 0;
        let totalDechets = 0;
        let totalTemps = 0;
        let NbReclamation;
        let entryMonthsaved;
        let entryYearsaved;

        entries.forEach((entry) => {
          NbReclamation = entry["RECLAMATION"];
          const [day, month, year] = entry["date"].split("/");
          entryMonthsaved = month
          entryYearsaved = year

          
          if (currentDPT === "SOUDURE" || currentDPT === "soudure") {
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

          if (currentDPT === "SOUDURE") {
            totalDechets += (entry["MOE"] || 0) + (entry["SOUD"] || 0);
          }

          if (currentDPT !== "SOUDURE") {
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
          totalProdM === 0
            ? 0
            : parseFloat((totalDechets / totalProdKg) * 100);

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
              typeof totalProdM === "number"
                ? totalProdM.toFixed(3)
                : totalProdM,
            "Prod (kg)":
              typeof totalProdKg === "number"
                ? totalProdKg.toFixed(3)
                : totalProdKg,
          },
          totalDechets: totalDechets || 0,
          "Durée mn": formatTime(totalTemps),
          "Duree h": (totalTemps / 60).toFixed(2),
          "Producté (m/h)":
            totalTemps === 0
              ? 0
              : (totalProdM / (totalTemps / 60)).toFixed(0),
          "Producté (kg/h)":
            totalTemps === 0
              ? 0
              : (totalProdKg / (totalTemps / 60)).toFixed(0),
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
          "Mois": entryMonthsaved,
          "Annee": entryYearsaved,

          "Chef dept": calculateCategoryValue(
            currentDPT.toUpperCase() !== "CCP"
              ? categoryData[currentDPT.toUpperCase()]["Chef de département"]
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
            currentDPT.toUpperCase() !== "CCP"
              ? categoryData[currentDPT.toUpperCase()]["Chef d'équipe"]
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
            currentDPT.toUpperCase() !== "IMPRESSION" &&
              currentDPT.toUpperCase() !== "CCP" &&
              currentDPT.toUpperCase() !== "SOUDURE"
              ? categoryData[currentDPT.toUpperCase()]["Extrudeur"]
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
            currentDPT.toUpperCase() !== "IMPRESSION" &&
              currentDPT.toUpperCase() !== "CCP"
              ? categoryData[currentDPT.toUpperCase()]["Opérateur"]
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

        totalChefDept += calculationResult["Chef dept"];
        totalChefEq += calculationResult["Chef eq"];
        totalExtrudeur += calculationResult.Extrudeur;
        totalOperateur += calculationResult.Opérateur;

        results.push(calculationResult);
      });

      const overallTotal =
        totalChefDept + totalChefEq + totalExtrudeur + totalOperateur;

      const totalResult = {
        "Total Chef dept": totalChefDept.toFixed(2),
        "Total eq": totalChefEq.toFixed(2),
        "Total Extrudeur": totalExtrudeur.toFixed(2),
        "Total Opérateur": totalOperateur.toFixed(2),
        Prime: overallTotal.toFixed(2),
      };

      const primeData = {
        [`Prime_Totale_${currentDPT.toLowerCase()}_${Annee}`]: {
          "Total Chef dept": totalChefDept.toFixed(2),
          "Total eq": totalChefEq.toFixed(2),
          "Total Extrudeur": totalExtrudeur.toFixed(2),
          "Total Opérateur": totalOperateur.toFixed(2),
          Prime: overallTotal.toFixed(2),
        },
      };

      const lastYearEnteredKey = Object.keys(primeData).find((key) =>
        key.startsWith("Last Year Entered:")
      );
      if (lastYearEnteredKey) {
        primeData[lastYearEnteredKey] = Annee;
      } else {
        primeData[`Last Year Entered: `] = Annee;
      }

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

        /*console.log("Formula Elements:", {
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
        });*/

        return NbReclamation < C9 && parseFloat(S) > B19
          ? parseFloat(ProdSimul) *
              (B4 - B4 * (T / parseFloat(C19))) *
              (B9 / 1000)
          : 0;
      }

      const calculationCollection = `calculation_${collectionName}`;
      for (const result of results) {
        await database
          .collection(calculationCollection)
          .updateOne(
            { Machine: result.Machine, EMPLOYE: result.EMPLOYE },
            { $set: result },
            { upsert: true }
          );
      }

      const primeCollection = database.collection("Prime");
      await primeCollection.updateOne({}, { $set: primeData }, { upsert: true });

      allResults.push({
        DPT: currentDPT,
        Calcul: results,
        Total: totalResult,
      });
    }

    return allResults;
  } catch (error) {
    console.error("Error calculating formulas:", error);
    throw new Error("Internal server error");
  } finally {
    await client.close();
    console.log("Disconnected from MongoDB");
  }
}

async function fetchAndSaveData(collectionName, apiUrl, database) {
  try {
    const response = await fetch(apiUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch data from ${apiUrl}`);
    }

    const data = await response.json();

    await database.collection(collectionName).insertMany(data);

    console.log(`Data saved to ${collectionName} collection`);

    return data;
  } catch (error) {
    console.error(`Error fetching and saving data from ${apiUrl}:`, error);
    throw new Error("Internal server error");
  }
}


module.exports = calculateFormulasFromFile;
