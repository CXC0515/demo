/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type StudentStatus = 'good' | 'warning' | 'risk' | 'outstanding';

export interface ParentInfo {
  name: string;
  phone: string;
  relation: string;
  remark: string;
}

export interface TeacherObservation {
  date: string;
  type: 'positive' | 'neutral' | 'negative';
  content: string;
  category?: 'study' | 'behavior' | 'emotion' | 'attendance';
  author?: string;
}

export interface HomeworkRecord {
  id: string;
  title: string;
  date: string;
  score: number;
  fullScore: number;
  status: 'submitted' | 'late' | 'missing';
  knowledgeErrors: {
    questionId: string;
    questionTitle: string;
    points: string[];
    errorType: string;
    status: 'fixed' | 'pending' | 'warning';
  }[];
}

export interface Student {
  id: string;
  name: string;
  studentNo: string;
  classId: string;
  className: string;
  gender: 'male' | 'female';
  isRepresentative: boolean;
  status: StudentStatus;
  behaviorTags: string[];
  parent: ParentInfo;
  familyStatus: 'normal' | 'attention' | 'special';
  familyStatusTag?: string; // e.g. "留守儿童", "单亲家庭"
  observationHistory: TeacherObservation[];
  strongKnowledge: string[];
  weakKnowledge: string[];
  recentHomeworkTrend: number[]; // Last 5 homework scores (out of 100)
  homeworkHistory: HomeworkRecord[];
}

export interface SchoolClass {
  id: string;
  name: string;
  grade: string;
  term: string;
  headTeacher: string;
  chineseTeacher: string;
  textbookVersion: string;
  studentCount: number;
  representatives: string[]; // Student IDs
  defaultSubmitTime: string; // e.g., "08:00"
  status: 'active' | 'archived';
}

export interface WorkbenchTask {
  id: string;
  name: string;
  classId: string;
  className: string;
  node: 'upload' | 'ocr' | 'grading' | 'verify' | 'report' | 'sync';
  nodeName: string;
  deadline: string;
  status: 'pending' | 'running' | 'completed' | 'error';
  progress?: number;
}

export interface ScheduleItem {
  id: string;
  day: number; // 1-5
  period: number; // 1-8
  title: string;
  classId: string;
  className: string;
  type: 'class' | 'meeting' | 'research' | 'reminder' | 'parent-comm' | 'grading';
  time: string;
}

export interface TimerReminder {
  id: string;
  name: string;
  classId: string;
  className: string;
  time: string;
  repeatRule: string;
  status: 'active' | 'inactive';
}

export interface WorkflowState {
  currentStep: number; // 1-10
  taskName: string;
  classId: string;
  deadline: string;
  relatedText: string;
  homeworkType: 'reading' | 'writing' | 'dictation' | 'comprehensive';
  questions: {
    id: string;
    title: string;
    score: number;
    knowledgePoint: string;
    desc: string;
  }[];
  standardAnswer: string;
  gradingRubric: {
    point: string;
    score: number;
    description: string;
  }[];
  uploadProgress: number;
  isUploading: boolean;
  uploadedCount: number;
  ocrResults: {
    studentName: string;
    rawImage: string;
    ocrText: string;
    matchScore: number;
  }[];
  aiResults: {
    studentId: string;
    studentName: string;
    score: number;
    hitPoints: string[];
    deductions: { point: string; score: number; reason: string }[];
    errorType: string;
    confidence: number;
  }[];
}

export interface ReviewItem {
  id: string;
  studentId: string;
  studentName: string;
  taskName: string;
  className: string;
  type: 'low-confidence' | 'large-gap' | 'conflict' | 'pending-confirm';
  typeName: string;
  priority: 'high' | 'medium' | 'low';
  studentAnswer: string;
  standardAnswer: string;
  rubric: string;
  aiSuggestedScore: number;
  teacherFinalScore: number;
  differenceReason: string;
  evidenceText: string;
  status: 'pending' | 'completed';
}

export interface KnowledgeNode {
  id: string;
  name: string;
  type: 'book' | 'unit' | 'lesson' | 'question' | 'knowledge' | 'capability' | 'error';
  typeName: string;
  desc: string;
  weight: number; // 1-5
  parentId?: string;
}

export type MorandiTheme = 'morandi-green' | 'fog-blue' | 'dusty-pink' | 'warm-gray' | 'dark-graphite';
