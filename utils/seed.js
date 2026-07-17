const mongoose = require('mongoose');
const dotenv = require('dotenv');
const connectDB = require('../config/db');
const User = require('../models/User');
const StudentProfile = require('../models/StudentProfile');
const AdminProfile = require('../models/AdminProfile');
const Exam = require('../models/Exam');
const Question = require('../models/Question');
const Result = require('../models/Result');
const StudentResponse = require('../models/StudentResponse');
const ActivityLog = require('../models/ActivityLog');
const Otp = require('../models/Otp');

dotenv.config();

const seedData = async () => {
  try {
    await connectDB();

    console.log('Clearing database...');
    await User.deleteMany();
    await StudentProfile.deleteMany();
    try {
      await StudentProfile.collection.dropIndexes();
    } catch (err) {
      // Ignore if collection does not exist yet
    }
    await AdminProfile.deleteMany();
    await Exam.deleteMany();
    await Question.deleteMany();
    await Result.deleteMany();
    await StudentResponse.deleteMany();
    await ActivityLog.deleteMany();
    await Otp.deleteMany();

    console.log('Seeding Users...');
    // Create Admin User
    const adminUser = await User.create({
      name: 'System Admin',
      email: 'admin@exam.com',
      password: 'admin123', // Will be hashed by pre-save hook
      role: 'admin'
    });

    await AdminProfile.create({
      user: adminUser._id,
      employeeId: 'ADM-001',
      department: 'Examinations'
    });

    // Create Super Admin User
    const superAdminUser = await User.create({
      name: 'System Super Admin',
      email: 'superadmin@exam.com',
      password: 'superadmin123', // Will be hashed by pre-save hook
      role: 'superAdmin'
    });

    await AdminProfile.create({
      user: superAdminUser._id,
      employeeId: 'SAD-001',
      department: 'Administration'
    });

    // Create Student User
    const studentUser = await User.create({
      name: 'John Doe',
      email: 'student@exam.com',
      password: 'student123', // Will be hashed by pre-save hook
      role: 'student'
    });

    const studentProfile = await StudentProfile.create({
      user: studentUser._id,
      rollNumber: 'STU-2026-001',
      batch: 'Batch B2',
      assignedAdmin: adminUser._id
    });

    console.log('Seeding Questions...');
    const questionsData = [
      {
        text: 'What does HTML stand for?',
        options: {
          A: 'Hyper Text Markup Language',
          B: 'Hyperlinks and Text Markup Language',
          C: 'Home Tool Markup Language',
          D: 'Hyper Tech Makeup Language'
        },
        correctAnswer: 'A',
        marks: 2,
        negativeMarks: 0.5,
        subject: 'Web Development',
        createdBy: adminUser._id
      },
      {
        text: 'Which programming language is known as the language of the web?',
        options: {
          A: 'Python',
          B: 'C++',
          C: 'JavaScript',
          D: 'Java'
        },
        correctAnswer: 'C',
        marks: 2,
        negativeMarks: 0.5,
        subject: 'Web Development',
        createdBy: adminUser._id
      },
      {
        text: 'What does CSS stand for?',
        options: {
          A: 'Creative Style Sheets',
          B: 'Cascading Style Sheets',
          C: 'Computer Style Sheets',
          D: 'Colorful Style Sheets'
        },
        correctAnswer: 'B',
        marks: 2,
        negativeMarks: 0,
        subject: 'Web Development',
        createdBy: adminUser._id
      },
      {
        text: 'Which HTML tag is used to define an internal style sheet?',
        options: {
          A: '<css>',
          B: '<script>',
          C: '<style>',
          D: '<link>'
        },
        correctAnswer: 'C',
        marks: 2,
        negativeMarks: 0,
        subject: 'Web Development',
        createdBy: adminUser._id
      },
      {
        text: 'In MongoDB, what is a database row equivalent to?',
        options: {
          A: 'Collection',
          B: 'Document',
          C: 'Field',
          D: 'Table'
        },
        correctAnswer: 'B',
        marks: 2,
        negativeMarks: 0.5,
        subject: 'Databases',
        createdBy: adminUser._id
      },
      {
        text: 'Which of the following is NOT a JavaScript framework/library?',
        options: {
          A: 'React',
          B: 'Angular',
          C: 'Django',
          D: 'Vue'
        },
        correctAnswer: 'C',
        marks: 2,
        negativeMarks: 0.25,
        subject: 'Web Development',
        createdBy: adminUser._id
      },
      {
        text: 'What is the default port for Express.js if not specified?',
        options: {
          A: '80',
          B: '8080',
          C: '3000',
          D: '27017'
        },
        correctAnswer: 'C',
        marks: 2,
        negativeMarks: 0,
        subject: 'NodeJS',
        createdBy: adminUser._id
      }
    ];

    const seededQuestions = await Question.insertMany(questionsData);
    const questionIds = seededQuestions.map(q => q._id);

    console.log('Seeding Exams...');
    const exam1 = await Exam.create({
      title: 'Web Tech Quick Test',
      description: 'A basic assessment test for HTML, CSS, JavaScript, and NodeJS concept basics.',
      duration: 5, // 5 minutes
      totalMarks: 14,
      passingMarks: 6,
      questions: questionIds,
      createdBy: adminUser._id,
      isActive: true
    });

    // Assign exam to student
    studentProfile.assignedExams.push(exam1._id);
    await studentProfile.save();

    console.log('Seeding completed successfully!');
    mongoose.connection.close();
  } catch (error) {
    console.error('Seeding failed:', error);
    process.exit(1);
  }
};

if (require.main === module) {
  seedData();
}
