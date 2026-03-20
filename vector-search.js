import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';

dotenv.config();

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const embeddingModel = "gemini-embedding-001";

// Simulating a "chunked" codebase
// In a real app, we'd parse a GitHub repo and split the files into pieces like this.
const codebaseChunks = [
    {
        id: 'chunk_1',
        content: `export function connectToDatabase() {
            const dbUrl = process.env.DB_URL;
            console.log("Connecting to Postgres...");
            return new Pool({ connectionString: dbUrl });
        }`
    },
    {
        id: 'chunk_2',
        content: `export const PrimaryButton = ({ text, onClick }) => {
            return <button className="bg-blue-500 text-white rounded px-4 py-2" onClick={onClick}>{text}</button>;
        }`
    },
    {
        id: 'chunk_3',
        content: `export function hashPassword(plainText) {
            const saltRounds = 10;
            return bcrypt.hashSync(plainText, saltRounds);
        }`
    }
];

// The Math: Cosine Similarity Function
// This compares two arrays of numbers and returns a score from -1 to 1.
// 1 means exactly identical, 0 means completely unrelated.
function cosineSimilarity(vecA, vecB) {
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    for (let i = 0; i < vecA.length; i++) {
        dotProduct += vecA[i] * vecB[i];
        normA += vecA[i] * vecA[i];
        normB += vecB[i] * vecB[i];
    }
    if (normA === 0 || normB === 0) return 0;
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

// Embedding API (the OG of this project)
async function getEmbedding(text) {
    const response = await ai.models.embedContent({
        model: embeddingModel,
        contents: text,
    });
    // the API returns an array of numbers (the vector)
    return response.embeddings[0].values; 
}

async function runVectorSearch() {
    console.log("Step 1: Generating embeddings for the codebase chunks...");
    
    // embedding all codebase chunks
    const chunkVectors = [];
    for (const chunk of codebaseChunks) {
        const vector = await getEmbedding(chunk.content);
        chunkVectors.push({
            id: chunk.id,
            content: chunk.content,
            vector: vector
        });
    }
    console.log(`Indexed ${chunkVectors.length} chunks.\n`);
    // just commenting (not removing) as it gives a cool visualization of how vectors look
    // console.log(`This is how they look like:\n${JSON.stringify(chunkVectors)}\n`);

    const query = "what is happening on frontend?";
    console.log(`User Query: "${query}"\n`);

    // embedding the Query
    console.log("Generating embedding for the query...");
    const queryVector = await getEmbedding(query);

    // comparing query vector to all chunk vectors
    console.log("\nCalculating similarities...");
    const searchResults = chunkVectors.map(chunk => {
        const similarityScore = cosineSimilarity(queryVector, chunk.vector);
        return {
            id: chunk.id,
            score: similarityScore,
            content: chunk.content
        };
    });

    // Sort by highest score first
    searchResults.sort((a, b) => b.score - a.score);

    console.log("\nTop Search Results:");
    searchResults.forEach(result => {
        console.log(`[Score: ${result.score.toFixed(4)}] ${result.id}`);
    });

    console.log("\nThe most relevant code block is:");
    console.log(searchResults[0].content);
}

await runVectorSearch();