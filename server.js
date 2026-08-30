// server.js — Strike Sentry
require('dotenv').config();
const express = require('express');
const app = express();

app.use(express.json());
app.use(express.static('public')); // vanilla HTML/CSS/JS frontend, no build step

app.use('/api/agent', require('./routes/agent'));
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/public/index.html');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Strike Sentry agent running on :${PORT}`));
