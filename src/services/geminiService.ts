export const transcribeAudio = async (
  base64Data: string,
  mimeType: string,
  filename?: string,
  onProgress?: (progress: number) => void
): Promise<string> => {
  // If the data is small (< 2MB base64 characters), send as a single payload to be fast, otherwise chunk it
  const CHUNK_SIZE = 2 * 1024 * 1024; // 2MB base64 characters
  const totalLength = base64Data.length;
  
  if (totalLength <= CHUNK_SIZE) {
    if (onProgress) onProgress(30);
    const response = await fetch('/api/transcribe', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ base64Data, mimeType, filename })
    });

    if (onProgress) onProgress(60);

    const responseText = await response.text().catch(() => "");
    if (!response.ok) {
      let errorMessage = "Failed to transcribe audio.";
      try {
        const errorData = JSON.parse(responseText);
        if (errorData.error) errorMessage = errorData.error;
      } catch (e) {}
      throw new Error(errorMessage);
    }

    if (onProgress) onProgress(100);
    try {
      const data = JSON.parse(responseText);
      return data.transcript || "No transcription returned.";
    } catch (err) {
      throw new Error("Unable to parse transcription. The server response was invalid.");
    }
  }

  // Chunked Upload for larger payloads
  // Step 1: Initialize session
  if (onProgress) onProgress(5);
  const startResponse = await fetch('/api/upload/start', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ filename, mimeType })
  });

  const startText = await startResponse.text().catch(() => "");
  if (!startResponse.ok) {
    let errorMessage = "Failed to initialize secure upload pipeline.";
    try {
      const errorData = JSON.parse(startText);
      if (errorData.error) errorMessage = errorData.error;
    } catch (e) {}
    throw new Error(errorMessage);
  }

  let sessionId = "";
  try {
    const startData = JSON.parse(startText);
    sessionId = startData.sessionId;
  } catch (err) {
    throw new Error("Failed to initialize session: The server returned an invalid response.");
  }
  if (!sessionId) {
    throw new Error("Failed to initialize session: No sessionId returned by server.");
  }
  const numChunks = Math.ceil(totalLength / CHUNK_SIZE);

  // Step 2: Upload piece by piece
  for (let i = 0; i < numChunks; i++) {
    const startIdx = i * CHUNK_SIZE;
    const endIdx = Math.min(startIdx + CHUNK_SIZE, totalLength);
    const chunk = base64Data.substring(startIdx, endIdx);

    const chunkResponse = await fetch('/api/upload/chunk', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        sessionId,
        chunkIndex: i,
        totalChunks: numChunks,
        base64Chunk: chunk
      })
    });

    if (!chunkResponse.ok) {
      const errorData = await chunkResponse.json().catch(() => ({}));
      throw new Error(errorData.error || `Upload interrupted at chunk ${i + 1}/${numChunks}.`);
    }

    if (onProgress) {
      // Scale uploading up to 99% during chunk loops
      const percent = Math.round(((i + 1) / numChunks) * 99);
      onProgress(Math.min(99, percent));
    }
  }

  // Once all chunks are successfully uploaded, mark upload as 100% complete
  if (onProgress) onProgress(100);

  // Step 3: Trigger final transcription
  const completeResponse = await fetch('/api/transcribe/complete', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ sessionId })
  });

  const completeText = await completeResponse.text().catch(() => "");
  if (!completeResponse.ok) {
    let errorMessage = "Failed to compile audio and transcribe.";
    try {
      const errorData = JSON.parse(completeText);
      if (errorData.error) errorMessage = errorData.error;
    } catch (e) {}
    throw new Error(errorMessage);
  }

  if (onProgress) onProgress(100);
  try {
    const data = JSON.parse(completeText);
    return data.transcript || "No transcription returned.";
  } catch (err) {
    throw new Error("Unable to parse transcription: The server returned an invalid response.");
  }
};
