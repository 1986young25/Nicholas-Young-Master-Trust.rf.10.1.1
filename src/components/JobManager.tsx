import React, { useState, useEffect } from "react";
import { collection, getDocs, setDoc, doc, deleteDoc, query, where } from "firebase/firestore";
import { db, handleFirestoreError, OperationType } from "../firebase";
import { JobDescription } from "../types";
import { Plus, Briefcase, Trash2, CheckCircle2, FileText, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface JobManagerProps {
  userId: string;
  activeJob: JobDescription | null;
  onSelectJob: (job: JobDescription) => void;
}

export default function JobManager({ userId, activeJob, onSelectJob }: JobManagerProps) {
  const [jobs, setJobs] = useState<JobDescription[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  
  // Form fields
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [requirements, setRequirements] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Fetch jobs
  useEffect(() => {
    async function fetchJobs() {
      setLoading(true);
      const collectionName = "job_descriptions";
      try {
        const q = query(collection(db, collectionName), where("ownerId", "==", userId));
        const querySnapshot = await getDocs(q);
        const fetchedJobs: JobDescription[] = [];
        querySnapshot.forEach((docSnap) => {
          fetchedJobs.push(docSnap.data() as JobDescription);
        });
        setJobs(fetchedJobs);
        if (fetchedJobs.length > 0 && !activeJob) {
          onSelectJob(fetchedJobs[0]);
        }
      } catch (err) {
        handleFirestoreError(err, OperationType.LIST, collectionName);
      } finally {
        setLoading(false);
      }
    }
    fetchJobs();
  }, [userId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !description || !requirements) return;
    
    setSubmitting(true);
    const id = "job_" + Math.random().toString(36).substr(2, 9);
    const newJob: JobDescription = {
      id,
      title,
      description,
      requirements,
      createdAt: new Date().toISOString(),
      ownerId: userId
    };

    const collectionName = "job_descriptions";
    try {
      await setDoc(doc(db, collectionName, id), newJob);
      setJobs((prev) => [newJob, ...prev]);
      onSelectJob(newJob);
      setIsAdding(false);
      setTitle("");
      setDescription("");
      setRequirements("");
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `${collectionName}/${id}`);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (jobId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const confirmed = window.confirm("Are you sure you want to delete this job opening? This will permanently remove it.");
    if (!confirmed) return;

    const collectionName = "job_descriptions";
    try {
      await deleteDoc(doc(db, collectionName, jobId));
      setJobs((prev) => prev.filter((j) => j.id !== jobId));
      if (activeJob?.id === jobId) {
        const remaining = jobs.filter((j) => j.id !== jobId);
        if (remaining.length > 0) {
          onSelectJob(remaining[0]);
        } else {
          onSelectJob(null as any);
        }
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `${collectionName}/${jobId}`);
    }
  };

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 space-y-6">
      
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Briefcase className="w-5 h-5 text-emerald-500" />
          <h2 className="text-md font-extrabold text-zinc-100 tracking-tight">Active Job Targets</h2>
        </div>
        <button
          onClick={() => setIsAdding(!isAdding)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-zinc-100 bg-emerald-600 rounded-lg hover:bg-emerald-500 hover:scale-103 transition"
          id="btn-create-role"
        >
          <Plus className="w-4 h-4 text-white" />
          {isAdding ? "Collapse" : "Create Target"}
        </button>
      </div>

      <AnimatePresence>
        {isAdding && (
          <motion.form
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            onSubmit={handleSubmit}
            className="p-4 bg-zinc-950/60 rounded-xl border border-zinc-850 space-y-4 overflow-hidden font-mono text-[11px]"
          >
            <div>
              <label className="block font-bold text-zinc-400 mb-1">Target Opening Title</label>
              <input
                type="text"
                placeholder="e.g. Lead Core Engineering Sourcing SRE"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                className="w-full px-3 py-2 text-xs border border-zinc-800 rounded-lg focus:outline-none focus:border-emerald-500 bg-zinc-900 text-zinc-100"
              />
            </div>
            <div>
              <label className="block font-bold text-zinc-400 mb-1">Primary Role Description</label>
              <textarea
                placeholder="Declare details about day-to-day strategic coupling mission..."
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                required
                className="w-full px-3 py-2 text-xs border border-zinc-800 rounded-lg focus:outline-none focus:border-emerald-500 bg-zinc-900 text-zinc-100 font-sans"
              />
            </div>
            <div>
              <label className="block font-bold text-zinc-400 mb-1">Required Competencies & Background</label>
              <textarea
                placeholder="Core keywords, experiences, and compliance benchmarks..."
                rows={3}
                value={requirements}
                onChange={(e) => setRequirements(e.target.value)}
                required
                className="w-full px-3 py-2 text-xs border border-zinc-800 rounded-lg focus:outline-none focus:border-emerald-500 bg-zinc-900 text-zinc-100 font-sans"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2 text-xs">
              <button
                type="button"
                onClick={() => setIsAdding(false)}
                className="px-3 py-1.5 font-bold text-zinc-400 hover:text-zinc-100 transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="flex items-center gap-1.5 px-3 py-1.5 font-bold text-white bg-emerald-605 bg-emerald-600 rounded-lg hover:bg-emerald-500 disabled:opacity-50 transition"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Recording...
                  </>
                ) : (
                  "Record Target"
                )}
              </button>
            </div>
          </motion.form>
        )}
      </AnimatePresence>

      {loading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-emerald-500" />
        </div>
      ) : jobs.length === 0 ? (
        <div className="text-center py-8 bg-zinc-950/40 rounded-xl border border-zinc-800">
          <Briefcase className="w-8 h-8 mx-auto text-zinc-700 mb-2" />
          <p className="text-sm text-zinc-400 font-bold font-mono">No target openings compiled.</p>
          <p className="text-xs text-zinc-500 mt-1 max-w-[200px] mx-auto leading-normal">Configure your first job opening target above to start screening.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {jobs.map((job) => {
            const isSelected = activeJob?.id === job.id;
            return (
              <div
                key={job.id}
                onClick={() => onSelectJob(job)}
                className={`flex items-center justify-between p-3 rounded-xl border transition cursor-pointer ${
                  isSelected
                    ? "bg-zinc-850 hover:bg-zinc-800 border-zinc-700 text-white shadow-sm"
                    : "bg-zinc-950/40 border-zinc-900 text-zinc-400 hover:border-zinc-805 hover:bg-zinc-900"
                }`}
              >
                <div className="flex items-center gap-3 overflow-hidden">
                  <div className={`p-2 rounded-lg shrink-0 ${isSelected ? "bg-zinc-900 text-emerald-400" : "bg-zinc-900 text-zinc-500"}`}>
                    <FileText className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-xs font-extrabold truncate leading-tight text-zinc-200">{job.title}</h3>
                    <p className={`text-[10px] truncate font-mono mt-1 ${isSelected ? "text-zinc-400" : "text-zinc-500"}`}>
                      {job.requirements}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0 pl-2" onClick={(e) => e.stopPropagation()}>
                  {isSelected && <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />}
                  <button
                    onClick={(e) => handleDelete(job.id, e)}
                    className="p-1 rounded text-zinc-550 hover:text-red-400 hover:bg-zinc-800 transition"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
