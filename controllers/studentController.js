const User = require('../models/User');
const StudentProfile = require('../models/StudentProfile');
const Exam = require('../models/Exam');
const Question = require('../models/Question');
const Result = require('../models/Result');
const StudentResponse = require('../models/StudentResponse');

// Fisher-Yates array shuffle helper
const shuffleArray = (array) => {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
};

// @desc    Student Dashboard
exports.getDashboard = async (req, res, next) => {
  try {
    const studentProfile = await StudentProfile.findOne({ user: req.user._id }).populate({
      path: 'assignedExams',
      match: { isActive: true }
    });

    if (!studentProfile) {
      return res.status(404).render('error', {
        title: 'Profile Not Found',
        message: 'Student profile not found. Please contact administrator.',
        statusCode: 404,
        user: req.user
      });
    }

    // Get exam history
    const results = await Result.find({ student: req.user._id })
      .populate('exam')
      .sort({ completedAt: -1 });

    // Calculate metrics
    const totalExamsTaken = results.length;
    const passedExams = results.filter(r => r.status === 'pass').length;
    const averagePercentage = totalExamsTaken > 0
      ? (results.reduce((acc, r) => acc + r.percentage, 0) / totalExamsTaken).toFixed(1)
      : 0;

    res.render('student/dashboard', {
      title: 'Student Dashboard',
      profile: studentProfile,
      results,
      metrics: {
        totalExamsTaken,
        passedExams,
        averagePercentage
      },
      user: req.user
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Exam Instructions Screen
exports.getInstructions = async (req, res, next) => {
  try {
    const exam = await Exam.findById(req.params.examId);
    if (!exam || !exam.isActive) {
      return res.status(404).render('error', {
        title: 'Exam Not Found',
        message: 'The requested exam is not available.',
        statusCode: 404,
        user: req.user
      });
    }

    // Verify if currently assigned
    const studentProfile = await StudentProfile.findOne({ user: req.user._id });
    if (!studentProfile || !studentProfile.assignedExams.includes(exam._id)) {
      return res.redirect('/student/dashboard?error=not_assigned');
    }

    res.render('student/instructions', {
      title: `${exam.title} - Instructions`,
      exam,
      user: req.user
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Start/Resume Exam Screen
exports.getExamScreen = async (req, res, next) => {
  try {
    const exam = await Exam.findById(req.params.examId).populate('questions');
    if (!exam || !exam.isActive) {
      return res.redirect('/student/dashboard?error=exam_unavailable');
    }

    // Check if exam is currently assigned to the student
    const studentProfile = await StudentProfile.findOne({ user: req.user._id });
    if (!studentProfile || !studentProfile.assignedExams.includes(exam._id)) {
      return res.redirect('/student/dashboard?error=not_assigned');
    }

    // Find or create StudentResponse
    let responseSession = await StudentResponse.findOne({ student: req.user._id, exam: exam._id });

    // If an old submitted session exists, clear it for the new attempt
    if (responseSession && responseSession.isSubmitted) {
      await StudentResponse.deleteOne({ _id: responseSession._id });
      responseSession = null;
    }

    if (!responseSession) {
      const startTime = new Date();
      const endTime = new Date(startTime.getTime() + exam.duration * 60 * 1000);

      // Shuffle copy of questions array to randomize question order for this student
      const shuffledQuestions = shuffleArray([...exam.questions]);

      // Initialize responses structure in randomized order
      const responses = shuffledQuestions.map(q => ({
        questionId: q._id,
        selectedOption: '',
        markedForReview: false,
        visited: false
      }));

      responseSession = await StudentResponse.create({
        student: req.user._id,
        exam: exam._id,
        startTime,
        endTime,
        responses
      });
    } else {
      // Check if session is expired
      const now = new Date();
      if (now >= responseSession.endTime) {
        // Auto submit if expired and redirect to result
        return exports.submitExamLogic(req.user._id, exam._id, res, next);
      }
    }

    // Calculate remaining time in seconds
    const now = new Date();
    const remainingSeconds = Math.max(0, Math.floor((responseSession.endTime.getTime() - now.getTime()) / 1000));

    // Render exam template following the randomized order saved in the response session
    const sanitizedQuestions = responseSession.responses.map((resp, idx) => {
      const q = exam.questions.find(quest => quest._id.toString() === resp.questionId.toString());
      return {
        _id: q._id,
        text: q.text,
        options: q.options,
        marks: q.marks,
        negativeMarks: q.negativeMarks,
        subject: q.subject,
        index: idx + 1
      };
    });

    res.render('student/exam', {
      title: exam.title,
      exam,
      questions: sanitizedQuestions,
      session: responseSession,
      remainingSeconds,
      user: req.user
    });
  } catch (error) {
    next(error);
  }
};

// @desc    AJAX API to save/update an option or visit status in progress
exports.saveAnswer = async (req, res, next) => {
  const { examId, questionId, selectedOption, markedForReview, visited } = req.body;

  try {
    const session = await StudentResponse.findOne({ student: req.user._id, exam: examId });
    if (!session || session.isSubmitted) {
      return res.status(400).json({ success: false, message: 'No active session found or already submitted' });
    }

    // Check if time expired
    if (new Date() > session.endTime) {
      return res.status(403).json({ success: false, message: 'Time has expired' });
    }

    // Find response and update
    const responseIndex = session.responses.findIndex(r => r.questionId.toString() === questionId);
    if (responseIndex !== -1) {
      if (selectedOption !== undefined) session.responses[responseIndex].selectedOption = selectedOption;
      if (markedForReview !== undefined) session.responses[responseIndex].markedForReview = markedForReview;
      if (visited !== undefined) session.responses[responseIndex].visited = visited;

      await session.save();
      return res.json({ success: true });
    }

    res.status(404).json({ success: false, message: 'Question not found in exam' });
  } catch (error) {
    next(error);
  }
};

// @desc    Submit Exam manually (POST handler)
exports.submitExam = async (req, res, next) => {
  const { examId } = req.body;
  try {
    await exports.submitExamLogic(req.user._id, examId, res, next);
  } catch (error) {
    next(error);
  }
};

// Core Logic helper to evaluate answers, calculate grades, create result entries
exports.submitExamLogic = async (studentId, examId, res, next) => {
  try {
    const session = await StudentResponse.findOne({ student: studentId, exam: examId }).populate({
      path: 'exam',
      populate: { path: 'questions' }
    });

    if (!session) {
      return res.redirect('/student/dashboard?error=no_active_session');
    }

    if (session.isSubmitted) {
      const existingResult = await Result.findOne({ student: studentId, exam: examId });
      return res.redirect(`/student/result/${existingResult._id}`);
    }

    // Calculate score
    const exam = session.exam;
    let score = 0;
    let correctAnswers = 0;
    let incorrectAnswers = 0;
    let attemptedQuestions = 0;
    const totalQuestions = exam.questions.length;

    session.responses.forEach(resp => {
      const question = exam.questions.find(q => q._id.toString() === resp.questionId.toString());
      if (question) {
        if (resp.selectedOption && resp.selectedOption !== '') {
          attemptedQuestions++;
          const isCorrect = resp.selectedOption === question.correctAnswer;
          if (isCorrect) {
            score += question.marks;
            correctAnswers++;
          } else {
            score -= question.negativeMarks;
            incorrectAnswers++;
          }
        }
      }
    });

    // Ensure score is not negative if we don't want it to drop below zero
    score = Math.max(0, score);
    const percentage = parseFloat(((score / exam.totalMarks) * 100).toFixed(2));
    const status = score >= exam.passingMarks ? 'pass' : 'fail';

    // Mark session submitted
    session.isSubmitted = true;
    session.submittedAt = new Date();
    await session.save();

    // Remove from student profile's assignedExams list
    await StudentProfile.findOneAndUpdate(
      { user: studentId },
      { $pull: { assignedExams: examId } }
    );

    // Create Result
    const result = await Result.create({
      student: studentId,
      exam: exam._id,
      score,
      percentage,
      totalQuestions,
      attemptedQuestions,
      correctAnswers,
      incorrectAnswers,
      status
    });

    // Redirect or output JSON depending on API
    res.redirect(`/student/result/${result._id}`);
  } catch (error) {
    next(error);
  }
};

// @desc    View specific scorecard
exports.getResultScorecard = async (req, res, next) => {
  try {
    const result = await Result.findById(req.params.resultId).populate('exam');
    if (!result) {
      return res.status(404).render('error', {
        title: 'Result Not Found',
        message: 'The scorecard was not found.',
        statusCode: 404,
        user: req.user
      });
    }

    // Double check user authorization
    if (result.student.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).render('error', {
        title: 'Access Denied',
        message: 'You are not authorized to view this scorecard.',
        statusCode: 403,
        user: req.user
      });
    }

    res.render('student/result', {
      title: 'Exam Result Summary',
      result,
      user: req.user
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Exam History View
exports.getExamHistory = async (req, res, next) => {
  try {
    const results = await Result.find({ student: req.user._id }).populate('exam').sort({ completedAt: -1 });
    res.render('student/history', {
      title: 'Exam History',
      results,
      user: req.user
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Exam Leaderboard View
exports.getLeaderboard = async (req, res, next) => {
  try {
    // Find student's assigned admin
    const profile = await StudentProfile.findOne({ user: req.user._id });
    if (!profile) {
      return res.status(404).render('error', {
        title: 'Profile Not Found',
        message: 'Student profile not found. Please contact administrator.',
        statusCode: 404,
        user: req.user
      });
    }

    const exams = await Exam.find({ createdBy: profile.assignedAdmin, isActive: true });
    const selectedExamId = req.query.examId || (exams.length > 0 ? exams[0]._id : null);
    
    let standings = [];
    if (selectedExamId) {
      standings = await Result.find({ exam: selectedExamId })
        .populate('student', 'name email')
        .sort({ score: -1, percentage: -1, completedAt: 1 })
        .limit(10);
    }

    res.render('student/leaderboard', {
      title: 'Exam Leaderboards',
      exams,
      selectedExamId,
      standings,
      user: req.user
    });
  } catch (error) {
    next(error);
  }
};
