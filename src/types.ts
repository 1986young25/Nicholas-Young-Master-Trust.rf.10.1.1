export interface JobDescription {
  id: string;
  title: string;
  description: string;
  requirements: string;
  createdAt: any;
  ownerId: string;
}

export interface CandidateEvaluation {
  id: string;
  name: string;
  email: string;
  phone: string;
  skills: string[];
  yearsOfExperience: number;
  overallScore: number;
  matchAnalysis: string;
  experienceSummary: string;
  status: 'Screened' | 'Shortlisted' | 'Interviewing' | 'Offered' | 'Rejected' | 'Draft';
  rating?: number; // 1 to 5 stars
  feedback?: string;
  driveFileId?: string;
  jobId: string;
  ownerId: string;
  createdAt: any;
  updatedAt: any;
}

export interface ChatMessage {
  role: 'user' | 'model';
  content: string;
  timestamp: number;
}

export interface CandidateChat {
  id: string;
  candidateId: string;
  messages: ChatMessage[];
  ownerId: string;
  createdAt: any;
}
