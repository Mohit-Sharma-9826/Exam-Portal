const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const examController = require('../controllers/examController');
const { protect, authorizeAdmin } = require('../middleware/auth');

// Apply protection & admin role
router.use(protect);
router.use(authorizeAdmin);

// Dashboards & Logs
router.get('/dashboard', adminController.getDashboard);
router.get('/logs', adminController.getLogs);

// Student Management
router.get('/students', adminController.getStudents);
router.post('/students/:id/assign', adminController.assignExam);
router.post('/students/:id/toggle', adminController.toggleStudentStatus);

// Exam Management (CRUD)
router.get('/exams', examController.getExams);
router.post('/exams', examController.createExam);
router.post('/exams/:id', examController.updateExam);
router.delete('/exams/:id', examController.deleteExam); // API action

// Question Management (CRUD)
router.get('/questions', examController.getQuestions);
router.post('/questions', examController.createQuestion);
router.post('/questions/:id', examController.updateQuestion);
router.delete('/questions/:id', examController.deleteQuestion); // API action

// Results & Exports
router.get('/results', examController.getResults);
router.get('/results/export', examController.exportResultsCSV);

module.exports = router;
