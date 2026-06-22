import express from "express";
import path from "path";
import cors from "cors";
import dotenv from "dotenv";
import { GoogleGenAI, ThinkingLevel, Type } from "@google/genai";
import { createServer as createViteServer } from "vite";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json({ limit: "15mb" }));

// Initialize the server-side Gemini client
const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  console.warn("Warning: GEMINI_API_KEY is not defined in the environment.");
}

const ai = new GoogleGenAI({
  apiKey: apiKey || "placeholder-key",
  httpOptions: {
    headers: {
      "User-Agent": "aistudio-build",
    },
  },
});

// Helper for calling Gemini
async function runGeminiScreening(resumeText: string, jobDetails: string, mode: "fast" | "detailed") {
  const modelName = mode === "detailed" ? "gemini-3.1-pro-preview" : "gemini-3.1-flash-lite";

  // Detailed recruting prompts
  const systemInstruction = 
    "You are an Elite Technical Recruiter and Sourcing Specialist. Your task is to audit developer resumes against a given Job Description. " +
    "Perform a granular analysis of their technical competencies, years of experience, and code craftsmanship. " +
    "You MUST respond ONLY with a valid JSON object matching the following structure exactly. Do not wrap the JSON in markdown code blocks like ```json ... ```, just return the plain JSON string. " +
    "{\n" +
    '  "name": "full name of candidate",\n' +
    '  "email": "candidate email address (leave empty if not found)",\n' +
    '  "phone": "candidate phone number (leave empty if not found)",\n' +
    '  "skills": ["extracted", "tech", "skills"],\n' +
    '  "yearsOfExperience": 5.5,\n' +
    '  "overallScore": 85,\n' +
    '  "matchAnalysis": "A very rigorous 2-3 paragraph examination of how their skill set compares directly alignment with requirements",\n' +
    '  "experienceSummary": "A concise summary of their professional work history and technical focus.",\n' +
    '  "feedback": "Suggested specific developer screening questions, missing skill caveats, or interview pointers."\n' +
    "}";

  const userPrompt = `JOB DESCRIPTION:\n${jobDetails}\n\nRESUME / DEVELOPER HISTORY:\n${resumeText}\n\nPlease audit this resume against the job description strictly and provide the evaluation in the requested JSON structure.`;

  const config: any = {
    systemInstruction,
    responseMimeType: "application/json",
    responseSchema: {
      type: Type.OBJECT,
      properties: {
        name: { type: Type.STRING },
        email: { type: Type.STRING },
        phone: { type: Type.STRING },
        skills: {
          type: Type.ARRAY,
          items: { type: Type.STRING }
        },
        yearsOfExperience: { type: Type.NUMBER },
        overallScore: { type: Type.INTEGER },
        matchAnalysis: { type: Type.STRING },
        experienceSummary: { type: Type.STRING },
        feedback: { type: Type.STRING }
      },
      required: ["name", "email", "phone", "skills", "yearsOfExperience", "overallScore", "matchAnalysis", "experienceSummary", "feedback"]
    }
  };

  // If detailed, add high-level reasoning thinking config and do not specify maximum output tokens
  if (mode === "detailed") {
    config.thinkingConfig = {
      thinkingLevel: ThinkingLevel.HIGH
    };
  }

  const response = await ai.models.generateContent({
    model: modelName,
    contents: userPrompt,
    config
  });

  const responseText = response.text || "";
  try {
    return JSON.parse(responseText.trim());
  } catch (err) {
    console.error("Failed to parse JSON response from Gemini, attempting manual cleanup", responseText);
    // Fallback parser in case markdown wrapper was injected anyway
    const cleaned = responseText.replace(/```json/g, "").replace(/```/g, "").trim();
    return JSON.parse(cleaned);
  }
}

// 1. Endpoint: Evaluate / Screening
app.post("/api/screening/evaluate", async (req, res) => {
  try {
    const { resumeText, jobDetails, mode } = req.body;
    if (!resumeText) {
      return res.status(400).json({ error: "Resume text content is required." });
    }
    if (!jobDetails) {
      return res.status(400).json({ error: "Job opening details are required." });
    }

    const evaluation = await runGeminiScreening(resumeText, jobDetails, mode || "fast");
    res.json(evaluation);
  } catch (error: any) {
    console.error("Gemini Screening API Error:", error);
    res.status(500).json({ error: error.message || "An error occurred during resume evaluation." });
  }
});

// 2. Endpoint: Chatbot
app.post("/api/chat/message", async (req, res) => {
  try {
    const { messages, candidate, job, userPrompt, role, modelSelection } = req.body;

    const availableModels = {
      pro: "gemini-3.1-pro-preview",
      flash: "gemini-3.5-flash",
      lite: "gemini-3.1-flash-lite"
    };

    const selectedModel = availableModels[modelSelection as "pro" | "flash" | "lite"] || "gemini-3.5-flash";

    // System roles instructions
    const systemRoleInstructions = {
      recruiter: "You are an expert Technical Recruiter with a sharp eye for hiring criteria, talent cultural additions, and sourcing trends. Provide strategic, human-centric guidance on screening this candidate.",
      interviewer: "You are a seasoned Principal Engineer and Technical Interviewer. Your goal is to draft exact practical interview challenges, code audits, and behavioral questions to test this candidate's depth.",
      advisor: "You are a Chief Technology Officer and Hiring Advisor. Help the manager make high-level decisions on hiring pipeline, team fits, salary alignments, and onboarding tracks."
    };

    const selectedInstruction = systemRoleInstructions[role as "recruiter" | "interviewer" | "advisor"] || systemRoleInstructions.recruiter;

    // Build immediate context
    const candidateStr = JSON.stringify(candidate || {}, null, 2);
    const jobStr = JSON.stringify(job || {}, null, 2);

    const systemInstruction = 
      `${selectedInstruction}\n\n` +
      `CONTEXT:\n` +
      `We are hiring for the following role:\n${jobStr}\n\n` +
      `The Candidate under evaluation is:\n${candidateStr}\n\n` +
      `Provide helpful, specific, actionable insights, suggested interview topics, or draft replies. Do not make up facts that are not present. Keep answers clear, structured, and recruitment-oriented.`;

    // Map history to Google GenAI structure: content: string -> history: Content part
    // Let's model message histories
    const contents: any[] = [];
    
    // Add history in correct sequence
    if (messages && messages.length > 0) {
      messages.forEach((msg: any) => {
        contents.push({
          role: msg.role === "user" ? "user" : "model",
          parts: [{ text: msg.content }]
        });
      });
    }

    // Add current user prompt
    contents.push({
      role: "user",
      parts: [{ text: userPrompt }]
    });

    const config: any = {
      systemInstruction
    };

    // If using the pro model, let's configure thinking mode
    if (selectedModel === "gemini-3.1-pro-preview") {
      config.thinkingConfig = {
        thinkingLevel: ThinkingLevel.HIGH
      };
    }

    const response = await ai.models.generateContent({
      model: selectedModel,
      contents,
      config
    });

    res.json({ text: response.text });
  } catch (error: any) {
    console.error("Gemini Chatbot API Error:", error);
    res.status(500).json({ error: error.message || "An error occurred during interactive chat." });
  }
});

// Setup development configuration using Vite middleware
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server successfully started, running on http://localhost:${PORT}`);
  });
}

startServer();
