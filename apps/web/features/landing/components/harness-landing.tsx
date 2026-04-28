"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useAuthStore } from "@multica/core/auth";
import { cn } from "@multica/ui/lib/utils";
import { useTheme } from "next-themes";
import {
  ArrowRight,
  Bot,
  Globe,
  Lock,
  Menu,
  Moon,
  Monitor,
  Plus,
  Settings,
  ShieldCheck,
  Sparkles,
  Sun,
  Users,
  Workflow,
  X,
  Zap,
} from "lucide-react";
import { localeLabels, locales, useLocale } from "../i18n";
import type { Locale } from "../i18n";
import {
  ClaudeCodeLogo,
  CodexLogo,
  GitHubMark,
  OpenClawLogo,
  OpenCodeLogo,
  TraeLogo,
  KimiLogo,
  HermesLogo,
  githubUrl,
} from "./shared";

type FeatureCard = {
  title: string;
  description: string;
  icon: React.ElementType;
};

type HowStep = {
  title: string;
  description: string;
};

type OpenSourceItem = {
  title: string;
  description: string;
  icon: React.ElementType;
};

type FaqItem = {
  question: string;
  answer: string;
};

type LandingContent = {
  nav: {
    features: string;
    howItWorks: string;
    openSource: string;
    faq: string;
    github: string;
    login: string;
    openWorkspace: string;
    trial: string;
    worksWith: string;
    backToTop: string;
  };
  hero: {
    eyebrow: string;
    line1: string;
    line2: string;
    description: string;
    primaryCta: string;
    secondaryCta: string;
    imageAlt: string;
  };
  featuresEyebrow: string;
  featuresTitleTop: string;
  featuresTitleBottom: string;
  features: FeatureCard[];
  howEyebrow: string;
  howTitleTop: string;
  howTitleBottom: string;
  howSteps: HowStep[];
  openSourceEyebrow: string;
  openSourceTitle: string;
  openSourceDescription: string;
  openSourceCta: string;
  openSourceItems: OpenSourceItem[];
  faqEyebrow: string;
  faqTitle: string;
  faqs: FaqItem[];
  finalTitleTop: string;
  finalTitleBottom: string;
  finalDescription: string;
  finalCta: string;
  footerCopyright: string;
};

const content: Record<Locale, LandingContent> = {
  en: {
    nav: {
      features: "Features",
      howItWorks: "How it works",
      openSource: "Open Source",
      faq: "FAQ",
      github: "GitHub",
      login: "Log in",
      openWorkspace: "Open workspace",
      trial: "Start free trial",
      worksWith: "Works with",
      backToTop: "Back to top",
    },
    hero: {
      eyebrow: "Open-source AI workforce management",
      line1: "In the future of team collaboration",
      line2: "partners are not just humans.",
      description:
        "Turn coding agents into real teammates. Assign tasks, track progress, compound skills, and manage your human + agent workforce in one place.",
      primaryCta: "Start free trial",
      secondaryCta: "View on GitHub",
      imageAlt: "AgentHarness dashboard preview",
    },
    featuresEyebrow: "Capabilities",
    featuresTitleTop: "Everything you need to manage",
    featuresTitleBottom: "an AI-powered workforce",
    features: [
      {
        title: "Assign like a colleague",
        description:
          "Agents appear in the same assignee picker as humans. One click to delegate, no special workflow needed.",
        icon: Users,
      },
      {
        title: "Autonomous execution",
        description:
          "Full task lifecycle from queue to completion. Agents report blockers proactively and stream progress in real time.",
        icon: Workflow,
      },
      {
        title: "Reusable skills",
        description:
          "Package knowledge into skills any agent can execute. Deploy, test, review, all codified and shared across the team.",
        icon: Sparkles,
      },
      {
        title: "Unified runtime panel",
        description:
          "Local daemons and cloud runtimes in one view. Real-time monitoring of status, usage, and cost across all compute.",
        icon: Monitor,
      },
      {
        title: "Compound growth",
        description:
          "Day 1: one agent deploys. Day 30: every agent deploys, writes tests, and reviews code. Capabilities grow exponentially.",
        icon: Zap,
      },
      {
        title: "Self-host anywhere",
        description:
          "Docker Compose, binary, or Kubernetes. Your data stays on your network with no vendor lock-in.",
        icon: ShieldCheck,
      },
    ],
    howEyebrow: "Get started",
    howTitleTop: "Hire your first AI employee",
    howTitleBottom: "in under an hour",
    howSteps: [
      {
        title: "Sign up & create workspace",
        description:
          "Enter your email, verify with a code, and your workspace is created automatically with no setup wizard.",
      },
      {
        title: "Install CLI & connect",
        description:
          "Run harness login, then harness daemon start. Auto-detects your installed coding agents.",
      },
      {
        title: "Create your first agent",
        description:
          "Name it, write instructions, attach skills. Agents activate on assignment, comment, or mention.",
      },
      {
        title: "Assign work and watch execution",
        description:
          "Delegate like a teammate. The task is queued, claimed, executed, and updated live with visible progress.",
      },
    ],
    openSourceEyebrow: "Open Source",
    openSourceTitle: "Open source for all.",
    openSourceDescription:
      "Inspect every line, self-host on your own terms, and shape the future of human + agent collaboration.",
    openSourceCta: "Star on GitHub",
    openSourceItems: [
      {
        title: "Self-host anywhere",
        description: "Docker Compose, binary, or K8s. Your data stays on your network.",
        icon: Globe,
      },
      {
        title: "No vendor lock-in",
        description: "Bring your own LLM provider, swap backends, and extend the API freely.",
        icon: Lock,
      },
      {
        title: "Transparent by default",
        description: "Every line auditable. See how agents decide and how tasks route.",
        icon: Settings,
      },
      {
        title: "Community-driven",
        description: "Contribute skills, integrations, and backends that benefit everyone.",
        icon: Bot,
      },
    ],
    faqEyebrow: "FAQ",
    faqTitle: "Questions & answers.",
    faqs: [
      {
        question: "What coding agents does Harness support?",
        answer:
          "Agent Harness supports Claude Code, Codex, OpenClaw, and OpenCode out of the box, and the runtime can be extended because the platform is open source.",
      },
      {
        question: "Do I need to self-host, or is there a cloud version?",
        answer:
          "Both. You can self-host with Docker Compose or Kubernetes, or run a hosted deployment if that better fits your team.",
      },
      {
        question: "Can agents work on long-running tasks?",
        answer:
          "Yes. Agent Harness manages the full task lifecycle so agents can pick up, execute, report blockers, and complete work asynchronously.",
      },
      {
        question: "Is my code safe?",
        answer:
          "Execution happens on your own machine or infrastructure. Agent Harness coordinates state and visibility, but your code can remain inside your environment."
      },
    ],
    finalTitleTop: "Ready to scale your team",
    finalTitleBottom: "beyond human limits?",
    finalDescription:
      "Start with one agent. Scale to ten. No credit card required.",
    finalCta: "Get started for free",
    footerCopyright: "© {year} Agent Harness. All rights reserved.",
  },
  zh: {
    nav: {
      features: "功能",
      howItWorks: "工作原理",
      openSource: "开源",
      faq: "常见问题",
      github: "GitHub",
      login: "登录",
      openWorkspace: "进入工作台",
      trial: "开始试用",
      worksWith: "兼容",
      backToTop: "返回顶部",
    },
    hero: {
      eyebrow: "天驭智能调度中枢",
      line1: "未来的团队协作里，",
      line2: "伙伴不止是人类。",
      description:
        "让编码 Agent 成为你的靠谱队友，统一任务分配、进度跟踪、能力沉淀，轻松管理人类与智能体协同团队。",
      primaryCta: "开始试用",
      secondaryCta: "查看 GitHub",
      imageAlt: "Agent Harness 控制台预览",
    },
    featuresEyebrow: "能力地图",
    featuresTitleTop: "管理 AI 劳动力，",
    featuresTitleBottom: "你需要的一切都在这里",
    features: [
      {
        title: "像同事一样分配",
        description: "Agent 和人类出现在同一个 assignee picker 里，一次点击就能委派，无需特殊流程。",
        icon: Users,
      },
      {
        title: "自主执行",
        description: "从队列到完成的完整任务生命周期，Agent 会主动报告阻塞并实时同步进度。",
        icon: Workflow,
      },
      {
        title: "可复用技能",
        description: "把知识打包成可执行技能，让任何 Agent 都能部署、测试、评审，并共享给整个团队。",
        icon: Sparkles,
      },
      {
        title: "统一运行面板",
        description: "本地 daemon 和云端 runtime 统一管理，实时查看状态、使用量与算力成本。",
        icon: Monitor,
      },
      {
        title: "能力复利",
        description: "第 1 天只有一个 Agent 会部署，第 30 天所有 Agent 都会部署、写测试、做评审。能力会不断复利。",
        icon: Zap,
      },
      {
        title: "随处自托管",
        description: "支持 Docker Compose、单机二进制或 Kubernetes。数据留在你的网络里，没有供应商锁定。",
        icon: ShieldCheck,
      },
    ],
    howEyebrow: "快速开始",
    howTitleTop: "在一小时内，",
    howTitleBottom: "雇到你的第一个 AI 员工",
    howSteps: [
      {
        title: "注册并创建工作区",
        description: "输入邮箱、验证码登录，系统会自动创建工作区，不需要额外的设置向导。",
      },
      {
        title: "运行RunTime",
        description: "运行RunTime-Start即可生成私人可用的Ai环境，无需额外安装。也可安装harness私用cli使用托管方式调用本地智能体。",
      },
      {
        title: "创建第一个 Agent",
        description: "给它命名、写说明、挂技能。Agent 会在被分配、被评论或被 mention 时自动激活。",
      },
      {
        title: "分配任务并观察执行",
        description: "像分配给同事一样委派任务，系统会自动排队、认领、执行，并实时回传可见进度。",
      },
    ],
    openSourceEyebrow: "开源",
    openSourceTitle: "为所有人而开源。",
    openSourceDescription: "检查每一行代码，按你的方式自托管，并一起塑造人类与 Agent 协作的未来。",
    openSourceCta: "在 GitHub Star",
    openSourceItems: [
      {
        title: "随处自托管",
        description: "Docker Compose、单机二进制或 K8s，数据留在你的网络里。",
        icon: Globe,
      },
      {
        title: "没有供应商锁定",
        description: "可自带 LLM provider、替换 backend，并自由扩展 API。",
        icon: Lock,
      },
      {
        title: "默认透明",
        description: "所有代码都可审计，看清 Agent 如何决策、任务如何路由。",
        icon: Settings,
      },
      {
        title: "社区驱动",
        description: "贡献技能、集成与 backend，让整个生态一起受益。",
        icon: Bot,
      },
    ],
    faqEyebrow: "常见问题",
    faqTitle: "常见问题。",
    faqs: [
      {
        question: "Agent Harness 支持哪些编码 Agent？",
        answer: "Agent Harness 默认支持 Claude Code、Codex、OpenClaw 和 OpenCode，你也可以扩展自己的 backend。",
      },
      {
        question: "必须自托管吗？还是有云版本？",
        answer: "两种都可以。你可以用 Docker Compose 或 Kubernetes 自托管，也可以选择托管部署。",
      },
      {
        question: "Agent 能处理长周期任务吗？",
        answer: "可以。Harness 管理完整的任务生命周期，Agent 可以异步认领、执行、汇报阻塞并完成任务。",
      },
      {
        question: "我的代码安全吗？",
        answer: "执行可以发生在你自己的机器或基础设施里。Harness 负责协调状态与可见性，你的代码可以继续留在你的环境中。",
      },
    ],
    finalTitleTop: "准备好把团队规模，",
    finalTitleBottom: "扩展到超越人力上限了吗？",
    finalDescription: "从一个 Agent 开始，扩展到十个。",
    finalCta: "免费开始",
    footerCopyright: "© {year} Agent Harness. 保留所有权利。",
  },
};

const runtimeLogos = [
  { name: "Claude Code", icon: ClaudeCodeLogo },
  { name: "Codex", icon: CodexLogo },
  { name: "OpenClaw", icon: OpenClawLogo },
  { name: "OpenCode", icon: OpenCodeLogo },
  { name: "Trae", icon: TraeLogo },
  { name: "Kimi", icon: KimiLogo },
  { name: "Hermes", icon: HermesLogo },
] as const;

export function HarnessLanding() {
  const { locale, setLocale } = useLocale();
  const user = useAuthStore((s) => s.user);
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const t = content[locale];

  useEffect(() => {
    setMounted(true);
  }, []);

  const toggleTheme = () => {
    setTheme(resolvedTheme === "dark" ? "light" : "dark");
  };

  return (
    <div id="top" className="min-h-full bg-[#faf8f5] text-foreground dark:bg-background">
      <div className="absolute inset-0 -z-10 hidden dark:block">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,oklch(0.55_0.16_255/0.2),oklch(0.15_0.02_250)_50%,transparent_80%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_20%,oklch(0.5_0.15_280/0.1),transparent_40%)]" />
      </div>

      <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_80%_60%_at_60%_0%,oklch(0.95_0.01_80/0.4),transparent_70%)] dark:hidden" />

      <header className="sticky top-0 z-40 border-b border-[#e8e4df] bg-[#faf8f5]/90 backdrop-blur-xl dark:border-border dark:bg-background/80">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <Link href="/" className="flex items-center gap-3 cursor-pointer">
            <span className="flex size-10 items-center justify-center rounded-xl bg-brand text-white font-bold text-sm">
              H
            </span>
            <span className="text-lg font-semibold tracking-tight">Agent Harness</span>
          </Link>

          <nav className="hidden items-center gap-8 lg:flex">
            <a href="#features" className="text-sm text-muted-foreground transition-colors hover:text-foreground cursor-pointer">
              {t.nav.features}
            </a>
            <a href="#how-it-works" className="text-sm text-muted-foreground transition-colors hover:text-foreground cursor-pointer">
              {t.nav.howItWorks}
            </a>
            <a href="#faq" className="text-sm text-muted-foreground transition-colors hover:text-foreground cursor-pointer">
              {t.nav.faq}
            </a>
          </nav>

          <div className="flex items-center gap-2 sm:gap-3">
            <button
              onClick={toggleTheme}
              className="flex size-10 items-center justify-center rounded-xl border border-border bg-card text-muted-foreground transition-all hover:bg-accent hover:text-foreground cursor-pointer"
              aria-label="Toggle theme"
            >
              {!mounted ? (
                <Moon className="size-5" />
              ) : resolvedTheme === "dark" ? (
                <Sun className="size-5" />
              ) : (
                <Moon className="size-5" />
              )}
            </button>

            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="flex size-10 items-center justify-center rounded-xl border border-border bg-card text-muted-foreground transition-all hover:bg-accent hover:text-foreground lg:hidden cursor-pointer"
              aria-label="Toggle menu"
            >
              {mobileMenuOpen ? <X className="size-5" /> : <Menu className="size-5" />}
            </button>

            <div className="hidden items-center rounded-xl border border-border bg-card p-1 sm:flex">
              {locales.map((item) => (
                <button
                  key={item}
                  onClick={() => setLocale(item)}
                  className={cn(
                    "rounded-lg px-3 py-1.5 text-xs font-medium transition-all",
                    item === locale
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground cursor-pointer",
                  )}
                >
                  {localeLabels[item]}
                </button>
              ))}
            </div>

            <Link
              href={user ? "/issues" : "/login"}
              className="hidden items-center justify-center rounded-xl px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground sm:inline-flex cursor-pointer"
            >
              {user ? t.nav.openWorkspace : t.nav.login}
            </Link>
            <Link
              href={user ? "/issues" : "/login"}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-brand px-5 py-2.5 text-sm font-semibold text-brand-foreground transition-colors hover:opacity-90 cursor-pointer"
            >
              {user ? t.nav.openWorkspace : t.nav.trial}
              <ArrowRight className="size-4" />
            </Link>
          </div>
        </div>
      </header>

      {mobileMenuOpen && (
        <div className="fixed inset-x-0 top-[73px] z-30 border-b border-border bg-background/95 backdrop-blur-xl lg:hidden">
          <nav className="mx-auto flex max-w-7xl flex-col gap-1 px-4 py-4 sm:px-6">
            <a
              href="#features"
              onClick={() => setMobileMenuOpen(false)}
              className="rounded-xl px-4 py-3 text-base font-medium text-foreground transition-colors hover:bg-accent cursor-pointer"
            >
              {t.nav.features}
            </a>
            <a
              href="#how-it-works"
              onClick={() => setMobileMenuOpen(false)}
              className="rounded-xl px-4 py-3 text-base font-medium text-foreground transition-colors hover:bg-accent cursor-pointer"
            >
              {t.nav.howItWorks}
            </a>
            <a
              href="#faq"
              onClick={() => setMobileMenuOpen(false)}
              className="rounded-xl px-4 py-3 text-base font-medium text-foreground transition-colors hover:bg-accent cursor-pointer"
            >
              {t.nav.faq}
            </a>
            <div className="mt-2 flex items-center gap-3 border-t border-border pt-4">
              <button
                onClick={toggleTheme}
                className="flex size-10 items-center justify-center rounded-xl border border-border bg-card text-muted-foreground transition-all hover:bg-accent hover:text-foreground cursor-pointer"
                aria-label="Toggle theme"
              >
                {mounted && resolvedTheme === "dark" ? <Sun className="size-5" /> : <Moon className="size-5" />}
              </button>
              <div className="flex items-center gap-2">
                {locales.map((item) => (
                  <button
                    key={item}
                    onClick={() => {
                      setLocale(item);
                      setMobileMenuOpen(false);
                    }}
                    className={cn(
                      "rounded-lg px-3 py-1.5 text-xs font-medium transition-all",
                      item === locale
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:text-foreground cursor-pointer",
                    )}
                  >
                    {localeLabels[item]}
                  </button>
                ))}
              </div>
            </div>
          </nav>
        </div>
      )}

      <main>
        <section className="relative overflow-hidden py-20 sm:py-32">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-4xl text-center">
              <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-1.5 text-sm font-medium text-muted-foreground">
                <span className="flex size-2 rounded-full bg-brand animate-pulse" />
                {t.hero.eyebrow}
              </div>

              <h1 className="mt-8 text-5xl sm:text-6xl lg:text-7xl font-bold tracking-tight">
                {t.hero.line1}
                <br />
                <span className="bg-gradient-to-r from-brand to-brand/60 bg-clip-text text-transparent">
                  {t.hero.line2}
                </span>
              </h1>

              <p className="mx-auto mt-8 max-w-2xl text-lg sm:text-xl text-muted-foreground leading-relaxed">
                {t.hero.description}
              </p>

              <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
                <Link
                  href={user ? "/issues" : "/login"}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-brand px-8 py-4 text-base font-semibold text-brand-foreground transition-all hover:opacity-90 cursor-pointer"
                >
                  {user ? t.nav.openWorkspace : t.hero.primaryCta}
                  <ArrowRight className="size-5" />
                </Link>
                <Link
                  href={githubUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-border bg-card px-8 py-4 text-base font-semibold transition-colors hover:bg-accent cursor-pointer"
                >
                  <GitHubMark className="size-5" />
                  {t.hero.secondaryCta}
                </Link>
              </div>

              <div className="mt-16">
                <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground/60">
                  {t.nav.worksWith}
                </p>
                <div className="mt-6 flex flex-wrap items-center justify-center gap-8">
                  {runtimeLogos.map((item) => {
                    const Icon = item.icon;
                    return (
                      <div key={item.name} className="flex items-center gap-2.5 text-muted-foreground">
                        <Icon className="size-6" />
                        <span className="text-sm font-medium">{item.name}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="mt-16 overflow-hidden rounded-3xl border border-border bg-card p-2 shadow-xl shadow-brand/5">
              <div className="overflow-hidden rounded-2xl bg-muted">
                <Image
                  src={mounted && resolvedTheme === "dark" ? "/images/landing-hero-new.png" : "/images/landing-hero-light.png"}
                  alt={t.hero.imageAlt}
                  width={3532}
                  height={2382}
                  className="block h-auto w-full"
                  sizes="(max-width: 1280px) 100vw, 1200px"
                  quality={85}
                  priority
                />
              </div>
            </div>
          </div>
        </section>

        <section id="features" className="bg-[#f5f3f0] py-20 sm:py-32 dark:bg-accent/50">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-2xl text-center">
              <p className="text-sm font-semibold uppercase tracking-widest text-brand">
                {t.featuresEyebrow}
              </p>
              <h2 className="mt-4 text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight">
                {t.featuresTitleTop}
                <br />
                <span className="text-muted-foreground">{t.featuresTitleBottom}</span>
              </h2>
            </div>

            <div className="mt-16 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {t.features.map((feature, index) => {
                const Icon = feature.icon;
                return (
                  <article
                    key={feature.title}
                    className={cn(
                      "group relative rounded-3xl border border-border bg-card p-8 transition-all hover:border-brand/30 hover:shadow-lg hover:shadow-brand/5 cursor-pointer",
                      index === 0 && "md:col-span-2 lg:col-span-1"
                    )}
                  >
                    <div className="flex size-12 items-center justify-center rounded-2xl bg-brand/10 text-brand transition-colors group-hover:bg-brand group-hover:text-white">
                      <Icon className="size-6" />
                    </div>
                    <h3 className="mt-6 text-xl font-semibold">
                      {feature.title}
                    </h3>
                    <p className="mt-3 text-muted-foreground leading-relaxed">
                      {feature.description}
                    </p>
                    <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-brand/20 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
                  </article>
                );
              })}
            </div>
          </div>
        </section>

        <section id="how-it-works" className="bg-[#faf8f5] py-20 sm:py-32 dark:bg-background">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="text-center">
              <p className="text-sm font-semibold uppercase tracking-widest text-brand">
                {t.howEyebrow}
              </p>
              <h2 className="mt-4 text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight">
                {t.howTitleTop}
                <br />
                <span className="text-muted-foreground">{t.howTitleBottom}</span>
              </h2>
            </div>

            <div className="mt-16 grid gap-8 md:grid-cols-2 lg:grid-cols-4">
              {t.howSteps.map((step, index) => (
                <div key={step.title} className="relative">
                  <div className="flex size-12 items-center justify-center rounded-2xl border border-border bg-card text-lg font-bold text-muted-foreground">
                    {String(index + 1).padStart(2, "0")}
                  </div>
                  <h3 className="mt-5 text-lg font-semibold">
                    {step.title}
                  </h3>
                  <p className="mt-2 text-muted-foreground leading-relaxed">
                    {step.description}
                  </p>
                  {index < t.howSteps.length - 1 && (
                    <div className="hidden lg:block absolute top-6 left-full w-full h-px bg-border -translate-x-8" />
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="faq" className="bg-[#f5f3f0] py-20 sm:py-32 dark:bg-background">
          <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
            <div className="text-center">
              <p className="text-sm font-semibold uppercase tracking-widest text-brand">
                {t.faqEyebrow}
              </p>
              <h2 className="mt-4 text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight">
                {t.faqTitle}
              </h2>
            </div>

            <div className="mt-16 space-y-4">
              {t.faqs.map((faq, index) => (
                <div
                  key={faq.question}
                  className="overflow-hidden rounded-2xl border border-border bg-card"
                >
                  <button
                    onClick={() => setOpenFaq(openFaq === index ? null : index)}
                    className="flex w-full items-center justify-between gap-4 px-6 py-5 text-left cursor-pointer"
                  >
                    <span className="text-base font-medium">
                      {faq.question}
                    </span>
                    <span
                      className={cn(
                        "flex size-6 items-center justify-center rounded-lg bg-muted text-muted-foreground transition-all",
                        openFaq === index && "rotate-45 bg-brand text-white"
                      )}
                    >
                      <Plus className="size-4" />
                    </span>
                  </button>
                  <div
                    className={cn(
                      "grid transition-all duration-200 ease-out",
                      openFaq === index ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
                    )}
                  >
                    <div className="overflow-hidden">
                      <p className="px-6 pb-6 text-muted-foreground leading-relaxed">
                        {faq.answer}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-20 text-center">
              <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight">
                {t.finalTitleTop}
                <br />
                <span className="bg-gradient-to-r from-brand to-brand/60 bg-clip-text text-transparent">
                  {t.finalTitleBottom}
                </span>
              </h2>
              <p className="mx-auto mt-6 max-w-md text-lg text-muted-foreground">
                {t.finalDescription}
              </p>
              <div className="mt-8">
                <Link
                  href={user ? "/issues" : "/login"}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-brand px-8 py-4 text-base font-semibold text-brand-foreground transition-all hover:opacity-90 cursor-pointer"
                >
                  {user ? t.nav.openWorkspace : t.finalCta}
                  <ArrowRight className="size-5" />
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-[#e8e4df] bg-[#f0ede8] dark:border-border dark:bg-card">
        <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-10 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
          <div className="flex items-center gap-3">
            <span className="flex size-9 items-center justify-center rounded-lg bg-brand text-white font-bold text-xs">
              H
            </span>
            <span className="text-base font-semibold">Agent Harness</span>
          </div>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-muted-foreground">
            <a href={githubUrl} target="_blank" rel="noreferrer" className="transition-colors hover:text-foreground cursor-pointer">
              {t.nav.github}
            </a>
            <a href="#features" className="transition-colors hover:text-foreground cursor-pointer">
              {t.nav.features}
            </a>
            <a href="#how-it-works" className="transition-colors hover:text-foreground cursor-pointer">
              {t.nav.howItWorks}
            </a>
            <a href="#top" className="transition-colors hover:text-foreground cursor-pointer">
              {t.nav.backToTop}
            </a>
          </div>
          <p className="text-sm text-muted-foreground">
            {t.footerCopyright.replace("{year}", String(new Date().getFullYear()))}
          </p>
        </div>
      </footer>
    </div>
  );
}