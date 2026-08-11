/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type StudentStatus = 'good' | 'warning' | 'risk' | 'outstanding';
export type EnrollmentStatus = 'active' | 'transferred' | 'withdrawn' | 'suspended';

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
  weaknessEvidence?: WeaknessEvidence[];
}

export interface ClassMembership {
  id: string;
  classId: string;
  studentId: string;
  studentNo: string;
  isRepresentative: boolean;
  status: EnrollmentStatus;
  joinedAt: string;
  leftAt?: string;
}

export interface RosterStudent extends Student {
  studentId: string;
  enrollmentStatus: EnrollmentStatus;
}

export interface RosterSnapshot {
  classes: SchoolClass[];
  students: RosterStudent[];
}

export interface ClassroomSeatAssignment {
  seatIndex: number;
  studentId: string;
}

export interface ClassroomLayout {
  classId: string;
  rowCount: number;
  columnCount: number;
  seats: ClassroomSeatAssignment[];
  updatedAt?: string;
}

export interface SubmissionRosterMatch {
  matched: RosterStudent[];
  missing: RosterStudent[];
  unknownStudentNos: string[];
  duplicateStudentNos: string[];
}

export interface WeaknessEvidence {
  id: string;
  knowledgePoint: string;
  issue: string;
  taskName: string;
  questionTitle: string;
  date: string;
  occurrenceCount: number;
  status: 'current' | 'sustained';
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
  node: 'setup' | 'collection' | 'upload' | 'ocr' | 'grading' | 'verify' | 'report' | 'sync';
  nodeName: string;
  deadline: string;
  createdAt: string;
  collectionDeadlineAt: string;
  status: 'pending' | 'running' | 'completed' | 'error';
  progress?: number;
}

export type GradingMode = 'per-submission' | 'batch-checkpoint' | 'auto-continue';
export type CalibrationResultSource = 'ai-confirmed' | 'teacher-adjusted' | 'teacher-manual';

export interface SubmissionPage {
  id: string;
  sequence: number;
  studentId?: string;
  expectedStudentName: string;
  detectedStudentNo: string;
  pageCount: number;
  ocrConfidence: number;
  studentNoConfidence?: number;
  textConfidence?: number;
  regionCompleteness?: number;
  pageContinuity?: number;
  reviewSource?: 'automatic' | 'multimodal' | 'teacher';
  issueReason?: string;
  rosterMatchStatus?: 'pending' | 'matched' | 'unknown-student-no' | 'duplicate-student-no' | 'unreadable-student-no' | 'ambiguous-student-name';
  rosterIssueReason?: string;
  status: 'matched' | 'needs-review' | 'missing-page';
}

export interface CalibrationSample {
  id: string;
  questionId?: string;
  studentId: string;
  studentName: string;
  studentNo: string;
  sampleType: 'high' | 'middle' | 'low' | 'boundary' | 'ocr-risk';
  rawImageDescription: string;
  rawOcrText?: string;
  teacherCorrectedText?: string;
  lunaReviewText?: string;
  recognitionConflict?: boolean;
  ocrSource?: 'paddle' | 'luna' | 'choice-vision';
  ocrText: string;
  ocrConfidence: number;
  aiScore: number | null;
  fullScore: number;
  gradingConfidence: number;
  needsTeacherReview?: boolean;
  matchedPoints: string[];
  missedPoints: string[];
  gradingReason?: string;
  sourceAssetId?: string;
  sourceFileName?: string;
  sourcePreviewUrl?: string;
  sourcePreviewType?: 'image' | 'document';
  status: 'pending' | 'confirmed';
  resultSource?: CalibrationResultSource;
  teacherScore?: number;
  teacherReason?: string;
  isFinal?: boolean;
  rubricVersion: number;
}

export interface TrialGradingQuestionInput {
  questionId: string;
  displayNo: string;
  stem: string;
  fullScore: number;
  standardAnswer: string;
  rubricPoints: GradingRubricPoint[];
  teacherRules: string[];
  rubricVersion: number;
}

export interface TrialGradingSubmissionInput {
  assetId: string;
  studentId: string;
  studentName: string;
  studentNo: string;
}

export interface TrialGradingResult {
  taskId: string;
  model: string;
  samples: CalibrationSample[];
  createdAt: string;
}

export interface VisionValidationItem {
  pipelineVersion?: number;
  displayNo: string;
  region: { x: number; y: number; width: number; height: number; pageNumber: number };
  locatorSource: 'paddle-layout' | 'inferred-gap' | 'vision-layout';
  locationStatus: 'located' | 'needs-visual' | 'needs-teacher';
  locationReasons: string[];
  cropUrl: string;
  evidenceUnits?: VisionEvidenceUnit[];
  paddleText: string;
  lunaText: string;
  answerFields?: VisionAnswerField[];
  crossedOutText: string[];
  selectedOption: string | null;
  visualEvidence: string;
  existingMarkings: string[];
  confidence: number;
  needsReview: boolean;
}

export type VisionEvidenceKind = 'text' | 'choice' | 'formula' | 'diagram' | 'table' | 'mixed';

export interface VisionEvidenceUnit {
  evidenceId: string;
  kind: VisionEvidenceKind;
  region: { x: number; y: number; width: number; height: number; pageNumber: number };
  cropUrl: string;
  provisionalText: string;
  literalText: string;
  confidence: number;
  needsReview: boolean;
  reviewReasons: string[];
}

export interface VisionAnswerField {
  fieldId: string;
  label: string;
  text: string;
  crossedOutText: string[];
  confidence: number;
  needsReview: boolean;
}

export interface TaskQuestionRubric {
  taskId: string;
  questionId: string;
  standardAnswer: string;
  gradingRubric: GradingRubricPoint[];
  teacherRules: string[];
  rubricVersion: number;
  updatedAt: string;
}

export interface VisionValidationResult {
  taskId: string;
  assetId: string;
  model: string;
  items: VisionValidationItem[];
  createdAt: string;
}

export interface GradingRubricPoint {
  point: string;
  score: number;
  description: string;
}

export interface QuestionGradingState {
  questionId: string;
  standardAnswer: string;
  standardAnswerOcrText?: string;
  standardAnswerSourceIds?: string[];
  gradingRubric: GradingRubricPoint[];
  teacherRules: string[];
  rubricVersion: number;
  sampleTarget: 3 | 5;
  calibrationSamples: CalibrationSample[];
  jointReviewEnabled: boolean;
}

export interface MissingSubmission {
  studentId: string;
  studentName: string;
  studentNo: string;
  status: 'missing' | 'excused' | 'late';
}

export interface AiReviewOpinion {
  reviewer: string;
  score: number;
  confidence: number;
  reason: string;
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

export interface DocumentAsset {
  id: string;
  taskId: string;
  kind: 'assignment' | 'reference-answer' | 'student-submission';
  fileName: string;
  mimeType: string;
  pageCount?: number;
  publicUrl?: string;
  status: 'uploaded' | 'processing' | 'ready' | 'needs-review' | 'failed';
  parseErrorCode?: string;
}

export type MaterialSourceFormat = 'docx' | 'pdf' | 'image' | 'text';

export interface NormalizedDocumentBlock {
  id: string;
  order: number;
  type: 'heading' | 'paragraph' | 'list-item' | 'table' | 'image' | 'formula' | 'page';
  text: string;
  markdown?: string;
  listLabel?: string;
  level?: number;
  pageNumber?: number;
  confidence?: number;
  boundingBox?: { x: number; y: number; width: number; height: number };
}

export interface NormalizedDocumentResource {
  id: string;
  fileName: string;
  mimeType: string;
  publicUrl: string;
  role?: 'content' | 'layout-visualization' | 'source-page';
  pageNumber?: number;
}

export interface MaterialParseWarning {
  code: string;
  message: string;
  blockId?: string;
}

export interface NormalizedDocument {
  assetId: string;
  sourceFormat: MaterialSourceFormat;
  markdown: string;
  sourceMarkdown?: string;
  sourcePreviewUrl?: string;
  blocks: NormalizedDocumentBlock[];
  resources: NormalizedDocumentResource[];
  warnings: MaterialParseWarning[];
  pageCount?: number;
  parsedAt: string;
}

export interface AnalysisEvidenceRef {
  assetKind: 'assignment' | 'reference-answer';
  assetId: string;
  fileName: string;
  blockIds: string[];
  quote: string;
  evidenceMode?: 'native-text' | 'source-crop';
  pageNumber?: number;
  boundingBox?: { x: number; y: number; width: number; height: number };
  imageUrl?: string;
  sourcePageUrl?: string;
  locatorStatus?: 'located' | 'needs-visual' | 'needs-teacher';
  locatorReasons?: string[];
}

export interface AnalyzedQuestionUnit {
  displayNo: string;
  title: string;
  stem: string;
  score: number | null;
  questionType: string;
  answerRequirement: string;
  standardAnswer: string;
  explanation: string;
  rubricPoints: { point: string; score: number | null; description: string }[];
  knowledgeCandidates: { nodeId: string; nodeName: string; confidence: number }[];
  questionSource: AnalysisEvidenceRef;
  answerSource: AnalysisEvidenceRef | null;
  confidence: number;
  reviewReasons: string[];
}

export interface AnalyzedQuestion extends AnalyzedQuestionUnit {
  subquestions: AnalyzedQuestionUnit[];
}

export interface FirstSectionAnalysis {
  taskId: string;
  scope: string;
  status: 'needs-review' | 'confirmed';
  model: string;
  materialAssetIds: string[];
  questions: AnalyzedQuestion[];
  createdAt: string;
}

export interface SourceEvidence {
  id: string;
  assetId: string;
  assetKind: DocumentAsset['kind'];
  fileName: string;
  pageNumber: number;
  boundingBox: { x: number; y: number; width: number; height: number };
  ocrText: string;
  confidence: number;
  imageUrl?: string;
  sourcePageUrl?: string;
  evidenceMode?: 'native-text' | 'source-crop';
  locatorStatus?: 'located' | 'needs-visual' | 'needs-teacher';
  locatorReasons?: string[];
  isMock?: boolean;
}

export interface KnowledgeLink {
  nodeId: string;
  nodeName: string;
  confidence: number;
  status: 'suggested' | 'confirmed';
}

export interface GradingQuestion {
  id: string;
  displayNo: string;
  parentId?: string;
  title: string;
  score: number;
  knowledgePoint: string;
  knowledgeLinks: KnowledgeLink[];
  desc: string;
  stem?: string;
  aiQuestionType?: string;
  answerRequirement?: string;
  parseConfidence: number;
  sourceEvidenceIds: string[];
}

export interface WorkflowState {
  currentStep: number; // 1-10
  taskName: string;
  classId: string;
  deadline: string;
  relatedText: string;
  homeworkType: 'reading' | 'writing' | 'dictation' | 'comprehensive';
  assignment: {
    status: 'draft' | 'assigned';
    analysisStatus: 'idle' | 'uploading' | 'parsing' | 'needs-review' | 'ready' | 'failed';
    questionFileNames: string[];
    answerFileNames: string[];
    note: string;
    assets: DocumentAsset[];
    documents?: NormalizedDocument[];
    firstSectionAnalysis?: FirstSectionAnalysis;
  };
  questions: GradingQuestion[];
  sourceEvidence: SourceEvidence[];
  standardAnswer: string;
  gradingRubric: GradingRubricPoint[];
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
  rubricVersion?: number;
  gradingMode?: GradingMode;
  teacherRules?: string[];
  submissionPages?: SubmissionPage[];
  calibrationSamples?: CalibrationSample[];
  jointReviewQuestionIds?: string[];
  questionGradingStates?: QuestionGradingState[];
  missingSubmissions?: MissingSubmission[];
}

export interface ReviewItem {
  id: string;
  taskId?: string;
  questionId?: string;
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
  questionTitle?: string;
  ocrConfidence?: number;
  gradingConfidence?: number;
  rawImageDescription?: string;
  aiReviews?: AiReviewOpinion[];
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
