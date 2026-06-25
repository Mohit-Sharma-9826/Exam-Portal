const User = require('../models/User');
const StudentProfile = require('../models/StudentProfile');
const Exam = require('../models/Exam');
const Question = require('../models/Question');
const Result = require('../models/Result');
const ActivityLog = require('../models/ActivityLog');

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

// @desc    Admin Dashboard Home
exports.getDashboard = async (req, res, next) => {
  try {
    const studentCount = await User.countDocuments({ role: 'student' });
    const examCount = await Exam.countDocuments();
    const questionCount = await Question.countDocuments();
    const resultCount = await Result.countDocuments();

    // Find performance breakdowns
    const passCount = await Result.countDocuments({ status: 'pass' });
    const failCount = await Result.countDocuments({ status: 'fail' });

    // Subject breakdown
    const subjectBreakdown = await Question.aggregate([
      { $group: { _id: '$subject', count: { $sum: 1 } } }
    ]);

    // Average score per exam
    const examPerformance = await Result.aggregate([
      {
        $group: {
          _id: '$exam',
          avgScore: { $avg: '$score' },
          avgPercentage: { $avg: '$percentage' },
          count: { $sum: 1 }
        }
      }
    ]);
    
    // Populate exam titles manually for aggregation response
    const populatedPerformance = await Promise.all(
      examPerformance.map(async (perf) => {
        const examObj = await Exam.findById(perf._id).select('title');
        return {
          title: examObj ? examObj.title : 'Deleted Exam',
          avgPercentage: parseFloat(perf.avgPercentage.toFixed(1)),
          count: perf.count
        };
      })
    );

    res.render('admin/dashboard', {
      title: 'Admin Dashboard',
      stats: {
        students: studentCount,
        exams: examCount,
        questions: questionCount,
        results: resultCount
      },
      charts: {
        passCount,
        failCount,
        subjectBreakdown,
        examPerformance: populatedPerformance
      },
      user: req.user
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Manage Student Accounts List
exports.getStudents = async (req, res, next) => {
  try {
    const students = await User.find({ role: 'student' }).sort({ createdAt: -1 });
    
    // Hydrate each student with profile fields
    const studentProfiles = await Promise.all(
      students.map(async (stu) => {
        const profile = await StudentProfile.findOne({ user: stu._id }).populate('assignedExams');
        return {
          user: stu,
          profile: profile || { rollNumber: 'N/A', batch: 'N/A', assignedExams: [] }
        };
      })
    );

    const exams = await Exam.find({ isActive: true });

    res.render('admin/students', {
      title: 'Manage Students',
      students: studentProfiles,
      exams,
      user: req.user
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Toggle user status (Active/Deactive)
exports.toggleStudentStatus = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'Student not found' });
    }

    user.isActive = !user.isActive;
    await user.save();

    await logActivity(
      req.user._id,
      user.isActive ? 'ACTIVATE_STUDENT' : 'DEACTIVATE_STUDENT',
      `Toggled status for student ${user.name} (${user.email}) to ${user.isActive ? 'Active' : 'Inactive'}`,
      req
    );

    if (req.originalUrl.startsWith('/api/')) {
      return res.json({ success: true, isActive: user.isActive });
    }

    res.redirect('/admin/students');
  } catch (error) {
    next(error);
  }
};

// @desc    Assign exam to student profile
exports.assignExam = async (req, res, next) => {
  const { examId } = req.body;
  try {
    const studentProfile = await StudentProfile.findOne({ user: req.params.id });
    if (!studentProfile) {
      return res.status(404).render('error', {
        title: 'Profile Not Found',
        message: 'Could not locate student profile.',
        statusCode: 404,
        user: req.user
      });
    }

    if (!studentProfile.assignedExams.includes(examId)) {
      studentProfile.assignedExams.push(examId);
      await studentProfile.save();

      const userObj = await User.findById(req.params.id);
      const examObj = await Exam.findById(examId);
      
      await logActivity(
        req.user._id,
        'ASSIGN_EXAM',
        `Assigned exam "${examObj ? examObj.title : examId}" to student ${userObj ? userObj.name : req.params.id}`,
        req
      );
    }

    res.redirect('/admin/students');
  } catch (error) {
    next(error);
  }
};

// @desc    View administrative activity log audits
exports.getLogs = async (req, res, next) => {
  try {
    const logs = await ActivityLog.find()
      .populate('admin', 'name email')
      .sort({ timestamp: -1 })
      .limit(100);

    res.render('admin/logs', {
      title: 'Activity Logs',
      logs,
      user: req.user
    });
  } catch (error) {
    next(error);
  }
};
