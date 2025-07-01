const express = require('express');
const { callLogs,  } = require('../controllers/callController');
const router = express.Router();

router.post('/call-history', callLogs);


module.exports = router;