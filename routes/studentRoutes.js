const express = require('express');
const router = express.Router();
const studentController = require('../controllers/studentController');
const { protect, authorizeStudent } = require('../middleware/auth');

// Apply protect & student checks to student routes
router.use(protect);
router.use(authorizeStudent);

router.get('/dashboard', studentController.getDashboard);
router.get('/exam/:examId/instructions', studentController.getInstructions);
router.get('/exam/:examId', studentController.getExamScreen);
router.post('/exam/:examId/submit', studentController.submitExam);
router.get('/result/:resultId', studentController.getResultScorecard);
router.get('/history', studentController.getExamHistory);
router.get('/leaderboard', studentController.getLeaderboard);

module.exports = router;
