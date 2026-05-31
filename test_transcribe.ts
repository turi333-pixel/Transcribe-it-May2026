import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";
import fs from "fs";
import path from "os";

dotenv.config();

async function runTest() {
  const apiKey = process.env.GEMINI_API_KEY;
  console.log("GEMINI_API_KEY configuration status:", apiKey ? "Present (length: " + apiKey.length + ")" : "MISSING");
  
  // Let's call the local server to run a full test sequence
  const sampleBase64 = "UklGRiQAAABXQVZFRm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA="; // Minimal 1-second silent WAV
  
  try {
    console.log("1. Starting upload session...");
    const startRes = await fetch("http://localhost:3000/api/upload/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ filename: "test.wav", mimeType: "audio/wav" })
    });
    const startData: any = await startRes.json();
    console.log("Start response status:", startRes.status, "data:", startData);
    
    if (!startRes.ok) throw new Error("Failed to start session");
    const sessionId = startData.sessionId;

    console.log("2. Uploading individual chunk...");
    const chunkRes = await fetch("http://localhost:3000/api/upload/chunk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId,
        chunkIndex: 0,
        totalChunks: 1,
        base64Chunk: sampleBase64
      })
    });
    const chunkData: any = await chunkRes.json();
    console.log("Chunk response status:", chunkRes.status, "data:", chunkData);
    
    if (!chunkRes.ok) throw new Error("Failed to upload chunk");

    console.log("3. Completing session and requesting transcription...");
    const completeRes = await fetch("http://localhost:3000/api/transcribe/complete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId })
    });
    console.log("Complete response status:", completeRes.status, "header:", completeRes.headers.get("content-type"));
    const text = await completeRes.text();
    console.log("Response body:", text);
  } catch (err: any) {
    console.error("Test failed with error:", err);
  }
}

runTest();
