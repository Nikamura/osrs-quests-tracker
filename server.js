import express from "express";
import { readFileSync, existsSync, mkdirSync } from "node:fs";
import path from "node:path";

const app = express();
const port = 3000;

if (!existsSync('public')) {
  mkdirSync('public');
}

// Serve static files from public directory
app.use(express.static('public'));

app.get("/", (req, res) => {
  const indexPath = path.join(process.cwd(), 'public', 'index.html');

  if (existsSync(indexPath)) {
    const htmlContent = readFileSync(indexPath, 'utf-8');
    res.send(htmlContent);
  } else {
    res.status(404).send(`
      <h1>Static HTML not found</h1>
      <p>Please generate the static HTML file first by running:</p>
      <pre>npm run generate</pre>
      <p>Or:</p>
      <pre>node generate_static.js</pre>
    `);
  }
});

app.listen(port, (err) => {
  if (err) {
    console.error(err);
    return;
  }
  console.log(`Server running at http://localhost:${port}`);
});
