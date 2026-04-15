import { Pinecone } from "@pinecone-database/pinecone";
import { GoogleGenAI, ThinkingLevel } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

// Initialize APIs
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const pc = new Pinecone({ apiKey: process.env.PINECONE_API_KEY });
const index = pc.index({ name: "codebase-assistant" });

/**
 * Queries the vector database and generates an AI response.
 * @param {string} sessionId - The temporary ID for the anonymous user's session.
 * @param {string} userQuestion - What the user is asking about the code.
 */
export async function askCodebase(sessionId, userQuestion) {
  console.log(`\nQuestion: "${userQuestion}"`);
  console.log(`[1/4] Embedding the question...`);

  try {
    // Step 1: Convert the user's question into a vector
    // We MUST use the exact same model and dimensionality we used for ingestion
    const embedResponse = await ai.models.embedContent({
      model: "gemini-embedding-001",
      contents: userQuestion,
      config: { outputDimensionality: 768 },
    });
    const questionVector = embedResponse.embeddings[0].values;

    // Step 2: Search Pinecone for the most relevant code chunks
    console.log(`[2/4] Searching Pinecone for relevant code...`);
    const ns = index.namespace(sessionId);

    const searchResults = await ns.query({
      vector: questionVector,
      topK: 5, // Retrieve the top 5 most relevant chunks
      includeMetadata: true, // We need the metadata to get the actual code text
    });

    // Step 3: Construct the Context (The "R" and "A" in RAG)
    console.log(
      `[3/4] Assembling context from ${searchResults.matches.length} retrieved chunks...`,
    );

    if (searchResults.matches.length === 0) {
      console.log("No relevant code found in the database.");
      return;
    }

    let contextString = "";
    searchResults.matches.forEach((match, i) => {
      // We append the raw code text stored in our metadata
      contextString += `\n--- Chunk ${i + 1} (Score: ${match.score.toFixed(2)}) ---\n`;
      contextString += match.metadata.text + "\n";
    });

    // Step 4: Generate the Answer (The "G" in RAG)
    console.log(`[4/4] Sending context to gemini-3.1-flash-lite-preview...`);

    const prompt = `
You are an expert developer assistant. Answer the user's question based ONLY on the provided codebase context. 
If the answer is not in the context, explicitly state "I cannot find the answer in the provided codebase."
Do not guess. Always mention the file names you are referencing.

CONTEXT:
${contextString}

USER QUESTION:
${userQuestion}
`;

    const response = await ai.models.generateContent({
      model: "gemini-3.1-flash-lite-preview",
      contents: prompt,
      config: {
        temperature: 0.2,
        thinkingConfig: {
          thinkingLevel: ThinkingLevel.LOW,
        },
      },
    });

    console.log("\n🤖 Assistant Response:\n====================\n");
    console.log(response.text);
    console.log("\n====================");
  } catch (error) {
    console.error("Query Engine Failed:", error);
  }
}

// --- Let's test it ---
// We will use a dummy session ID to represent our anonymous user.
// Make sure this matches the namespace you used when running ingest.js!
const ANONYMOUS_SESSION_ID = "session_test_123";

await askCodebase(ANONYMOUS_SESSION_ID, "What are we trying to achieve here?");
