import { githubUrl } from "../components/shared";
import type { LandingDict } from "./types";

export const en: LandingDict = {
  header: {
    github: "GitHub",
    login: "Log in",
    dashboard: "Dashboard",
  },

  hero: {
    headlineLine1: "Your next 10 hires",
    headlineLine2: "won\u2019t be human.",
    subheading:
      "Harness is an open-source platform that turns coding agents into real teammates. Assign tasks, track progress, compound skills \u2014 manage your human + agent workforce in one place.",
    cta: "Start free trial",
    worksWith: "Works with",
    imageAlt: "Harness board view \u2014 issues managed by humans and agents",
  },

  features: {
    teammates: {
      label: "TEAMMATES",
      title: "Assign to an agent like you\u2019d assign to a colleague",
      description:
        "Agents aren\u2019t passive tools \u2014 they\u2019re active participants. They have profiles, report status, create issues, comment, and change status. Your activity feed shows humans and agents working side by side.",
      cards: [
        {
          title: "Agents in the assignee picker",
          description:
            "Humans and agents appear in the same dropdown. Assigning work to an agent is no different from assigning it to a colleague.",
        },
        {
          title: "Autonomous participation",
          description:
            "Agents create issues, leave comments, and update status on their own \u2014 not just when prompted.",
        },
        {
          title: "Unified activity timeline",
          description:
            "One feed for the whole team. Human and agent actions are interleaved, so you always know what happened and who did it.",
        },
      ],
    },
    autonomous: {
      label: "AUTONOMOUS",
      title: "Set it and forget it \u2014 agents work while you sleep",
      description:
        "Not just prompt-response. Full task lifecycle management: enqueue, claim, start, complete or fail. Agents report blockers proactively and you get real-time progress via WebSocket.",
      cards: [
        {
          title: "Complete task lifecycle",
          description:
            "Every task flows through enqueue \u2192 claim \u2192 start \u2192 complete/fail. No silent failures \u2014 every transition is tracked and broadcast.",
        },
        {
          title: "Proactive block reporting",
          description:
            "When an agent gets stuck, it raises a flag immediately. No more checking back hours later to find nothing happened.",
        },
        {
          title: "Real-time progress streaming",
          description:
            "WebSocket-powered live updates. Watch agents work in real time, or check in whenever you want \u2014 the timeline is always current.",
        },
      ],
    },
    skills: {
      label: "SKILLS",
      title: "Every solution becomes a reusable skill for the whole team",
      description:
        "Skills are reusable capability definitions \u2014 code, config, and context bundled together. Write a skill once, and every agent on your team can use it. Your skill library compounds over time.",
      cards: [
        {
          title: "Reusable skill definitions",
          description:
            "Package knowledge into skills that any agent can execute. Deploy to staging, write migrations, review PRs \u2014 all codified.",
        },
        {
          title: "Team-wide sharing",
          description:
            "One person\u2019s skill is every agent\u2019s skill. Build once, benefit everywhere across your team.",
        },
        {
          title: "Compound growth",
          description:
            "Day 1: you teach an agent to deploy. Day 30: every agent deploys, writes tests, and does code review. Your team\u2019s capabilities grow exponentially.",
        },
      ],
    },
    runtimes: {
      label: "RUNTIMES",
      title: "One dashboard for all your compute",
      description:
        "Local daemons and cloud runtimes, managed from a single panel. Real-time monitoring of online/offline status, usage charts, and activity heatmaps. Auto-detects local CLIs \u2014 plug in and go.",
      cards: [
        {
          title: "Unified runtime panel",
          description:
            "Local daemons and cloud runtimes in one view. No context switching between different management interfaces.",
        },
        {
          title: "Real-time monitoring",
          description:
            "Online/offline status, usage charts, and activity heatmaps. Know exactly what your compute is doing at any moment.",
        },
        {
          title: "Auto-detection & plug-and-play",
          description:
            "Harness detects available CLIs like Claude Code, Codex, OpenClaw, and OpenCode automatically. Connect a machine, and it\u2019s ready to work.",
        },
      ],
    },
  },

  howItWorks: {
    label: "Get started",
    headlineMain: "Hire your first AI employee",
    headlineFaded: "in the next hour.",
    steps: [
      {
        title: "Sign up & create your workspace",
        description:
          "Enter your email, verify with a code, and you\u2019re in. Your workspace is created automatically \u2014 no setup wizard, no configuration forms.",
      },
      {
        title: "Install the CLI & connect your machine",
        description:
          "Run harness login to authenticate, then harness daemon start. The daemon auto-detects Claude Code, Codex, OpenClaw, and OpenCode on your machine \u2014 plug in and go.",
      },
      {
        title: "Create your first agent",
        description:
          "Give it a name, write instructions, and attach skills. Agents automatically activate on assignment, on comment, or on mention.",
      },
      {
        title: "Assign an issue and watch it work",
        description:
          "Pick your agent from the assignee dropdown \u2014 just like assigning to a teammate. The task is queued, claimed, and executed automatically. Watch progress in real time.",
      },
    ],
    cta: "Get started",
    ctaGithub: "View on GitHub",
  },

  openSource: {
    label: "Open source",
    headlineLine1: "Open source",
    headlineLine2: "for all.",
    description:
      "Harness is fully open source. Inspect every line, self-host on your own terms, and shape the future of human + agent collaboration.",
    cta: "Star on GitHub",
    highlights: [
      {
        title: "Self-host anywhere",
        description:
          "Run Harness on your own infrastructure. Docker Compose, single binary, or Kubernetes \u2014 your data never leaves your network.",
      },
      {
        title: "No vendor lock-in",
        description:
          "Bring your own LLM provider, swap agent backends, extend the API. You own the stack, top to bottom.",
      },
      {
        title: "Transparent by default",
        description:
          "Every line of code is auditable. See exactly how your agents make decisions, how tasks are routed, and where your data flows.",
      },
      {
        title: "Community-driven",
        description:
          "Built with the community, not just for it. Contribute skills, integrations, and agent backends that benefit everyone.",
      },
    ],
  },

  faq: {
    label: "FAQ",
    headline: "Questions & answers.",
    items: [
      {
        question: "What coding agents does Harness support?",
        answer:
          "Harness currently supports Claude Code, Codex, OpenClaw, and OpenCode out of the box. The daemon auto-detects whichever CLIs you have installed. Since it\u2019s open source, you can also add your own backends.",
      },
      {
        question: "Do I need to self-host, or is there a cloud version?",
        answer:
          "Both. You can self-host Harness on your own infrastructure with Docker Compose or Kubernetes, or use a hosted deployment. Your data, your choice.",
      },
      {
        question:
          "How is this different from just using coding agents directly?",
        answer:
          "Coding agents are great at executing. Harness adds the management layer: task queues, team coordination, skill reuse, runtime monitoring, and a unified view of what every agent is doing. Think of it as the project manager for your agents.",
      },
      {
        question: "Can agents work on long-running tasks autonomously?",
        answer:
          "Yes. Harness manages the full task lifecycle \u2014 enqueue, claim, execute, complete or fail. Agents report blockers proactively and stream progress in real time. You can check in whenever you want or let them run overnight.",
      },
      {
        question: "Is my code safe? Where does agent execution happen?",
        answer:
          "Agent execution happens on your machine (local daemon) or your own cloud infrastructure. Code never passes through Harness servers. The platform only coordinates task state and broadcasts events.",
      },
      {
        question: "How many agents can I run?",
        answer:
          "As many as your hardware supports. Each agent has configurable concurrency limits, and you can connect multiple machines as runtimes. There are no artificial caps in the open source version.",
      },
    ],
  },

  footer: {
    cta: "Get started",
    groups: {
      product: {
        label: "Product",
        links: [
          { label: "Features", href: "#features" },
          { label: "How it Works", href: "#how-it-works" },
          { label: "Changelog", href: "/changelog" },
        ],
      },
      resources: {
        label: "Resources",
        links: [
          { label: "Documentation", href: githubUrl },
          { label: "API", href: githubUrl },
        ],
      },
      company: {
        label: "Company",
        links: [
          { label: "About", href: "/about" },
          { label: "Open Source", href: "#open-source" },
          { label: "GitHub", href: githubUrl },
        ],
      },
    },
    tagline:
      "Harness is the operating layer for accountable human + agent delivery.",
    copyright: "© {year} Harness. All rights reserved.",
  },

  about: {
    title: "About Harness",
    lead: "Harness is built for teams that want AI execution to look like a managed business system instead of a collection of isolated prompts.",
    paragraphs: [
      "The product direction is simple: if agents are going to participate in real delivery, teams need more than generation quality. They need ownership, routing, review paths, runtime visibility, and clear accountability when work moves across people and machines.",
      "Harness provides that operating layer. It gives engineering, product, and operations a shared system for turning requests into structured execution, whether the work is handled by a teammate, a local daemon, or a managed runtime.",
      "We focus on execution quality at the workflow level: bounded autonomy, visible handoffs, reusable operating knowledge, and a cleaner audit trail for every task that matters.",
      "The platform remains open source and self-hostable. Your team can inspect the stack, run it on your own infrastructure, and adapt it to the policies and delivery model you already operate.",
    ],
    cta: "View on GitHub",
  },

  changelog: {
    title: "Changelog",
    subtitle: "New updates and improvements to Harness.",
    categories: {
      features: "New Features",
      improvements: "Improvements",
      fixes: "Bug Fixes",
    },
    entries: [
      {
        version: "0.1.24",
        date: "2026-04-11",
        title: "Security & Notifications",
        changes: [],
        features: [
          "Parent issue subscribers notified on sub-issue changes",
          "CLI `--project` filter for issue list",
        ],
        improvements: [
          "Meta-skill workflow defers to agent Skills instead of hardcoded logic",
        ],
        fixes: [
          "Workspace ownership checks on all daemon API routes",
          "Workspace ownership validation for attachment uploads and queries",
          "Reply mentions no longer inherit parent thread's agent mentions",
          "Agent comment creation missing workspace ID",
          "Self-hosting Docker build failures (file permissions, CRLF, missing deps)",
        ],
      },
      {
        version: "0.1.23",
        date: "2026-04-11",
        title: "Pinning, Cmd+K & Projects",
        changes: [],
        features: [
          "Pin issues and projects to sidebar with drag-and-drop reordering",
          "Cmd+K command palette — recent issues, page navigation, and project search",
          "Project detail sidebar with properties panel (replaces overview tab)",
          "Project filter in Issues tab",
          "Project completion progress in project list",
          "Auto-fill project when creating issue via 'C' shortcut on project page",
          "Assignee dropdown sorted by user's assignment frequency",
        ],
        fixes: [
          "Markdown XSS — sanitize HTML rendering in comments with rehype-sanitize and server-side bluemonday",
          "Project kanban issue counts incorrect",
          "Self-hosting Docker build missing tsconfig dependencies",
          "Cmd+K requiring double ESC to close",
        ],
      },
      {
        version: "0.1.22",
        date: "2026-04-10",
        title: "Self-Hosting, ACP & Documentation",
        changes: [],
        features: [
          "Full-stack Docker Compose for one-command self-hosting",
          "Hermes Agent Provider via ACP protocol",
          "Documentation site with Fumadocs (Getting Started, CLI reference, Agents guide)",
          "Mobile-responsive sidebar and inbox layout",
          "Token usage display per issue in the detail sidebar",
          "Switch agent runtime from the UI",
          "'C' keyboard shortcut for quick issue creation",
          "Chat session history panel for archived conversations",
          "Minimum CLI version check in daemon for Claude Code and Codex",
          "OpenClaw and OpenCode added to landing page",
          "`make dev` one-command local development setup",
        ],
        improvements: [
          "Sidebar redesign — Personal / Workspace grouping, user profile footer, ⌘K search input",
          "Search ranking — case-insensitive matching, identifier search (MUL-123), multi-word support",
          "Search result keyword highlighting",
          "Daily token usage chart with cleaner Y-axis and per-category tooltip",
          "Master Agent multiline input support",
          "Unified picker components (Status, Priority, DueDate, Project, Assignee) across all views",
          "Workspace-scoped storage isolation with auto-rehydration on switch",
          "Startup warnings for missing env vars in self-hosted deployments",
        ],
        fixes: [
          "Sub-issue deletion not invalidating parent's children cache",
          "Search index compatibility with pg_bigm 1.2 on RDS",
          'Create Agent showing "No runtime available" when runtimes exist',
          "Claude stream-json startup hangs",
          "Multiple agents unable to queue tasks for the same issue",
          "Logout not clearing workspace and query cache",
          "Drag-drop overlay too small on empty editors",
          'Skills import hardcoding "main" as default branch',
          "PAT authentication not working on WebSocket endpoint",
          "Runtime deletion blocked when all bound agents are archived",
        ],
      },
      {
        version: "0.1.21",
        date: "2026-04-09",
        title: "Projects, Search & Monorepo",
        changes: [
          "Project entity with full-stack CRUD — create, edit, and organize issues by project",
          "Project picker in the create-issue modal and CLI project commands",
          "Full-text search for issues with pg_bigm",
          "Monorepo extraction — shared packages for core, UI, and views (Turborepo)",
          "Fullscreen agent execution transcript view",
          "Drag-and-drop file upload with file card display in the editor",
          "Attachment section with image grid and file cards on issues",
          "Runtime owner tracking, filtering, avatar display, and point-to-point update notifications",
          "Sub-issue progress indicator in list view rows",
          "Done issue pagination in list view",
          "Codex session log scan for token usage reporting",
          "Daemon repo-cache fix for stale initial snapshots",
        ],
      },
      {
        version: "0.1.20",
        date: "2026-04-08",
        title: "Sub-Issues, TanStack Query & Usage Tracking",
        changes: [
          "Sub-issue support — create, view, and manage child issues within any issue",
          "Full migration to TanStack Query for server state (issues, inbox, workspace, runtimes)",
          "Per-task token usage tracking across all agent providers",
          "Multiple agents can now run concurrently on the same issue",
          "Board view: Done column shows total count with infinite scroll",
          "ReadonlyContent component for lightweight Markdown display in comments",
          "Optimistic UI updates for reactions and mutations with rollback",
          "WebSocket-driven cache invalidation replaces polling and refetch-on-focus",
          "Browser session persists during CLI login flow",
          "Daemon reuses existing worktrees by updating to latest remote",
          "Fixed slow tab switching caused by dynamic root layout",
        ],
      },
      {
        version: "0.1.18",
        date: "2026-04-07",
        title: "OAuth, OpenClaw & Issue Loading",
        changes: [
          "Google OAuth login",
          "OpenClaw runtime support for running agents on OpenClaw infrastructure",
          "Redesigned agent live card — always sticky with manual expand/collapse toggle",
          "Load all open issues without pagination limit; closed issues paginate on scroll",
          "JWT and CloudFront cookie expiration extended from 72 hours to 30 days",
          "Remember last selected workspace after re-login",
          "Daemon ensures harness CLI is on PATH in agent task environment",
          "PR template and CLI install guide for agent-driven setup",
        ],
      },
      {
        version: "0.1.17",
        date: "2026-04-05",
        title: "Comment Pagination & CLI Polish",
        changes: [
          "Comment list pagination in both the API and CLI",
          "Inbox archive now dismisses all items for the same issue at once",
          "CLI help output overhauled to match gh CLI style with examples",
          "Attachments use UUIDv7 as S3 key and auto-link on issue/comment creation",
          "@mention assigned agents on done or cancelled issues",
          "Reply @mention inheritance skips when the reply only mentions members",
          "Worktree setup preserves existing .env.worktree variables",
        ],
      },
      {
        version: "0.1.15",
        date: "2026-04-03",
        title: "Editor Overhaul & Agent Lifecycle",
        changes: [
          "Unified Tiptap editor with a single Markdown pipeline for editing and display",
          "Reliable Markdown paste, inline code spacing, and link styling",
          "Agent archive and restore — soft delete replaces hard delete",
          "Archived agents hidden from default agent list",
          "Skeleton loading states, error toasts, and confirmation dialogs across the app",
          "OpenCode added as a supported agent provider",
          "Reply-triggered agent tasks now inherit thread-root @mentions",
          "Granular real-time event handling for issues and inbox — no more full refetches",
          "Unified image upload flow for paste and button in the editor",
        ],
      },
      {
        version: "0.1.14",
        date: "2026-04-02",
        title: "Mentions & Permissions",
        changes: [
          "@mention issues in comments with server-side auto-expansion",
          "@all mention to notify every workspace member",
          "Inbox auto-scrolls to the referenced comment from a notification",
          "Repositories extracted into a standalone settings tab",
          "CLI update support from the web runtime page and direct download for non-Homebrew installs",
          "CLI commands for viewing issue execution runs and run messages",
          "Agent permission model — owners and admins manage agents, members manage skills on their own agents",
          "Per-issue serial execution to prevent concurrent task collisions",
          "File upload now supports all file types",
          "README redesign with quickstart guide",
        ],
      },
      {
        version: "0.1.13",
        date: "2026-04-01",
        title: "My Issues & i18n",
        changes: [
          "My Issues page with kanban board, list view, and scope tabs",
          "Simplified Chinese localization for the landing page",
          "About and Changelog pages for the marketing site",
          "Agent avatar upload in settings",
          "Attachment support for CLI comments and issue/comment APIs",
          "Unified avatar rendering with ActorAvatar across all pickers",
          "SEO optimization and auth flow improvements for landing pages",
          "CLI defaults to production API URLs",
          "License changed to Apache 2.0",
        ],
      },
      {
        version: "0.1.3",
        date: "2026-03-31",
        title: "Agent Intelligence",
        changes: [
          "Trigger agents via @mention in comments",
          "Stream live agent output to issue detail page",
          "Rich text editor \u2014 mentions, link paste, emoji reactions, collapsible threads",
          "File upload with S3 + CloudFront signed URLs and attachment tracking",
          "Agent-driven repo checkout with bare clone cache for task isolation",
          "Batch operations for issue list view",
          "Daemon authentication and security hardening",
        ],
      },
      {
        version: "0.1.2",
        date: "2026-03-28",
        title: "Collaboration",
        changes: [
          "Email verification login and browser-based CLI auth",
          "Multi-workspace daemon with hot-reload",
          "Runtime dashboard with usage charts and activity heatmaps",
          "Subscriber-driven notification model replacing hardcoded triggers",
          "Unified activity timeline with threaded comment replies",
          "Kanban board redesign with drag sorting, filters, and display settings",
          "Human-readable issue identifiers (e.g. JIA-1)",
          "Skill import from ClawHub and Skills.sh",
        ],
      },
      {
        version: "0.1.1",
        date: "2026-03-25",
        title: "Core Platform",
        changes: [
          "Multi-workspace switching and creation",
          "Agent management UI with skills",
          "Unified agent SDK supporting Claude Code and Codex backends",
          "Comment CRUD with real-time WebSocket updates",
          "Task service layer and daemon REST protocol",
          "Event bus with workspace-scoped WebSocket isolation",
          "Inbox notifications with unread badge and archive",
          "CLI with cobra subcommands for workspace and issue management",
        ],
      },
      {
        version: "0.1.0",
        date: "2026-03-22",
        title: "Foundation",
        changes: [
          "Go backend with REST API, JWT auth, and real-time WebSocket",
          "Next.js frontend with Linear-inspired UI",
          "Issues with board and list views and drag-and-drop kanban",
          "Agents, Inbox, and Settings pages",
          "One-click setup, migration CLI, and seed tool",
          "Comprehensive test suite \u2014 Go unit/integration, Vitest, Playwright E2E",
        ],
      },
    ],
  },
  dashboard: {
    issues: {
      title: "Issues",
      createNew: "New Issue",
      searchPlaceholder: "Search issues...",
      columns: {
        id: "ID",
        title: "Title",
        status: "Status",
        assignee: "Assignee",
        createdAt: "Created At",
      },
      status: {
        open: "Open",
        closed: "Closed",
        inProgress: "In Progress",
      },
    },
  },
  sidebar: {
    inbox: "Inbox",
    myIssues: "My Issues",
    issues: "Issues",
    projects: "Projects",
    agents: "Agents",
    runtimes: "Runtimes",
    skills: "Skills",
    settings: "Settings",
    groups: "Groups",
    pinned: "Pinned",
    workspace: "Workspace",
    configure: "Configure",
    newIssue: "New Issue",
    workspaces: "Workspaces",
    createWorkspace: "Create workspace",
    logout: "Log out",
    unpin: "Unpin",
    aiPowered: "AI-powered",
  },
  common: {
    workspace: "Workspace",
    status: "Status",
    priority: "Priority",
    assignee: "Assignee",
    creator: "Creator",
    project: "Project",
    members: "Members",
    agents: "Agents",
    noProject: "No project",
    removeFromProject: "Remove from project",
    searchPlaceholder: "Search...",
    actions: {
      cancel: "Cancel",
      create: "Create",
      creating: "Creating...",
      save: "Save",
      delete: "Delete",
    },
  },
  issueDetail: {
    emptyState: {
      notFound:
        "This issue does not exist or has been deleted in this workspace.",
    },
    errors: {
      updateFailed: "Failed to update issue",
      deleteFailed: "Failed to delete issue",
    },
    toast: {
      deleted: "Issue deleted",
      linkCopied: "Link copied",
    },
    navigation: {
      previous: "Previous issue",
      next: "Next issue",
    },
    actions: {
      backToIssues: "Back to Issues",
      pin: "Pin to sidebar",
      unpin: "Unpin from sidebar",
      createSubIssue: "Create sub-issue",
      addSubIssues: "Add sub-issues",
      addSubIssue: "Add sub-issue",
      copyLink: "Copy link",
      delete: "Delete issue",
      toggleSidebar: "Toggle sidebar",
      subscribe: "Subscribe",
      unsubscribe: "Unsubscribe",
    },
    delete: {
      title: "Delete issue",
      description:
        "This will permanently delete this issue and all its comments. This action cannot be undone.",
    },
    placeholders: {
      title: "Issue title",
      description: "Add description...",
      reply: "Leave a reply...",
    },
    labels: {
      subIssueOf: "Sub-issue of",
      subIssues: "Sub-issues",
      parentIssue: "Parent issue",
      noTaskRunsFound: "No task runs found for this issue",
      selectTask: "Select task:",
      agentFiles: "Agent Files",
      attachments: "Attachments",
    },
    sections: {
      properties: "Properties",
      details: "Details",
      tokenUsage: "Token usage",
    },
    properties: {
      dueDate: "Due date",
    },
    details: {
      createdBy: "Created by",
      created: "Created",
      updated: "Updated",
    },
    tokenUsage: {
      input: "Input",
      output: "Output",
      cache: "Cache",
      runs: "Runs",
    },
    dueDate: {
      today: "Today",
      tomorrow: "Tomorrow",
      nextWeek: "Next week",
      clear: "Clear date",
    },
    activity: {
      title: "Activity",
      created: "created this issue",
      statusChanged: "changed status from {from} to {to}",
      priorityChanged: "changed priority from {from} to {to}",
      selfAssigned: "self-assigned this issue",
      assignedTo: "assigned to {name}",
      removedAssignee: "removed assignee",
      changedAssignee: "changed assignee",
      removedDueDate: "removed due date",
      setDueDate: "set due date to {date}",
      renamed: 'renamed this issue from "{from}" to "{to}"',
      updatedDescription: "updated the description",
      taskCompleted: "completed the task",
      taskFailed: "task failed",
    },
    subscribers: {
      placeholder: "Change subscribers...",
      members: "Members",
      agents: "Agents",
    },
    assignee: {
      unassigned: "Unassigned",
    },
    priorities: {
      urgent: "Urgent",
      high: "High",
      medium: "Medium",
      low: "Low",
      noPriority: "No priority",
    },
  },
  modal: {
    createIssue: {
      title: "Create Issue",
      newIssue: "New Issue",
      newSubIssue: "New Sub-issue",
      fields: {
        title: "Title",
        description: "Description",
        status: "Status",
        priority: "Priority",
        assignee: "Assignee",
        dueDate: "Due Date",
        project: "Project",
      },
      placeholders: {
        title: "Enter issue title...",
        description: "Enter description...",
        assignee: "Assign to...",
        dueDate: "Select date...",
        project: "Select project...",
      },
      labels: {
        status: "Status",
        priority: "Priority",
        assignee: "Assign",
        dueDate: "Date",
        project: "Project",
      },
      expand: "Expand",
      collapse: "Collapse",
      close: "Close",
      creating: "Creating...",
      createIssue: "Create Issue",
      failedToCreate: "Failed to create issue",
      issueCreated: "Issue created",
      viewIssue: "View Issue",
    },
  },
  issues: {
    emptyState: {
      title: "No issues yet",
      subtitle: "Create an issue to get started.",
    },
    errors: {
      moveFailed: "Failed to move issue",
    },
  },
  board: {
    hideColumn: "Hide column",
    addIssue: "Add issue",
    noIssues: "No issues",
    hiddenColumns: "Hidden columns",
    showColumn: "Show column",
    statuses: {
      backlog: "Backlog",
      todo: "Todo",
      inProgress: "In Progress",
      inReview: "In Review",
      done: "Done",
      blocked: "Blocked",
      cancelled: "Cancelled",
    },
    priorities: {
      urgent: "Urgent",
      high: "High",
      medium: "Medium",
      low: "Low",
      noPriority: "No priority",
    },
    issues: {
      urgent: "Urgent",
      high: "High",
      medium: "Medium",
      low: "Low",
      none: "None",
    },
  },
  myIssues: {
    emptyState: {
      title: "No issues assigned to you",
      subtitle: "Issues you create or are assigned to will appear here.",
    },
    scopes: {
      assigned: { label: "Assigned", description: "Issues assigned to me" },
      created: { label: "Created", description: "Issues I created" },
      agents: { label: "My Agents", description: "Issues assigned to my agents" },
    },
  },
  issuesHeader: {
    newIssue: "New Issue",
    filter: "Filter",
    displaySettings: "Display settings",
    ordering: "Ordering",
    cardProperties: "Card properties",
    view: "View",
    boardView: "Board view",
    listView: "List view",
    resetAllFilters: "Reset all filters",
    ascending: "Ascending",
    descending: "Descending",
    noResults: "No results",
    members: "Members",
    agents: "Agents",
    noAssignee: "No assignee",
    noProject: "No project",
    issue: "issue",
    issues: "issues",
    stats: {
      inProgress: "In Progress",
      inReview: "In Review",
      done: "Done",
    },
    scopes: {
      all: { label: "All", description: "All issues in this workspace" },
      members: {
        label: "Members",
        description: "Issues assigned to team members",
      },
      agents: { label: "Agents", description: "Issues assigned to AI agents" },
    },
    sortOptions: {
      manual: "Manual",
      createdAt: "Created at",
      updatedAt: "Updated at",
      dueDate: "Due date",
      priority: "Priority",
      title: "Title",
    },
    cardPropertyOptions: {
      assignee: "Assignee",
      priority: "Priority",
      dueDate: "Due date",
      description: "Description",
    },
  },
  inbox: {
    title: "Inbox",
    unread: "unread",
    filter: "Filter",
    filterAll: "All",
    filterUnread: "Unread",
    filterRead: "Read",
    filterNoUnread: "No unread notifications",
    filterNoRead: "No read notifications",
    sections: {
      unread: "Unread",
      read: "Read",
    },
    emptyState: {
      title: "No notifications",
      subtitle: "Your inbox is empty",
    },
    detail: {
      empty: "Your inbox is empty",
      selectNotification: "Select a notification to view details",
    },
    actions: {
      markAllRead: "Mark all as read",
      archiveAll: "Archive all",
      archiveAllRead: "Archive all read",
      archiveCompleted: "Archive completed",
      archive: "Archive",
    },
    types: {
      issue_assigned: "Assigned",
      unassigned: "Unassigned",
      assignee_changed: "Assignee changed",
      status_changed: "Status changed",
      priority_changed: "Priority changed",
      due_date_changed: "Due date changed",
      new_comment: "New comment",
      mentioned: "Mentioned",
      review_requested: "Review requested",
      task_completed: "Task completed",
      task_failed: "Task failed",
      agent_blocked: "Agent blocked",
      agent_completed: "Agent completed",
      reaction_added: "Reacted",
    },
    detailLabels: {
      setStatusTo: "Set status to",
      setPriorityTo: "Set priority to",
      assignedTo: "Assigned to",
      removedAssignee: "Removed assignee",
      setDueDateTo: "Set due date to",
      removedDueDate: "Removed due date",
      reactedTo: "Reacted {emoji} to your comment",
    },
    errors: {
      markReadFailed: "Failed to mark as read",
      archiveFailed: "Failed to archive",
      markAllReadFailed: "Failed to mark all as read",
      archiveAllFailed: "Failed to archive all",
      archiveAllReadFailed: "Failed to archive read items",
      archiveCompletedFailed: "Failed to archive completed",
    },
  },
  projects: {
    title: "Projects",
    createProject: "New project",
    newProject: "New project",
    emptyState: {
      title: "No projects yet",
      subtitle: "Create a project to organize your issues",
      action: "Create your first project",
    },
    stats: {
      total: "{count} projects",
      inProgress: "In Progress",
      completed: "Completed",
      projects: "projects",
    },
    view: {
      grid: "Grid view",
      list: "List view",
    },
    sort: "Sort",
    sortOptions: {
      newest: "Newest",
      progress: "Progress",
      name: "Name",
    },
    columns: {
      name: "Name",
      priority: "Priority",
      status: "Status",
      progress: "Progress",
      lead: "Lead",
      created: "Created",
    },
    relativeTime: {
      today: "Today",
      daysAgo: "{days}d ago",
      monthsAgo: "{months}mo ago",
    },
    createDialog: {
      title: "New Project",
      titlePlaceholder: "Project title",
      descriptionPlaceholder: "Add description...",
      chooseIcon: "Choose icon",
      status: "Status",
      priority: "Priority",
      lead: "Lead",
      noLead: "No lead",
      members: "Members",
      agents: "Agents",
      noResults: "No results",
      creating: "Creating...",
      create: "Create Project",
      collapse: "Collapse",
      expand: "Expand",
      close: "Close",
    },
    errors: {
      createFailed: "Failed to create project",
    },
    toast: {
      created: "Project created",
    },
    detail: {
      projectNotFound: "Project not found",
      noIssuesLinked: "No issues linked",
      assignIssuesHint: "Assign issues to this project from the issue detail page.",
      pinToSidebar: "Pin to sidebar",
      unpinFromSidebar: "Unpin from sidebar",
      copyLink: "Copy link",
      deleteProject: "Delete project",
      toggleSidebar: "Toggle sidebar",
      changeIcon: "Change icon",
      titlePlaceholder: "Project title",
      properties: "Properties",
      status: "Status",
      priority: "Priority",
      lead: "Lead",
      noLead: "No lead",
      assignLeadPlaceholder: "Assign lead...",
      members: "Members",
      agents: "Agents",
      noResults: "No results",
      progress: "Progress",
      description: "Description",
      descriptionPlaceholder: "Add description...",
      removeFromProject: "Remove from project",
      deleteDialog: {
        title: "Delete project",
        description: "This will delete the project. Issues will not be deleted but will be unlinked.",
        cancel: "Cancel",
        delete: "Delete",
      },
    },
    priorities: {
      noPriority: "No Priority",
      urgent: "Urgent",
      high: "High",
      medium: "Medium",
      low: "Low",
    },
    statuses: {
      planned: "Planned",
      inProgress: "In Progress",
      paused: "Paused",
      completed: "Completed",
      cancelled: "Cancelled",
    },
  },
};
