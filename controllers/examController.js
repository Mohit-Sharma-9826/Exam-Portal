const Exam = require('../models/Exam');
const Question = require('../models/Question');
const Result = require('../models/Result');
const User = require('../models/User');
const StudentProfile = require('../models/StudentProfile');
const ActivityLog = require('../models/ActivityLog');
const { parseQuestionsCSV } = require('../utils/csvParser');

// Helper to log admin actions
const logActivity = async (adminId, action, details, req) => {
  try {
    const ipAddress = req.ip || req.connection.remoteAddress;
    await ActivityLog.create({
      admin: adminId,
      action,
      details,
      ipAddress
    });
  } catch (error) {
    console.error('Failed to save activity log:', error);
  }
};

// EXAM CONTROLLERS

// @desc    View Exams list
exports.getExams = async (req, res, next) => {
  try {
    const exams = await Exam.find({ createdBy: req.user._id }).populate('questions').sort({ createdAt: -1 });
    const questions = await Question.find({ createdBy: req.user._id }).sort({ subject: 1 });
    res.render('admin/exams', {
      title: 'Manage Exams',
      exams,
      questions,
      user: req.user
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Create Exam
exports.createExam = async (req, res, next) => {
  const { title, description, duration, totalMarks, passingMarks, questions } = req.body;

  try {
    // Standardize questions format (either single ID string, array of strings, or undefined)
    let questionsArray = [];
    if (questions) {
      questionsArray = Array.isArray(questions) ? questions : [questions];
    }

    const exam = await Exam.create({
      title,
      description,
      duration: parseInt(duration, 10),
      totalMarks: parseInt(totalMarks, 10),
      passingMarks: parseInt(passingMarks, 10),
      questions: questionsArray,
      createdBy: req.user._id
    });

    await logActivity(req.user._id, 'CREATE_EXAM', `Created exam "${exam.title}" with ${questionsArray.length} questions`, req);
    res.redirect('/admin/exams');
  } catch (error) {
    next(error);
  }
};

// @desc    Update Exam
exports.updateExam = async (req, res, next) => {
  const { title, description, duration, totalMarks, passingMarks, questions } = req.body;

  try {
    let questionsArray = [];
    if (questions) {
      questionsArray = Array.isArray(questions) ? questions : [questions];
    }

    const exam = await Exam.findOne({ _id: req.params.id, createdBy: req.user._id });
    if (!exam) {
      return res.status(404).render('error', { title: 'Not Found', message: 'Exam not found or unauthorized access', statusCode: 404, user: req.user });
    }

    exam.title = title;
    exam.description = description;
    exam.duration = parseInt(duration, 10);
    exam.totalMarks = parseInt(totalMarks, 10);
    exam.passingMarks = parseInt(passingMarks, 10);
    exam.questions = questionsArray;

    await exam.save();

    await logActivity(req.user._id, 'UPDATE_EXAM', `Updated exam "${exam.title}"`, req);
    res.redirect('/admin/exams');
  } catch (error) {
    next(error);
  }
};

// @desc    Delete Exam
exports.deleteExam = async (req, res, next) => {
  try {
    const exam = await Exam.findOne({ _id: req.params.id, createdBy: req.user._id });
    if (!exam) {
      return res.status(404).json({ success: false, message: 'Exam not found or unauthorized access' });
    }

    await Exam.deleteOne({ _id: req.params.id });

    await logActivity(req.user._id, 'DELETE_EXAM', `Deleted exam "${exam.title}"`, req);
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
};

// QUESTION CONTROLLERS

// @desc    View Question Bank
exports.getQuestions = async (req, res, next) => {
  const { search, subject } = req.query;

  try {
    const query = { createdBy: req.user._id };
    if (search) {
      query.text = { $regex: search, $options: 'i' };
    }
    if (subject) {
      query.subject = subject;
    }

    const questions = await Question.find(query).sort({ subject: 1 });
    
    // Find unique subjects for filter select element
    const subjects = await Question.distinct('subject', { createdBy: req.user._id });

    res.render('admin/questions', {
      title: 'Question Bank',
      questions,
      subjects,
      filters: { search: search || '', subject: subject || '' },
      user: req.user
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Create Question
exports.createQuestion = async (req, res, next) => {
  const { text, optionA, optionB, optionC, optionD, correctAnswer, marks, negativeMarks, subject } = req.body;

  try {
    const question = await Question.create({
      text,
      options: { A: optionA, B: optionB, C: optionC, D: optionD },
      correctAnswer,
      marks: parseInt(marks, 10),
      negativeMarks: parseFloat(negativeMarks),
      subject,
      createdBy: req.user._id
    });

    await logActivity(req.user._id, 'CREATE_QUESTION', `Created question: "${text.substring(0, 30)}..."`, req);
    res.redirect('/admin/questions');
  } catch (error) {
    next(error);
  }
};

// @desc    Update Question
exports.updateQuestion = async (req, res, next) => {
  const { text, optionA, optionB, optionC, optionD, correctAnswer, marks, negativeMarks, subject } = req.body;

  try {
    const question = await Question.findOne({ _id: req.params.id, createdBy: req.user._id });
    if (!question) {
      return res.status(404).render('error', { title: 'Not Found', message: 'Question not found or unauthorized access', statusCode: 404, user: req.user });
    }

    question.text = text;
    question.options = { A: optionA, B: optionB, C: optionC, D: optionD };
    question.correctAnswer = correctAnswer;
    question.marks = parseInt(marks, 10);
    question.negativeMarks = parseFloat(negativeMarks);
    question.subject = subject;

    await question.save();

    await logActivity(req.user._id, 'UPDATE_QUESTION', `Updated question ID ${question._id}`, req);
    res.redirect('/admin/questions');
  } catch (error) {
    next(error);
  }
};

// @desc    Delete Question
exports.deleteQuestion = async (req, res, next) => {
  try {
    const question = await Question.findOne({ _id: req.params.id, createdBy: req.user._id });
    if (!question) {
      return res.status(404).json({ success: false, message: 'Question not found or unauthorized access' });
    }

    await Question.deleteOne({ _id: req.params.id });

    // Also pull question from any exam it is associated with
    await Exam.updateMany(
      { questions: req.params.id },
      { $pull: { questions: req.params.id } }
    );

    await logActivity(req.user._id, 'DELETE_QUESTION', `Deleted question ID ${req.params.id}`, req);
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
};

// @desc    Import Questions from CSV File
exports.uploadQuestionsCSV = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }

    const questionsList = await parseQuestionsCSV(req.file.buffer, req.user._id);
    
    if (questionsList.length === 0) {
      return res.status(400).json({ success: false, message: 'CSV parser found no valid question rows. Make sure headers match.' });
    }

    const inserted = await Question.insertMany(questionsList);
    

    await logActivity(req.user._id, 'IMPORT_QUESTIONS_CSV', `Imported ${inserted.length} questions from CSV`, req);
    res.json({ success: true, count: inserted.length });
  } catch (error) {
    next(error);
  }
};

// REPORTS & EXPORT CONTROLLERS

// @desc    View Results list
exports.getResults = async (req, res, next) => {
  const { examId } = req.query;

  try {
    // Only get exams created by this admin
    const exams = await Exam.find({ createdBy: req.user._id }).select('title');
    const examIds = exams.map(e => e._id);
    
    // Find students managed by this admin
    const managedStudentProfiles = await StudentProfile.find({ assignedAdmin: req.user._id });
    const managedStudentUserIds = managedStudentProfiles.map(p => p.user);

    const query = {
      student: { $in: managedStudentUserIds },
      exam: { $in: examIds }
    };

    if (examId) {
      if (examIds.some(id => id.toString() === examId.toString())) {
        query.exam = examId;
      } else {
        query.exam = '000000000000000000000000'; // Target dummy non-existing ID
      }
    }

    const results = await Result.find(query)
      .populate('student', 'name email')
      .populate('exam', 'title totalMarks')
      .sort({ completedAt: -1 });

    res.render('admin/results', {
      title: 'Exam Results Report',
      results,
      exams,
      selectedExamId: examId || '',
      user: req.user
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Export Results as CSV file
exports.exportResultsCSV = async (req, res, next) => {
  const { examId } = req.query;

  try {
    // Only get exams created by this admin
    const exams = await Exam.find({ createdBy: req.user._id }).select('title');
    const examIds = exams.map(e => e._id);

    // Find students managed by this admin
    const managedStudentProfiles = await StudentProfile.find({ assignedAdmin: req.user._id });
    const managedStudentUserIds = managedStudentProfiles.map(p => p.user);

    const query = {
      student: { $in: managedStudentUserIds },
      exam: { $in: examIds }
    };
    let filenameSuffix = 'all';

    if (examId) {
      if (examIds.some(id => id.toString() === examId.toString())) {
        query.exam = examId;
        const examObj = await Exam.findById(examId);
        if (examObj) {
          filenameSuffix = examObj.title.toLowerCase().replace(/[^a-z0-9]/g, '-');
        }
      } else {
        query.exam = '000000000000000000000000';
      }
    }

    const results = await Result.find(query)
      .populate('student', 'name email')
      .populate('exam', 'title');

    // Generate CSV contents manually
    let csv = 'Student Name,Student Email,Exam Title,Score,Percentage,Total Questions,Attempted Questions,Correct Answers,Incorrect Answers,Status,Completed At\n';
    
    results.forEach(r => {
      const name = r.student ? r.student.name : 'Unknown Student';
      const email = r.student ? r.student.email : 'N/A';
      const examTitle = r.exam ? r.exam.title : 'Deleted Exam';
      const completedAt = r.completedAt ? r.completedAt.toISOString() : 'N/A';
      
      csv += `"${name}","${email}","${examTitle}",${r.score},${r.percentage},${r.totalQuestions},${r.attemptedQuestions},${r.correctAnswers},${r.incorrectAnswers},"${r.status}","${completedAt}"\n`;
    });

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=exam-results-${filenameSuffix}.csv`);
    res.status(200).send(csv);
  } catch (error) {
    next(error);
  }
};
