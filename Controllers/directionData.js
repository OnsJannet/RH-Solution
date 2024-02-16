const fs = require("fs");
const { connectToDatabase, disconnectFromDatabase } = require("../database");

//Save Data To MongoDB
async function saveToMongoDB(jsonFilePath, collectionName) {
  let client;
  try {
    // Connect to MongoDB
    ({ client, database } = await connectToDatabase());

    // Fetch data from the "Prime" collection
    const primeCollection = database.collection("Prime");
    const primeData = await primeCollection.find().toArray();
    //console.log(primeData);

    // Calculate the sum of all "Prime" values
    /*const budget = primeData.reduce((sum, entry) => {
      // Iterate over each department in the entry
      Object.values(entry).forEach((department) => {
        // Add the "Prime" value to the sum
        sum += parseFloat(department?.Prime || 0);
      });

      return sum;
    }, 0);*/

    let budget;

    const entryKeys = primeData.length > 0 ? Object.keys(primeData[0]) : [];
    console.log("Keys of an entry in primeData:", entryKeys);
    
    const lastYearEnteredKey = entryKeys.find((key) => key.startsWith('Last Year Entered'));
    
    if (lastYearEnteredKey) {
      const lastYearEntered = primeData[0][lastYearEnteredKey];
    
      // Calculate the budget only if Last Year Entered is found
      budget = primeData.reduce((sum, entry) => {
        // Check if the entry corresponds to the specified year and is not the "Last Year Entered" key
        if (
          Object.keys(entry).some((key) =>
            key.endsWith(`_${lastYearEntered}`) && key !== `Last Year Entered: ${lastYearEntered}`
          )
        ) {
          // Log the matching keys for each entry
          const matchingKeys = Object.keys(entry).filter((key) =>
            key.endsWith(`_${lastYearEntered}`) && key !== `Last Year Entered: ${lastYearEntered}`
          );
          console.log("Matching keys:", matchingKeys);
    
          // Iterate over each matching key in the entry
          matchingKeys.forEach((matchingKey) => {
            // Add the "Prime" value of the matching key to the sum
            sum += parseFloat(entry[matchingKey]?.Prime || 0);
          });
        }
    
        return sum;
      }, 0);
    
      console.log("Budget for Last Year Entered:", budget);
    } else {
      console.log("Last Year Entered not found in primeData");
    }
    

    // Read the JSON file
    const jsonData = JSON.parse(fs.readFileSync(jsonFilePath, "utf-8"));
    // Calculate the total sum of "ok" values for all departments except "Product"
    const totalOkExceptProduct = Object.keys(jsonData)
      .filter((department) => department.toLowerCase() !== "product")
      .reduce((sum, department) => {
        return sum + (jsonData[department].ok || 0);
      }, 0);

    const totalEmployeesMinusProduction = Object.keys(jsonData)
      .filter((department) => department.toLowerCase() !== "production")
      .reduce((sum, department) => {
        return sum + (jsonData[department].ok || 0);
      }, 0);

    console.log("Total employees including PRoduction:", totalOkExceptProduct);
    console.log(
      "Total employees including PRoduction:",
      totalEmployeesMinusProduction
    );

    const testBudge = budget;
    //const testBudge = 200000;
    const testBudgetPerPrime = testBudge / 2;
    const testBudgetNormal = testBudgetPerPrime * (10 / 100);
    const testBudgetProduction = testBudgetPerPrime * (40 / 100);
    const individueBudget = testBudgetPerPrime / totalOkExceptProduct;

    //console.log("Test Budge:", testBudge);
    //console.log("testBudgetNormal", testBudgetNormal);
    //console.log("testBudgetPerPrime", testBudgetPerPrime);
    //console.log("testBudgetProduction", testBudgetProduction);
    //console.log("individueBudget", individueBudget)

    // Perform calculations on jsonData (modify this part based on your calculations)
    /*const calculatedData = performCalculations(
      jsonData,
      totalEmployeesMinusProduction,
      budget,
      testBudgetPerPrime,
      testBudgetNormal,
      testBudgetProduction,
      individueBudget
    );*/

    const calculatedData = performCalculations(
      jsonData,
      totalEmployeesMinusProduction,
      testBudgetNormal,
      testBudgetProduction,
      individueBudget
    );

    // Save data to MongoDB
    const collection = database.collection(collectionName);
    await collection.insertOne(calculatedData);
    return { calculatedData };
    //console.log(`Data has been saved to MongoDB collection: ${collectionName}`);
  } catch (error) {
    console.error(error);
    throw new Error("Failed to save data to MongoDB");
  } finally {
    // Disconnect from MongoDB
    await disconnectFromDatabase();
  }
}

//Calculations
function performCalculations(
  data,
  totalEmployeesMinusProduction,
  testBudgetNormal,
  testBudgetProduction,
  individueBudget
) {
  for (const department in data) {
    const departmentData = data[department];

    // Check if the department has "ok" property
    if (departmentData.hasOwnProperty("ok")) {
      const valeurVariable = calculateValeurVariable(
        department,
        departmentData,
        totalEmployeesMinusProduction
      );
      departmentData["Valeur Variable"] = `${valeurVariable}%`;

      //console.log("testBudgetNormal2", testBudgetNormal);
      //console.log("testBudgetProduction2", testBudgetProduction);
      //console.log("individueBudget2", individueBudget);
      // Calculate Prime Annuelle, Prime Trimestrielle, and Prime Mensuelle for the department
      calculatePrimes(
        departmentData,
        testBudgetNormal,
        testBudgetProduction,
        department
      );

      // Check if the department has sub-departments
      if (
        typeof departmentData === "object" &&
        !Array.isArray(departmentData)
      ) {
        calculateSubDepartmentsValeurVariable(
          departmentData,
          parseFloat(departmentData["Valeur Variable"])
        );

        calculateProductionSubDepartementsPart(departmentData);

        // Calculate Prime Annuelle, Prime Trimestrielle, and Prime Mensuelle for sub-departments
        calculateSubDepartmentsPrimes(
          departmentData,
          testBudgetNormal,
          testBudgetProduction
        );
      }

      // Calculation Prime for Department "Production"
      if (department === "Production") {
        const allData = data[department];
        const NumberofEmployers = departmentData.ok;
        const ValeurVariableDepartments = parseFloat(
          departmentData["Valeur Variable"]
        );
        const PrimeMensuelle = departmentData;
        const subDepartementProduction = departmentData.subDepartement;

        calculateRespProductionPart(
          NumberofEmployers,
          ValeurVariableDepartments,
          subDepartementProduction
        );

        calculateProductionSubDepartementsPart(
          NumberofEmployers,
          ValeurVariableDepartments,
          subDepartementProduction
        );

        calculateRespProductionValeur(
          NumberofEmployers,
          ValeurVariableDepartments,
          subDepartementProduction
        );

        calculateProductionSubDepartementsValeur(subDepartementProduction);

        calculateProductionSubDepartementsValeurVariable(
          subDepartementProduction
        );

        calculatePrimeProductionValeur(
          NumberofEmployers,
          ValeurVariableDepartments,
          subDepartementProduction,
          allData,
          testBudgetProduction
        );

        calculatePrimeProductionSubValeur(
          NumberofEmployers,
          ValeurVariableDepartments,
          subDepartementProduction,
          allData,
          testBudgetProduction
        );
      }
    }

    // Calculate Production Departement Part
    if (departmentData.subDepartement) {
      const ProductionNumber = departmentData["ok"];
      const ProductionValeur = departmentData["Valeur Variable"];

      if (departmentData["ok"] === 100) {
        var Production = departmentData["ok"];
      }

      if (departmentData["ok"] === 100) {
        var Production = departmentData["ok"];
      }

      const respProductionData = departmentData.subDepartement;

      // Replace the placeholder values with actual data
      const nbrProduction = respProductionData.Nbre;
      if (respProductionData.hasOwnProperty("ok")) {
        const valeurVariable = calculateValeurVariable(
          department,
          departmentData,
          totalEmployeesMinusProduction
        );
        departmentData["Valeur Variable"] = `${valeurVariable}%`;

        // Calculate Prime Annuelle, Prime Trimestrielle, and Prime Mensuelle for the department
        calculatePrimes(departmentData, testBudgetNormal, testBudgetProduction);
      }
    }

    // Add individueBudget property
    data["individueBudget"] = individueBudget;

    // Remove the total property (optional)
    delete departmentData.total;
  }

  return data;
}

// Valeur Variable Département
function calculateValeurVariable(
  departmentName,
  departmentData,
  totalEmployeesMinusProduction
) {
  const okPercentage =
    (departmentData.ok * 100) / totalEmployeesMinusProduction;

  switch (departmentName) {
    case "Qualité":
      return okPercentage + 0.5 + 0.5;

    case "Commercial":
      return okPercentage + 0.4 + 0.3 + 0.25;

    case "Maintenannce":
      return okPercentage - 0.25;

    case "GRH":
      return okPercentage - 1.5;

    case "Approvisionnement":
      return okPercentage + 0.25 + 0.25;

    case "Finance + Compta":
      return okPercentage - 1 + 0.2 + 0.5;

    case "Production":
      return 76.52;

    default:
      return 0; // Default value if no formula matches
  }
}

// Valeur Variable Sub Département
function calculateSubDepartmentsValeurVariable(
  subDepartments,
  parentValeurVariable
) {
  for (const subDepartment in subDepartments) {
    const subDepartmentData = subDepartments[subDepartment];
    if (!subDepartments["Production"]) {
      // Check if the sub-department has "Part" property
      if (subDepartmentData.hasOwnProperty("Part")) {
        let valeurVariable;

        // Check specific conditions for Production department and sub-departments
        if (
          subDepartment === "Resp. Production" ||
          subDepartment === "Planification" ||
          subDepartment === "Extrusion" ||
          subDepartment === "Soudure" ||
          subDepartment === "Trait Déchet" ||
          subDepartment === "Impression"
        ) {
          break;
        } else {
          // For other cases, use the default formula
          valeurVariable =
            (subDepartmentData.Part * parentValeurVariable) / 100;
        }

        subDepartmentData["Valeur Variable"] = valeurVariable;
      }

      // Check if the sub-department has sub-departments
      if (
        typeof subDepartmentData === "object" &&
        !Array.isArray(subDepartmentData)
      ) {
        calculateSubDepartmentsValeurVariable(
          subDepartmentData,
          parseFloat(subDepartmentData["Valeur Variable"])
        );
      }
    }
  }

  // Calculate production sub-departments
  /*if (subDepartments["Production"]) {
    calculateProductionSubDepartments(subDepartments["Production"]);
  }*/
}

// Calcules Prime for departements
function calculatePrimes(
  departmentData,
  testBudgetNormal,
  testBudgetProduction,
  department
) {
  // Check if the department is "Production"
  const isProduction =
    departmentData && departmentData.hasOwnProperty("subDepartement");

  // Use the appropriate test budget based on the department
  const testBudgetIn = isProduction ? testBudgetProduction : testBudgetNormal;
  //console.log("testBudgetIn", testBudgetIn);

  const primeAnnuelle =
    (parseFloat(departmentData["Valeur Variable"]) * testBudgetIn) / 100;

  const primeAnnuelleValue = primeAnnuelle.toFixed(2);
  const primeTrimestrielleValue = (primeAnnuelle / 4).toFixed(2);
  const primeMensuelleValue = (primeAnnuelle / 12).toFixed(2);

  departmentData["Prime Annuelle"] = primeAnnuelleValue;
  departmentData["Prime Trimestrielle"] = primeTrimestrielleValue;
  departmentData["Prime Mensuelle"] = primeMensuelleValue;

  return {
    primeAnnuelle: primeAnnuelleValue,
    primeTrimestrielle: primeTrimestrielleValue,
    primeMensuelle: primeMensuelleValue,
  };
}

// Calcules Prime for sub departements
function calculateSubDepartmentsPrimes(
  subDepartments,
  testBudgetNormal,
  testBudgetProduction
) {
  for (const subDepartment in subDepartments) {
    const subDepartmentData = subDepartments[subDepartment];

    // Check if the sub-department has "Part" property
    if (subDepartmentData.hasOwnProperty("Part")) {
      const subDepartmentValeurVariable = parseFloat(
        subDepartmentData["Valeur Variable"]
      );
      const parentValeurVariable = parseFloat(
        subDepartments["Valeur Variable"]
      );

      // Check if the parentValeurVariable is not NaN to avoid division by zero
      if (!isNaN(parentValeurVariable) && parentValeurVariable !== 0) {
        const { primeAnnuelle, primeTrimestrielle, primeMensuelle } =
          calculatePrimes(
            subDepartmentData,
            testBudgetNormal,
            testBudgetProduction
          );

        const primeAnnuelleSub = subDepartmentValeurVariable * testBudgetNormal;

        subDepartmentData["Prime Annuelle"] = primeAnnuelleSub.toFixed(2);
        subDepartmentData["Prime Trimestrielle"] = (
          primeAnnuelleSub / 4
        ).toFixed(2);
        subDepartmentData["Prime Mensuelle"] = (primeAnnuelleSub / 12).toFixed(
          2
        );
      } else {
        // If parentValeurVariable is NaN or 0, set primes to 0
        if (
          !subDepartments.Planification ||
          !subDepartments.Extrusion ||
          !subDepartments.Impression ||
          !subDepartments.Soudure ||
          !subDepartments["Resp. Production"] ||
          !subDepartments["Trait Déchet"]
        ) {
          subDepartmentData["Prime Annuelle"] = "0.00";
          subDepartmentData["Prime Trimestrielle"] = "0.00";
          subDepartmentData["Prime Mensuelle"] = "0.00";
        } else {
          break;
        }
      }
    }

    // Check if the sub-department has sub-departments
    if (
      typeof subDepartmentData === "object" &&
      !Array.isArray(subDepartmentData)
    ) {
      // Check if the department is "Production"
      const isProduction =
        subDepartmentData && subDepartmentData.hasOwnProperty("subDepartement");

      // Use the appropriate test budget based on the department
      const testBudget = isProduction ? testBudgetProduction : testBudgetNormal;

      calculateSubDepartmentsPrimes(subDepartmentData, testBudget);
    }
  }
}

// Production:
// Calculates Production Departement Parts
function calculateRespProductionPart(
  NumberofEmployers,
  ValeurVariableDepartments,
  subDepartementProduction
) {
  const ValeurVariableDepartmentsAfter = ValeurVariableDepartments / 100;
  for (let subDep in subDepartementProduction) {
    if (subDep === "Impression") {
      subDepartementProduction[subDep].Part =
        (subDepartementProduction[subDep].Nbre *
          ValeurVariableDepartmentsAfter) /
          NumberofEmployers +
        0.006;
    } else if (subDep === "Resp. Production") {
      subDepartementProduction[subDep].Part =
        (subDepartementProduction[subDep].Nbre *
          ValeurVariableDepartmentsAfter) /
          NumberofEmployers +
        0.007;
    } else if (subDep === "Extrusion") {
      subDepartementProduction[subDep].Part =
        (subDepartementProduction[subDep].Nbre *
          ValeurVariableDepartmentsAfter) /
          NumberofEmployers -
        0.005;
    } else if (subDep === "Soudure") {
      subDepartementProduction[subDep].Part =
        (subDepartementProduction[subDep].Nbre *
          ValeurVariableDepartmentsAfter) /
        NumberofEmployers;
    } else if (subDep === "Trait Déchet") {
      subDepartementProduction[subDep].Part =
        (subDepartementProduction[subDep].Nbre *
          ValeurVariableDepartmentsAfter) /
          NumberofEmployers -
        0.006;
    }
  }
}

// Calculates Production Sub Departement Parts
function calculateProductionSubDepartementsPart(
  NumberofEmployers,
  ValeurVariableDepartments,
  subDepartementProduction
) {
  for (let subDep in subDepartementProduction) {
    for (let souSubDep in subDepartementProduction[subDep]) {
      subDepartementProduction[subDep][souSubDep].Part =
        (subDepartementProduction[subDep][souSubDep].souPart *
          subDepartementProduction[subDep].Part) /
        1;
    }
  }
}

function calculateProductionSubDepartementsValeurVariable(
  subDepartementProduction
) {
  for (let subDep in subDepartementProduction) {
    for (let souSubDep in subDepartementProduction[subDep]) {
      subDepartementProduction[subDep][souSubDep]["Valeur Variable"] =
        (subDepartementProduction[subDep][souSubDep].souPart *
          subDepartementProduction[subDep]["Valeur Variable"]) /
        1;
    }
  }
}

// Calculates Production Departement Valeur
function calculateRespProductionValeur(
  NumberofEmployers,
  ValeurVariableDepartments,
  subDepartementProduction
) {
  for (let subDep in subDepartementProduction) {
    subDepartementProduction[subDep]["Valeur Variable"] =
      ((subDepartementProduction[subDep].Part * 1) /
        ValeurVariableDepartments) *
      100;
  }
}

// Calculates Prime for Production Departement
function calculatePrimeProductionValeur(
  NumberofEmployers,
  ValeurVariableDepartments,
  subDepartementProduction,
  allData,
  testBudgetProduction
) {
  const PercentageValeur = ValeurVariableDepartments;
  const PrimeMensuelleProduction = testBudgetProduction * PercentageValeur;
  for (let subDep in subDepartementProduction) {
    if (
      subDepartementProduction[subDep] !==
      subDepartementProduction["Trait Déchet"]
    ) {
      subDepartementProduction[subDep]["Prime Annuelle"] =
        (PrimeMensuelleProduction *
          subDepartementProduction[subDep]["Valeur Variable"]) /
        100;
    } else {
      subDepartementProduction[subDep]["Prime Annuelle"] =
        (PrimeMensuelleProduction *
          subDepartementProduction[subDep]["Valeur Variable"]) /
        2 /
        100;
    }

    // Calculate Prime Trimestrielle and Prime Mensuelle
    subDepartementProduction[subDep]["Prime Trimestrielle"] =
      subDepartementProduction[subDep]["Prime Annuelle"] / 4;
    subDepartementProduction[subDep]["Prime Mensuelle"] =
      subDepartementProduction[subDep]["Prime Annuelle"] / 12;
  }
}

// Calculates Prime for Production Sub Departement
function calculatePrimeProductionSubValeur(
  NumberofEmployers,
  ValeurVariableDepartments,
  subDepartementProduction,
  allData,
  testBudgetProduction
) {
  const PercentageValeur = ValeurVariableDepartments;
  const PrimeMensuelleProduction = testBudgetProduction * PercentageValeur;

  for (let subDep in subDepartementProduction) {
    for (let souSubDep in subDepartementProduction[subDep]) {
      const subElement = subDepartementProduction[subDep][souSubDep];
      if (subElement.hasOwnProperty("souPart")) {
        const souPartValue = subElement.souPart;

        // Calculate Prime Annuelle for the sub-department
        subElement["Prime Annuelle"] =
          (souPartValue * subDepartementProduction[subDep]["Prime Annuelle"]) /
          subElement.Nbre;

        // Calculate Prime Trimestrielle and Prime Mensuelle
        subElement["Prime Trimestrielle"] = subElement["Prime Annuelle"] / 4;
        subElement["Prime Mensuelle"] = subElement["Prime Annuelle"] / 12;
      }
    }
  }
}

// Calculates Production Sub Departement Valeur
function calculateProductionSubDepartementsValeur(subDepartementProduction) {
  for (let subDep in subDepartementProduction) {
    for (let souSubDep in subDepartementProduction[subDep]) {
      subDepartementProduction[subDep][souSubDep].Part =
        (subDepartementProduction[subDep][souSubDep].souPart *
          subDepartementProduction[subDep].Part) /
        1;
    }
  }
}

module.exports = saveToMongoDB;
