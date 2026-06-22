import React, { useState } from "react";
import { searchDriveFiles, getFileContent } from "../utils/workspaceService";
import { Search, FileText, Settings, Loader2, Sparkles, Check, ChevronRight, CornerDownRight, HelpCircle } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface DriveResumePickerProps {
  token: string | null;
  onEvaluateResume: (text: string, fileName?: string, mode?: "fast" | "detailed") => Promise<void>;
  isProcessing: boolean;
}

export default function DriveResumePicker({ token, onEvaluateResume, isProcessing }: DriveResumePickerProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [files, setFiles] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Custom paste states
  const [manualText, setManualText] = useState("");
  const [manualName, setManualName] = useState("");
  const [activeTab, setActiveTab] = useState<"drive" | "paste">("drive");

  // Models configuration
  const [evalMode, setEvalMode] = useState<"fast" | "detailed">("detailed");

  // Selected Google Drive File
  const [selectedFile, setSelectedFile] = useState<any | null>(null);

  const handleSearch = async () => {
    if (!token) {
      setError("Please authenticate with Google to access your Drive repositories.");
      return;
    }
    setSearching(true);
    setError(null);
    try {
      const driveFiles = await searchDriveFiles(token, searchTerm);
      setFiles(driveFiles);
      if (driveFiles.length === 0) {
        setError("Zero developer files or Docs found matching those keywords in Google Drive.");
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Drive index request has timed out.");
    } finally {
      setSearching(false);
    }
  };

  const handleEvaluateFile = async (file: any) => {
    if (!token) return;
    setSelectedFile(file);
    setError(null);
    try {
      const text = await getFileContent(token, file.id, file.mimeType);
      if (!text || text.trim().length === 0) {
        throw new Error("File content returned from drive is empty.");
      }
      await onEvaluateResume(text, file.name, evalMode);
      setSelectedFile(null);
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Failed to process target Drive document.");
      setSelectedFile(null);
    }
  };

  const handleEvaluateManual = async () => {
    if (!manualText || !manualName) {
      setError("Candidate name and resume text values must be entered.");
      return;
    }
    setError(null);
    try {
      await onEvaluateResume(manualText, manualName, evalMode);
      setManualText("");
      setManualName("");
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Manual valuation analysis aborted.");
    }
  };

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h2 className="text-md font-extrabold text-zinc-100 tracking-tight flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-emerald-400" />
          Applicant Data Ingress
        </h2>

        <div className="flex bg-zinc-950 p-1 rounded-lg border border-zinc-800 max-w-sm text-xs font-mono">
          <button
            onClick={() => setActiveTab("drive")}
            className={`px-3 py-1.5 font-bold rounded-md transition ${
              activeTab === "drive"
                ? "bg-zinc-900 text-emerald-400"
                : "text-zinc-500 hover:text-zinc-300"
            }`}
          >
            Google Drive
          </button>
          <button
            onClick={() => setActiveTab("paste")}
            className={`px-3 py-1.5 font-bold rounded-md transition ${
              activeTab === "paste"
                ? "bg-zinc-900 text-emerald-400"
                : "text-zinc-500 hover:text-zinc-300"
            }`}
          >
            Direct Paste
          </button>
        </div>
      </div>

      {/* Model Selection Configuration Bar */}
      <div className="bg-zinc-950/60 p-4 rounded-xl border border-zinc-850/80 space-y-3 font-mono text-[11px]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 font-bold text-zinc-400">
            <Settings className="w-4 h-4 text-zinc-500" />
            Gemini Sourcing Classifier Configuration
          </div>
          <span className="text-[10px] bg-emerald-950/40 text-emerald-400 border border-emerald-800/30 px-2 py-0.5 rounded">
            {evalMode === "detailed" ? "gemini-3.1-pro-preview" : "gemini-3.1-flash-lite"}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-3 text-xs font-sans">
          <label
            onClick={() => setEvalMode("detailed")}
            className={`cursor-pointer flex flex-col p-3 rounded-lg border text-left transition ${
              evalMode === "detailed"
                ? "bg-zinc-900 border-emerald-500/50 ring-1 ring-emerald-500/30"
                : "bg-zinc-950/30 border-zinc-850 text-zinc-400 opacity-60 hover:opacity-100"
            }`}
          >
            <span className="font-bold text-zinc-200 text-xs">High-Thinking Mode</span>
            <span className="text-[10px] text-zinc-500 mt-1 leading-normal">
              Utilize deep logical thinking loops (gemini-3.1-pro-preview with HIGH level) for granular quality rating.
            </span>
          </label>

          <label
            onClick={() => setEvalMode("fast")}
            className={`cursor-pointer flex flex-col p-3 rounded-lg border text-left transition ${
              evalMode === "fast"
                ? "bg-zinc-900 border-emerald-500/50 ring-1 ring-emerald-500/30"
                : "bg-zinc-950/30 border-zinc-850 text-zinc-400 opacity-60 hover:opacity-100"
            }`}
          >
            <span className="font-bold text-zinc-200 text-xs">Low-Latency Mode</span>
            <span className="text-[10px] text-zinc-500 mt-1 leading-normal">
              Ultra-rapid analysis and keyword aggregation leveraging lightweight flash models.
            </span>
          </label>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {activeTab === "drive" ? (
          <motion.div
            key="drive-tab"
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -5 }}
            className="space-y-4"
          >
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-3 h-4 w-4 text-zinc-500" />
                <input
                  type="text"
                  placeholder="Key developer name, tech-stack or keywords in Google Drive..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                  className="w-full pl-9 pr-3 py-2.5 border border-zinc-800 rounded-lg bg-zinc-950 text-zinc-200 focus:outline-none focus:border-emerald-500/50 text-xs"
                />
              </div>
              <button
                onClick={handleSearch}
                disabled={searching || isProcessing}
                className="px-4 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-lg transition disabled:opacity-40 cursor-pointer"
              >
                {searching ? <Loader2 className="w-4 h-4 animate-spin" /> : "Query Drive"}
              </button>
            </div>

            {error && (
              <div className="p-3 bg-red-950/40 text-red-400 text-xs rounded-lg border border-red-900/30 flex items-start gap-2">
                <div className="shrink-0 font-bold font-mono">ℹ</div>
                <div>{error}</div>
              </div>
            )}

            <div className="max-h-60 overflow-y-auto space-y-2 scrollbar-thin">
              {files.map((file) => {
                const isThisFileProcessing = selectedFile?.id === file.id;
                return (
                  <div
                    key={file.id}
                    className="flex items-center justify-between p-3 bg-zinc-950/70 rounded-lg border border-zinc-850 text-sm hover:border-zinc-700 transition"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <FileText className="w-4 h-4 text-emerald-400 shrink-0" />
                      <div className="min-w-0 font-mono text-[11px]">
                        <p className="font-bold text-zinc-200 truncate text-[11px] font-sans">{file.name}</p>
                        <p className="text-[10px] text-zinc-500 mt-0.5 truncate uppercase">
                          {file.mimeType.split("/")[1] || "dataset"}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => handleEvaluateFile(file)}
                      disabled={isProcessing || isThisFileProcessing}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-zinc-200 bg-zinc-900 border border-zinc-800 rounded-lg hover:bg-zinc-800 hover:border-zinc-700 disabled:opacity-40 transition shrink-0 ml-4 cursor-pointer"
                    >
                      {isThisFileProcessing ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          Analyzing...
                        </>
                      ) : (
                        <>
                          Screen Resume
                          <ChevronRight className="w-3.5 h-3.5 text-emerald-400" />
                        </>
                      )}
                    </button>
                  </div>
                );
              })}

              {!searching && files.length === 0 && !error && (
                <div className="text-center py-8 text-zinc-500 text-xs font-mono">
                  <FileText className="w-8 h-8 mx-auto text-zinc-850 mb-1.5" />
                  Define target criteria and execute Drive lookup to index candidate assets.
                </div>
              )}
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="paste-tab"
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -5 }}
            className="space-y-4"
          >
            <div>
              <label className="block text-xs font-bold text-zinc-400 mb-1 font-mono">Candidate Identifier</label>
              <input
                type="text"
                placeholder="e.g. Nicholas Young - Principal Engineer Sourcing"
                value={manualName}
                onChange={(e) => setManualName(e.target.value)}
                className="w-full px-3 py-2 border border-zinc-800 rounded-lg bg-zinc-950 text-zinc-200 focus:outline-none focus:border-emerald-500/50 text-xs"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-zinc-400 mb-1 font-mono">Resume Raw Text Content</label>
              <textarea
                placeholder="Copy and paste CV credentials, technical portfolios or experience timelines..."
                rows={5}
                value={manualText}
                onChange={(e) => setManualText(e.target.value)}
                className="w-full px-3 py-2.5 border border-zinc-800 rounded-lg bg-zinc-950 text-zinc-200 focus:outline-none focus:border-emerald-500/50 text-xs font-sans"
              />
            </div>

            {error && (
              <div className="p-3 text-xs bg-red-950/40 text-red-400 rounded-lg border border-red-900/30 font-mono">
                {error}
              </div>
            )}

            <div className="flex justify-end pt-1">
              <button
                onClick={handleEvaluateManual}
                disabled={isProcessing || !manualText || !manualName}
                className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-lg transition disabled:opacity-40 cursor-pointer"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    AI Classifying...
                  </>
                ) : (
                  <>
                    Analyze Profile
                    <Sparkles className="w-3.5 h-3.5 text-yellow-300" />
                  </>
                )}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
