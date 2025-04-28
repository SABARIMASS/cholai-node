const express = require('express');
const upload = require('../middleware/multerConfig'); // Import the updated multer config
const { uploadTemp } = require('../controllers/documentController');

const router = express.Router();

// API to upload an image (temporary)
router.post('/upload-temp', upload.single('image'), (req, res, next) => {
    console.log("File received:", req.file);  // This will print the file details
    // Handle file validation errors
    if (req.fileValidationError) {
        return res.status(400).json({ message: req.fileValidationError });
    }
    next();
}, uploadTemp);


module.exports = router;
