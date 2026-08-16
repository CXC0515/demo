import {
  KnowledgeEntityType,
  KnowledgeRelationType,
  ResourceKind,
  ResourceStatus,
} from "../../domain/types";

export const entityLabels: Record<KnowledgeEntityType, string> = {
  knowledge: "知识点",
  "question-type": "题型",
  method: "解法",
  example: "例题",
  ability: "能力点",
  error: "错误类型",
};

export const entityTones: Record<KnowledgeEntityType, string> = {
  knowledge:
    "bg-violet-100 text-violet-800 border-violet-200 dark:bg-violet-900/30 dark:text-violet-200",
  "question-type":
    "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/30 dark:text-blue-200",
  method:
    "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-200",
  example:
    "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/30 dark:text-amber-200",
  ability:
    "bg-cyan-100 text-cyan-800 border-cyan-200 dark:bg-cyan-900/30 dark:text-cyan-200",
  error:
    "bg-rose-100 text-rose-800 border-rose-200 dark:bg-rose-900/30 dark:text-rose-200",
};

export const relationLabels: Record<KnowledgeRelationType, string> = {
  parent: "属于",
  prerequisite: "先修",
  related: "相关",
  confusable: "易混淆",
  examines: "考查",
  "applies-to": "适用于",
  demonstrates: "示范",
  explains: "讲解",
};

export const resourceKindLabels: Record<ResourceKind, string> = {
  textbook: "课本",
  supplement: "教辅",
  worksheet: "试卷 / 题目",
  "lesson-plan": "参考教案",
  "ppt-template": "PPT 模板",
  notice: "职业资料",
  other: "其他",
};

export const resourceStatusLabels: Record<ResourceStatus, string> = {
  uploaded: "待解析",
  processing: "解析中",
  ready: "可使用",
  "needs-review": "需复核",
  failed: "解析失败",
};

export const resourceStatusTones: Record<ResourceStatus, string> = {
  uploaded: "bg-slate-100 text-slate-600",
  processing: "bg-blue-100 text-blue-700",
  ready: "bg-emerald-100 text-emerald-700",
  "needs-review": "bg-amber-100 text-amber-700",
  failed: "bg-rose-100 text-rose-700",
};
