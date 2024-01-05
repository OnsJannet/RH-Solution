const express = require("express");
const timeSheetController = require("../Controllers/timeSheetController");

const router = express.Router();

router.post("/uploadData", timeSheetController.uploadData);
router.get("/fetchData/:category", timeSheetController.fetchData);

module.exports = router;
