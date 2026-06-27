const express = require('express');
const router = express.Router();
const mentorController = require('../controllers/mentorController');
const authMiddleware = require('../middleware/auth');

router.get('/chat', authMiddleware, mentorController.getChatHistory);
router.post('/chat', authMiddleware, mentorController.sendChatMessage);

module.exports = router;
