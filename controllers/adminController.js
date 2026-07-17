const User = require('../models/User');
const StudentProfile = require('../models/StudentProfile');
const Exam = require('../models/Exam');
const Question = require('../models/Question');
const Result = require('../models/Result');
const ActivityLog = require('../models/ActivityLog');
const StudentResponse = require('../models/StudentResponse');

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
    // Find students managed by this admin
    const managedStudentProfiles = await StudentProfile.find({ assignedAdmin: req.user._id });
    const managedStudentUserIds = managedStudentProfiles.map(p => p.user);

    const studentCount = managedStudentUserIds.length;
    const examCount = await Exam.countDocuments({ createdBy: req.user._id });
    const questionCount = await Question.countDocuments({ createdBy: req.user._id });
    const resultCount = await Result.countDocuments({ student: { $in: managedStudentUserIds } });

    // Find performance breakdowns for managed students
    const passCount = await Result.countDocuments({ student: { $in: managedStudentUserIds }, status: 'pass' });
    const failCount = await Result.countDocuments({ student: { $in: managedStudentUserIds }, status: 'fail' });

    // Subject breakdown
    const subjectBreakdown = await Question.aggregate([
      { $match: { createdBy: req.user._id } },
      { $group: { _id: '$subject', count: { $sum: 1 } } }
    ]);

    // Average score per exam for managed students
    const examPerformance = await Result.aggregate([
      { $match: { student: { $in: managedStudentUserIds } } },
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
    // Find student profiles managed by this admin
    const profiles = await StudentProfile.find({ assignedAdmin: req.user._id }).populate('assignedExams');
    const studentUserIds = profiles.map(p => p.user);

    const students = await User.find({ _id: { $in: studentUserIds }, role: 'student' }).sort({ createdAt: -1 });
    
    // Hydrate each student with profile fields
    const studentProfiles = students.map((stu) => {
      const profile = profiles.find(p => p.user.toString() === stu._id.toString());
      return {
        user: stu,
        profile: profile || { rollNumber: 'N/A', batch: 'N/A', assignedExams: [] }
      };
    });

    const exams = await Exam.find({ createdBy: req.user._id, isActive: true });

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
    // Verify student is managed by this admin
    const profile = await StudentProfile.findOne({ user: req.params.id, assignedAdmin: req.user._id });
    if (!profile) {
      if (req.originalUrl.startsWith('/api/')) {
        return res.status(403).json({ success: false, message: 'Not authorized to manage this student' });
      }
      return res.status(403).render('error', { title: 'Forbidden', message: 'Not authorized to manage this student', statusCode: 403, user: req.user });
    }

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

// @desc    Assign exam to all student profiles
exports.assignExamToAll = async (req, res, next) => {
  const { examId } = req.body;
  try {
    const examObj = await Exam.findOne({ _id: examId, createdBy: req.user._id });
    if (!examObj) {
      return res.status(404).render('error', {
        title: 'Exam Not Found',
        message: 'Could not locate the requested exam or unauthorized access.',
        statusCode: 404,
        user: req.user
      });
    }

    // Get all student profiles assigned to this admin
    const studentProfiles = await StudentProfile.find({ assignedAdmin: req.user._id });
    let newlyAssignedCount = 0;

    for (const profile of studentProfiles) {
      if (!profile.assignedExams.includes(examId)) {
        // Delete previous results and response logs of this exam for this student
        await Result.deleteMany({ student: profile.user, exam: examId });
        await StudentResponse.deleteMany({ student: profile.user, exam: examId });

        profile.assignedExams.push(examId);
        await profile.save();
        newlyAssignedCount++;
      }
    }

    await logActivity(
      req.user._id,
      'ASSIGN_EXAM_TO_ALL',
      `Assigned exam "${examObj.title}" to all ${studentProfiles.length} students managed by this admin (newly assigned: ${newlyAssignedCount})`,
      req
    );

    res.redirect('/admin/students');
  } catch (error) {
    next(error);
  }
};

// @desc    Assign exam to student profile
exports.assignExam = async (req, res, next) => {
  const { examId } = req.body;
  try {
    const examObj = await Exam.findOne({ _id: examId, createdBy: req.user._id });
    if (!examObj) {
      return res.status(404).render('error', {
        title: 'Exam Not Found',
        message: 'Could not locate the requested exam or unauthorized access.',
        statusCode: 404,
        user: req.user
      });
    }

    const studentProfile = await StudentProfile.findOne({ user: req.params.id, assignedAdmin: req.user._id });
    if (!studentProfile) {
      return res.status(404).render('error', {
        title: 'Profile Not Found',
        message: 'Could not locate student profile or unauthorized access.',
        statusCode: 404,
        user: req.user
      });
    }

    if (studentProfile.assignedExams.includes(examId)) {
      return res.status(400).render('error', {
        title: 'Assignment Blocked',
        message: 'This exam is already assigned to the student and has not been submitted yet.',
        statusCode: 400,
        user: req.user
      });
    }

    // Delete previous results and response logs of this exam for this student
    await Result.deleteMany({ student: req.params.id, exam: examId });
    await StudentResponse.deleteMany({ student: req.params.id, exam: examId });

    studentProfile.assignedExams.push(examId);
    await studentProfile.save();

    const userObj = await User.findById(req.params.id);
    
    await logActivity(
      req.user._id,
      'ASSIGN_EXAM',
      `Assigned exam "${examObj ? examObj.title : examId}" to student ${userObj ? userObj.name : req.params.id}`,
      req
    );

    res.redirect('/admin/students');
  } catch (error) {
    next(error);
  }
};

// @desc    View administrative activity log audits
exports.getLogs = async (req, res, next) => {
  try {
    const logs = await ActivityLog.find({ admin: req.user._id })
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

// @desc    Approve a pending student registration
exports.approveStudent = async (req, res, next) => {
  try {
    // Verify student is managed by this admin
    const profile = await StudentProfile.findOne({ user: req.params.id, assignedAdmin: req.user._id });
    if (!profile) {
      if (req.originalUrl.startsWith('/api/')) {
        return res.status(403).json({ success: false, message: 'Not authorized to manage this student' });
      }
      return res.status(403).render('error', { title: 'Forbidden', message: 'Not authorized to manage this student', statusCode: 403, user: req.user });
    }

    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'Student not found' });
    }

    user.isApproved = true;
    user.isActive = true; // Make active by default upon approval
    await user.save();

    await logActivity(
      req.user._id,
      'APPROVE_STUDENT',
      `Approved registration request for student ${user.name} (${user.email})`,
      req
    );

    if (req.originalUrl.startsWith('/api/')) {
      return res.json({ success: true, message: 'Student approved successfully' });
    }

    res.redirect('/admin/students');
  } catch (error) {
    next(error);
  }
};

// @desc    Reject and delete a pending student registration
exports.rejectStudent = async (req, res, next) => {
  try {
    // Verify student is managed by this admin
    const profile = await StudentProfile.findOne({ user: req.params.id, assignedAdmin: req.user._id });
    if (!profile) {
      if (req.originalUrl.startsWith('/api/')) {
        return res.status(403).json({ success: false, message: 'Not authorized to manage this student' });
      }
      return res.status(403).render('error', { title: 'Forbidden', message: 'Not authorized to manage this student', statusCode: 403, user: req.user });
    }

    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'Student not found' });
    }

    // Delete records
    await StudentProfile.deleteOne({ user: req.params.id });
    await User.deleteOne({ _id: req.params.id });

    await logActivity(
      req.user._id,
      'REJECT_STUDENT',
      `Rejected and deleted registration request for student ${user.name} (${user.email})`,
      req
    );

    if (req.originalUrl.startsWith('/api/')) {
      return res.json({ success: true, message: 'Student registration rejected and deleted' });
    }

    res.redirect('/admin/students');
  } catch (error) {
    next(error);
  }
};

// @desc    Delete student completely from database
exports.deleteStudent = async (req, res, next) => {
  try {
    // Verify student is managed by this admin
    const profile = await StudentProfile.findOne({ user: req.params.id, assignedAdmin: req.user._id });
    if (!profile) {
      if (req.originalUrl.startsWith('/api/')) {
        return res.status(403).json({ success: false, message: 'Not authorized to manage this student' });
      }
      return res.status(403).render('error', { title: 'Forbidden', message: 'Not authorized to manage this student', statusCode: 403, user: req.user });
    }

    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'Student not found' });
    }

    // Delete records
    await StudentProfile.deleteOne({ user: req.params.id });
    await User.deleteOne({ _id: req.params.id });
    await Result.deleteMany({ student: req.params.id });
    await StudentResponse.deleteMany({ student: req.params.id });

    await logActivity(
      req.user._id,
      'DELETE_STUDENT',
      `Deleted student ${user.name} (${user.email}) completely from the database`,
      req
    );

    if (req.originalUrl.startsWith('/api/')) {
      return res.json({ success: true, message: 'Student deleted successfully' });
    }

    res.redirect('/admin/students');
  } catch (error) {
    next(error);
  }
};
