// 1. Simulate the output from File Parser file
const mockFiles = [
  {
    filePath: "src/services/auth.js",
    content: `import crypto from 'crypto';

export function hashPassword(password) {
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
    return { salt, hash };
}

export function verifyPassword(password, hash, salt) {
    const checkHash = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
    return hash === checkHash;
}

export function generateToken(user) {
    // Imagine JWT generation logic here
    return "jwt_token_string";
}`,
  },
];

/**
 * Splits a file's content into overlapping chunks of lines.
 * @param {Object} fileObj - Object containing filePath and content
 * @param {number} maxLines - Maximum number of lines per chunk
 * @param {number} overlapLines - Number of lines to overlap between chunks
 * @returns {Array<Object>} - Array of chunk objects ready for embedding
 */
function chunkCodeFile(fileObj, maxLines = 20, overlapLines = 4) {
  const lines = fileObj.content.split("\n");
  const chunks = [];

  let currentLineIndex = 0;

  while (currentLineIndex < lines.length) {
    // Extract a slice of lines for this chunk
    const chunkLines = lines.slice(
      currentLineIndex,
      currentLineIndex + maxLines,
    );
    const rawChunkText = chunkLines.join("\n");

    // CRITICAL: Inject the file path at the top of the chunk.
    // If you skip this, the LLM will not know where this code lives.
    const contextAwareText = `File: ${fileObj.filePath}\nCode: ${rawChunkText}`;

    chunks.push({
      id: `${fileObj.filePath}_chunk_${chunks.length + 1}`,
      filePath: fileObj.filePath,
      textToEmbed: contextAwareText,
    });

    // Move the index forward, but step back by the overlap amount
    currentLineIndex += maxLines - overlapLines;
  }

  return chunks;
}

function run() {
  console.log("Starting chunking process...");

  let allChunks = [];

  mockFiles.forEach((file) => {
    // We use 20 lines per chunk and 4 lines of overlap for this demo
    const fileChunks = chunkCodeFile(file, 10, 3);
    allChunks = allChunks.concat(fileChunks);
  });

  console.log(`Generated ${allChunks.length} chunks. \n`);

  allChunks.forEach((chunk) => {
    console.log(`--- [${chunk.id}] ---`);
    console.log(chunk.textToEmbed);
    console.log("----------------------\n");
  });
}

run();
