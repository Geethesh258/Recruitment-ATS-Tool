// Import required modules
const express = require('express');
const bodyParser = require('body-parser');
const mysql = require('mysql2');
const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const odbc = require("odbc");
const dotenv = require("dotenv");
const ExcelJS = require('exceljs');
const { exec } = require('child_process');
require('dotenv').config();

dotenv.config();

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
const port = process.env.PORT || 3000;

// ODBC connection
const odbcDsn = process.env.ODBC_DSN;

// View engine and static files setup
app.set('view engine', 'ejs');
app.use(express.static(path.join(__dirname, 'public')));

// Cloudinary configuration
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// MySQL Database Connection
const db = mysql.createConnection({
  host: 'localhost',
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
});

db.connect((err) => {
  if (err) {
    console.error('Error connecting to the database:', err);
    throw err;
  }
  console.log('Connected to MySQL database!');
});

// Excel file path
const excelFilePath = 'ats-candidates.xlsx';

// Update database with Excel row numbers
(async () => {
  try {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(excelFilePath);
    const worksheet = workbook.getWorksheet(1);

    if (!worksheet) {
      console.error('Worksheet not found in the Excel file.');
      return;
    }

    if (worksheet.rowCount <= 1) {
      console.error('Excel file is empty or contains only headers.');
      return;
    }

    worksheet.eachRow((row, rowIndex) => {
      console.log(`Processing row ${rowIndex}:`, row.values);

      if (rowIndex === 1) return; // Skip header row

      const name = row.getCell(2)?.value; // Safe access to cell value
      if (!name) {
        console.warn(`Row ${rowIndex} has no valid name. Skipping...`);
        return;
      }

      db.query(
        'UPDATE candidate SET excel_row = ? WHERE name = ?',
        [rowIndex, name],
        (err) => {
          if (err) console.error(`Error updating row ${rowIndex}:`, err);
        }
      );
    });

    console.log('Excel row numbers updated in the database.');
  } catch (err) {
    console.error('Error processing Excel file:', err);
  }
})();

// Multer setup to handle file uploads
const storage = multer.memoryStorage();
const upload = multer({ storage });

// Routes

// Serve the login page
app.get('/', (req, res) => res.render('login'));

// Login POST route
app.post('/login', (req, res) => {
  const { username, password } = req.body;
  const query = 'SELECT * FROM users WHERE username = ? AND password = ?';
  db.query(query, [username, password], (err, results) => {
    if (err) {
      console.error('Database error during login:', err);
      return res.status(500).send('Error during login');
    }
    if (results.length > 0) {
      res.redirect('/dashboard');
    } else {
      res.status(401).send('Invalid login credentials!');
    }
  });
});

// Dashboard route
app.get('/dashboard', (req, res) => res.render('dashboard'));

// Serve the upload resume page
app.get('/upload-resume', (req, res) => res.render('uploadResume'));

// Handle resume upload
app.post('/upload-resume', upload.single('resume'), (req, res) => {
  const { name, email, skills } = req.body;

  if (!name || !email || !skills || !req.file) {
    return res.status(400).send('All fields are required.');
  }

  if (req.file.size > 10 * 1024 * 1024) {
    return res.status(400).send('File is too large. Max size is 10 MB.');
  }

  cloudinary.uploader.upload_stream(
    { resource_type: 'raw' },
    (error, result) => {
      if (error) {
        console.error('Upload Error:', error);
        return res.status(500).send('Error uploading file to Cloudinary');
      }

      const resumeUrl = result.secure_url;
      const query =
        'INSERT INTO candidate (name, email, skills, resume_file_url) VALUES (?, ?, ?, ?)';
      db.query(query, [name, email, skills, resumeUrl], (err) => {
        if (err) {
          console.error('Database error during resume upload:', err);
          return res.status(500).send('Error saving resume data to the database');
        }
        res.send('Resume uploaded successfully!');
      });
    }
  ).end(req.file.buffer);
});

// Search page
app.get('/search', (req, res) => {
  res.render('search', { results: [], message: '' });  // Default empty message
});

// Search POST route
app.post('/search', (req, res) => {
  const searchQuery = req.body.query.trim();

  // Validate if query is empty
  if (!searchQuery) {
    return res.render('search', { results: [], message: 'Please enter a search term.' });
  }

  // Split input into terms and operators (AND, OR)
  const terms = searchQuery.split(/\s+(AND|OR)\s+/).map(term => term.trim());

  let conditions = [];
  let values = [];
  let operator = 'OR'; // Default operator

  terms.forEach((term) => {
    if (term === 'AND' || term === 'OR') {
      operator = term; // Update operator for the next terms
    } else {
      // Search term for both `name` and `skills`
      conditions.push(`(name LIKE ? OR skills LIKE ?)`); 
      values.push(`%${term}%`, `%${term}%`);
    }
  });

  if (conditions.length === 0) {
    return res.render('search', { results: [], message: 'No valid search terms found.' });
  }

  // Construct the SQL query
  const query = `SELECT * FROM candidate WHERE ${conditions.join(` ${operator} `)}`;

  // Execute the query
  db.query(query, values, (err, results) => {
    if (err) {
      console.error('Database error during search:', err);
      return res.status(500).send('Error searching candidates');
    }

    const message = results.length === 0 ? 'No results found.' : '';
    res.render('search', { results, message });
  });
});

app.get('/view-in-excel', (req, res) => {
  const candidateId = req.query.candidateId;

  // Fetch candidate name from the database
  const query = 'SELECT name FROM candidate WHERE id = ?';
  db.query(query, [candidateId], (err, results) => {
      if (err) {
          console.error(err);
          res.status(500).send("Database error.");
          return;
      }

      if (results.length === 0) {
          res.status(404).send("Candidate not found.");
          return;
      }

      const candidateName = results[0].name;
      const excelPath = path.join(__dirname, 'ats-candidates.xlsx'); // Path to your Excel file

      // Call the Python script
      const pythonScript = `python highlight_excel.py "${candidateName}" "${excelPath}"`;
      exec(pythonScript, (error, stdout, stderr) => {
          if (error) {
              console.error(`Error: ${error.message}`);
              res.status(500).send("Error opening Excel file.");
              return;
          }
          if (stderr) {
              console.error(`Error: ${stderr}`);
          }
          console.log(stdout);
          res.send("Excel file opened and row highlighted.");
      });
  });
});
// Recruiters page
app.get('/recruiters', (req, res) => res.render('recruiters'));

// Start the server
app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
