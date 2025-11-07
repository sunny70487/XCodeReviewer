import Dashboard from "@/pages/Dashboard";
import Projects from "@/pages/Projects";
import ProjectDetail from "@/pages/ProjectDetail";
import RecycleBin from "@/pages/RecycleBin";
import InstantAnalysis from "@/pages/InstantAnalysis";
import AuditTasks from "@/pages/AuditTasks";
import TaskDetail from "@/pages/TaskDetail";
import AdminDashboard from "@/pages/AdminDashboard";
import LogsPage from "@/pages/LogsPage";
import type { ReactNode } from 'react';

export interface RouteConfig {
  name: string;
  path: string;
  element: ReactNode;
  visible?: boolean;
}

const routes: RouteConfig[] = [
  {
    name: "儀表盤",
    path: "/",
    element: <Dashboard />,
    visible: true,
  },
  {
    name: "專案管理",
    path: "/projects",
    element: <Projects />,
    visible: true,
  },
  {
    name: "專案詳情",
    path: "/projects/:id",
    element: <ProjectDetail />,
    visible: false,
  },
  {
    name: "即時分析",
    path: "/instant-analysis",
    element: <InstantAnalysis />,
    visible: true,
  },
  {
    name: "審計任務",
    path: "/audit-tasks",
    element: <AuditTasks />,
    visible: true,
  },
  {
    name: "任務詳情",
    path: "/tasks/:id",
    element: <TaskDetail />,
    visible: false,
  },
  {
    name: "系統管理",
    path: "/admin",
    element: <AdminDashboard />,
    visible: true,
  },
  {
    name: "回收站",
    path: "/recycle-bin",
    element: <RecycleBin />,
    visible: true,
  },
  {
    name: "系統日誌",
    path: "/logs",
    element: <LogsPage />,
    visible: true,
  },
];

export default routes;