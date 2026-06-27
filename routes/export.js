const express = require('express');
const router = express.Router();
const exportController = require('../controllers/exportController');
const authMiddleware = require('../middleware/auth');

router.get('/json', authMiddleware, exportController.exportJson);
router.get('/markdown', authMiddleware, exportController.exportMarkdown);
router.get('/pdf', authMiddleware, exportController.exportPdf);

module.exports = router;
