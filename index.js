import fs from "node:fs";
import dotenv from "dotenv";
import { GoogleGenAI } from "@google/genai";

dotenv.config();

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const model = "gemini-3.1-flash-lite-preview";

async function analyzeCode() {
  console.log("Reading file...");
  const fileName = "dummy-auth.js";
  const fileContent = fs.readFileSync(`./${fileName}`, "utf-8");

  const userQuestion = "How does this code handle empty password case?";

  // We explicitly separate the instructions, the context (the code), and the question.
  const prompt = `
You are an expert software engineer. Answer the user's question based ONLY on the provided code.

--- Context (File: ${fileName}) ---
${fileContent}
-----------------------------------

Question: ${userQuestion}
    `;

  console.log(`Sending context to ${model}...`);

  try {
    const response = await ai.models.generateContent({
      model,
      contents: prompt,
    });

    console.log("\nAssistant Response:\n");
    console.log(response.text);
  } catch (error) {
    console.error("Error calling Gemini API:", error);
  }
}

// Execute the function
await analyzeCode();
