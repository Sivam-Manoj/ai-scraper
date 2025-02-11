const express = require('express');
const https = require('https');
const cors = require('cors');
const cheerio = require('cheerio');
const dotenv = require('dotenv');
dotenv.config();
const path = require('path'); // Required for serving HTML file from views folder

const app = express();
const port = process.env.PORT || 5000;
const API_KEY = process.env.SCRAPER_API;

app.use(cors());
app.use(express.json());

// Serve static files from the "views" directory
app.use(express.static(path.join(__dirname, 'views')));

// Route for scraping eMAG
app.get('/scrape/emag', (req, res) => {
  const query = req.query.query || '';
  if (!query.trim()) {
    return res.status(400).json({ error: 'No query provided' });
  }

  const targetUrl = `https://www.emag.ro/search/${encodeURIComponent(query)}`;
  const apiUrl = `https://api.scraperapi.com?api_key=${API_KEY}&url=${targetUrl}`;

  https
    .get(apiUrl, (response) => {
      let data = '';

      // Collect data chunks
      response.on('data', (chunk) => {
        data += chunk;
      });

      // When the response ends, process the data
      response.on('end', () => {
        if (data.includes('captcha-widget')) {
          return res.json({ captcha: true });
        }

        // Extract product details using Cheerio
        const products = extractProducts(data);
        res.json(products);
      });
    })
    .on('error', (error) => {
      console.error('Scraping error:', error);
      res.status(500).json({ error: 'Failed to scrape data' });
    });
});

// Route for scraping eBay
app.get('/scrape/ebay', (req, res) => {
  const query = req.query.query || '';
  if (!query.trim()) {
    return res.status(400).json({ error: 'No query provided' });
  }

  const targetUrl = `https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(
    query
  )}`;
  const apiUrl = `https://api.scraperapi.com?api_key=${API_KEY}&url=${targetUrl}`;

  https
    .get(apiUrl, (response) => {
      let data = '';

      // Collect data chunks
      response.on('data', (chunk) => {
        data += chunk;
      });

      // When the response ends, process the data
      response.on('end', () => {
        if (data.includes('captcha-widget')) {
          return res.json({ captcha: true });
        }

        // Extract product details using Cheerio
        const products = extractEbayProducts(data);
        res.json(products);
      });
    })
    .on('error', (error) => {
      console.error('Scraping error:', error);
      res.status(500).json({ error: 'Failed to scrape data' });
    });
});

// Function to extract product data from eMAG
function extractProducts(html) {
  const products = [];
  const $ = cheerio.load(html);

  $('.card-item').each((_, element) => {
    const name = $(element).find('.card-v2-title').text().trim() || 'No name';
    const price =
      $(element).find('.product-new-price').text().trim() || 'No price';
    const link = $(element).find('a').attr('href') || 'No link';

    // Extract rating and review count
    const rating = $(element)
      .find('.card-v2-rating .average-rating')
      .text()
      .trim();
    const totalReviews = $(element)
      .find('.card-v2-rating .star-rating-text')
      .text()
      .trim();

    const totalReviewsCount = totalReviews.match(/\d+/)
      ? parseInt(totalReviews.match(/\d+/)[0])
      : 0;

    // Only include products with valid name and price
    if (name !== 'No name' && price !== 'No price') {
      products.push({
        name,
        price,
        link,
        totalReviews: totalReviewsCount,
        rating: parseFloat(rating) || 0,
      });
    }
  });

  return products;
}

// Function to extract product data from eBay
function extractEbayProducts(html) {
  const products = [];
  const $ = cheerio.load(html);

  $('.s-item').each((_, element) => {
    const name = $(element).find('.s-item__title').text().trim() || 'No name';
    const price = $(element).find('.s-item__price').text().trim() || 'No price';
    const link = $(element).find('.s-item__link').attr('href') || 'No link';

    // Extract rating and review count
    const rating = $(element).find('.x-star-rating').text().trim();
    const totalReviews = $(element).find('.s-item__reviews').text().trim();

    const totalReviewsCount = totalReviews.match(/\d+/)
      ? parseInt(totalReviews.match(/\d+/)[0])
      : 0;

    // Only include products with valid name and price
    if (name !== 'No name' && price !== 'No price') {
      products.push({
        name,
        price,
        link,
        totalReviews: totalReviewsCount,
        rating: parseFloat(rating) || 0,
      });
    }
  });

  return products;
}

// Route to serve the HTML file from the views folder
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'index.html')); // Send the HTML file
});

// Start the server
app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
