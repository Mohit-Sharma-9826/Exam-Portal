# Exam Portal

A full-stack web-based **Exam Portal** that allows administrators to create and manage online examinations while enabling students to securely attempt assigned exams. The platform also features a **real-time leaderboard** that ranks students based on their exam performance.

---

## Features

### Admin Portal

- Secure admin login
- Create and manage exams
- Add, edit, and delete MCQ questions
- Assign exams to specific students
- View students' exam performance
- Manage question bank

### Student Portal

- Secure student login
- View assigned exams
- Attempt MCQ-based examinations
- Automatic score calculation after submission
- View exam results

### Leaderboard

- Exam-specific leaderboard
- Displays student rankings based on marks
- Shows student names and scores
- Automatically updates after exam submission

---

## Tech Stack

### Frontend
- HTML
- CSS
- JavaScript
- EJS

### Backend
- Node.js
- Express.js

### Database
- MongoDB
- Mongoose

### Authentication
- Express Session

---

## Project Structure

```
ExamPortal/
│
├── models/
├── routes/
├── views/
├── public/
├── middleware/
├── config/
├── .env
├── package.json
└── server.js
```

---

## Installation

### Clone the repository

```bash
git clone https://github.com/Mohit-Sharma-9826/Exam-Portal
```

### Navigate to the project

```bash
cd exam-portal
```

### Install dependencies

```bash
npm install
```

### Create a `.env` file

```env
PORT=3000
MONGO_URI=your_mongodb_connection_string
SESSION_SECRET=your_secret_key
```

### Add Admins directly

```bash
npm run admin
```

### Start the application

```bash
npm run seed
npm start (or) npm run dev
```

or

```bash
npm run seed
node server.js
```

---

## Modules

- Admin Dashboard
- Student Dashboard
- Exam Management
- Question Bank
- Exam Assignment
- Result Management
- Leaderboard

---

## Future Enhancements

- Timer for exams
- Negative marking
- Randomized question order
- Subject-wise analytics
- CSV question import
- PDF result generation
- Email notifications
- Performance charts
- Anti-cheating features

---

## Security

- Password authentication
- Environment variable support using `.env`
- Protected admin routes
- Session-based authentication

---

## Author

**Mohit Sharma**

B.Tech CSE (AI & ML)

---

## License

This project is developed for educational purposes.