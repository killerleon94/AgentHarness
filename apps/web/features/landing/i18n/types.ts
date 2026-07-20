// e:\AgentHarness\apps\web\features\landing\i18n\types.ts
export type Locale = "en" | "zh";

export const locales: Locale[] = ["en", "zh"];

export const localeLabels: Record<Locale, string> = {
  en: "EN",
  zh: "\u4e2d\u6587",
};

type FeatureSection = {
  label: string;
  title: string;
  description: string;
  cards: { title: string; description: string }[];
};

type FooterGroup = {
  label: string;
  links: { label: string; href: string }[];
};

// 通用字段类型
type CommonDict = {
  workspace: string;
  status?: string;
  priority?: string;
  assignee?: string;
  creator?: string;
  project?: string;
  searchPlaceholder?: string;
  members?: string;
  agents?: string;
  noProject?: string;
  removeFromProject?: string;
  actions?: CommonActionsDict;
};

// 侧边栏字段类型
type SidebarDict = {
  inbox: string;
  myIssues: string;
  issues: string;
  projects: string;
  agents: string;
  runtimes: string;
  skills: string;
  settings: string;
  groups: string;
  pinned: string;
  workspace: string;
  configure: string;
  newIssue: string;
  workspaces: string;
  createWorkspace: string;
  logout: string;
  unpin: string;
  aiPowered: string;
};

// 新增：仪表盘 Issues 页面字段类型
type DashboardIssuesDict = {
  title: string;
  createNew: string;
  searchPlaceholder: string;
  columns: {
    id: string;
    title: string;
    status: string;
    assignee: string;
    createdAt: string;
  };
  status: {
    open: string;
    closed: string;
    inProgress: string;
  };
};

// 新增：仪表盘通用字段类型
type DashboardDict = {
  issues: DashboardIssuesDict;
};

// 新增：Issues 组件通用错误/状态字段
type IssuesDict = {
  emptyState: {
    title: string;
    subtitle: string;
  };
  errors: {
    moveFailed: string;
  };
};
type IssuesHeaderDict = {
  filter: string;
  displaySettings: string;
  ordering: string;
  cardProperties: string;
  view: string;
  boardView: string;
  listView: string;
  resetAllFilters: string;
  ascending: string;
  descending: string;
  noResults: string;
  members: string;
  agents: string;
  noAssignee: string;
  noProject: string;
  issue: string; // 单数
  issues: string; // 复数
  newIssue: string;
  stats?: {
    inProgress?: string;
    inReview?: string;
    done?: string;
  };
  scopes: {
    all: { label: string; description: string };
    members: { label: string; description: string };
    agents: { label: string; description: string };
  };
  sortOptions: {
    manual: string;
    createdAt: string;
    updatedAt: string;
    dueDate: string;
    priority: string;
    title: string;
  };
  cardPropertyOptions: {
    assignee: string;
    priority: string;
    dueDate: string;
    description: string;
  };
};

type MyIssuesDict = {
  emptyState: {
    title: string;
    subtitle: string;
  };
  scopes: {
    assigned: { label: string; description: string };
    created: { label: string; description: string };
    agents: { label: string; description: string };
  };
};

type InboxDict = {
  title: string;
  unread: string;
  filter: string;
  filterAll: string;
  filterUnread: string;
  filterRead: string;
  filterNoUnread: string;
  filterNoRead: string;
  sections: {
    unread: string;
    read: string;
  };
  emptyState: {
    title: string;
    subtitle: string;
  };
  detail: {
    empty: string;
    selectNotification: string;
  };
  actions: {
    markAllRead: string;
    archiveAll: string;
    archiveAllRead: string;
    archiveCompleted: string;
    archive: string;
  };
  types: {
    issue_assigned: string;
    unassigned: string;
    assignee_changed: string;
    status_changed: string;
    priority_changed: string;
    due_date_changed: string;
    new_comment: string;
    mentioned: string;
    review_requested: string;
    task_completed: string;
    task_failed: string;
    agent_blocked: string;
    agent_completed: string;
    reaction_added: string;
  };
  detailLabels: {
    setStatusTo: string;
    setPriorityTo: string;
    assignedTo: string;
    removedAssignee: string;
    setDueDateTo: string;
    removedDueDate: string;
    reactedTo: string;
  };
  errors: {
    markReadFailed: string;
    archiveFailed: string;
    markAllReadFailed: string;
    archiveAllFailed: string;
    archiveAllReadFailed: string;
    archiveCompletedFailed: string;
  };
};

type ProjectsDict = {
  title: string;
  createProject: string;
  newProject: string;
  emptyState: {
    title: string;
    subtitle: string;
    action: string;
  };
  stats: {
    total: string;
    inProgress: string;
    completed: string;
    projects: string;
  };
  view: {
    grid: string;
    list: string;
  };
  sort: string;
  sortOptions: {
    newest: string;
    progress: string;
    name: string;
  };
  columns: {
    name: string;
    priority: string;
    status: string;
    progress: string;
    lead: string;
    created: string;
  };
  relativeTime: {
    today: string;
    daysAgo: string;
    monthsAgo: string;
  };
  createDialog: {
    title: string;
    titlePlaceholder: string;
    descriptionPlaceholder: string;
    chooseIcon: string;
    status: string;
    priority: string;
    lead: string;
    noLead: string;
    members: string;
    agents: string;
    noResults: string;
    creating: string;
    create: string;
    collapse: string;
    expand: string;
    close: string;
  };
  errors: {
    createFailed: string;
  };
  toast: {
    created: string;
  };
  detail: {
    projectNotFound: string;
    noIssuesLinked: string;
    assignIssuesHint: string;
    pinToSidebar: string;
    unpinFromSidebar: string;
    copyLink: string;
    deleteProject: string;
    toggleSidebar: string;
    changeIcon: string;
    titlePlaceholder: string;
    properties: string;
    status: string;
    priority: string;
    lead: string;
    noLead: string;
    assignLeadPlaceholder: string;
    members: string;
    agents: string;
    noResults: string;
    progress: string;
    description: string;
    descriptionPlaceholder: string;
    removeFromProject: string;
    deleteDialog: {
      title: string;
      description: string;
      cancel: string;
      delete: string;
    };
  };
  priorities: {
    noPriority: string;
    urgent: string;
    high: string;
    medium: string;
    low: string;
  };
  statuses: {
    planned: string;
    inProgress: string;
    paused: string;
    completed: string;
    cancelled: string;
  };
};

type BoardDict = {
  hideColumn: string;
  addIssue: string;
  noIssues: string;
  hiddenColumns: string;
  showColumn: string;
  statuses: {
    backlog: string;
    todo: string;
    inProgress: string;
    inReview: string;
    done: string;
    blocked: string;
    cancelled?: string;
  };
  priorities: {
    urgent: string;
    high: string;
    medium: string;
    low: string;
    noPriority: string;
  };
  issues: {
    urgent: string;
    high: string;
    medium: string;
    low: string;
    none: string;
  };
};
type ModalDict = {
  createIssue: {
    title: string;
    newIssue: string;
    newSubIssue: string;
    fields: {
      title: string;
      description: string;
      status: string;
      priority: string;
      assignee: string;
      dueDate: string;
      project: string;
    };
    placeholders: {
      title: string;
      description: string;
      assignee: string;
      dueDate: string;
      project: string;
    };
    labels: {
      status: string;
      priority: string;
      assignee: string;
      dueDate: string;
      project: string;
    };
    expand: string;
    collapse: string;
    close: string;
    creating: string;
    createIssue: string;
    failedToCreate: string;
    issueCreated: string;
    viewIssue: string;
  };
};

type CommonActionsDict = {
  cancel: string;
  create: string;
  creating: string;
  save: string;
  delete: string;
};

type IssueDetailDict = {
  // 通用状态/错误
  emptyState: {
    notFound: string;
  };
  errors: {
    updateFailed: string;
    deleteFailed: string;
  };
  toast: {
    deleted: string;
    linkCopied: string;
  };

  // 导航与操作
  navigation: {
    previous: string;
    next: string;
  };
  actions: {
    backToIssues: string;
    pin: string;
    unpin: string;
    createSubIssue: string;
    addSubIssues: string; // 按钮文本 "Add sub-issues"
    addSubIssue: string; // Tooltip/Label "Add sub-issue"
    copyLink: string;
    delete: string;
    toggleSidebar: string;
    subscribe: string;
    unsubscribe: string;
  };

  // 删除确认弹窗
  delete: {
    title: string;
    description: string;
  };

  // 占位符
  placeholders: {
    title: string;
    description: string;
    reply: string;
  };

  // 标签与标题
  labels: {
    subIssueOf: string;
    subIssues: string;
    parentIssue: string;
    noTaskRunsFound: string;
    selectTask: string;
    agentFiles: string;
    attachments: string;
  };

  // 侧边栏区块标题
  sections: {
    properties: string;
    details: string;
    tokenUsage: string;
  };

  // 属性行标签 (Sidebar)
  properties: {
    dueDate: string;
  };

  // 详情部分标签 (Sidebar -> Details)
  details: {
    createdBy: string;
    created: string;
    updated: string;
  };

  // Token 用量标签 (Sidebar -> Token usage)
  tokenUsage: {
    input: string;
    output: string;
    cache: string;
    runs: string;
  };

  // 日期快捷选项
  dueDate: {
    today: string;
    tomorrow: string;
    nextWeek: string;
    clear: string;
  };

  // 活动日志 (Activity Timeline)
  activity: {
    title: string;
    created: string;
    statusChanged: string; // 支持 {from}, {to占位符}
    priorityChanged: string; // 支持 {from}, {to}
    selfAssigned: string;
    assignedTo: string; // 支持 {name}
    removedAssignee: string;
    changedAssignee: string;
    removedDueDate: string;
    setDueDate: string; // 支持 {date}
    renamed: string; // 支持 {from}, {to}
    updatedDescription: string;
    taskCompleted: string;
    taskFailed: string;
  };

  // 订阅者弹窗
  subscribers: {
    placeholder: string;
    members: string;
    agents: string;
  };

  // 指派状态
  assignee: {
    unassigned: string;
  };

  // 优先级
  priorities: {
    urgent: string;
    high: string;
    medium: string;
    low: string;
    noPriority: string;
  };
};

export type LandingDict = {
  header: { github: string; login: string; dashboard: string };
  hero: {
    headlineLine1: string;
    headlineLine2: string;
    subheading: string;
    cta: string;
    worksWith: string;
    imageAlt: string;
  };
  features: {
    teammates: FeatureSection;
    autonomous: FeatureSection;
    skills: FeatureSection;
    runtimes: FeatureSection;
  };
  howItWorks: {
    label: string;
    headlineMain: string;
    headlineFaded: string;
    steps: { title: string; description: string }[];
    cta: string;
    ctaGithub: string;
  };
  openSource: {
    label: string;
    headlineLine1: string;
    headlineLine2: string;
    description: string;
    cta: string;
    highlights: { title: string; description: string }[];
  };
  faq: {
    label: string;
    headline: string;
    items: { question: string; answer: string }[];
  };
  footer: {
    tagline: string;
    cta: string;
    groups: {
      product: FooterGroup;
      resources: FooterGroup;
      company: FooterGroup;
    };
    copyright: string;
  };
  about: {
    title: string;
    lead: string;
    paragraphs: string[];
    cta: string;
  };
  changelog: {
    title: string;
    subtitle: string;
    categories: {
      features: string;
      improvements: string;
      fixes: string;
    };
    entries: {
      version: string;
      date: string;
      title: string;
      changes: string[];
      features?: string[];
      improvements?: string[];
      fixes?: string[];
    }[];
  };

  // 新增字段
  common: CommonDict & { actions?: CommonActionsDict }; // 合并 actions
  modal?: ModalDict; // 可选或必填，视结构而定
  sidebar: SidebarDict;
  dashboard: DashboardDict;
  issues: IssuesDict;
  board: BoardDict;
  issuesHeader: IssuesHeaderDict;
  myIssues: MyIssuesDict;
  issueDetail: IssueDetailDict;
  inbox: InboxDict;
  projects: ProjectsDict;
};
