const { Readable } = require('stream');
const csv = require('csv-parser');

/**
 * Parses a CSV buffer and converts rows into Mongoose Question objects.
 * @param {Buffer} fileBuffer - Uploaded CSV file buffer.
 * @param {string} createdById - User ID of the admin importing the questions.
 * @returns {Promise<Array>}
 */
const parseQuestionsCSV = (fileBuffer, createdById) => {
  return new Promise((resolve, reject) => {
    const questionsList = [];

    const stream = Readable.from(fileBuffer);

    stream
      .pipe(csv())
      .on('data', (row) => {
        // Normalize keys to support various header spellings
        const text = row.text || row.question || row.Question || row['Question Text'];
        const optA = row.optionA || row.optiona || row.A || row.a || row['Option A'];
        const optB = row.optionB || row.optionb || row.B || row.b || row['Option B'];
        const optC = row.optionC || row.optionc || row.C || row.c || row['Option C'];
        const optD = row.optionD || row.optiond || row.D || row.d || row['Option D'];

        let correctAns =
          row.correctAnswer ||
          row.correct ||
          row.Answer ||
          row['Correct Answer'] ||
          row.correct_answer;

        if (correctAns) correctAns = correctAns.trim().toUpperCase();

        const marksVal = parseInt(row.marks || row.Marks || 1, 10);
        const negMarksVal = parseFloat(
          row.negativeMarks ||
          row.negative_marks ||
          row['Negative Marks'] ||
          0
        );

        const subjectVal =
          row.subject ||
          row.Subject ||
          row.category ||
          'General';

        if (
          text &&
          optA &&
          optB &&
          optC &&
          optD &&
          ['A', 'B', 'C', 'D'].includes(correctAns)
        ) {
          questionsList.push({
            text: text.trim(),
            options: {
              A: optA.trim(),
              B: optB.trim(),
              C: optC.trim(),
              D: optD.trim()
            },
            correctAnswer: correctAns,
            marks: isNaN(marksVal) ? 1 : marksVal,
            negativeMarks: isNaN(negMarksVal) ? 0 : negMarksVal,
            subject: subjectVal.trim(),
            createdBy: createdById
          });
        }
      })
      .on('end', () => {
        resolve(questionsList);
      })
      .on('error', (error) => {
        reject(error);
      });
  });
};

module.exports = { parseQuestionsCSV };

