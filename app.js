const express = require('express');
const bodyParser = require('body-parser');
const mysql = require('mysql2');
const path = require('path');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

// Database Connection
const db = mysql.createConnection({
    host: 'localhost',
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: 'ats'
});

db.connect(err => {
    if (err) throw err;
    console.log('Connected to MySQL database!');
});

// Middleware
app.use(bodyParser.urlencoded({ extended: false }));
app.use(express.static(path.join(__dirname, 'public')));
app.set('view engine', 'ejs');

// Routes
app.get('/', (req, res) => res.render('login'));

app.post('/login', (req, res) => {
    const { username, password } = req.body;
    const query = 'SELECT * FROM users WHERE username = ? AND password = ?';
    db.query(query, [username, password], (err, results) => {
        if (err) throw err;
        if (results.length > 0) res.redirect('/dashboard');
        else res.send('Invalid login credentials!');
    });
});

app.get('/dashboard', (req, res) => res.render('dashboard'));

app.get('/add-resume', (req, res) => res.render('addResume'));

app.post('/add-resume', (req, res) => {
    const { name, email, phone, skills } = req.body;
    const query = 'INSERT INTO resumes (name, email, phone, skills) VALUES (?, ?, ?, ?)';
    db.query(query, [name, email, phone, skills], err => {
        if (err) throw err;
        res.redirect('/dashboard');
    });
});
// Route to render the Search Resume page
app.get('/search-resume', (req, res) => {
    res.render('searchResume', { resumes: [] }); // Pass an empty array initially
});

// Route to handle search form submission
app.post('/search-resume', (req, res) => {
    const { name } = req.body;

    const query = 'SELECT * FROM resumes WHERE name LIKE ?';
    db.query(query, [`%${name}%`], (err, results) => {
        if (err) throw err;

        // Pass the search results to the template
        res.render('searchResume', { resumes: results });
    });
});


// Start Server
app.listen(port, () => console.log(`Server running on http://localhost:${port}`));
