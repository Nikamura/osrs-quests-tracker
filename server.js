import express from "express";
import helmet from "helmet";
import { readFileSync, existsSync, mkdirSync } from "node:fs";
import path from "node:path";

const app = express();
const port = 3000;

if (!existsSync('public')) {
  mkdirSync('public');
}

app.use(helmet({
  contentSecurityPolicy: false

}));

// Serve static files from public directory
app.use(express.static('public'));

app.listen(port, (err) => {
  if (err) {
    console.error(err);
    return;
  }
  console.log(`Server running at http://localhost:${port}`);
});
