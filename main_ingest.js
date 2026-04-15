import { exec } from "node:child_process";
import { promisify } from "node:util";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import dotenv from "dotenv";
import { GoogleGenAI } from "@google/genai";
import { saveToVectorDB } from "./database.js";

dotenv.config();

const execAsync = promisify(exec);
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// --- Configuration ---
const IGNORED_DIRS = new Set([
  "node_modules",
  ".git",
  "dist",
  "build",
  "coverage",
  ".next",
  "public",
]);
const ALLOWED_EXTENSIONS = new Set([
  ".js",
  ".jsx",
  ".ts",
  ".tsx",
  ".py",
  ".go",
  ".java",
  ".md",
  ".cpp",
]);
const BATCH_SIZE = 20;
const RATE_LIMIT_DELAY_MS = 2000;
const ANONYMOUS_SESSION_ID = "session_test_123";

// Step 1: Clone & Cleanup
async function cloneRepository(repoUrl) {
  const repoName = repoUrl.split("/").pop().replace(".git", "");
  const targetPath = path.join(
    os.tmpdir(),
    `codebase-assistant-${repoName}-${Date.now()}`,
  );
  console.log(`[1/5] Cloning repository into: ${targetPath}`);

  const cloneCommand = `git clone --depth 1 ${repoUrl} ${targetPath}`;
  await execAsync(cloneCommand);
  return targetPath;
}

async function cleanupRepository(directoryPath) {
  console.log(`[Cleanup] Deleting temporary directory: ${directoryPath}`);
  try {
    fs.rmSync(directoryPath, { recursive: true, force: true });
  } catch (error) {
    console.error("[Cleanup Error] Failed to delete directory:", error.message);
  }
}

// Step 2: Parse Files (Recursively walks a directory and returns an array of file objects)
function getCodeFiles(dirPath, arrayOfFiles = []) {
  const items = fs.readdirSync(dirPath);

  items.forEach((item) => {
    const fullPath = path.join(dirPath, item);
    if (fs.statSync(fullPath).isDirectory()) {
      if (!IGNORED_DIRS.has(item)) {
        getCodeFiles(fullPath, arrayOfFiles);
      }
    } else {
      const ext = path.extname(item).toLowerCase();
      if (ALLOWED_EXTENSIONS.has(ext)) {
        try {
          const content = fs.readFileSync(fullPath, "utf-8");
          if (content.trim().length > 0) {
            arrayOfFiles.push({ filePath: fullPath, content: content });
          }
        } catch {
          // Silently skip unreadable files
        }
      }
    }
  });
  return arrayOfFiles;
}

// Step 3: Chunking (From Day 5)
function chunkCodeFile(fileObj, maxLines = 50, overlapLines = 10) {
  const lines = fileObj.content.split("\n");
  const chunks = [];
  let currentLineIndex = 0;

  while (currentLineIndex < lines.length) {
    const chunkLines = lines.slice(
      currentLineIndex,
      currentLineIndex + maxLines,
    );
    const rawChunkText = chunkLines.join("\n");

    const contextAwareText = `File: ${fileObj.filePath}\nCode:\n${rawChunkText}`;

    chunks.push({
      id: `${fileObj.filePath}_chunk_${chunks.length + 1}`,
      filePath: fileObj.filePath,
      textToEmbed: contextAwareText,
    });

    currentLineIndex += maxLines - overlapLines;
  }
  return chunks;
}

// Step 4: Batching & Embedding
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function chunkArray(array, size) {
  const chunked = [];
  for (let i = 0; i < array.length; i += size) {
    chunked.push(array.slice(i, i + size));
  }
  return chunked;
}

async function generateEmbeddingsSafely(allCodeChunks) {
  const batches = chunkArray(allCodeChunks, BATCH_SIZE);
  let allEmbeddings = [];

  console.log(
    `[4/5] Processing ${allCodeChunks.length} chunks in ${batches.length} batches...`,
  );

  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i];
    console.log(`      -> Embedding batch ${i + 1} of ${batches.length}`);

    const textsToEmbed = batch.map((chunk) => chunk.textToEmbed);

    const response = await ai.models.embedContent({
      model: "gemini-embedding-001",
      contents: textsToEmbed,
      // Optimization: Reducing vector size from 3072 to 768 to save database space
      config: { outputDimensionality: 768 },
    });

    const batchResults = batch.map((chunk, index) => ({
      id: chunk.id,
      filePath: chunk.filePath,
      text: chunk.textToEmbed,
      vector: response.embeddings[index].values,
    }));

    allEmbeddings = allEmbeddings.concat(batchResults);

    if (i < batches.length - 1) {
      await delay(RATE_LIMIT_DELAY_MS);
    }
  }
  return allEmbeddings;
}

// Main Func
async function ingestRepo(repoUrl) {
  let localRepoPath = "";

  try {
    // Download
    localRepoPath = await cloneRepository(repoUrl);

    // Parse
    console.log(`[2/5] Parsing files...`);
    const files = getCodeFiles(localRepoPath);
    console.log(`      -> Found ${files.length} valid code files.`);

    // Chunk
    console.log(`[3/5] Chunking files...`);
    let allChunks = [];
    files.forEach((file) => {
      const fileChunks = chunkCodeFile(file);
      allChunks = allChunks.concat(fileChunks);
    });
    console.log(`      -> Generated ${allChunks.length} overlapping chunks.`);

    // Embed (with Batching)
    const finalizedData = await generateEmbeddingsSafely(allChunks);

    // Database Save
    console.log(
      `[5/5] Ready to save ${finalizedData.length} vectors to the database.`,
    );
    await saveToVectorDB(finalizedData, ANONYMOUS_SESSION_ID);

    // For testing, just log the first result's ID and vector length
    console.log(`Sample vector length: ${finalizedData[0].vector.length}`);
  } catch (error) {
    console.error("Ingestion Pipeline Failed:", error);
  } finally {
    // Cleanup
    if (localRepoPath) {
      await cleanupRepository(localRepoPath);
    }
  }
}

// calling main function
await ingestRepo("https://github.com/Soman-Anshuman/plotTwist-app");
