"use client";

import dynamic from "next/dynamic";
import type { ComponentType } from "react";
import { AppLoading } from "./AppFrame";

/** Props every app may receive from its window (`win.props`). */
export interface AppProps {
  slug?: string;
  tab?: string;
  tag?: string;
}

/**
 * Apps are code-split: nothing below is downloaded until its window is opened
 * (the desktop itself ships only the window chrome). `dynamic()` is called with a
 * literal import() each time so the bundler can split and preload correctly.
 */
export const APP_COMPONENTS: Record<string, ComponentType<AppProps>> = {
  welcome: dynamic(() => import("@/components/apps/WelcomeApp").then((m) => m.WelcomeApp), {
    loading: () => <AppLoading name="Welcome.exe" />,
  }),
  about: dynamic(() => import("@/components/apps/AboutApp").then((m) => m.AboutApp), {
    loading: () => <AppLoading name="About Me.exe" />,
  }),
  projects: dynamic(() => import("@/components/apps/ProjectsApp").then((m) => m.ProjectsApp), {
    loading: () => <AppLoading name="Projects.exe" />,
  }),
  built: dynamic(() => import("@/components/apps/ProjectsApp").then((m) => m.ProjectsApp), {
    loading: () => <AppLoading name="Built Projects.exe" />,
  }),
  important: dynamic(() => import("@/components/apps/ProjectsApp").then((m) => m.ProjectsApp), {
    loading: () => <AppLoading name="Important Projects.exe" />,
  }),
  project: dynamic(() => import("@/components/apps/ProjectWindow").then((m) => m.ProjectWindow), {
    loading: () => <AppLoading name="project" />,
  }),
  playground: dynamic(() => import("@/components/apps/PlaygroundApp").then((m) => m.PlaygroundApp), {
    loading: () => <AppLoading name="RUN MY PROJECTS.exe" />,
  }),
  demo: dynamic(() => import("@/components/apps/DemoWindow").then((m) => m.DemoWindow), {
    loading: () => <AppLoading name="application" />,
  }),
  skills: dynamic(() => import("@/components/apps/SkillsApp").then((m) => m.SkillsApp), {
    loading: () => <AppLoading name="Skills.exe" />,
  }),
  journey: dynamic(() => import("@/components/apps/JourneyApp").then((m) => m.JourneyApp), {
    loading: () => <AppLoading name="JOURNEY.exe" />,
  }),
  github: dynamic(() => import("@/components/apps/GitHubApp").then((m) => m.GitHubApp), {
    loading: () => <AppLoading name="GitHub.exe" />,
  }),
  resume: dynamic(() => import("@/components/apps/ResumeApp").then((m) => m.ResumeApp), {
    loading: () => <AppLoading name="Resume.exe" />,
  }),
  contact: dynamic(() => import("@/components/apps/ContactApp").then((m) => m.ContactApp), {
    loading: () => <AppLoading name="Contact.exe" />,
  }),
  terminal: dynamic(() => import("@/components/apps/TerminalApp").then((m) => m.TerminalApp), {
    loading: () => <AppLoading name="Terminal" />,
  }),
  sysinfo: dynamic(() => import("@/components/apps/SystemInfoApp").then((m) => m.SystemInfoApp), {
    loading: () => <AppLoading name="System Info" />,
  }),
  stack: dynamic(() => import("@/components/apps/StackApp").then((m) => m.StackApp), {
    loading: () => <AppLoading name="STACK.exe" />,
  }),
  howibuild: dynamic(() => import("@/components/apps/HowIBuildApp").then((m) => m.HowIBuildApp), {
    loading: () => <AppLoading name="HOW I BUILD.exe" />,
  }),
  blog: dynamic(() => import("@/components/apps/BlogApp").then((m) => m.BlogApp), {
    loading: () => <AppLoading name="DHIRAJ.LOG" />,
  }),
  recycle: dynamic(() => import("@/components/apps/RecycleApp").then((m) => m.RecycleApp), {
    loading: () => <AppLoading name="Recycle Bin" />,
  }),
  hidden: dynamic(() => import("@/components/apps/HiddenApp").then((m) => m.HiddenApp), {
    loading: () => <AppLoading name="DhirajOS.exe" />,
  }),
};
