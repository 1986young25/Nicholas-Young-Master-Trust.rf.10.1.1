import React, { useState, useEffect, useRef } from "react";
import { CandidateEvaluation, ChatMessage, CandidateChat } from "../types";
import { db, handleFirestoreError, OperationType } from "../firebase";
import { collection, query, where, getDocs, setDoc, doc } from "firebase/firestore";
import { 
  createGoogleContact, 
  sendGmail, 
  createCalendarEvent, 
  listCalendarEvents 
} from "../utils/workspaceService";
import { 
  FileText, Mail, Calendar, UserPlus, MessageSquare, Loader2, Sparkles, Check, Send, 
  User, CheckCircle, ShieldAlert, Cpu, Award, Zap, HelpCircle, ShieldCheck, Activity, Milestone
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { calculateSTSEFit, STSEParameters, ATOMIC_LOCK_HASH, USPTO_IP_ASSET, MASTER_TRUST_ASSIGNEE } from "../utils/stse";

interface CandidateDetailProps {
  token: string | null;
  candidate: CandidateEvaluation | null;
  userId: string;
  jobTitle: string;
  stseEnabled: boolean;
  stseParams: STSEParameters;
}

type ModeTab = "audit" | "gmail" | "calendar" | "chat" | "contacts";

export default function CandidateDetail({ token, candidate, userId, jobTitle, stseEnabled, stseParams }: CandidateDetailProps) {
  if (!candidate) {
    return (
      <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-8 text-center text-zinc-500">
        <FileText className="w-12 h-12 mx-auto text-zinc-700 mb-2" />
        <p className="text-sm font-bold font-sans text-zinc-400">No Candidate Selected</p>
        <p className="text-xs text-zinc-500 mt-1 max-w-sm mx-auto leading-relaxed">
          Select an evaluated resume from the interactive pipeline above to review their detailed scorecards, execute compliance checks, manage Google Workspace communications, and query Gemini.
        </p>
      </div>
    );
  }

  // Hook STSE scores for this candidate
  const stseResults = calculateSTSEFit(candidate.overallScore, candidate.yearsOfExperience || 0, stseParams);

  const [activeTab, setActiveTab] = useState<ModeTab>("audit");
  const [workspaceLoading, setWorkspaceLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Google Contacts state
  const [contactsSynced, setContactsSynced] = useState(false);

  // Gmail state
  const [emailSubject, setEmailSubject] = useState("");
  const [emailBody, setEmailBody] = useState("");
  const [activeGmailTemplate, setActiveGmailTemplate] = useState<"invite" | "followup" | "decline">("invite");

  // Calendar state
  const [selectedDate, setSelectedDate] = useState(""); 
  const [selectedTime, setSelectedTime] = useState("10:00"); 
  const [conflictingEvents, setConflictingEvents] = useState<any[]>([]);
  const [checkedConflicts, setCheckedConflicts] = useState(false);

  // Chat state
  const [chatLog, setChatLog] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatRole, setChatRole] = useState<"recruiter" | "interviewer" | "advisor">("recruiter");
  const [chatModel, setChatModel] = useState<"pro" | "flash" | "lite">("flash");
  const [chatLoading, setChatLoading] = useState(false);
  const chatBottomRef = useRef<HTMLDivElement | null>(null);

  // Fill in active template subject and draft copy
  useEffect(() => {
    if (activeGmailTemplate === "invite") {
      setEmailSubject(`Interview Request: Nicholas Young Master Trust - ${jobTitle}`);
      setEmailBody(
        `Hi ${candidate.name},<br/><br/>` +
        `Our technical sourcing team has reviewed your developer history and profile in our database.<br/><br/>` +
        `We are highly interested in scheduling a technical resonance screening to discuss the <strong>${jobTitle}</strong> opening and verify your technical expertise alongside our core compliance protocols.<br/><br/>` +
        `Screen Fit Rating: ${stseEnabled ? stseResults.score : candidate.overallScore}%<br/>` +
        `Skills evaluated: ${candidate.skills.slice(0, 5).join(", ")}<br/><br/>` +
        `Please let us know your availability so we can verify a block using our online calendar. We look forward to exchanging details soon!<br/><br/>` +
        `Best regards,<br/>` +
        `Technical Office<br/>` +
        `Nicholas Young Master Trust`
      );
    } else if (activeGmailTemplate === "followup") {
      setEmailSubject(`Update: Sourcing evaluation process - ${jobTitle}`);
      setEmailBody(
        `Dear ${candidate.name},<br/><br/>` +
        `Thank you for taking the time to share your technology background and credentials with us.<br/><br/>` +
        `We are currently finalizing our shortlists for the <strong>${jobTitle}</strong> position within the trust's recruitment protocol. Your compliance score is registered, and we will contact you within the next 48 hours with subsequent instructions.<br/><br/>` +
        `Warm regards,<br/>` +
        `Sourcing Director<br/>` +
        `Nicholas Young Master Trust`
      );
    } else {
      setEmailSubject(`Application status update - ${jobTitle}`);
      setEmailBody(
        `Dear ${candidate.name},<br/><br/>` +
        `Thank you for your interest in the <strong>${jobTitle}</strong> position and for submitting your developer credentials for review.<br/><br/>` +
        `While your background and skills are impressive (particularly in ${candidate.skills.slice(0, 3).join(", ")}), we have chosen to prioritize candidates whose physical profiles align more immediately with our precise project resonance requirements at this stage of the Trust's development.<br/><br/>` +
        `We have recordated your profile in our secure database and will reach back out if future target opportunities emerge.<br/><br/>` +
        `Sincerely,<br/>` +
        `Recruiting Office<br/>` +
        `Nicholas Young Master Trust`
      );
    }
  }, [candidate, activeGmailTemplate, jobTitle, stseEnabled, stseParams]);

  // Load chat logs on candidate change
  useEffect(() => {
    async function loadChat() {
      setChatLog([]);
      const collectionName = "chats";
      try {
        const q = query(
          collection(db, collectionName), 
          where("ownerId", "==", userId), 
          where("candidateId", "==", candidate.id)
        );
        const querySnapshot = await getDocs(q);
        if (!querySnapshot.empty) {
          const chatDoc = querySnapshot.docs[0].data() as CandidateChat;
          setChatLog(chatDoc.messages || []);
        } else {
          const welcome: ChatMessage = {
            role: "model",
            content: `Greetings. I am your specialized STSE AI Assistant. I have calibrated **${candidate.name}** for the **${jobTitle}** role.\n\n` +
                     `**Current Parameters:**\n` +
                     `- Standard Fit: **${candidate.overallScore}%**\n` +
                     `${stseEnabled ? `- calibrated Sovereign Trust STAR Rating: **${stseResults.score}%**\n` : ""}` +
                     `- Verified Keywords: ${candidate.skills.slice(0, 5).map(s => `\`${s}\``).join(", ")}\n\n` +
                     `Input your command. I can generate deep-level interview questions mapping their background, evaluate their structural code craftsmanship, or check for specific capability gaps.`,
            timestamp: Date.now()
          };
          setChatLog([welcome]);
        }
      } catch (err) {
        handleFirestoreError(err, OperationType.LIST, collectionName);
      }
    }
    loadChat();
  }, [candidate, userId]);

  // Scroll to bottom of chat
  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatLog]);

  const showSuccess = (msg: string) => {
    setSuccessMsg(msg);
    setErrorMsg(null);
    setTimeout(() => setSuccessMsg(null), 5000);
  };

  const showError = (msg: string) => {
    setErrorMsg(msg);
    setSuccessMsg(null);
  };

  // Sync Google Contacts handler
  const handleSyncContact = async () => {
    if (!token) {
      showError("Please sign in with Google to sync Contacts.");
      return;
    }
    setWorkspaceLoading(true);
    setErrorMsg(null);
    try {
      await createGoogleContact(
        token, 
        candidate.name, 
        candidate.email || "", 
        candidate.phone || "", 
        stseEnabled ? stseResults.score : candidate.overallScore, 
        jobTitle
      );
      setContactsSynced(true);
      showSuccess(`Successfully synchronization: ${candidate.name} created inside Google Contacts.`);
    } catch (err: any) {
      console.error(err);
      showError(err.message || "Failed to synchronise candidate to Google Contacts.");
    } finally {
      setWorkspaceLoading(false);
    }
  };

  // Google Calendar integration
  const handleCheckConflicts = async () => {
    if (!token) {
      showError("Please sign in with Google to query Calendar conflicts.");
      return;
    }
    if (!selectedDate) {
      showError("Please enter a valid target Date.");
      return;
    }
    setWorkspaceLoading(true);
    setErrorMsg(null);
    setCheckedConflicts(false);
    try {
      const timeMin = `${selectedDate}T00:00:00Z`;
      const timeMax = `${selectedDate}T23:59:59Z`;
      const events = await listCalendarEvents(token, timeMin, timeMax);
      setConflictingEvents(events);
      setCheckedConflicts(true);
      showSuccess("Google Calendar slots polled successfully.");
    } catch (err: any) {
      console.error(err);
      showError(err.message || "Google Calendar query has failed.");
    } finally {
      setWorkspaceLoading(false);
    }
  };

  // Create Interview Meeting
  const handleCreateEvent = async () => {
    if (!token) {
      showError("Please check Google secure connection before proceeding.");
      return;
    }
    if (!selectedDate || !selectedTime) {
      showError("Target date and start time must be declared.");
      return;
    }

    const confirmed = window.confirm(`Generate Calendar invite for ${candidate.name}?`);
    if (!confirmed) return;

    setWorkspaceLoading(true);
    setErrorMsg(null);
    try {
      const startDateTime = `${selectedDate}T${selectedTime}:00`;
      const [hour, min] = selectedTime.split(":").map(Number);
      const endHour = hour + 1;
      const endHourStr = endHour < 10 ? `0${endHour}` : `${endHour}`;
      const endDateTime = `${selectedDate}T${endHourStr}:${min < 10 ? "0" + min : min}:00`;

      const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || "America/Detroit";

      const eventPayload = {
        summary: `STSE Compliance Screen - ${candidate.name} / ${jobTitle}`,
        description: `Scheduled via trust compliance portal.\n\nSourced Sourcing Specs:\n- Sovereign Fit Rate: ${stseResults.score}%\n- Base AI Score: ${candidate.overallScore}%\n- Experience Calibration: ${candidate.yearsOfExperience} yrs\n- Verification Anchor: ${ATOMIC_LOCK_HASH}\n\nNotes:\n${candidate.feedback || "Screen completed."}`,
        start: { dateTime: startDateTime, timeZone },
        end: { dateTime: endDateTime, timeZone },
        attendees: candidate.email ? [{ email: candidate.email }] : []
      };

      await createCalendarEvent(token, eventPayload);
      showSuccess(`Google Calendar invitation dispatched to ${candidate.name}.`);
    } catch (err: any) {
      console.error(err);
      showError(err.message || "Calendar action failed.");
    } finally {
      setWorkspaceLoading(false);
    }
  };

  // Send Email
  const handleSendGmail = async () => {
    if (!token) {
      showError("Please sign in with Google to draft messages.");
      return;
    }
    if (!candidate.email) {
      showError("A valid candidate target email is required.");
      return;
    }

    const confirmed = window.confirm(`Deliver official message via Gmail to ${candidate.email}?`);
    if (!confirmed) return;

    setWorkspaceLoading(true);
    setErrorMsg(null);
    try {
      await sendGmail(token, candidate.email, emailSubject, emailBody);
      showSuccess(`Gmail dispatch successful: Delivered message to ${candidate.email}`);
    } catch (err: any) {
      console.error(err);
      showError(err.message || "Gmail transmission has failed.");
    } finally {
      setWorkspaceLoading(false);
    }
  };

  // Multi-turn chat
  const handleChatSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || chatLoading) return;

    const userMessage: ChatMessage = {
      role: "user",
      content: chatInput,
      timestamp: Date.now()
    };

    setChatLog((prev) => [...prev, userMessage]);
    setChatInput("");
    setChatLoading(true);
    setErrorMsg(null);

    try {
      const response = await fetch("/api/chat/message", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: chatLog,
          candidate: {
            name: candidate.name,
            email: candidate.email,
            phone: candidate.phone,
            skills: candidate.skills,
            yearsOfExperience: candidate.yearsOfExperience,
            overallScore: candidate.overallScore,
            stseScore: stseResults.score,
            matchAnalysis: candidate.matchAnalysis,
            experienceSummary: candidate.experienceSummary,
            feedback: candidate.feedback
          },
          job: {
            title: jobTitle,
          },
          userPrompt: userMessage.content,
          role: chatRole,
          modelSelection: chatModel
        })
      });

      if (!response.ok) {
        throw new Error(`Chat connection has errored: ${await response.text()}`);
      }

      const data = await response.json();
      const modelMessage: ChatMessage = {
        role: "model",
        content: data.text,
        timestamp: Date.now()
      };

      const updatedHistory = [...chatLog, userMessage, modelMessage];
      setChatLog(updatedHistory);

      // Save history back to Firestore
      const chatId = `chat_${userId}_${candidate.id}`;
      const chatDoc: CandidateChat = {
        id: chatId,
        candidateId: candidate.id,
        messages: updatedHistory,
        ownerId: userId,
        createdAt: new Date().toISOString()
      };

      await setDoc(doc(db, "chats", chatId), chatDoc);
    } catch (err: any) {
      console.error(err);
      showError(err.message || "Failed to secure AI interaction.");
    } finally {
      setChatLoading(false);
    }
  };

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden flex flex-col h-full min-h-[550px]">
      
      {/* Detail Top Header */}
      <div className="p-6 bg-zinc-950/45 border-b border-zinc-800">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono uppercase bg-zinc-800 text-emerald-400 border border-zinc-700 px-2 py-0.5 rounded font-black tracking-wide">
                Evaluation File
              </span>
              {stseEnabled && stseResults.isTrustBound && (
                <span className="text-[10px] font-mono uppercase bg-emerald-950/60 text-emerald-300 border border-emerald-800 px-2 py-0.5 rounded font-black tracking-wide flex items-center gap-1">
                  <ShieldCheck className="w-3" />
                  TRUST ASSIGNED
                </span>
              )}
            </div>
            <h1 className="text-lg font-bold text-zinc-100 flex items-center gap-2 font-mono">
              {candidate.name}
            </h1>
            <p className="text-xs text-zinc-500 font-mono">
              {candidate.email ? candidate.email : "Incomplete email dataset"} 
              {candidate.phone && `  •  ${candidate.phone}`}
            </p>
          </div>

          <div className="flex items-center gap-4">
            <div className="text-right">
              <span className="text-[10px] text-zinc-500 block font-mono">Calibrated Sovereign Index</span>
              <span className="text-2xl font-black font-mono text-emerald-400">
                {stseEnabled ? `${stseResults.score}%` : `${candidate.overallScore}%`}
              </span>
            </div>
            
            {/* Resonance Wave SVG Visualization */}
            <div className="w-12 h-12 rounded-xl border border-zinc-800 bg-zinc-950 relative flex items-center justify-center overflow-hidden shrink-0">
              <Activity className="w-5 h-5 text-emerald-500 z-10" />
              {stseEnabled && (
                <span 
                  className="absolute inset-0 bg-emerald-500/10 rounded-full animate-ping"
                  style={{ animationDuration: `${(4.0 / stseParams.frequency).toFixed(2)}s` }}
                />
              )}
            </div>
          </div>
        </div>

        {/* Tab Selection */}
        <div className="flex gap-2 mt-6 border-b border-zinc-800 overflow-x-auto scrollbar-none pb-px text-xs font-mono">
          <button
            onClick={() => setActiveTab("audit")}
            className={`flex items-center gap-1.5 pb-2.5 font-bold transition whitespace-nowrap px-2 ${
              activeTab === "audit"
                ? "border-b-2 border-emerald-400 text-emerald-400"
                : "text-zinc-500 hover:text-zinc-300"
            }`}
          >
            <FileText className="w-4 h-4" />
            Resume Audit
          </button>
          
          <button
            onClick={() => setActiveTab("chat")}
            className={`flex items-center gap-1.5 pb-2.5 font-bold transition whitespace-nowrap px-2 ${
              activeTab === "chat"
                ? "border-b-2 border-emerald-400 text-emerald-400"
                : "text-zinc-500 hover:text-zinc-300"
            }`}
          >
            <MessageSquare className="w-4 h-4" />
            AI Sourcing Assistant
          </button>

          <button
            onClick={() => setActiveTab("gmail")}
            className={`flex items-center gap-1.5 pb-2.5 font-bold transition whitespace-nowrap px-2 ${
              activeTab === "gmail"
                ? "border-b-2 border-emerald-400 text-emerald-400"
                : "text-zinc-500 hover:text-zinc-300"
            }`}
          >
            <Mail className="w-4 h-4" />
            Gmail Connect
          </button>

          <button
            onClick={() => setActiveTab("calendar")}
            className={`flex items-center gap-1.5 pb-2.5 font-bold transition whitespace-nowrap px-2 ${
              activeTab === "calendar"
                ? "border-b-2 border-emerald-400 text-emerald-400"
                : "text-zinc-500 hover:text-zinc-300"
            }`}
          >
            <Calendar className="w-4 h-4" />
            Interview Calendar
          </button>

          <button
            onClick={() => setActiveTab("contacts")}
            className={`flex items-center gap-1.5 pb-2.5 font-bold transition whitespace-nowrap px-2 ${
              activeTab === "contacts"
                ? "border-b-2 border-emerald-400 text-emerald-400"
                : "text-zinc-500 hover:text-zinc-300"
            }`}
          >
            <UserPlus className="w-4 h-4" />
            Contacts Sync
          </button>
        </div>
      </div>

      {/* Main Body */}
      <div className="flex-1 p-6 overflow-y-auto max-h-[600px] text-xs">
        
        {/* Dynamic Alerts */}
        <AnimatePresence>
          {successMsg && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="mb-4 p-3.5 bg-emerald-950/40 text-emerald-400 rounded-lg border border-emerald-800/30 flex items-center gap-2.5 font-mono font-bold"
            >
              <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0" />
              {successMsg}
            </motion.div>
          )}

          {errorMsg && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="mb-4 p-3.5 bg-red-950/40 text-red-400 rounded-lg border border-red-800/30 flex items-center gap-2.5 font-mono font-bold"
            >
              <ShieldAlert className="w-4 h-4 text-red-500 shrink-0" />
              {errorMsg}
            </motion.div>
          )}
        </AnimatePresence>

        {workspaceLoading && (
          <div className="flex items-center gap-2 p-3.5 bg-zinc-950/50 rounded-lg border border-zinc-800/80 mb-4 font-mono text-zinc-400">
            <Loader2 className="w-4 h-4 animate-spin text-emerald-500 shrink-0" />
            Transmission active... Securing workspace connection...
          </div>
        )}

        <AnimatePresence mode="wait">
          
          {/* TAB 1: AUDIT */}
          {activeTab === "audit" && (
            <motion.div
              key="audit-view"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-6"
            >
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                
                {/* Years of Experience */}
                <div className="bg-zinc-950/40 p-4 rounded-xl border border-zinc-800 text-center">
                  <span className="text-[10px] text-zinc-500 uppercase tracking-wide font-mono block mb-1">Experience Baseline</span>
                  <p className="text-lg font-bold font-mono text-zinc-100">{candidate.yearsOfExperience || 0} Years</p>
                  <p className="text-[10px] text-zinc-500 mt-1 leading-normal font-mono">Calibrated Work History</p>
                </div>

                {/* STSE Calibration metrics indicators */}
                {stseEnabled ? (
                  <div className="bg-zinc-950/40 p-4 rounded-xl border border-zinc-800 text-center col-span-2 grid grid-cols-2 gap-2 text-left font-mono">
                    <div className="border-r border-zinc-850 px-2">
                      <span className="text-[10px] text-zinc-500 block">FREQUENCY RESONANCE:</span>
                      <div className="text-zinc-200 text-base font-bold flex items-center gap-1">
                        {stseResults.freqCoupling}%
                        <span className="text-[10px] text-emerald-500 font-normal">({stseParams.frequency} Hz)</span>
                      </div>
                      <span className="text-[10px] text-zinc-500 block mt-1">Impedance Cal: {stseParams.impedance} Ω</span>
                    </div>

                    <div className="px-2">
                      <span className="text-[10px] text-zinc-500 block">COMPLIANCE SEALS:</span>
                      <div className="text-zinc-200 text-base font-black flex items-center gap-1">
                        {stseResults.isTrustBound ? (
                          <span className="text-emerald-400 flex items-center gap-1">
                            <ShieldCheck className="w-4 h-4" /> APPROVED
                          </span>
                        ) : (
                          <span className="text-amber-500">PENDING</span>
                        )}
                      </div>
                      <span className="text-[10px] text-zinc-500 block mt-1 truncate">Hash: {ATOMIC_LOCK_HASH.substr(0, 10)}...</span>
                    </div>
                  </div>
                ) : (
                  <div className="bg-zinc-950/40 p-4 rounded-xl border border-zinc-800 text-center col-span-2">
                    <span className="text-[10px] text-zinc-500 uppercase tracking-wide font-mono block mb-1">Target Skills Stack</span>
                    <div className="flex flex-wrap gap-1.5 justify-center mt-2">
                      {candidate.skills.map((skill, i) => (
                        <span key={i} className="bg-zinc-800 border border-zinc-750 px-2 py-0.5 rounded text-[10px] font-bold text-zinc-300 font-mono">
                          {skill}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* USPTO Certificate Plate */}
              {stseEnabled && stseResults.isTrustBound && (
                <div className="bg-gradient-to-r from-emerald-950/30 to-zinc-950 border border-emerald-800/40 p-4 rounded-xl space-y-2.5 font-mono text-zinc-300">
                  <div className="flex items-center gap-2 text-emerald-400 font-bold">
                    <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0" />
                    <span>NICHOLAS YOUNG MASTER TRUST COMPLIANCE CERTIFICATION</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-[10px] text-zinc-400 mt-2 border-t border-emerald-800/20 pt-2.5">
                    <div>
                      <p className="font-bold text-zinc-500">AUTHORIZED IP LICENSE REFERENCE</p>
                      <p className="text-emerald-300">{USPTO_IP_ASSET}</p>
                    </div>
                    <div>
                      <p className="font-bold text-zinc-500">ASSIGNED DECLARED LICENSEE</p>
                      <p className="text-zinc-200">{MASTER_TRUST_ASSIGNEE}</p>
                    </div>
                    <div className="sm:col-span-2">
                      <p className="font-bold text-zinc-500">ATOMIC VERIFICATION KEY</p>
                      <p className="text-emerald-400/80 break-all">{ATOMIC_LOCK_HASH}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Standard text elements */}
              <div className="space-y-2">
                <h3 className="font-extrabold text-zinc-200 text-sm flex items-center gap-2 font-mono">
                  <Award className="w-4 h-4 text-emerald-500" />
                  Target Match Structural Analysis
                </h3>
                <div className="p-4 bg-zinc-950/45 rounded-xl border border-zinc-850 text-zinc-300 leading-relaxed whitespace-pre-line font-sans">
                  {candidate.matchAnalysis}
                </div>
              </div>

              <div className="space-y-2">
                <h3 className="font-extrabold text-zinc-200 text-sm font-mono flex items-center gap-2">
                  <Milestone className="w-4 h-4 text-emerald-500" />
                  Experience Chronology Breakdown
                </h3>
                <div className="p-4 bg-zinc-950/45 rounded-xl border border-zinc-850 text-zinc-300 leading-relaxed whitespace-pre-line font-sans">
                  {candidate.experienceSummary}
                </div>
              </div>

              {candidate.feedback && (
                <div className="space-y-2">
                  <h3 className="font-extrabold text-emerald-400 text-sm font-mono flex items-center gap-2">
                    <Zap className="w-4 h-4 text-orange-400 fill-orange-400/10" />
                    Strategic Interview Questions & Missing Credentials
                  </h3>
                  <div className="p-4 bg-emerald-950/20 rounded-xl border border-emerald-900/30 text-zinc-300 leading-relaxed font-sans whitespace-pre-line">
                    {candidate.feedback}
                  </div>
                </div>
              )}
            </motion.div>
          )}

          {/* TAB 2: CHAT */}
          {activeTab === "chat" && (
            <motion.div
              key="chat-view"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col h-[525px] font-mono"
            >
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-zinc-950 p-3 rounded-lg border border-zinc-800 mb-4">
                <div className="flex items-center gap-2">
                  <Cpu className="w-4 h-4 text-emerald-500 animate-pulse" />
                  <span className="font-bold text-zinc-300 text-[11px]">STSE AI Sourcing Assistant</span>
                </div>
                
                <div className="flex flex-wrap gap-2 text-[10px]">
                  <select
                    value={chatRole}
                    onChange={(e) => setChatRole(e.target.value as any)}
                    className="bg-zinc-900 border border-zinc-800 text-zinc-300 rounded px-2.5 py-1 font-bold"
                  >
                    <option value="recruiter">Persona: Technical Recruiter</option>
                    <option value="interviewer">Persona: Coding Auditor</option>
                    <option value="advisor">Persona: Trust Trustee Advisor</option>
                  </select>

                  <select
                    value={chatModel}
                    onChange={(e) => setChatModel(e.target.value as any)}
                    className="bg-zinc-900 border border-zinc-800 text-zinc-300 rounded px-2.5 py-1 font-bold"
                  >
                    <option value="pro">Model: pro-preview (Thinking HIGH)</option>
                    <option value="flash">Model: 3.5-flash</option>
                    <option value="lite">Model: 3.1-flash-lite</option>
                  </select>
                </div>
              </div>

              {/* Messages Container */}
              <div className="flex-1 bg-zinc-950/40 rounded-xl border border-zinc-850 p-4 overflow-y-auto space-y-4 font-sans max-h-[340px]">
                {chatLog.map((msg, i) => (
                  <div
                    key={i}
                    className={`flex gap-3 max-w-[85%] ${
                      msg.role === "user" ? "ml-auto flex-row-reverse" : ""
                    }`}
                  >
                    <div className={`p-2 rounded-lg shrink-0 ${
                      msg.role === "user" ? "bg-emerald-600 text-white" : "bg-zinc-900 border border-zinc-800 text-zinc-300"
                    }`}>
                      {msg.role === "user" ? <User className="w-3.5 h-3.5" /> : <Cpu className="w-3.5 h-3.5 text-emerald-400" />}
                    </div>
                    <div>
                      <div className={`p-3.5 rounded-xl text-xs leading-relaxed ${
                        msg.role === "user"
                          ? "bg-zinc-800 border border-zinc-700 text-white"
                          : "bg-zinc-900 border border-zinc-800 text-zinc-300"
                      } whitespace-pre-wrap`}>
                        {msg.content}
                      </div>
                    </div>
                  </div>
                ))}
                {chatLoading && (
                  <div className="flex items-center gap-2 p-2.5 text-zinc-500 text-xs font-mono">
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-500" />
                    AI is calculating response parameters...
                  </div>
                )}
                <div ref={chatBottomRef} />
              </div>

              {/* Chat Input */}
              <form onSubmit={handleChatSubmit} className="flex gap-2 mt-4">
                <input
                  type="text"
                  placeholder="Ask standard coding questions, core capabilities matching, or draft compliance audits..."
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  className="flex-1 px-3 py-2 border border-zinc-800 rounded-lg bg-zinc-950 text-zinc-100 placeholder-zinc-650 focus:outline-none focus:border-emerald-500 text-xs font-sans"
                />
                <button
                  type="submit"
                  disabled={chatLoading || !chatInput.trim()}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 rounded-lg flex items-center justify-center transition disabled:opacity-40"
                >
                  <Send className="w-4 h-4" />
                </button>
              </form>
            </motion.div>
          )}

          {/* TAB 3: GMAIL */}
          {activeTab === "gmail" && (
            <motion.div
              key="gmail-view"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-4 font-sans"
            >
              <div className="flex bg-zinc-950 p-1 rounded-lg border border-zinc-800 max-w-sm text-xs font-mono">
                <button
                  onClick={() => setActiveGmailTemplate("invite")}
                  className={`flex-1 py-1 text-center font-bold rounded-lg transition ${
                    activeGmailTemplate === "invite" ? "bg-zinc-900 text-emerald-400" : "text-zinc-500 hover:text-zinc-300"
                  }`}
                >
                  Interviews
                </button>
                <button
                  onClick={() => setActiveGmailTemplate("followup")}
                  className={`flex-1 py-1 text-center font-bold rounded-lg transition ${
                    activeGmailTemplate === "followup" ? "bg-zinc-900 text-emerald-400" : "text-zinc-500 hover:text-zinc-300"
                  }`}
                >
                  Follow-Up
                </button>
                <button
                  onClick={() => setActiveGmailTemplate("decline")}
                  className={`flex-1 py-1 text-center font-bold rounded-lg transition ${
                    activeGmailTemplate === "decline" ? "bg-zinc-900 text-emerald-400" : "text-zinc-500 hover:text-zinc-300"
                  }`}
                >
                  Regrets
                </button>
              </div>

              <div className="space-y-3 font-mono text-[11px]">
                <div className="grid grid-cols-6 items-center gap-2 bg-zinc-950/40 p-2 rounded-lg border border-zinc-850">
                  <span className="col-span-1 text-zinc-500 font-bold">To:</span>
                  <span className="col-span-5 text-zinc-300 select-all">{candidate.email || "No email detected in scorecard"}</span>
                </div>

                <div className="grid grid-cols-6 items-center gap-2 bg-zinc-950/40 p-2 rounded-lg border border-zinc-850">
                  <span className="col-span-1 text-zinc-500 font-bold">Subject:</span>
                  <input
                    type="text"
                    value={emailSubject}
                    onChange={(e) => setEmailSubject(e.target.value)}
                    className="col-span-5 bg-transparent text-zinc-200 focus:outline-none w-full"
                  />
                </div>

                <div className="bg-zinc-950/40 rounded-xl border border-zinc-850 p-3.5 space-y-2">
                  <span className="text-zinc-500 font-bold block">Draft Body (HTML Supported):</span>
                  <textarea
                    rows={8}
                    value={emailBody}
                    onChange={(e) => setEmailBody(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-900 p-3 rounded-lg text-xs leading-relaxed text-zinc-300 focus:outline-none focus:border-zinc-800 text-sans"
                  />
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    disabled={workspaceLoading || !candidate.email}
                    onClick={handleSendGmail}
                    className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-4 py-2 rounded-lg transition disabled:opacity-50"
                  >
                    <Mail className="w-4 h-4" />
                    Transmit Sourcing Email
                  </button>
                </div>
              </div>
            </motion.div>
          )}

          {/* TAB 4: CALENDAR */}
          {activeTab === "calendar" && (
            <motion.div
              key="calendar-view"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-4 font-mono text-[11px]"
            >
              <div className="bg-zinc-950/45 p-4 rounded-xl border border-zinc-850 space-y-4">
                <span className="font-bold text-zinc-400 block text-[11px]">CHALLENGE INTERVIEW BLOCK PARAMETERS:</span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-zinc-500 block font-bold">Select Target Date:</label>
                    <input
                      type="date"
                      value={selectedDate}
                      onChange={(e) => setSelectedDate(e.target.value)}
                      className="w-full bg-zinc-90 w px-3 py-2 rounded-lg border border-zinc-800 text-zinc-200 focus:outline-none text-xs"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-zinc-500 block font-bold">Resonance Start Time:</label>
                    <input
                      type="time"
                      value={selectedTime}
                      onChange={(e) => setSelectedTime(e.target.value)}
                      className="w-full bg-zinc-90w px-3 py-2 rounded-lg border border-zinc-800 text-zinc-200 focus:outline-none text-xs"
                    />
                  </div>
                </div>

                <div className="flex gap-2 pt-1">
                  <button
                    onClick={handleCheckConflicts}
                    disabled={workspaceLoading || !selectedDate}
                    className="flex-1 bg-zinc-850 hover:bg-zinc-800 text-zinc-300 hover:text-white border border-zinc-750 font-bold py-2 rounded-lg transition disabled:opacity-40"
                  >
                    Check Schedule Overlaps
                  </button>

                  <button
                    onClick={handleCreateEvent}
                    disabled={workspaceLoading || !selectedDate || !selectedTime}
                    className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-2 rounded-lg transition disabled:opacity-40"
                  >
                    Lock Meeting Slot
                  </button>
                </div>
              </div>

              {/* Conflict lists */}
              {checkedConflicts && (
                <div className="bg-zinc-950/40 p-4 rounded-xl border border-zinc-850 space-y-2">
                  <span className="font-bold text-zinc-500 uppercase tracking-wider block">Google Calendar conflicts on {selectedDate}:</span>
                  {conflictingEvents.length === 0 ? (
                    <p className="text-emerald-400 font-bold">✓ Clear Space. Zero structural overlaps found.</p>
                  ) : (
                    <div className="divide-y divide-zinc-900 leading-normal">
                      {conflictingEvents.map((evt: any, idx: number) => (
                        <div key={idx} className="py-2 flex items-center justify-between text-zinc-300">
                          <span className="font-semibold">{evt.summary || "Secured event Block"}</span>
                          <span className="text-zinc-500 font-mono">
                            {evt.start?.dateTime ? new Date(evt.start.dateTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : "Full-Day block"}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </motion.div>
          )}

          {/* TAB 5: CONTACTS */}
          {activeTab === "contacts" && (
            <motion.div
              key="contacts-view"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-4 font-mono text-[11px] text-center py-6 min-h-[220px] flex flex-col justify-center items-center"
            >
              <UserPlus className="w-12 h-12 text-zinc-700 mb-2" />
              <div className="max-w-md space-y-1">
                <span className="text-zinc-350 font-bold block text-sm">Synchronize Credentials</span>
                <p className="text-zinc-500 leading-relaxed text-xs">
                  Create a validated contact inside Google Contacts holding candidates phone numbers, email parameters, matching scorecards, and current interview status.
                </p>
              </div>

              <div className="pt-4 w-full max-w-xs">
                {contactsSynced ? (
                  <div className="flex items-center justify-center gap-2 bg-emerald-950/45 text-emerald-400 border border-emerald-800/30 p-3 rounded-xl font-bold">
                    <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                    Credentials Synchronized
                  </div>
                ) : (
                  <button
                    disabled={workspaceLoading}
                    onClick={handleSyncContact}
                    className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold py-3.5 rounded-xl transition disabled:opacity-40 flex items-center justify-center gap-2 text-xs"
                  >
                    <UserPlus className="w-5 h-5" />
                    Synchronize now
                  </button>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

    </div>
  );
}
