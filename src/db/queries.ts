import { db } from "./index.ts";
import { users, jobs, candidates } from "./schema.ts";
import { eq, and } from "drizzle-orm";

// 1. Synchronous Upsert for User session sync
export async function getOrCreateUser(uid: string, email: string) {
  try {
    const result = await db.insert(users)
      .values({
        uid,
        email,
      })
      .onConflictDoUpdate({
        target: users.uid,
        set: {
          email,
        },
      })
      .returning();

    return result[0];
  } catch (error) {
    console.error("getOrCreateUser database error:", error);
    throw new Error("Unable to authenticate and sync user with PostgreSQL database.", { cause: error });
  }
}

// 2. Job Openings Queries
export async function getJobsByUser(ownerId: string) {
  try {
    return await db.select().from(jobs).where(eq(jobs.ownerId, ownerId));
  } catch (error) {
    console.error("getJobsByUser database error:", error);
    throw new Error("Unable to fetch jobs from PostgreSQL database.", { cause: error });
  }
}

export async function createJob(id: string, title: string, requirements: string, description: string, ownerId: string) {
  try {
    const result = await db.insert(jobs)
      .values({
        id,
        title,
        requirements,
        description,
        ownerId,
      })
      .returning();
    return result[0];
  } catch (error) {
    console.error("createJob database error:", error);
    throw new Error("Unable to create job record in PostgreSQL database.", { cause: error });
  }
}

// 3. Candidates Screening scorecards
export async function getCandidatesByJob(jobId: string, ownerId: string) {
  try {
    return await db.select()
      .from(candidates)
      .where(and(eq(candidates.jobId, jobId), eq(candidates.ownerId, ownerId)));
  } catch (error) {
    console.error("getCandidatesByJob database error:", error);
    throw new Error("Unable to fetch job candidates from PostgreSQL database.", { cause: error });
  }
}

export async function createCandidate(data: {
  id: string;
  name: string;
  email: string;
  phone: string;
  skills: string[];
  yearsOfExperience: number;
  overallScore: number;
  matchAnalysis: string;
  experienceSummary: string;
  feedback: string;
  status: string;
  rating: number;
  jobId: string;
  ownerId: string;
}) {
  try {
    const result = await db.insert(candidates)
      .values({
        id: data.id,
        name: data.name,
        email: data.email,
        phone: data.phone,
        skills: data.skills,
        yearsOfExperience: data.yearsOfExperience,
        overallScore: data.overallScore,
        matchAnalysis: data.matchAnalysis,
        experienceSummary: data.experienceSummary,
        feedback: data.feedback,
        status: data.status,
        rating: data.rating,
        jobId: data.jobId,
        ownerId: data.ownerId,
      })
      .returning();
    return result[0];
  } catch (error) {
    console.error("createCandidate database error:", error);
    throw new Error("Unable to write candidate evaluation to PostgreSQL database.", { cause: error });
  }
}

export async function updateCandidateStatus(candId: string, status: string, ownerId: string) {
  try {
    const result = await db.update(candidates)
      .set({ status, updatedAt: new Date() })
      .where(and(eq(candidates.id, candId), eq(candidates.ownerId, ownerId)))
      .returning();
    return result[0];
  } catch (error) {
    console.error("updateCandidateStatus database error:", error);
    throw new Error("Unable to update candidate status in PostgreSQL database.", { cause: error });
  }
}

export async function updateCandidateRating(candId: string, rating: number, ownerId: string) {
  try {
    const result = await db.update(candidates)
      .set({ rating, updatedAt: new Date() })
      .where(and(eq(candidates.id, candId), eq(candidates.ownerId, ownerId)))
      .returning();
    return result[0];
  } catch (error) {
    console.error("updateCandidateRating database error:", error);
    throw new Error("Unable to update candidate rating in PostgreSQL database.", { cause: error });
  }
}
