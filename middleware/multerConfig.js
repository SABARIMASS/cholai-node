const multer = require('multer');
const path = require('path');

// Storage configuration
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'local/temp/'); // Define your directory
    },
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname);
        const baseName = path.basename(file.originalname, ext);
        const timestamp = Date.now();
        cb(null, `${baseName}-${timestamp}${ext}`);
    },
});

// File filter for validation
const fileFilter = (req, file, cb) => {
    console.log("File Object: ", file);  // Log the whole file object
    console.log("MIME Type: ", file.mimetype);  // Log MIME type

    const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg']; // Allowed MIME types
    if (allowedTypes.includes(file.mimetype)) {
        cb(null, true); // Accept the file
    } else {
        cb(new Error('Invalid file type. Only JPG and PNG are allowed!'));
    }
};


// Initialize multer with storage and filter
const upload = multer({ storage, fileFilter });

module.exports = upload;
