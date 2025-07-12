const express = require('express');
const upload = require('../middleware/multerConfig'); // still using multer
const { uploadTemp } = require('../controllers/documentController');

const router = express.Router();

// API to upload an image (temporary)
router.post(
    '/upload-temp',
    upload.single('image'),
    async (req, res, next) => {
        if (req.fileValidationError) {
            return res.status(400).json({ message: req.fileValidationError });
        }
        next(); // go to uploadTemp controller
    },
    uploadTemp
);

module.exports = router;
