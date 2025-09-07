const express = require("express");
const multer = require("multer");
const router = express.Router();
const cvController = require("../controllers/cvController");

// File upload configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/");
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + "-" + file.originalname);
  },
});

const upload = multer({
  storage: storage,
  fileFilter: (req, file, cb) => {
    const allowedTypes = /pdf|doc|docx/;
    const extname = allowedTypes.test(
      require("path").extname(file.originalname).toLowerCase()
    );

    if (extname) {
      return cb(null, true);
    } else {
      cb(new Error("Only PDF, DOC, and DOCX files are allowed"));
    }
  },
  limits: { fileSize: 5 * 1024 * 1024 },
});

// Routes
router.post("/analyze", upload.single("cv"), cvController.analyzeCv);
router.post("/compare", upload.single("cv"), cvController.compareWithJob);

module.exports = router;
