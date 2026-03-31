import fs from "node:fs";
import path from "node:path";

// 1. Strict Blocklist for Directories
// We use a Set because lookups (O(1)) are faster than arrays, which matters in huge repos.
const IGNORED_DIRS = new Set([
  "node_modules",
  ".git",
  "dist",
  "build",
  "coverage",
  ".next",
  "public",
]);

// 2. Strict Allowlist for File Extensions
// A whitelist is ALWAYS safer than a blacklist. If you try to blacklist '.png', '.jpg', etc.,
// you will inevitably forget '.ico' or '.woff2' and break your embedding pipeline.
const ALLOWED_EXTENSIONS = new Set([".js", ".jsx", ".ts", ".tsx", ".md"]);

/**
 * Recursively walks a directory and returns an array of file objects.
 * @param {string} dirPath - The starting directory path.
 * @param {Array} arrayOfFiles - Accumulator array for recursion.
 * @returns {Array<{filePath: string, content: string}>}
 */
function getCodeFiles(dirPath, arrayOfFiles = []) {
  // Read all files and folders in the current directory
  const items = fs.readdirSync(dirPath);

  items.forEach((item) => {
    const fullPath = path.join(dirPath, item);

    // Check if the current item is a directory
    if (fs.statSync(fullPath).isDirectory()) {
      // If it's a directory we want to ignore, skip it entirely.
      // Otherwise, recursively call this function to look inside it.
      if (!IGNORED_DIRS.has(item)) {
        getCodeFiles(fullPath, arrayOfFiles);
      }
    } else {
      // It's a file. Get its extension.
      const ext = path.extname(item).toLowerCase();

      if (ALLOWED_EXTENSIONS.has(ext)) {
        // We only read the file if it matches our allowlist
        try {
          const content = fs.readFileSync(fullPath, "utf-8");

          // Optional: Skip completely empty files
          if (content.trim().length > 0) {
            arrayOfFiles.push({
              // Store the relative path (useful for the LLM context)
              filePath: fullPath,
              content: content,
            });
          }
        } catch (error) {
          console.warn(`Could not read file ${fullPath}:`, error.message);
        }
      }
    }
  });

  return arrayOfFiles;
}

// --- Let's test it on our current project directory ---
function run() {
  console.log("Scanning directory...");

  // We pass './' to scan the directory we are currently working in.
  // When integrated, you will pass the temporary path returned by Day 3's clone script.
  const rootDir = "./";
  const extractedFiles = getCodeFiles(rootDir);

  console.log(
    `\nSuccessfully extracted ${extractedFiles.length} valid code files.\n`,
  );

  // Let's print out the paths and the character count of what we found
  extractedFiles.forEach((file) => {
    console.log(`${file.filePath} (${file.content.length} chars)`);
  });
}

run();
