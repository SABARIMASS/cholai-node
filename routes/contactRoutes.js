const express = require('express');
const { checkContacts ,userStatus} = require('../controllers/contactController');
const router = express.Router();

// POST route to check user availability
router.post('/check-contacts', checkContacts);
// POST
router.post('/user-status', userStatus);

module.exports = router;
