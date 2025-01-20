const express = require('express');
const bodyParser = require('body-parser');
const mysql = require('mysql2');
const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const { v4: uuidv4 } = require('uuid');
const path = require('path');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

// View engine and static files setup
app.set('view engine', 'ejs');
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: true }));
app.use(bodyParser.json());

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
  try {
    const { name, email, skills } = req.body;

    // Validate required fields
    if (!name || !email || !skills || !req.file) {
      return res.status(400).send('All fields are required.');
    }

    // Validate file size
    if (req.file.size > 10 * 1024 * 1024) {
      return res.status(400).send('File is too large. Max size is 10 MB.');
    }

    // Upload file to Cloudinary
    cloudinary.uploader.upload_stream({ resource_type: 'raw' }, (error, result) => {
      if (error) {
        console.log('Upload Error:', error);
        return res.status(500).send('Error uploading file to Cloudinary');
      } else {
        // Save data to the database
        const resumeUrl = result.secure_url;
        const query = 'INSERT INTO candidate (name, email, skills, resume_file_url) VALUES (?, ?, ?, ?)';
        db.query(query, [name, email, skills, resumeUrl], (err) => {
          if (err) {
            console.error('Database error during resume upload:', err);
            return res.status(500).send('Error saving resume data to the database');
          }
          res.send('Resume uploaded successfully!');
        });
      }
    }).end(req.file.buffer); // Upload the file buffer to Cloudinary

  } catch (err) {
    console.error('Error handling resume upload:', err);
    res.status(500).send('Internal server error');
  }
});

// Search page
app.get('/search', (req, res) => {
  res.render('search', { results: [], message: '' });  // Default empty message
});
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


// Recruiters page
app.get('/recruiters', (req, res) => res.render('recruiters'));

// Fetch all candidates for download
app.get('/downloads', (req, res) => {
  const query = 'SELECT * FROM candidate';
  db.query(query, (err, results) => {
    if (err) {
      console.error('Database error during fetch:', err);
      return res.status(500).send('Error fetching candidates');
    }
    res.render('downloads', { candidate: results });
  });
});

// Start the server
app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
