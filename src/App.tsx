import React, { useState, useEffect } from "react";
import { User } from "firebase/auth";
import { collection, query, where, getDocs, setDoc, doc, deleteDoc, updateDoc } from "firebase/firestore";
import { db, googleSignIn, initAuth, logout, handleFirestoreError, OperationType } from "./firebase";
import { JobDescription, CandidateEvaluation } from "./types";
import JobManager from "./components/JobManager";
import DriveResumePicker from "./components/DriveResumePicker";
import CandidateTable from "./components/CandidateTable";
import CandidateDetail from "./components/CandidateDetail";
import { 
  Sparkles, LogOut, CheckCircle, ShieldAlert, Users, 
  FileCheck, HelpCircle, UserCheck, Briefcase, Zap, Info, Loader2,
  Sliders, Cpu, Activity, Award, ShieldCheck, Database, FileText,
  Sun, Moon
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { STSEParameters, ATOMIC_LOCK_HASH, USPTO_IP_ASSET, MASTER_TRUST_ASSIGNEE } from "./utils/stse";

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [needsAuth, setNeedsAuth] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);

  // User theme toggle preference
  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    const saved = localStorage.getItem("stse-theme");
    return saved ? saved === "dark" : true; // Default to dark mode is typical for this console
  });

  const toggleTheme = () => {
    setIsDarkMode((prev) => {
      const next = !prev;
      localStorage.setItem("stse-theme", next ? "dark" : "light");
      return next;
    });
  };

  // Active Job targets description
  const [activeJob, setActiveJob] = useState<JobDescription | null>(null);
  
  // Candidates evaluations under active selection
  const [candidates, setCandidates] = useState<CandidateEvaluation[]>([]);
  const [candidatesLoading, setCandidatesLoading] = useState(false);
  const [selectedCandidate, setSelectedCandidate] = useState<CandidateEvaluation | null>(null);

  // Resume screening operation active indicator
  const [isProcessing, setIsProcessing] = useState(false);

  // Alert bar notifications
  const [globalSuccess, setGlobalSuccess] = useState<string | null>(null);
  const [globalError, setGlobalError] = useState<string | null>(null);

  // STSE State Parameters (Sovereign Trust Sourcing Engine)
  const [stseEnabled, setStseEnabled] = useState(true);
  const [stseFrequency, setStseFrequency] = useState(3.69);   // default resonance
  const [stseImpedance, setStseImpedance] = useState(376.5);   // default wave impedance
  const [stseMultiplier, setStseMultiplier] = useState(1.691); // default experience factor

  // Initialize secure authentication state
  useEffect(() => {
    initAuth(
      (userSnap, tokenSnap) => {
        setUser(userSnap);
        setToken(tokenSnap);
        setNeedsAuth(false);
        setAuthLoading(false);
      },
      () => {
        setNeedsAuth(true);
        setUser(null);
        setToken(null);
        setAuthLoading(false);
      }
    );
  }, []);

  // Fetch evaluated candidates whenever active selected Job changes
  useEffect(() => {
    if (!user || !activeJob) {
      setCandidates([]);
      setSelectedCandidate(null);
      return;
    }

    async function fetchCandidates() {
      setCandidatesLoading(true);
      const collectionName = "candidates";
      try {
        const q = query(
          collection(db, collectionName),
          where("ownerId", "==", user.uid),
          where("jobId", "==", activeJob.id)
        );
        const querySnapshot = await getDocs(q);
        const list: CandidateEvaluation[] = [];
        querySnapshot.forEach((docSnap) => {
          list.push(docSnap.data() as CandidateEvaluation);
        });
        setCandidates(list);
        if (list.length > 0) {
          // Select highest rated or first candidate by default
          const sorted = [...list].sort((a, b) => b.overallScore - a.overallScore);
          setSelectedCandidate(sorted[0]);
        } else {
          setSelectedCandidate(null);
        }
      } catch (err) {
        handleFirestoreError(err, OperationType.LIST, collectionName);
      } finally {
        setCandidatesLoading(false);
      }
    }

    fetchCandidates();
  }, [user, activeJob]);

  // Auth logins trigger
  const handleLogin = async () => {
    try {
      const result = await googleSignIn();
      if (result) {
        setUser(result.user);
        setToken(result.accessToken);
        setNeedsAuth(false);
      }
    } catch (err: any) {
      console.error(err);
      setGlobalError(err.message || "Failed to sign in with Google provider.");
    }
  };

  // Logouts trigger
  const handleLogout = async () => {
    try {
      await logout();
      setUser(null);
      setToken(null);
      setNeedsAuth(true);
      setActiveJob(null);
      setCandidates([]);
      setSelectedCandidate(null);
    } catch (err: any) {
      console.error(err);
    }
  };

  // Evaluate Resume callback
  const handleEvaluateResume = async (resumeText: string, fileName?: string, mode: "fast" | "detailed" = "detailed") => {
    if (!activeJob || !user) {
      setGlobalError("Please define and select an active Job opening prior to screening resumes.");
      return;
    }

    setIsProcessing(true);
    setGlobalError(null);
    setGlobalSuccess(null);

    try {
      const response = await fetch("/api/screening/evaluate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          resumeText,
          jobDetails: `Title: ${activeJob.title}\nRequirements: ${activeJob.requirements}\nDescription: ${activeJob.description}`,
          mode
        })
      });

      if (!response.ok) {
        throw new Error(`Screening server error: ${await response.text()}`);
      }

      // Read parsed evaluation scorecard from server response
      const scorecard = await response.json();

      // Write results to Firestore candidates collection
      const candidateId = "cand_" + Math.random().toString(36).substr(2, 9);
      const newCandidate: CandidateEvaluation = {
        id: candidateId,
        name: scorecard.name || fileName || "Reviewed Candidate",
        email: scorecard.email || "",
        phone: scorecard.phone || "",
        skills: scorecard.skills || [],
        yearsOfExperience: scorecard.yearsOfExperience || 0,
        overallScore: scorecard.overallScore || 0,
        matchAnalysis: scorecard.matchAnalysis || "",
        experienceSummary: scorecard.experienceSummary || "",
        feedback: scorecard.feedback || "",
        status: "Screened",
        rating: 3, // default rating
        jobId: activeJob.id,
        ownerId: user.uid,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      const collectionName = "candidates";
      await setDoc(doc(db, collectionName, candidateId), newCandidate);

      // Prepend to pipeline state list
      setCandidates((prev) => [newCandidate, ...prev]);
      setSelectedCandidate(newCandidate);
      setGlobalSuccess(`Successfully scanned and scored profile for '${newCandidate.name}' (${newCandidate.overallScore}% standard fit).`);
    } catch (err: any) {
      console.error(err);
      setGlobalError(err.message || "Failed to analyze candidate resume profile data.");
    } finally {
      setIsProcessing(false);
    }
  };

  // Status updates in Firestore
  const handleUpdateStatus = async (candId: string, status: CandidateEvaluation["status"]) => {
    const target = candidates.find((c) => c.id === candId);
    if (!target) return;

    setCandidates((prev) =>
      prev.map((c) => (c.id === candId ? { ...c, status, updatedAt: new Date().toISOString() } : c))
    );
    if (selectedCandidate?.id === candId) {
      setSelectedCandidate((prev) => prev ? { ...prev, status, updatedAt: new Date().toISOString() } : null);
    }

    const collectionName = "candidates";
    try {
      const cRef = doc(db, collectionName, candId);
      await updateDoc(cRef, { status, updatedAt: new Date().toISOString() });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `${collectionName}/${candId}`);
    }
  };

  // Star Ratings updates in Firestore
  const handleUpdateRating = async (candId: string, rating: number) => {
    const target = candidates.find((c) => c.id === candId);
    if (!target) return;

    setCandidates((prev) =>
      prev.map((c) => (c.id === candId ? { ...c, rating, updatedAt: new Date().toISOString() } : c))
    );
    if (selectedCandidate?.id === candId) {
      setSelectedCandidate((prev) => prev ? { ...prev, rating, updatedAt: new Date().toISOString() } : null);
    }

    const collectionName = "candidates";
    try {
      const cRef = doc(db, collectionName, candId);
      await updateDoc(cRef, { rating, updatedAt: new Date().toISOString() });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `${collectionName}/${candId}`);
    }
  };

  // Delete Candidate evaluation
  const handleDeleteCandidate = async (candId: string) => {
    const confirmed = window.confirm("Are you sure you want to delete this candidate from the opening database? This action is permanent.");
    if (!confirmed) return;

    const collectionName = "candidates";
    try {
      await deleteDoc(doc(db, collectionName, candId));
      setCandidates((prev) => prev.filter((c) => c.id !== candId));
      if (selectedCandidate?.id === candId) {
        const remaining = candidates.filter((c) => c.id !== candId);
        setSelectedCandidate(remaining.length > 0 ? remaining[0] : null);
      }
      setGlobalSuccess("Successfully deleted candidate evaluation entry.");
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `${collectionName}/${candId}`);
    }
  };

  // Build parameters object
  const activeParams: STSEParameters = {
    frequency: stseFrequency,
    impedance: stseImpedance,
    multiplier: stseMultiplier
  };

  return (
    <div className={`min-h-screen font-sans antialiased flex flex-col selection:bg-emerald-500/20 selection:text-emerald-400 ${
      isDarkMode 
        ? "bg-zinc-950 text-zinc-100 dark-theme" 
        : "bg-slate-50 text-slate-900 light-theme"
    }`}>
      
      {/* Upper Navigation Rail bar */}
      <header className="sticky top-0 z-40 bg-zinc-950/80 border-b border-zinc-800 px-6 py-4 flex items-center justify-between backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-emerald-600 rounded-xl text-white flex items-center justify-center">
            <Cpu className="w-5 h-5 text-zinc-100 animate-pulse" />
          </div>
          <div>
            <h1 className="text-sm font-extrabold tracking-tight text-zinc-100 flex items-center gap-1.5 font-mono">
              Nicholas Young Master Trust Sourcing Engine
            </h1>
            <p className="text-[10px] text-zinc-500 mt-0.5 font-bold font-mono">
              STSE PRO v3.69 • Compliance System Nodes Alpha & 01 Sigma
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {/* Theme Toggle Button */}
          <button
            onClick={toggleTheme}
            className="p-2.5 border rounded-xl transition flex items-center justify-center cursor-pointer bg-zinc-900/50 hover:bg-zinc-800 border-zinc-800 text-zinc-400 hover:text-zinc-100"
            title={isDarkMode ? "Switch to Light Mode" : "Switch to Dark Mode"}
            id="theme-toggle"
          >
            {isDarkMode ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-indigo-500" />}
          </button>

          {user && (
            <div className="flex items-center gap-5">
              <div className="hidden sm:block text-right font-mono">
                <span className="text-[9px] block text-zinc-500 font-bold uppercase">Compliance Trustee</span>
                <span className="text-xs font-semibold text-zinc-300">{user.email}</span>
              </div>
              <button
                onClick={handleLogout}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-zinc-400 hover:text-zinc-100 transition border border-zinc-800 rounded-lg bg-zinc-900/50 hover:bg-zinc-800"
              >
                <LogOut className="w-3.5 h-3.5" />
                Sign Out
              </button>
            </div>
          )}
        </div>
      </header>

      {/* Main Container workspace */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-6 flex flex-col gap-6">
        
        {/* Sign In Required Section */}
        <AnimatePresence mode="wait">
          {authLoading ? (
            <motion.div
              key="auth-loading"
              className="flex-1 flex flex-col items-center justify-center py-24 text-center"
            >
              <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
              <p className="text-xs font-bold text-zinc-500 mt-4 font-mono">Decrypting secure token credentials...</p>
            </motion.div>
          ) : needsAuth ? (
            <motion.div
              key="auth-login"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="flex-1 flex items-center justify-center py-20"
            >
              <div className="max-w-md w-full bg-zinc-900 rounded-2xl border border-zinc-800 p-8 text-center space-y-6">
                <div className="w-16 h-16 bg-emerald-600 rounded-2xl flex items-center justify-center mx-auto text-white">
                  <Database className="w-8 h-8 text-zinc-100 animate-pulse" />
                </div>
                <div className="space-y-2">
                  <h2 className="text-lg font-bold font-mono tracking-tight text-zinc-100">STSE Compliance Access portal</h2>
                  <p className="text-xs text-zinc-400 leading-relaxed font-sans px-4">
                    Connect your professional Trustee account to authenticate Google Workspace, retrieve raw Drive resumes, and execute real-time physical calibration audits with Gemini.
                  </p>
                </div>

                <div className="pt-2">
                  <button
                    onClick={handleLogin}
                    className="w-full flex items-center justify-center gap-3 py-3 border border-zinc-800 rounded-xl bg-zinc-950 hover:bg-zinc-900 transition font-mono font-bold text-xs text-zinc-200 cursor-pointer"
                  >
                    <div className="gsi-material-button-icon">
                      <svg version="1.1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" style={{ display: "block", width: "16px", height: "16px" }}>
                        <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"></path>
                        <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"></path>
                        <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"></path>
                        <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"></path>
                      </svg>
                    </div>
                    <span>Sign In With Google</span>
                  </button>
                </div>

                <div className="p-3.5 bg-zinc-950/65 rounded-xl border border-zinc-850 flex items-start gap-2.5 text-left text-[10px] leading-normal text-zinc-500 font-mono">
                  <Info className="w-4 h-4 text-zinc-650 shrink-0 mt-0.5" />
                  <div>
                    Your access token is secured inside memory and authorizes read-only Drive indexation, Gmail dispatch, Contacts sync and Calendar conflict checks.
                  </div>
                </div>
              </div>
            </motion.div>
          ) : (
            
            // Core Dashboard Workspace
            <motion.div
              key="dashboard-view"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start"
            >
              
              {/* Sovereign Trust Sourcing Engine Calibration & Control Panel */}
              <div className="lg:col-span-12 space-y-4">
                <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-zinc-800/60 pb-4 mb-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <Activity className="w-5 h-5 text-emerald-400" />
                        <h3 className="text-sm font-extrabold font-mono text-zinc-100 uppercase tracking-widest">Sovereign Trust Calibration Console (STSE)</h3>
                      </div>
                      <p className="text-[10px] text-zinc-500 font-mono">
                        Calibrate atomic physical metrics to dynamically shape and coupling candidate indexes.
                      </p>
                    </div>

                    <div className="flex items-center gap-3">
                      <span className="text-2xs font-mono font-bold text-zinc-500">STSE CALIBRATION COUPLING:</span>
                      <button
                        onClick={() => setStseEnabled(!stseEnabled)}
                        className={`px-3 py-1 text-2xs font-mono font-black border rounded-md transition ${
                          stseEnabled 
                            ? "bg-emerald-950/40 text-emerald-400 border-emerald-800" 
                            : "bg-zinc-950 text-zinc-500 border-zinc-800"
                        }`}
                      >
                        {stseEnabled ? "ACTIVE RESONANCE" : "STANDBY"}
                      </button>
                    </div>
                  </div>

                  {stseEnabled && (
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-6 text-xs font-mono">
                      {/* Freq Slider */}
                      <div className="space-y-2 bg-zinc-950/50 p-3.5 rounded-lg border border-zinc-850">
                        <div className="flex justify-between font-bold text-zinc-400">
                          <span>Resonant Frequency:</span>
                          <span className="text-emerald-400 font-black">{stseFrequency.toFixed(2)} Hz</span>
                        </div>
                        <input
                          type="range"
                          min="1.00"
                          max="10.00"
                          step="0.01"
                          value={stseFrequency}
                          onChange={(e) => setStseFrequency(Number(e.target.value))}
                          className="w-full h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                        />
                        <p className="text-[9px] text-zinc-500">Peak energy alignment centers strictly at 3.69 Hz.</p>
                      </div>

                      {/* Impedance Slider */}
                      <div className="space-y-2 bg-zinc-950/50 p-3.5 rounded-lg border border-zinc-850">
                        <div className="flex justify-between font-bold text-zinc-400">
                          <span>Wave Impedance:</span>
                          <span className="text-emerald-400 font-black">{stseImpedance.toFixed(1)} Ω</span>
                        </div>
                        <input
                          type="range"
                          min="100.0"
                          max="500.0"
                          step="0.5"
                          value={stseImpedance}
                          onChange={(e) => setStseImpedance(Number(e.target.value))}
                          className="w-full h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                        />
                        <p className="text-[9px] text-zinc-500 font-mono">Acoustic wave coupling impedance limit: 376.5 Ω.</p>
                      </div>

                      {/* Multiplier Slider */}
                      <div className="space-y-2 bg-zinc-950/50 p-3.5 rounded-lg border border-zinc-850">
                        <div className="flex justify-between font-bold text-zinc-400">
                          <span>Sourcing Multiplier:</span>
                          <span className="text-emerald-400 font-black">{stseMultiplier.toFixed(3)} μ</span>
                        </div>
                        <input
                          type="range"
                          min="1.000"
                          max="2.000"
                          step="0.001"
                          value={stseMultiplier}
                          onChange={(e) => setStseMultiplier(Number(e.target.value))}
                          className="w-full h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                        />
                        <p className="text-[9px] text-zinc-500">Trust-specific scale multiplier constant: 1.691.</p>
                      </div>

                      {/* active Telemetry */}
                      <div className="bg-zinc-950/50 p-3.5 rounded-lg border border-zinc-850/80 space-y-1 text-[10px] leading-relaxed text-zinc-400">
                        <div className="text-zinc-500 font-black text-2xs uppercase">Active Compute Host Telemetry:</div>
                        <div className="flex justify-between">
                          <span>NODE-ALPHA STATE:</span>
                          <span className="text-emerald-400 font-bold">● ACTIVE (3.69 Hz)</span>
                        </div>
                        <div className="flex justify-between">
                          <span>NODE-01 SIGMA:</span>
                          <span className="text-emerald-400/80 font-bold">● CO-PROCESSING GPUS</span>
                        </div>
                        <div className="flex justify-between truncate">
                          <span>USPTO IP:</span>
                          <span className="text-zinc-500 shrink-0 truncate max-w-[120px]">{USPTO_IP_ASSET}</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Alert System */}
              <div className="lg:col-span-12">
                <AnimatePresence>
                  {globalSuccess && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      className="p-3.5 bg-emerald-950/40 text-emerald-400 rounded-xl border border-emerald-800/30 text-xs flex items-center gap-2 mb-4 font-mono font-bold"
                    >
                      <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0" />
                      {globalSuccess}
                    </motion.div>
                  )}

                  {globalError && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      className="p-3.5 bg-red-950/40 text-red-400 rounded-xl border border-red-800/30 text-xs flex items-center gap-2 mb-4 font-mono font-bold"
                    >
                      <ShieldAlert className="w-4 h-4 text-red-500 shrink-0" />
                      {globalError}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Left Column: Job Manager + Drive Resume Picker */}
              <div className="lg:col-span-4 space-y-6">
                <JobManager
                  userId={user!.uid}
                  activeJob={activeJob}
                  onSelectJob={setActiveJob}
                />

                <DriveResumePicker
                  token={token}
                  onEvaluateResume={handleEvaluateResume}
                  isProcessing={isProcessing}
                />
              </div>

              {/* Right Column: Interactive Pipeline Grid List + Detail Action Workspace */}
              <div className="lg:col-span-8 space-y-6">
                
                {/* Active Opening Display */}
                <div className="bg-zinc-900 p-5 rounded-xl border border-zinc-800 flex flex-col sm:flex-row justify-between sm:items-center gap-4">
                  <div>
                    <span className="text-[10px] text-zinc-500 font-bold block uppercase tracking-wide font-mono">Target Opening Selected</span>
                    <h3 className="text-md font-bold text-zinc-100 flex items-center gap-2 mt-0.5 font-mono">
                      <Briefcase className="w-4 h-4 text-emerald-500" />
                      {activeJob ? activeJob.title : "Assemble Opening Target"}
                    </h3>
                  </div>

                  <div className="bg-zinc-950 border border-zinc-800 px-3 py-1.5 rounded-lg flex items-center gap-2">
                    <Zap className="w-4 h-4 text-yellow-500 animate-pulse" />
                    <span className="text-xs font-bold font-mono text-zinc-300">
                      Evaluated Profiles: {candidates.length}
                    </span>
                  </div>
                </div>

                {activeJob ? (
                  <div className="space-y-6">
                    {candidatesLoading ? (
                      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-12 text-center">
                        <Loader2 className="w-8 h-8 animate-spin text-emerald-500 mx-auto" />
                        <p className="text-xs font-bold font-mono text-zinc-500 mt-3">Interfacing candidate repositories...</p>
                      </div>
                    ) : (
                      <CandidateTable
                        candidates={candidates}
                        selectedCandidateId={selectedCandidate?.id || null}
                        onSelectCandidate={setSelectedCandidate}
                        onUpdateStatus={handleUpdateStatus}
                        onUpdateRating={handleUpdateRating}
                        onDeleteCandidate={handleDeleteCandidate}
                        stseEnabled={stseEnabled}
                        stseParams={activeParams}
                      />
                    )}

                    <CandidateDetail
                      token={token}
                      candidate={selectedCandidate}
                      userId={user!.uid}
                      jobTitle={activeJob.title}
                      stseEnabled={stseEnabled}
                      stseParams={activeParams}
                    />
                  </div>
                ) : (
                  <div className="bg-zinc-900 p-12 rounded-xl text-center border border-zinc-805">
                    <Briefcase className="w-12 h-12 text-zinc-800 mx-auto mb-3" />
                    <h3 className="font-bold text-zinc-200 text-sm font-mono uppercase tracking-wide">Interface Missing Targets</h3>
                    <p className="text-xs text-zinc-500 mt-2 max-w-sm mx-auto leading-relaxed">
                      Select or compile an active sourcing target using the opening module in the left sidebar. This is required to initialize the screening pipeline.
                    </p>
                  </div>
                )}
              </div>

            </motion.div>
          )}
        </AnimatePresence>

      </main>

      {/* Recruiter footer credit */}
      <footer className="bg-zinc-950 border-t border-zinc-900 px-6 py-4 mt-auto text-center text-[10px] text-zinc-500 leading-normal font-mono uppercase tracking-wide">
        Nicholas Young Master Trust • Secure Compliance Screening Vault • Google Workspace & Gemini Core API.
      </footer>

    </div>
  );
}
