import { pgTable, serial, text, timestamp, integer, real } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// 1. Users Table
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  uid: text("uid").notNull().unique(), // Firebase Auth UID
  email: text("email").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// 2. Jobs Table (Store Job Openings)
export const jobs = pgTable("jobs", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  requirements: text("requirements").notNull(),
  description: text("description").notNull(),
  ownerId: text("owner_id").notNull(), // Links to users.uid
  createdAt: timestamp("created_at").defaultNow(),
});

// 3. Candidates Table (Store Resume screening results)
export const candidates = pgTable("candidates", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull(),
  phone: text("phone").notNull(),
  skills: text("skills").array(), // String array for skill tags
  yearsOfExperience: real("years_of_experience").notNull(),
  overallScore: integer("overall_score").notNull(),
  matchAnalysis: text("match_analysis").notNull(),
  experienceSummary: text("experience_summary").notNull(),
  feedback: text("feedback").notNull(),
  status: text("status").notNull(), // Screened, Contacted, Interviewed, Offered, Rejected
  rating: integer("rating").notNull().default(3),
  jobId: text("job_id").references(() => jobs.id).notNull(),
  ownerId: text("owner_id").notNull(), // Links to users.uid
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// 4. Declare Relations
export const usersRelations = relations(users, ({ many }) => ({
  jobs: many(jobs),
  candidates: many(candidates),
}));

export const jobsRelations = relations(jobs, ({ one, many }) => ({
  owner: one(users, {
    fields: [jobs.ownerId],
    references: [users.uid],
  }),
  candidates: many(candidates),
}));

export const candidatesRelations = relations(candidates, ({ one }) => ({
  job: one(jobs, {
    fields: [candidates.jobId],
    references: [jobs.id],
  }),
  owner: one(users, {
    fields: [candidates.ownerId],
    references: [users.uid],
  }),
}));
