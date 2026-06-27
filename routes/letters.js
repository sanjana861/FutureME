const express = require('express');
const router = express.Router();
const letterController = require('../controllers/letterController');
const authMiddleware = require('../middleware/auth');

router.get('/all', authMiddleware, letterController.getAllLetters);
router.post('/generate', authMiddleware, letterController.generateNewLetter);
router.post('/:id/read', authMiddleware, letterController.readLetter);

module.exports = router;
