const express = require('express');
const router = express.Router();
const taskController = require('../controllers/taskController');
const authMiddleware = require('../middleware/auth');

router.get('/daily', authMiddleware, taskController.getDailyTasks);
router.post('/:id/complete', authMiddleware, taskController.completeTask);
router.post('/:id/skip', authMiddleware, taskController.skipTask);
router.post('/:id/postpone', authMiddleware, taskController.postponeTask);
router.post('/weekly-checkin', authMiddleware, taskController.submitWeeklyCheckin);

module.exports = router;
