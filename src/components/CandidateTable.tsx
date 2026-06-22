import React, { useState } from "react";
import { CandidateEvaluation } from "../types";
import { Search, SlidersHorizontal, Star, FileCheck, ArrowUpDown, Trash2, Cpu, Zap, ShieldCheck, Download } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { calculateSTSEFit, STSEParameters, ATOMIC_LOCK_HASH, USPTO_IP_ASSET } from "../utils/stse";

interface CandidateTableProps {
  candidates: CandidateEvaluation[];
  selectedCandidateId: string | null;
  onSelectCandidate: (candidate: CandidateEvaluation) => void;
  onUpdateStatus: (candidateId: string, status: CandidateEvaluation["status"]) => void;
  onUpdateRating: (candidateId: string, rating: number) => void;
  onDeleteCandidate: (candidateId: string) => void;
  stseEnabled: boolean;
  stseParams: STSEParameters;
}

type SortField = "overallScore" | "stseScore" | "yearsOfExperience" | "name" | "rating" | "createdAt";

export default function CandidateTable({
  candidates,
  selectedCandidateId,
  onSelectCandidate,
  onUpdateStatus,
  onUpdateRating,
  onDeleteCandidate,
  stseEnabled,
  stseParams,
}: CandidateTableProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("All");
  const [minScore, setMinScore] = useState<number>(0);
  const [minExperience, setMinExperience] = useState<number>(0);
  
  // Sorting state
  const [sortField, setSortField] = useState<SortField>(stseEnabled ? "stseScore" : "overallScore");
  const [sortAsc, setSortAsc] = useState<boolean>(false);

  // Toggle sort direction or field
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(false);
    }
  };

  // Process all candidates in memory with STSE scores
  const processedCandidates = candidates.map((cand) => {
    const stse = calculateSTSEFit(cand.overallScore, cand.yearsOfExperience || 0, stseParams);
    return {
      ...cand,
      stseScore: stse.score,
      stseResults: stse,
    };
  });

  // Filter candidates logic
  const filteredCandidates = processedCandidates.filter((cand) => {
    const matchesSearch =
      cand.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      cand.skills.some((skill) => skill.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const matchesStatus = statusFilter === "All" || cand.status === statusFilter;
    const activeScore = stseEnabled ? cand.stseScore : cand.overallScore;
    const matchesScore = activeScore >= minScore;
    const matchesExperience = (cand.yearsOfExperience || 0) >= minExperience;

    return matchesSearch && matchesStatus && matchesScore && matchesExperience;
  });

  // Sort candidates logic
  const sortedCandidates = [...filteredCandidates].sort((a, b) => {
    let valA = a[sortField];
    let valB = b[sortField];

    if (sortField === "createdAt") {
      valA = new Date(a.createdAt).getTime();
      valB = new Date(b.createdAt).getTime();
    }

    if (valA === undefined) return 1;
    if (valB === undefined) return -1;

    if (typeof valA === "string" && typeof valB === "string") {
      return sortAsc ? valA.localeCompare(valB) : valB.localeCompare(valA);
    } else {
      return sortAsc ? (valA as number) - (valB as number) : (valB as number) - (valA as number);
    }
  });

  // Color mappings
  const getScoreColor = (score: number) => {
    if (score >= 85) return "bg-emerald-950/40 text-emerald-400 border-emerald-800/30";
    if (score >= 70) return "bg-sky-950/40 text-sky-400 border-sky-800/30";
    if (score >= 50) return "bg-amber-950/40 text-amber-400 border-amber-800/30";
    return "bg-rose-950/40 text-rose-400 border-rose-800/30";
  };

  const getStatusStyle = (status: CandidateEvaluation["status"]) => {
    switch (status) {
      case "Shortlisted":
        return "bg-teal-950/40 text-teal-400 border-teal-800/30";
      case "Interviewing":
        return "bg-indigo-950/40 text-indigo-400 border-indigo-800/30";
      case "Offered":
        return "bg-purple-950/40 text-purple-400 border-purple-800/30";
      case "Rejected":
        return "bg-red-950/40 text-red-400 border-red-800/30";
      case "Screened":
      default:
        return "bg-zinc-800 text-zinc-300 border-zinc-700";
    }
  };

  const triggerCSVExport = () => {
    let headers = "Candidate Name,Candidate Email,Standard AI Fit %,Sovereign Trust STAR %,Years of Experience,Interview Stage,Top Skills,Trust-Bound status,Validation Lock\n";
    const rows = sortedCandidates.map(c => {
      const skillsStr = `"${c.skills.join("; ")}"`;
      return `"${c.name}","${c.email || "N/A"}",${c.overallScore},${c.stseScore},${c.yearsOfExperience || 0},"${c.status}",${skillsStr},"${c.stseResults.isTrustBound ? "BOUND" : "UNBOUND"}","${ATOMIC_LOCK_HASH}"`;
    }).join("\n");

    const blob = new Blob([headers + rows], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `Nicholas_Young_Master_Trust_Compliance_Ledger_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 space-y-6">
      
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <SlidersHorizontal className="w-5 h-5 text-emerald-500" />
          <h2 className="text-md font-extrabold text-zinc-100 tracking-tight">Interactive Sourcing Pipeline</h2>
        </div>

        {sortedCandidates.length > 0 && (
          <button
            onClick={triggerCSVExport}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-zinc-300 font-bold bg-zinc-950 hover:bg-zinc-800 rounded-lg border border-zinc-800 hover:border-zinc-700 transition"
          >
            <Download className="w-3.5 h-3.5 text-emerald-500" />
            Compliance Ledger
          </button>
        )}
      </div>

      {/* Advanced Filter Toolbar */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 bg-zinc-950/50 p-4 rounded-xl border border-zinc-800/80 text-xs">
        {/* Search */}
        <div className="space-y-1.5">
          <label className="font-bold text-zinc-400">Keyword Lookup</label>
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-zinc-500" />
            <input
              type="text"
              placeholder="Filter names or engineering stack..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-8 pr-2.5 py-2 border border-zinc-800 rounded-lg bg-zinc-900 text-zinc-100 focus:outline-none focus:border-emerald-500/50"
            />
          </div>
        </div>

        {/* Status Stage */}
        <div className="space-y-1.5">
          <label className="font-bold text-zinc-400">Pipeline Stage</label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full px-2 py-2 border border-zinc-800 rounded-lg bg-zinc-900 text-zinc-100 focus:outline-none focus:border-emerald-500/50"
          >
            <option value="All">All Stages</option>
            <option value="Screened">Screened</option>
            <option value="Shortlisted">Shortlisted</option>
            <option value="Interviewing">Interviewing</option>
            <option value="Offered">Offered</option>
            <option value="Rejected">Rejected</option>
          </select>
        </div>

        {/* Score Threshold */}
        <div className="space-y-1.5">
          <div className="flex justify-between font-bold text-zinc-400">
            <span>{stseEnabled ? "Sovereign Target Fit:" : "Base AI Match Fit:"}</span>
            <span className="font-mono text-emerald-400 font-bold">&gt;= {minScore}%</span>
          </div>
          <input
            type="range"
            min="0"
            max="100"
            step="5"
            value={minScore}
            onChange={(e) => setMinScore(Number(e.target.value))}
            className="w-full h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
          />
        </div>

        {/* Experience Target */}
        <div className="space-y-1.5">
          <div className="flex justify-between font-bold text-zinc-400">
            <span>Experience Boundary:</span>
            <span className="font-mono text-emerald-400 font-bold">&gt;= {minExperience} yrs</span>
          </div>
          <input
            type="range"
            min="0"
            max="15"
            step="1"
            value={minExperience}
            onChange={(e) => setMinExperience(Number(e.target.value))}
            className="w-full h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
          />
        </div>
      </div>

      {/* Candidates List/Table */}
      <div className="overflow-x-auto border border-zinc-800 rounded-xl bg-zinc-950/10">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="bg-zinc-950/85 text-zinc-400 border-b border-zinc-800 font-bold select-none text-[11px]">
              <th onClick={() => handleSort("name")} className="p-3.5 cursor-pointer hover:bg-zinc-900 transition">
                <span className="flex items-center gap-1">
                  Candidate Credentials
                  <ArrowUpDown className="w-3" />
                </span>
              </th>
              {stseEnabled && (
                <th onClick={() => handleSort("stseScore")} className="p-3.5 cursor-pointer hover:bg-zinc-900 transition text-emerald-400 font-black">
                  <span className="flex items-center gap-1">
                    Sovereign STAR %
                    <ArrowUpDown className="w-3" />
                  </span>
                </th>
              )}
              <th onClick={() => handleSort("overallScore")} className="p-3.5 cursor-pointer hover:bg-zinc-900 transition">
                <span className="flex items-center gap-1">
                  Base Fit %
                  <ArrowUpDown className="w-3" />
                </span>
              </th>
              <th onClick={() => handleSort("yearsOfExperience")} className="p-3.5 cursor-pointer hover:bg-zinc-900 transition font-sans">
                <span className="flex items-center gap-1">
                  Experience
                  <ArrowUpDown className="w-3" />
                </span>
              </th>
              <th className="p-3.5">Keywords & Stacks</th>
              <th onClick={() => handleSort("rating")} className="p-3.5 cursor-pointer hover:bg-zinc-900 transition">
                <span className="flex items-center gap-1">
                  Rating
                  <ArrowUpDown className="w-3" />
                </span>
              </th>
              <th className="p-3.5">Sourcing Stage</th>
              <th className="p-3.5 text-center">Delete</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800/60">
            <AnimatePresence mode="popLayout">
              {sortedCandidates.map((candidate) => {
                const isSelected = selectedCandidateId === candidate.id;
                const matchesStseCenter = candidate.stseResults.isTrustBound;

                return (
                  <motion.tr
                    key={candidate.id}
                    layoutId={`row_${candidate.id}`}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={() => onSelectCandidate(candidate)}
                    className={`cursor-pointer transition-colors ${
                      isSelected ? "bg-zinc-800/50 border-l border-emerald-500" : "hover:bg-zinc-950/40"
                    }`}
                  >
                    {/* Name */}
                    <td className="p-3.5">
                      <div className="font-semibold text-zinc-100 flex items-center gap-1.5">
                        {candidate.name}
                        {matchesStseCenter && (
                          <span title="Licensed to Nicholas Young Master Trust under the 369-VX Vortex Engine technology">
                            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 fill-emerald-950/20" />
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] text-zinc-500 font-mono mt-0.5">{candidate.email || "No Email listed"}</div>
                    </td>

                    {/* STSE Sovereign Score */}
                    {stseEnabled && (
                      <td className="p-3.5">
                        <span className={`px-2 py-0.5 rounded text-[11px] font-mono font-black border ${getScoreColor(candidate.stseScore)}`}>
                          ★ {candidate.stseScore}%
                        </span>
                      </td>
                    )}

                    {/* Standard AI Fit */}
                    <td className="p-3.5 font-mono">
                      <span className="text-zinc-300 font-bold">{candidate.overallScore}%</span>
                    </td>

                    {/* Exp */}
                    <td className="p-3.5 font-bold text-zinc-300 font-mono">
                      {candidate.yearsOfExperience || 0} yrs
                    </td>

                    {/* Skills */}
                    <td className="p-3.5">
                      <div className="flex flex-wrap gap-1 max-w-[200px]">
                        {candidate.skills.slice(0, 3).map((skill, index) => (
                          <span
                            key={index}
                            className="bg-zinc-800 border border-zinc-800 text-zinc-300 px-1.5 py-0.5 rounded text-[9px] truncate max-w-[80px]"
                          >
                            {skill}
                          </span>
                        ))}
                        {candidate.skills.length > 3 && (
                          <span className="text-[9px] text-zinc-500 self-center">+{candidate.skills.length - 3}</span>
                        )}
                      </div>
                    </td>

                    {/* Rating stars */}
                    <td className="p-3.5" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center gap-0.5">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <button
                            key={star}
                            onClick={() => onUpdateRating(candidate.id, star)}
                            className="text-amber-400 hover:scale-110 transition shrink-0"
                          >
                            <Star
                              className={`w-3.5 h-3.5 ${
                                star <= (candidate.rating || 0) ? "fill-amber-400 text-amber-450" : "text-zinc-700"
                              }`}
                            />
                          </button>
                        ))}
                      </div>
                    </td>

                    {/* Status selection */}
                    <td className="p-3.5" onClick={(e) => e.stopPropagation()}>
                      <select
                        value={candidate.status}
                        onChange={(e) => onUpdateStatus(candidate.id, e.target.value as any)}
                        className={`text-[10px] font-semibold border rounded-lg px-2.5 py-1 focus:outline-none transition-all ${getStatusStyle(
                          candidate.status
                        )}`}
                      >
                        <option value="Screened">Screened</option>
                        <option value="Shortlisted">Shortlisted</option>
                        <option value="Interviewing">Interviewing</option>
                        <option value="Offered">Offered</option>
                        <option value="Rejected">Rejected</option>
                      </select>
                    </td>

                    {/* Delete */}
                    <td className="p-3.5 text-center" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => onDeleteCandidate(candidate.id)}
                        className="p-1.5 text-zinc-500 hover:text-red-400 rounded hover:bg-zinc-800 transition"
                      >
                        <Trash2 className="w-3.5 h-3.5 mx-auto" />
                      </button>
                    </td>
                  </motion.tr>
                );
              })}
            </AnimatePresence>

            {sortedCandidates.length === 0 && (
              <tr>
                <td colSpan={stseEnabled ? 8 : 7} className="text-center py-12 text-zinc-500 text-xs">
                  <FileCheck className="w-8 h-8 mx-auto text-zinc-700 mb-2" />
                  No applicant matches are logged in the database for the active filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
