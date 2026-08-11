/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { CalibrationSample, Student, SchoolClass, WorkbenchTask, ScheduleItem, TimerReminder, ReviewItem, KnowledgeNode, WorkflowState } from './types';

export const initialClasses: SchoolClass[] = [
  {
    id: 'c1',
    name: '七年级 3 班',
    grade: '七年级',
    term: '2026 春季学期',
    headTeacher: '刘老师',
    chineseTeacher: '王老师',
    textbookVersion: '统编版七年级下册',
    studentCount: 42,
    representatives: ['s1', 's4'], // 林子涵, 许佳琪
    defaultSubmitTime: '08:00',
    status: 'active'
  },
  {
    id: 'c2',
    name: '七年级 4 班',
    grade: '七年级',
    term: '2026 春季学期',
    headTeacher: '陈老师',
    chineseTeacher: '王老师',
    textbookVersion: '统编版七年级下册',
    studentCount: 40,
    representatives: ['s10'],
    defaultSubmitTime: '08:00',
    status: 'active'
  },
  {
    id: 'c3',
    name: '八年级 1 班',
    grade: '八年级',
    term: '2025 秋季学期',
    headTeacher: '张老师',
    chineseTeacher: '王老师',
    textbookVersion: '统编版八年级上册',
    studentCount: 45,
    representatives: [],
    defaultSubmitTime: '08:30',
    status: 'archived'
  }
];

export const initialStudents: Student[] = [
  {
    id: 's1',
    name: '林子涵',
    studentNo: '2026070301',
    classId: 'c1',
    className: '七年级 3 班',
    gender: 'female',
    isRepresentative: true,
    status: 'good',
    behaviorTags: ['积极发言', '作文优秀', '课堂专注', '书写工整'],
    parent: {
      name: '林国强',
      phone: '13812345678',
      relation: '父亲',
      remark: '家长十分配合教学，对孩子期望较高。'
    },
    familyStatus: 'normal',
    observationHistory: [
      { date: '2026-06-15', type: 'positive', content: '古诗词朗诵比赛获得一等奖，表现非常大方自信。' },
      { date: '2026-06-28', type: 'positive', content: '主动帮助语文薄弱同学，讲解字词理解。' }
    ],
    strongKnowledge: ['结构分析', '主旨理解', '修辞手法鉴赏'],
    weakKnowledge: ['文言文虚词', '新闻拟标题'],
    recentHomeworkTrend: [95, 98, 92, 96, 100],
    homeworkHistory: [
      {
        id: 'h1',
        title: '《驿路梨花》课后阅读练习',
        date: '2026-06-25',
        score: 96,
        fullScore: 100,
        status: 'submitted',
        knowledgeErrors: []
      },
      {
        id: 'h2',
        title: '第四单元文言文虚词填空',
        date: '2026-06-20',
        score: 92,
        fullScore: 100,
        status: 'submitted',
        knowledgeErrors: [
          {
            questionId: 'q2',
            questionTitle: '之、而、其等虚词辨析',
            points: ['文言文虚词'],
            errorType: '知识点混淆',
            status: 'fixed'
          }
        ]
      }
    ]
  },
  {
    id: 's2',
    name: '张雨轩',
    studentNo: '2026070302',
    classId: 'c1',
    className: '七年级 3 班',
    gender: 'male',
    isRepresentative: false,
    status: 'warning',
    behaviorTags: ['课下贪玩', '书写潦草', '阅读偏科'],
    parent: {
      name: '张华',
      phone: '13598765432',
      relation: '母亲',
      remark: '家长工作较忙，平时祖父母带，缺乏细致辅导。'
    },
    familyStatus: 'attention',
    familyStatusTag: '双职工家庭/隔代教养',
    observationHistory: [
      { date: '2026-06-12', type: 'neutral', content: '课堂上有开小差行为，经提醒后有所收敛。' },
      { date: '2026-06-24', type: 'negative', content: '听写不合格，回家后未完成家长签字任务。' }
    ],
    strongKnowledge: ['现代文叙事概括'],
    weakKnowledge: ['标题作用题', '字词默写', '结构分析'],
    recentHomeworkTrend: [80, 75, 82, 68, 72],
    homeworkHistory: [
      {
        id: 'h1',
        title: '《驿路梨花》课后阅读练习',
        date: '2026-06-25',
        score: 72,
        fullScore: 100,
        status: 'submitted',
        knowledgeErrors: [
          {
            questionId: 'q3',
            questionTitle: '《驿路梨花》标题的多重含义',
            points: ['标题作用题', '主旨理解'],
            errorType: '漏答要点',
            status: 'pending'
          }
        ]
      },
      {
        id: 'h2',
        title: '第四单元字词拼音与书写',
        date: '2026-06-18',
        score: 68,
        fullScore: 100,
        status: 'submitted',
        knowledgeErrors: [
          {
            questionId: 'q1',
            questionTitle: '重点词语看拼音写汉字',
            points: ['字词默写'],
            errorType: '笔画错误',
            status: 'warning'
          }
        ]
      }
    ]
  },
  {
    id: 's3',
    name: '陈梓睿',
    studentNo: '2026070303',
    classId: 'c1',
    className: '七年级 3 班',
    gender: 'male',
    isRepresentative: false,
    status: 'risk',
    behaviorTags: ['频繁迟交', '课堂神游', '情绪波动'],
    parent: {
      name: '陈建国',
      phone: '13045678901',
      relation: '爷爷',
      remark: '孩子父母常年在广东务工，属于典型留守儿童，心理较敏感。'
    },
    familyStatus: 'special',
    familyStatusTag: '留守儿童',
    observationHistory: [
      { date: '2026-06-10', type: 'negative', content: '语文课上伏案睡觉，精神不振，下课后谈心表现内向。' },
      { date: '2026-06-22', type: 'negative', content: '作业连续三次未带，声称遗失或忘在家里。' }
    ],
    strongKnowledge: ['想象作文'],
    weakKnowledge: ['阅读要点漏答', '议论文论据', '字词默写'],
    recentHomeworkTrend: [65, 58, 62, 45, 50],
    homeworkHistory: [
      {
        id: 'h1',
        title: '《驿路梨花》课后阅读练习',
        date: '2026-06-25',
        score: 50,
        fullScore: 100,
        status: 'submitted',
        knowledgeErrors: [
          {
            questionId: 'q3',
            questionTitle: '《驿路梨花》标题的多重含义',
            points: ['标题作用题', '主旨理解'],
            errorType: '漏答要点',
            status: 'warning'
          },
          {
            questionId: 'q4',
            questionTitle: '文中三处梨花的象征手法',
            points: ['修辞手法鉴赏'],
            errorType: '没有结合文本',
            status: 'pending'
          }
        ]
      },
      {
        id: 'h2',
        title: '第四单元字词拼音与书写',
        date: '2026-06-18',
        score: 45,
        fullScore: 100,
        status: 'submitted',
        knowledgeErrors: [
          {
            questionId: 'q1',
            questionTitle: '字形纠错与填空',
            points: ['字词默写'],
            errorType: '错别字频发',
            status: 'warning'
          }
        ]
      }
    ]
  },
  {
    id: 's4',
    name: '许佳琪',
    studentNo: '2026070304',
    classId: 'c1',
    className: '七年级 3 班',
    gender: 'female',
    isRepresentative: true,
    status: 'outstanding',
    behaviorTags: ['管理能力强', '朗读流利', '思维活跃', '作文之星'],
    parent: {
      name: '许安平',
      phone: '13912349876',
      relation: '父亲',
      remark: '公务员家庭，阅读量极大，自律性很强。'
    },
    familyStatus: 'normal',
    observationHistory: [
      { date: '2026-06-18', type: 'positive', content: '作为语文课代表，收发作业极其准时，帮老师整理了考勤。' },
      { date: '2026-06-29', type: 'positive', content: '期末作文习作被复印作为班级范文，构思精巧。' }
    ],
    strongKnowledge: ['主旨理解', '散文阅读', '古诗鉴赏', '修辞手法鉴赏'],
    weakKnowledge: ['文言文虚词'],
    recentHomeworkTrend: [98, 96, 100, 99, 98],
    homeworkHistory: [
      {
        id: 'h1',
        title: '《驿路梨花》课后阅读练习',
        date: '2026-06-25',
        score: 98,
        fullScore: 100,
        status: 'submitted',
        knowledgeErrors: []
      }
    ]
  },
  {
    id: 's5',
    name: '周宇洋',
    studentNo: '2026070305',
    classId: 'c1',
    className: '七年级 3 班',
    gender: 'male',
    isRepresentative: false,
    status: 'good',
    behaviorTags: ['踏实勤奋', '理科强文科弱', '不善表达'],
    parent: {
      name: '周德发',
      phone: '13745671234',
      relation: '父亲',
      remark: '希望老师多提问他，锻炼表达能力。'
    },
    familyStatus: 'normal',
    observationHistory: [
      { date: '2026-06-14', type: 'positive', content: '听写全对，平时虽然默默无闻，但背诵非常踏实。' }
    ],
    strongKnowledge: ['说明文阅读', '字词默写'],
    weakKnowledge: ['修辞手法鉴赏', '主旨理解'],
    recentHomeworkTrend: [85, 88, 86, 90, 84],
    homeworkHistory: [
      {
        id: 'h1',
        title: '《驿路梨花》课后阅读练习',
        date: '2026-06-25',
        score: 84,
        fullScore: 100,
        status: 'submitted',
        knowledgeErrors: [
          {
            questionId: 'q4',
            questionTitle: '文中三处梨花的象征手法',
            points: ['修辞手法鉴赏'],
            errorType: '理解浅层',
            status: 'fixed'
          }
        ]
      }
    ]
  },
  {
    id: 's6',
    name: '黄思语',
    studentNo: '2026070306',
    classId: 'c1',
    className: '七年级 3 班',
    gender: 'female',
    isRepresentative: false,
    status: 'good',
    behaviorTags: ['笔记工整', '温和内敛', '成绩稳定'],
    parent: {
      name: '李美凤',
      phone: '18822334455',
      relation: '母亲',
      remark: '关注孩子心理压力，希望以鼓励为主。'
    },
    familyStatus: 'normal',
    observationHistory: [
      { date: '2026-06-19', type: 'positive', content: '读书笔记做得非常漂亮，作为典范在班级展示。' }
    ],
    strongKnowledge: ['结构分析', '字词默写'],
    weakKnowledge: ['散文阅读'],
    recentHomeworkTrend: [90, 92, 88, 91, 89],
    homeworkHistory: [
      {
        id: 'h1',
        title: '《驿路梨花》课后阅读练习',
        date: '2026-06-25',
        score: 89,
        fullScore: 100,
        status: 'submitted',
        knowledgeErrors: []
      }
    ]
  },
  {
    id: 's7',
    name: '徐昊然',
    studentNo: '2026070307',
    classId: 'c1',
    className: '七年级 3 班',
    gender: 'male',
    isRepresentative: false,
    status: 'warning',
    behaviorTags: ['爱接老师话茬', '思维敏捷', '粗心大意'],
    parent: {
      name: '徐明',
      phone: '13366778899',
      relation: '父亲',
      remark: '有些淘气，脾气直率，请老师严格管教。'
    },
    familyStatus: 'normal',
    observationHistory: [
      { date: '2026-06-13', type: 'neutral', content: '上课爱插嘴，虽然反应快但影响班级纪律，谈话纠正。' }
    ],
    strongKnowledge: ['新闻拟标题', '现代文叙事概括'],
    weakKnowledge: ['古诗鉴赏', '字词默写'],
    recentHomeworkTrend: [78, 85, 72, 80, 75],
    homeworkHistory: [
      {
        id: 'h1',
        title: '《驿路梨花》课后阅读练习',
        date: '2026-06-25',
        score: 75,
        fullScore: 100,
        status: 'submitted',
        knowledgeErrors: [
          {
            questionId: 'q1',
            questionTitle: '拼音与写字',
            points: ['字词默写'],
            errorType: '看错题目要求',
            status: 'fixed'
          }
        ]
      }
    ]
  },
  {
    id: 's8',
    name: '赵妙心',
    studentNo: '2026070308',
    classId: 'c1',
    className: '七年级 3 班',
    gender: 'female',
    isRepresentative: false,
    status: 'good',
    behaviorTags: ['画画好', '喜欢看历史书', '课堂发言少'],
    parent: {
      name: '赵国梁',
      phone: '13111223344',
      relation: '父亲',
      remark: '支持孩子美术特长，希望语文老师引导其阅读古典文学。'
    },
    familyStatus: 'normal',
    observationHistory: [],
    strongKnowledge: ['古诗鉴赏', '主旨理解'],
    weakKnowledge: ['结构分析'],
    recentHomeworkTrend: [86, 88, 90, 85, 87],
    homeworkHistory: [
      {
        id: 'h1',
        title: '《驿路梨花》课后阅读练习',
        date: '2026-06-25',
        score: 87,
        fullScore: 100,
        status: 'submitted',
        knowledgeErrors: []
      }
    ]
  },
  {
    id: 's10',
    name: '王晨阳',
    studentNo: '2026070401',
    classId: 'c2',
    className: '七年级 4 班',
    gender: 'male',
    isRepresentative: true,
    status: 'good',
    behaviorTags: ['做事认真', '体育课代表', '课堂发言踊跃'],
    parent: {
      name: '王树林',
      phone: '13244556677',
      relation: '父亲',
      remark: '孩子喜欢语文，多给他展现机会。'
    },
    familyStatus: 'normal',
    observationHistory: [],
    strongKnowledge: ['散文阅读', '修辞手法鉴赏'],
    weakKnowledge: ['字词默写'],
    recentHomeworkTrend: [88, 90, 85, 92, 88],
    homeworkHistory: []
  }
];

export const initialTasks: WorkbenchTask[] = [
  {
    id: 'task-20260810-1',
    name: '20260810_1',
    classId: 'c5',
    className: '七年级 5 班',
    node: 'collection',
    nodeName: '评分依据待确认',
    deadline: '今天 18:00',
    createdAt: '2026-08-10T10:00:00+08:00',
    collectionDeadlineAt: '2026-08-10T18:00:00+08:00',
    status: 'pending'
  },
  {
    id: 't1',
    name: '《驿路梨花》阅读理解检测',
    classId: 'c1',
    className: '七年级 3 班',
    node: 'verify',
    nodeName: '待人工复核',
    deadline: '今天 18:00',
    createdAt: '2026-08-07T09:00:00+08:00',
    collectionDeadlineAt: '2026-08-09T18:00:00+08:00',
    status: 'pending',
    progress: 85
  },
  {
    id: 't2',
    name: '第四单元字词听写与纠错',
    classId: 'c1',
    className: '七年级 3 班',
    node: 'upload',
    nodeName: '待上传作业',
    deadline: '明天 12:00',
    createdAt: '2026-08-06T16:20:00+08:00',
    collectionDeadlineAt: '2026-08-10T12:00:00+08:00',
    status: 'pending'
  },
  {
    id: 't3',
    name: '第七单元字词听写(测试)',
    classId: 'c2',
    className: '七年级 4 班',
    node: 'ocr',
    nodeName: '待识别校对',
    deadline: '今天 16:30',
    createdAt: '2026-08-05T14:00:00+08:00',
    collectionDeadlineAt: '2026-08-09T16:30:00+08:00',
    status: 'running',
    progress: 45
  },
  {
    id: 't4',
    name: '古诗文默写《陋室铭》',
    classId: 'c1',
    className: '七年级 3 班',
    node: 'report',
    nodeName: '待生成讲评',
    deadline: '2026-07-03',
    createdAt: '2026-07-01T10:00:00+08:00',
    collectionDeadlineAt: '2026-07-03T08:00:00+08:00',
    status: 'completed'
  },
  {
    id: 't5',
    name: '文言文实词与虚词专项训练',
    classId: 'c2',
    className: '七年级 4 班',
    node: 'grading',
    nodeName: '待 AI 评分',
    deadline: '今天 20:00',
    createdAt: '2026-08-08T11:00:00+08:00',
    collectionDeadlineAt: '2026-08-09T20:00:00+08:00',
    status: 'pending'
  }
];

export const initialSchedule: ScheduleItem[] = [
  { id: 'sch1', day: 1, period: 1, title: '初中语文 - 3班', classId: 'c1', className: '七年级 3 班', type: 'class', time: '08:00 - 08:45' },
  { id: 'sch2', day: 1, period: 2, title: '初中语文 - 4班', classId: 'c2', className: '七年级 4 班', type: 'class', time: '08:55 - 09:40' },
  { id: 'sch2b', day: 1, period: 7, title: '课后作业批改', classId: 'c1', className: '七年级 3 班', type: 'grading', time: '15:10 - 15:55' },
  { id: 'sch3', day: 2, period: 3, title: '语文教研会', classId: '', className: '全体教师', type: 'research', time: '10:00 - 11:30' },
  { id: 'sch4', day: 3, period: 1, title: '初中语文 - 3班', classId: 'c1', className: '七年级 3 班', type: 'class', time: '08:00 - 08:45' },
  { id: 'sch5', day: 3, period: 2, title: '初中语文 - 4班', classId: 'c2', className: '七年级 4 班', type: 'class', time: '08:55 - 09:40' },
  { id: 'sch6', day: 4, period: 4, title: '林子涵家长沟通', classId: 'c1', className: '七年级 3 班', type: 'parent-comm', time: '11:10 - 11:55' },
  { id: 'sch7', day: 5, period: 1, title: '初中语文 - 3班', classId: 'c1', className: '七年级 3 班', type: 'class', time: '08:00 - 08:45' },
  { id: 'sch8', day: 5, period: 2, title: '初中语文 - 4班', classId: 'c2', className: '七年级 4 班', type: 'class', time: '08:55 - 09:40' }
];

export const initialReminders: TimerReminder[] = [
  {
    id: 'r1',
    name: '周一早自习收取周末读书笔记',
    classId: 'c1',
    className: '七年级 3 班',
    time: '每周一 08:00',
    repeatRule: '每周一',
    status: 'active'
  },
  {
    id: 'r2',
    name: '周三 16:00 阅读随堂练收取',
    classId: 'c1',
    className: '七年级 3 班',
    time: '每周三 16:00',
    repeatRule: '每周三',
    status: 'active'
  },
  {
    id: 'r3',
    name: '期末古诗文默写考前巩固督促',
    classId: 'c2',
    className: '七年级 4 班',
    time: '2026-07-10 09:00',
    repeatRule: '一次性',
    status: 'active'
  }
];

export const initialReviewQueue: ReviewItem[] = [
  {
    id: 'rv1',
    taskId: 't1',
    questionId: 'q3',
    studentId: 's2',
    studentName: '张雨轩',
    taskName: '《驿路梨花》阅读理解检测',
    className: '七年级 3 班',
    type: 'low-confidence',
    typeName: '低置信度',
    priority: 'high',
    studentAnswer: '“驿路梨花”一方面是指那座被称为小驿站附近的梨花树。另一方面是指那个照顾驿站的小姑娘叫梨花，代表了雷锋精神在驿路上传递。',
    standardAnswer: '1. 实指驿路旁的梨花，交代故事发生的背景和环境。\n2. 虚指（象征）哈尼族小姑娘“梨花”以及以梨花为代表的淳朴热情的哈尼族人民。\n3. 象征具有雷锋精神、无私奉献的高尚品质，揭示了“雷锋精神处处开花”的主旨。',
    rubric: '答对一层得2分，答对两层得4分，答对三层得6分（满分6分）。必须要提到自然环境、小姑娘名字、以及无私奉献的雷锋精神。',
    aiSuggestedScore: 4,
    teacherFinalScore: 4,
    differenceReason: 'AI 标注“雷锋精神在驿路上传递”置信度为 0.71（低于 0.75 阈值）。',
    evidenceText: '“代表了雷锋精神在驿路上传递”',
    status: 'pending',
    questionTitle: '第 3 题：标题含义与作用',
    ocrConfidence: 0.82,
    gradingConfidence: 0.71,
    rawImageDescription: '答题区第 3 题，右上角学号 0302，末行有轻微涂改。'
  },
  {
    id: 'rv2',
    taskId: 't1',
    questionId: 'q3',
    studentId: 's3',
    studentName: '陈梓睿',
    taskName: '《驿路梨花》阅读理解检测',
    className: '七年级 3 班',
    type: 'large-gap',
    typeName: '分差过大',
    priority: 'high',
    studentAnswer: '就是梨花开在路边很好看，给人带来温暖和希望，象征好人好事。',
    standardAnswer: '同上（满分6分）',
    rubric: '同上。答出梨花自然景物得2分，答出雷锋精神象征得2分，陈梓睿的回答没有提到哈尼族小姑娘梨花。',
    aiSuggestedScore: 2,
    teacherFinalScore: 3,
    differenceReason: '大模型1给分2分，大模型2给分4分，分差超过设置的1分阈值。需人工裁决。',
    evidenceText: '“给人带来温暖和希望，象征好人好事”',
    status: 'pending',
    questionTitle: '第 3 题：标题含义与作用',
    ocrConfidence: 0.91,
    gradingConfidence: 0.58,
    rawImageDescription: '答题区第 3 题，右上角学号 0303，字迹清晰。',
    aiReviews: [
      { reviewer: '证据核查 AI', score: 2, confidence: 0.82, reason: '只明确命中自然景物，象征表达过于宽泛。' },
      { reviewer: '整体理解 AI', score: 4, confidence: 0.76, reason: '“好人好事”可以视作对雷锋精神的概括。' },
      { reviewer: '严格评分 AI', score: 2, confidence: 0.88, reason: '缺少哈尼姑娘梨花和精神传承两个明确要点。' }
    ]
  },
  {
    id: 'rv3',
    taskId: 't1',
    questionId: 'q3',
    studentId: 's7',
    studentName: '徐昊然',
    taskName: '《驿路梨花》阅读理解检测',
    className: '七年级 3 班',
    type: 'conflict',
    typeName: 'AI 冲突',
    priority: 'medium',
    studentAnswer: '指路边的梨花和叫梨花的小姑娘。',
    standardAnswer: '同上（满分6分）',
    rubric: '写出自然界的梨花与哈尼族姑娘梨花，得4分。',
    aiSuggestedScore: 4,
    teacherFinalScore: 4,
    differenceReason: '多模型置信度发生实质冲突（模型A判断为主旨完整，模型B判断为缺少第三层象征）。',
    evidenceText: '“指路边的梨花和叫梨花的小姑娘”',
    status: 'pending',
    questionTitle: '第 3 题：标题含义与作用',
    ocrConfidence: 0.95,
    gradingConfidence: 0.63,
    rawImageDescription: '答题区第 3 题，右上角学号 0307，页面完整。',
    aiReviews: [
      { reviewer: '证据核查 AI', score: 4, confidence: 0.91, reason: '自然梨花和人物梨花两个要点均有证据。' },
      { reviewer: '整体理解 AI', score: 4, confidence: 0.86, reason: '完成双关层面，但没有上升到文章主旨。' },
      { reviewer: '严格评分 AI', score: 3, confidence: 0.78, reason: '人物层面没有说明其品质，表达不够完整。' }
    ]
  },
  {
    id: 'rv4',
    taskId: 't1',
    questionId: 'q3',
    studentId: 's5',
    studentName: '周宇洋',
    taskName: '《驿路梨花》阅读理解检测',
    className: '七年级 3 班',
    type: 'pending-confirm',
    typeName: '待主批确认',
    priority: 'low',
    studentAnswer: '是指自然界的梨花盛开；也指照顾驿站、无私奉献的哈尼族小姑娘梨花和雷锋精神。',
    standardAnswer: '同上（满分6分）',
    rubric: '三层要点齐全。',
    aiSuggestedScore: 6,
    teacherFinalScore: 6,
    differenceReason: '高分卷（满分卷）常规抽样审核。',
    evidenceText: '“自然界的梨花；照顾驿站的小姑娘；雷锋精神”',
    status: 'pending',
    questionTitle: '第 3 题：标题含义与作用',
    ocrConfidence: 0.98,
    gradingConfidence: 0.96,
    rawImageDescription: '答题区第 3 题，右上角学号 0305，字迹工整。'
  }
];

export const initialKnowledgeNodes: KnowledgeNode[] = [
  { id: 'n1', name: '统编版七年级下册', type: 'book', typeName: '课本', desc: '初中语文统编版七年级下册教材', weight: 1 },
  { id: 'n2', name: '第四单元', type: 'unit', typeName: '单元', desc: '第四单元：崇高品格与奉献精神', weight: 2, parentId: 'n1' },
  { id: 'n3', name: '《驿路梨花》', type: 'lesson', typeName: '课文', desc: '作者：彭荆风。通过在哀牢山深处寻找“梨花”主人的故事，展现雷锋精神。', weight: 3, parentId: 'n2' },
  { id: 'n4', name: '课后阅读主旨题', type: 'question', typeName: '题目', desc: '结合课文，谈谈“驿路梨花”标题的含义和作用。', weight: 4, parentId: 'n3' },
  { id: 'n5', name: '标题作用题', type: 'knowledge', typeName: '知识点', desc: '考察文章标题的语境义、象征义、双关义及结构和主旨上的作用。', weight: 5, parentId: 'n4' },
  { id: 'n6', name: '结构分析', type: 'capability', typeName: '能力点', desc: '分析标题在结构上贯穿全文、设置悬念、照应结尾的作用。', weight: 5, parentId: 'n5' },
  { id: 'n7', name: '主旨理解', type: 'capability', typeName: '能力点', desc: '理解标题在主旨上深化象征、暗示中心思想、点明主题的作用。', weight: 5, parentId: 'n5' },
  { id: 'n8', name: '漏答要点', type: 'error', typeName: '错误类型', desc: '学生回答中缺失对小姑娘梨花或自然景物、雷锋精神的其中一层，通常属于审题或整合不全。', weight: 4, parentId: 'n5' },
  { id: 'n9', name: '没有结合文本', type: 'error', typeName: '错误类型', desc: '回答空洞泛泛，没有结合哀牢山、哈尼族、雷锋精神具体细节，属于答题规范缺失。', weight: 4, parentId: 'n5' }
];

const calibrationStudents = [
  { id: 's1', name: '林子涵', no: '2026070301', type: 'high' as const, ocr: 0.98, grading: 0.97 },
  { id: 's2', name: '张雨轩', no: '2026070302', type: 'boundary' as const, ocr: 0.82, grading: 0.71 },
  { id: 's3', name: '陈梓睿', no: '2026070303', type: 'low' as const, ocr: 0.91, grading: 0.68 },
  { id: 's4', name: '许佳琪', no: '2026070304', type: 'ocr-risk' as const, ocr: 0.58, grading: 0.52 },
  { id: 's5', name: '周宇洋', no: '2026070305', type: 'middle' as const, ocr: 0.96, grading: 0.88 }
];

const sampleAnswers: Record<string, string[]> = {
  q1: ['陡峭、竹篾、简陋。', '陡峭、竹蔑、简陋。', '陡峭、简陋。', '陡峭、竹……', '陡峭、竹篾、简陋。'],
  q2: ['“我”和老余发现小茅屋，瑶族老人说明米的来历，哈尼小姑娘揭示建屋人。', '先发现小屋，再遇到老人，最后知道梨花姑娘照料小屋。', '大家在山里找到了一间小屋。', '发现小屋后遇到……', '发现、借宿、追问，最后揭开小屋主人的故事。'],
  q3: ['驿路梨花既指山路旁的梨花，也指哈尼姑娘梨花，更象征无私奉献的雷锋精神代代相传。', '驿路梨花是路边的梨花树，也是名字叫梨花的小女孩，代表了雷锋精神在驿路上传递。', '梨花开在路边很好看，象征大家做的好人好事。', '梨花既是景物又是姑娘的名字，还象征着人与人之间……', '标题指自然界的梨花，也指姑娘梨花，赞美无私帮助他人的雷锋精神。'],
  q4: ['三次梨花描写由实到虚，照应标题，串联人物并深化雷锋精神的主旨。', '梨花描写很美，也写出了梨花姑娘的善良。', '梨花象征人物品质。', '梨花描写照应了……', '多次写梨花推动情节并表现互助精神。']
};

const makeCalibrationSamples = (questionId: string, fullScore: number, target: 3 | 5, confirmedCount: number): CalibrationSample[] =>
  calibrationStudents.slice(0, target).map((student, index) => {
    const confirmed = index < confirmedCount;
    const scoreRatios = [1, 0.76, 0.42, 0.58, 0.84];
    const aiScore = Math.round(fullScore * scoreRatios[index]);
    return {
      id: `${questionId}-sample-${index + 1}`,
      questionId,
      studentId: student.id,
      studentName: student.name,
      studentNo: student.no,
      sampleType: student.type,
      rawImageDescription: `第 ${questionId.slice(1)} 题答题区，右上角学号 ${student.no.slice(-4)}，${student.type === 'ocr-risk' ? '末句边缘疑似被截断。' : '页面完整。'}`,
      ocrText: sampleAnswers[questionId][index],
      ocrConfidence: student.ocr,
      aiScore,
      fullScore,
      gradingConfidence: student.grading,
      matchedPoints: index === 0 ? ['主要采分点完整', '结合文本'] : ['部分采分点'],
      missedPoints: index === 0 ? [] : ['表达或证据仍需教师确认'],
      status: confirmed ? 'confirmed' : 'pending',
      resultSource: confirmed ? 'ai-confirmed' : undefined,
      teacherScore: confirmed ? aiScore : undefined,
      isFinal: confirmed,
      rubricVersion: 2
    };
  });

export const initialWorkflowState: WorkflowState = {
  currentStep: 6, // default AI grading step
  taskName: '《驿路梨花》阅读理解检测',
  classId: 'c1',
  deadline: '今天 18:00',
  relatedText: '《驿路梨花》课文第14-25段',
  homeworkType: 'reading',
  assignment: {
    status: 'assigned',
    analysisStatus: 'ready',
    questionFileNames: ['驿路梨花阅读检测.pdf'],
    answerFileNames: ['驿路梨花参考答案.pdf'],
    note: '完成全部四道题，答题时结合原文。',
    assets: [
      { id: 'asset-assignment-1', taskId: 't1', kind: 'assignment', fileName: '驿路梨花阅读检测.pdf', mimeType: 'application/pdf', pageCount: 2, status: 'ready' },
      { id: 'asset-answer-1', taskId: 't1', kind: 'reference-answer', fileName: '驿路梨花参考答案.pdf', mimeType: 'application/pdf', pageCount: 1, status: 'ready' }
    ]
  },
  questions: [
    { id: 'q1', displayNo: '1', title: '注音与词语填空', score: 10, knowledgePoint: '字词默写', knowledgeLinks: [], desc: '拼音与重点字形纠错。', stem: '根据拼音写出词语，并订正句中的错别字：山路陡qiào，屋内用竹miè编成的器物虽然简lòu，却十分整洁。', aiQuestionType: '基础积累 · 字音字形', answerRequirement: '写出三个正确词语。', parseConfidence: 0.99, sourceEvidenceIds: ['e-q1'] },
    { id: 'q2', displayNo: '2', title: '现代文叙事概括', score: 30, knowledgePoint: '现代文叙事概括', knowledgeLinks: [{ nodeId: 'n6', nodeName: '结构分析', confidence: 0.81, status: 'suggested' }], desc: '理清文章叙事脉络，概括寻访“梨花”的过程。', stem: '阅读全文，按照故事发展的顺序，概括“我”和老余从发现小茅屋到弄清小茅屋主人身份的主要经过。', aiQuestionType: '叙事概括 · 情节梳理', answerRequirement: '按事件顺序概括主要经过。', parseConfidence: 0.96, sourceEvidenceIds: ['e-q2'] },
    { id: 'q3', displayNo: '3', title: '标题含义与作用', score: 30, knowledgePoint: '标题作用题', knowledgeLinks: [{ nodeId: 'n5', nodeName: '标题作用题', confidence: 0.98, status: 'confirmed' }, { nodeId: 'n7', nodeName: '主旨理解', confidence: 0.93, status: 'suggested' }], desc: '理解“驿路梨花”的双关和象征含义。', stem: '结合全文，谈谈标题“驿路梨花”有哪些含义，并分析它在表现文章主题方面的作用。', aiQuestionType: '标题作用 · 主旨理解', answerRequirement: '说明标题的多层含义并联系文章主题。', parseConfidence: 0.98, sourceEvidenceIds: ['e-q3'] },
    { id: 'q4', displayNo: '4', title: '梨花的象征手法鉴赏', score: 30, knowledgePoint: '修辞手法鉴赏', knowledgeLinks: [{ nodeId: 'n6', nodeName: '结构分析', confidence: 0.88, status: 'suggested' }, { nodeId: 'n7', nodeName: '主旨理解', confidence: 0.91, status: 'suggested' }], desc: '分析文中三处梨花描写在刻画人物和表现雷锋精神时的作用。', stem: '文中三次描写梨花。请分别联系上下文，分析这些描写在营造氛围、刻画人物和深化主题方面的作用。', aiQuestionType: '写法鉴赏 · 象征手法', answerRequirement: '分别联系语境说明环境、结构和主题作用。', parseConfidence: 0.95, sourceEvidenceIds: ['e-q4'] }
  ],
  sourceEvidence: [
    { id: 'e-q1', assetId: 'asset-assignment-1', assetKind: 'assignment', fileName: '驿路梨花阅读检测.pdf', pageNumber: 1, boundingBox: { x: 0.08, y: 0.12, width: 0.84, height: 0.16 }, ocrText: '1. 根据拼音写出词语，并订正句中的错别字……', confidence: 0.99, isMock: true },
    { id: 'e-q2', assetId: 'asset-assignment-1', assetKind: 'assignment', fileName: '驿路梨花阅读检测.pdf', pageNumber: 1, boundingBox: { x: 0.08, y: 0.31, width: 0.84, height: 0.18 }, ocrText: '2. 阅读全文，按照故事发展的顺序，概括主要经过。', confidence: 0.96, isMock: true },
    { id: 'e-q3', assetId: 'asset-assignment-1', assetKind: 'assignment', fileName: '驿路梨花阅读检测.pdf', pageNumber: 2, boundingBox: { x: 0.08, y: 0.15, width: 0.84, height: 0.2 }, ocrText: '3. 结合全文，谈谈标题“驿路梨花”有哪些含义，并分析其主题作用。', confidence: 0.98, isMock: true },
    { id: 'e-q4', assetId: 'asset-assignment-1', assetKind: 'assignment', fileName: '驿路梨花阅读检测.pdf', pageNumber: 2, boundingBox: { x: 0.08, y: 0.42, width: 0.84, height: 0.24 }, ocrText: '4. 文中三次描写梨花，请分别联系上下文分析其作用。', confidence: 0.95, isMock: true },
    { id: 'e-a1', assetId: 'asset-answer-1', assetKind: 'reference-answer', fileName: '驿路梨花参考答案.pdf', pageNumber: 1, boundingBox: { x: 0.09, y: 0.1, width: 0.82, height: 0.12 }, ocrText: '1. 陡峭、竹篾、简陋。', confidence: 0.99, isMock: true },
    { id: 'e-a2', assetId: 'asset-answer-1', assetKind: 'reference-answer', fileName: '驿路梨花参考答案.pdf', pageNumber: 1, boundingBox: { x: 0.09, y: 0.24, width: 0.82, height: 0.15 }, ocrText: '2. 按“发现小屋—追问主人—揭示建屋人”的顺序概括。', confidence: 0.97, isMock: true },
    { id: 'e-a3', assetId: 'asset-answer-1', assetKind: 'reference-answer', fileName: '驿路梨花参考答案.pdf', pageNumber: 1, boundingBox: { x: 0.09, y: 0.43, width: 0.82, height: 0.2 }, ocrText: '3. 自然梨花、梨花姑娘、无私奉献的雷锋精神三层含义。', confidence: 0.98, isMock: true },
    { id: 'e-a4', assetId: 'asset-answer-1', assetKind: 'reference-answer', fileName: '驿路梨花参考答案.pdf', pageNumber: 1, boundingBox: { x: 0.09, y: 0.67, width: 0.82, height: 0.18 }, ocrText: '4. 营造氛围、照应标题并深化雷锋精神主题。', confidence: 0.96, isMock: true }
  ],
  standardAnswer: '第三题标准答案要点：\n1. 交代背景：实指哀牢山路旁的梨花，为故事设置温馨浪漫的背景环境。\n2. 象征哈尼姑娘“梨花”：双关手法，实写景物，虚写人物。\n3. 象征无私奉献的“雷锋精神”：深化主题，说明雷锋精神处处开花、代代相传。',
  gradingRubric: [
    { point: '采分点1：交代自然环境背景', score: 10, description: '回答包含“实指路边的梨花”、“交代大自然背景/环境”等关键词。' },
    { point: '采分点2：双关哈尼姑娘梨花', score: 10, description: '回答提到“虚指哈尼姑娘梨花”、“赞美热情的少数民族人民”。' },
    { point: '采分点3：象征奉献与雷锋精神', score: 10, description: '回答涉及“象征雷锋精神”、“赞美互帮互助、无私奉献的美德，点明主旨”。' }
  ],
  uploadProgress: 100,
  isUploading: false,
  uploadedCount: 42,
  rubricVersion: 2,
  gradingMode: 'auto-continue',
  teacherRules: [
    '“好人好事代代相传”也算命中雷锋精神与无私奉献。',
    '只写“梨花很美”不算命中自然环境作用。',
    '三层意思都有但没有结合文本，最高得 25 分。'
  ],
  submissionPages: [],
  calibrationSamples: makeCalibrationSamples('q3', 30, 5, 1),
  missingSubmissions: [],
  questionGradingStates: [
    {
      questionId: 'q1',
      standardAnswer: '陡峭、竹篾、简陋。',
      standardAnswerOcrText: '1. 陡峭、竹篾、简陋。',
      standardAnswerSourceIds: ['e-a1'],
      gradingRubric: [{ point: '字形准确', score: 10, description: '每个词语字形正确；同音错别字不得分。' }],
      teacherRules: ['“竹篾”的“篾”部件书写清楚即可，不要求印刷体。'],
      rubricVersion: 2,
      sampleTarget: 3,
      calibrationSamples: makeCalibrationSamples('q1', 10, 3, 3),
      jointReviewEnabled: false
    },
    {
      questionId: 'q2',
      standardAnswer: '按“发现小屋—追问主人—揭示梨花姑娘与解放军建屋”的顺序概括主要情节。',
      standardAnswerOcrText: '2. 按“发现小屋—追问主人—揭示建屋人”的顺序概括。',
      standardAnswerSourceIds: ['e-a2'],
      gradingRubric: [
        { point: '主要事件完整', score: 15, description: '写出发现、追问和揭示三个环节。' },
        { point: '叙事顺序准确', score: 15, description: '人物和事件关系清楚，无关键性错位。' }
      ],
      teacherRules: ['使用“寻找小屋主人”概括中间过程也算分。'],
      rubricVersion: 2,
      sampleTarget: 3,
      calibrationSamples: makeCalibrationSamples('q2', 30, 3, 2),
      jointReviewEnabled: false
    },
    {
      questionId: 'q3',
      standardAnswer: '第三题标准答案要点：\n1. 交代自然环境背景。\n2. 双关哈尼姑娘“梨花”。\n3. 象征无私奉献的雷锋精神。',
      standardAnswerOcrText: '3. 自然梨花、梨花姑娘、无私奉献的雷锋精神三层含义。',
      standardAnswerSourceIds: ['e-a3'],
      gradingRubric: [
        { point: '交代自然环境背景', score: 10, description: '回答包含路边梨花及环境作用。' },
        { point: '双关哈尼姑娘梨花', score: 10, description: '回答提到哈尼姑娘梨花及人物品质。' },
        { point: '象征奉献与雷锋精神', score: 10, description: '回答涉及互助、奉献和主题。' }
      ],
      teacherRules: ['“好人好事代代相传”也算命中雷锋精神与无私奉献。', '三层意思都有但没有结合文本，最高得 25 分。'],
      rubricVersion: 2,
      sampleTarget: 5,
      calibrationSamples: makeCalibrationSamples('q3', 30, 5, 1),
      jointReviewEnabled: true
    },
    {
      questionId: 'q4',
      standardAnswer: '三处梨花描写由实到虚，照应标题、串联人物，并深化雷锋精神的主题。',
      standardAnswerOcrText: '4. 营造氛围、照应标题并深化雷锋精神主题。',
      standardAnswerSourceIds: ['e-a4'],
      gradingRubric: [
        { point: '描写作用', score: 10, description: '说明环境或氛围作用。' },
        { point: '结构作用', score: 10, description: '说明照应标题或推动情节。' },
        { point: '主题作用', score: 10, description: '联系人物品质和雷锋精神。' }
      ],
      teacherRules: ['答出“梨花贯穿全文”可视为结构作用。'],
      rubricVersion: 2,
      sampleTarget: 3,
      calibrationSamples: makeCalibrationSamples('q4', 30, 3, 1),
      jointReviewEnabled: true
    }
  ],
  jointReviewQuestionIds: ['q3'],
  ocrResults: [
    { studentName: '林子涵', rawImage: 'img_lin.png', ocrText: '题目三：我认为驿路梨花既是指大山中路边怒放的梨花；也代表了那位细心热忱照顾路人的哈尼姑娘梨花。最后它更象征了像雷锋那样无私奉献、温暖他人的精神，在整条路上传承。', matchScore: 98 },
    { studentName: '张雨轩', rawImage: 'img_zhang.png', ocrText: '答：驿路梨花就是路边的梨花树，还有那个名字叫梨花的小女孩，她们都非常善良。雷锋精神是很好的，在哀牢山传递着。', matchScore: 82 },
    { studentName: '陈梓睿', rawImage: 'img_chen.png', ocrText: '就是路边开满了洁白如雪的梨花，非常好看，能让人心里感到温暖和希望，象征了大家做的好人好事。', matchScore: 71 }
  ],
  aiResults: [
    {
      studentId: 's1',
      studentName: '林子涵',
      score: 96,
      hitPoints: ['采分点1：交代自然环境背景', '采分点2：双关哈尼姑娘梨花', '采分点3：象征奉献与雷锋精神'],
      deductions: [],
      errorType: '无明显错误',
      confidence: 0.98
    },
    {
      studentId: 's2',
      studentName: '张雨轩',
      score: 72,
      hitPoints: ['采分点1：交代自然环境背景', '采分点2：双关哈尼姑娘梨花'],
      deductions: [{ point: '采分点3：象征奉献与雷锋精神', score: 10, reason: '表述过于含糊，未能清晰揭示雷锋精神的无私奉献主旨，仅带过雷锋字眼。' }],
      errorType: '漏答要点',
      confidence: 0.72
    },
    {
      studentId: 's3',
      studentName: '陈梓睿',
      score: 50,
      hitPoints: ['采分点1：交代自然环境背景'],
      deductions: [
        { point: '采分点2：双关哈尼姑娘梨花', score: 10, reason: '未提及关键人物哈尼姑娘梨花及其奉献。' },
        { point: '采分点3：象征奉献与雷锋精神', score: 10, reason: '未上升至雷锋精神的传承高度，无相关表述。' }
      ],
      errorType: '漏答要点、没有结合文本',
      confidence: 0.68
    }
  ]
};
