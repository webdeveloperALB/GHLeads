import express from 'express';
import cors from 'cors';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const port = 3000;

// Enable CORS and JSON parsing
app.use(cors());
app.use(express.json());

// Serve test.html directly from the root directory
app.get(['/test', '/test.html'], (req, res) => {
  res.sendFile(path.join(__dirname, 'test.html'));
});

// API endpoints
app.post('/api/leads', (req, res) => {
  const apiKey = req.headers['x-api-key'];

  // Validate API key
  if (!apiKey || apiKey !== 'BHX04DS3K1J4AU1AH6B6F3H7GOM43RXP') {
    return res.status(401).json({
      success: false,
      error: {
        code: 'invalid_api_key',
        message: 'Invalid API key'
      }
    });
  }

  const { firstName, lastName, email, phone, country, brand, funnel, desk } = req.body;

  // Validate required fields
  if (!firstName || !lastName || !email) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'validation_error',
        message: 'Missing required fields',
        details: {
          fields: ['firstName', 'lastName', 'email']
        }
      }
    });
  }

  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'validation_error',
        message: 'Invalid email format',
        details: {
          field: 'email',
          value: email
        }
      }
    });
  }

  // Here you would typically save the lead to your database
  // For now, we'll just return a success response
  res.json({
    success: true,
    data: {
      id: Date.now(),
      source_id: Math.floor(Math.random() * 90000) + 10000,
      created_at: new Date().toISOString()
    }
  });
});

// Serve static files from the dist directory
app.use(express.static('dist'));

// Handle React routes
app.get('*', (req, res) => {
  // Don't serve index.html for test routes
  if (req.path === '/test' || req.path === '/test.html') {
    res.sendFile(path.join(__dirname, 'test.html'));
  } else {
    res.sendFile(path.join(__dirname, 'dist', 'index.html'));
  }
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
  console.log(`Test page available at http://localhost:${port}/test.html`);
});