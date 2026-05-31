import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";
import fs from "fs";
import os from "os";

dotenv.config();

// Helper to normalize MIME type and return a valid extension
function getMimeAndExtension(mimeType: string, filename?: string) {
  const mime = (mimeType || '').toLowerCase();
  
  if (mime.includes("mpeg") || mime.includes("mp3")) {
    return { mime: "audio/mp3", ext: "mp3" };
  }
  if (mime.includes("wav") || (filename && filename.endsWith(".wav"))) {
    return { mime: "audio/wav", ext: "wav" };
  }
  if (mime.includes("webm") || (filename && filename.endsWith(".webm"))) {
    return { mime: "audio/webm", ext: "webm" };
  }
  if (mime.includes("ogg") || (filename && filename.endsWith(".ogg"))) {
    return { mime: "audio/ogg", ext: "ogg" };
  }
  if (
    mime.includes("m4a") || 
    mime.includes("aac") || 
    mime.includes("mp4") || 
    (filename && (filename.endsWith(".m4a") || filename.endsWith(".mp4") || filename.endsWith(".aac")))
  ) {
    return { mime: "audio/mp4", ext: "m4a" };
  }
  
  return { mime: mime || "audio/mp3", ext: "mp3" };
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Configure body limits for large audio file transfers (up to 100MB)
  app.use(express.json({ limit: "100mb" }));
  app.use(express.urlencoded({ limit: "100mb", extended: true }));

  // Keep track of active upload sessions
  const uploadSessions = new Map<string, { tempFilePath: string; ext: string; normalizedMime: string }>();

  // Endpoint to initialize a chunked upload session
  app.post("/api/upload/start", (req, res) => {
    try {
      const { filename, mimeType } = req.body;
      const sessionId = `session_${Date.now()}_${Math.random().toString(36).substring(7)}`;
      const { mime: normalizedMime, ext } = getMimeAndExtension(mimeType, filename);
      const tempDir = os.tmpdir();
      const tempFilePath = path.join(tempDir, `transcribe_${sessionId}.${ext}`);
      
      // Initialize empty file
      fs.writeFileSync(tempFilePath, Buffer.alloc(0));
      
      uploadSessions.set(sessionId, { tempFilePath, ext, normalizedMime });
      console.log(`Initialized chunked upload session ${sessionId} pointing to ${tempFilePath}`);
      res.json({ sessionId });
    } catch (err: any) {
      console.error("Error in upload/start:", err);
      res.status(500).json({ error: err.message || "Failed to start upload session." });
    }
  });

  // Endpoint to receive chunk of binary content (base64) and append to temp file
  app.post("/api/upload/chunk", async (req, res) => {
    try {
      const { sessionId, chunkIndex, totalChunks, base64Chunk } = req.body;
      if (!sessionId || base64Chunk === undefined) {
        return res.status(400).json({ error: "Missing sessionId or base64Chunk." });
      }
      
      const session = uploadSessions.get(sessionId);
      if (!session) {
        return res.status(404).json({ error: "Upload session not found or has expired." });
      }
      
      const buffer = Buffer.from(base64Chunk, "base64");
      await fs.promises.appendFile(session.tempFilePath, buffer);
      
      console.log(`Session ${sessionId}: Appended chunk ${chunkIndex + 1}/${totalChunks} (${buffer.length} bytes)`);
      res.json({ success: true, chunkIndex });
    } catch (err: any) {
      console.error("Error in upload/chunk:", err);
      res.status(500).json({ error: err.message || "Failed to append audio chunk." });
    }
  });

  // Complete session and process transcription on server-side using Gemini Files API
  app.post("/api/transcribe/complete", async (req, res) => {
    const { sessionId } = req.body;
    if (!sessionId) {
      return res.status(400).json({ error: "Missing sessionId." });
    }

    const session = uploadSessions.get(sessionId);
    if (!session) {
      return res.status(404).json({ error: "Session not found or already completed." });
    }

    let uploadedFile: any = null;
    const apiKey = process.env.GEMINI_API_KEY;

    try {
      if (!apiKey) {
        return res.status(500).json({ error: "GEMINI_API_KEY environment variable is not configured on the server." });
      }

      const ai = new GoogleGenAI({
        apiKey: apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          }
        }
      });

      console.log(`Processing complete chunked upload. Uploading temp file ${session.tempFilePath} with mimType ${session.normalizedMime} to Gemini...`);

      uploadedFile = await ai.files.upload({
        file: session.tempFilePath,
        config: {
          mimeType: session.normalizedMime,
        }
      });

      console.log(`File uploaded successfully to Gemini via session complete: ${uploadedFile.name}. Waiting for file processing complete...`);

      // Poll file status until ACTIVE or FAILED to handle larger files safely
      let file = uploadedFile;
      let getAttempts = 0;
      while ((file.state === "PROCESSING" || !file.state) && getAttempts < 45) {
        console.log(`File ${file.name} state: ${file.state || 'PENDING'}. Polling get (attempt ${getAttempts + 1})...`);
        await new Promise((resolve) => setTimeout(resolve, 1500));
        file = await ai.files.get({ name: file.name });
        getAttempts++;
      }

      if (file.state === "FAILED") {
        throw new Error("The audio processing failed on Gemini's servers.");
      }

      uploadedFile = file;
      console.log(`File is ready for transcription. State: ${uploadedFile.state}. Scribing...`);

      const response = await ai.models.generateContent({
        model: 'gemini-3.5-flash',
        contents: [
          {
            fileData: {
              fileUri: uploadedFile.uri,
              mimeType: uploadedFile.mimeType,
            }
          },
          {
            text: `Please process this audio and provide a professional document with the following structure:

1. SUMMARY: Provide a concise 2-3 sentence summary of the main topics discussed.
2. TRANSCRIPT: Transcribe the audio with precise speaker diarization and timestamps. 
   - Use '[MM:SS]' markers at the start of every speaker turn.
   - Assign unique labels like 'Speaker 1:' or use real names if mentioned.
   - Start a new line for every speaker change.
3. ACTION ITEMS: List any tasks, decisions, or agreed-upon actions in a clear, bulleted format. 
   - Specify who is responsible for each action if their name is identifiable from the context.

Maintain high accuracy and a professional tone. Return ONLY the final structured text. Do not include introductory remarks or meta-commentary.`
          }
        ],
        config: {
          temperature: 0.1,
          systemInstruction: "You are an elite executive assistant specializing in meeting transcription and synthesis. You transform audio recordings into structured professional documents featuring summaries, time-coded transcripts with speaker identification, and clear action item tracking."
        }
      });

      const transcript = response.text || "Transcription failed or returned no text.";
      res.json({ transcript });
    } catch (error: any) {
      console.error("Chunked Scribing Error:", error);
      res.status(500).json({ error: error.message || "An error occurred during audio transcription on the server." });
    } finally {
      // Clean up server-side temp file
      try {
        if (fs.existsSync(session.tempFilePath)) {
          await fs.promises.unlink(session.tempFilePath);
          console.log(`Cleaned up temp file ${session.tempFilePath}`);
        }
      } catch (cleanupErr) {
        console.error("Failed to delete temp file:", cleanupErr);
      }
      
      // Clean up session reference
      uploadSessions.delete(sessionId);

      // Clean up Gemini cloud-stored file
      if (uploadedFile && apiKey) {
        try {
          const aiCleanup = new GoogleGenAI({
            apiKey: apiKey,
            httpOptions: {
              headers: {
                'User-Agent': 'aistudio-build',
              }
            }
          });
          await aiCleanup.files.delete({ name: uploadedFile.name });
          console.log(`Cleaned up Gemini uploaded file ${uploadedFile.name}`);
        } catch (cleanupGeminiErr) {
          console.error("Failed to delete Gemini uploaded file:", cleanupGeminiErr);
        }
      }
    }
  });

  // Secure server-side audio transcription endpoint proxying Gemini APIs (direct single-shot fallback)
  app.post("/api/transcribe", async (req, res) => {
    let tempFilePath: string | null = null;
    let uploadedFile: any = null;
    const apiKey = process.env.GEMINI_API_KEY;

    try {
      const { base64Data, mimeType, filename } = req.body;
      if (!base64Data || !mimeType) {
        return res.status(400).json({ error: "Missing audio payload (base64Data or mimeType)." });
      }

      if (!apiKey) {
        return res.status(500).json({ error: "GEMINI_API_KEY environment variable is not configured on the server." });
      }

      const ai = new GoogleGenAI({
        apiKey: apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          }
        }
      });

      const { mime: normalizedMime, ext } = getMimeAndExtension(mimeType, filename);

      // Create a local temporary file to stream or upload to Gemini's File API
      const tempDir = os.tmpdir();
      tempFilePath = path.join(tempDir, `transcribe_${Date.now()}_${Math.random().toString(36).substring(7)}.${ext}`);
      
      // Write the base64 content to the temp file
      await fs.promises.writeFile(tempFilePath, Buffer.from(base64Data, "base64"));

      console.log(`Uploading temp file ${tempFilePath} with normalized mime ${normalizedMime}...`);

      // Upload the local temp file using Gemini Files API
      uploadedFile = await ai.files.upload({
        file: tempFilePath,
        config: {
          mimeType: normalizedMime,
        }
      });

      console.log(`File uploaded successfully to Gemini: ${uploadedFile.name}. Waiting for file processing complete...`);

      // Poll file status until ACTIVE or FAILED to handle larger files safely
      let file = uploadedFile;
      let getAttempts = 0;
      while ((file.state === "PROCESSING" || !file.state) && getAttempts < 45) {
        console.log(`File ${file.name} state: ${file.state || 'PENDING'}. Polling get (attempt ${getAttempts + 1})...`);
        await new Promise((resolve) => setTimeout(resolve, 1500));
        file = await ai.files.get({ name: file.name });
        getAttempts++;
      }

      if (file.state === "FAILED") {
        throw new Error("The audio processing failed on Gemini's servers.");
      }

      uploadedFile = file;
      console.log(`File is ready for transcription. State: ${uploadedFile.state}. Scribing...`);

      // Request Gemini 3.5 Flash to transcribe the uploaded audio file
      const response = await ai.models.generateContent({
        model: 'gemini-3.5-flash',
        contents: [
          {
            fileData: {
              fileUri: uploadedFile.uri,
              mimeType: uploadedFile.mimeType,
            }
          },
          {
            text: `Please process this audio and provide a professional document with the following structure:

1. SUMMARY: Provide a concise 2-3 sentence summary of the main topics discussed.
2. TRANSCRIPT: Transcribe the audio with precise speaker diarization and timestamps. 
   - Use '[MM:SS]' markers at the start of every speaker turn.
   - Assign unique labels like 'Speaker 1:' or use real names if mentioned.
   - Start a new line for every speaker change.
3. ACTION ITEMS: List any tasks, decisions, or agreed-upon actions in a clear, bulleted format. 
   - Specify who is responsible for each action if their name is identifiable from the context.

Maintain high accuracy and a professional tone. Return ONLY the final structured text. Do not include introductory remarks or meta-commentary.`
          }
        ],
        config: {
          temperature: 0.1,
          systemInstruction: "You are an elite executive assistant specializing in meeting transcription and synthesis. You transform audio recordings into structured professional documents featuring summaries, time-coded transcripts with speaker identification, and clear action item tracking."
        }
      });

      const transcript = response.text || "Transcription failed or returned no text.";
      res.json({ transcript });
    } catch (error: any) {
      console.error("Server-Side Transcription Error:", error);
      res.status(500).json({ error: error.message || "An error occurred during audio transcription on the server." });
    } finally {
      // Clean up local temp file
      if (tempFilePath) {
        try {
          if (fs.existsSync(tempFilePath)) {
            await fs.promises.unlink(tempFilePath);
            console.log(`Cleaned up local temp file ${tempFilePath}`);
          }
        } catch (cleanupErr) {
          console.error("Failed to delete local temp file:", cleanupErr);
        }
      }

      // Clean up Gemini uploaded file
      if (uploadedFile && apiKey) {
        try {
          const aiCleanup = new GoogleGenAI({
            apiKey: apiKey,
            httpOptions: {
              headers: {
                'User-Agent': 'aistudio-build',
              }
            }
          });
          await aiCleanup.files.delete({ name: uploadedFile.name });
          console.log(`Cleaned up Gemini uploaded file ${uploadedFile.name}`);
        } catch (cleanupGeminiErr) {
          console.error("Failed to delete Gemini uploaded file:", cleanupGeminiErr);
        }
      }
    }
  });

  // Vite middleware development bundle delivery
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server starting up on http://0.0.0.0:${PORT}`);
  });
}

startServer();
