import React, { useState, useEffect } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import {
  Users,
  UserCheck,
  Settings,
  LogOut,
  UserPlus,
  List,
  Key,
  BarChart,
  Menu,
  X,
  HelpCircle,
  GitBranch,
} from "lucide-react";
import clsx from "clsx";
import { supabase, getCurrentUser, type UserProfile } from "../lib/supabase";
import GlobalSearch from "./GlobalSearch";
import NotificationBell from "./NotificationBell";
import toast from "react-hot-toast";

const Sidebar = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<(UserProfile & { email: string }) | null>(
    null
  );
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    getCurrentUser().then(setUser);
  }, []);

  const handleLogout = async () => {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        navigate("/login");
        return;
      }

      await supabase.auth.refreshSession();

      const { error } = await supabase.auth.signOut();
      if (error) throw error;

      setUser(null);
      navigate("/login");
    } catch (error: any) {
      console.error("Error during logout:", error);

      if (
        error.message?.includes("session_not_found") ||
        error.status === 403
      ) {
        navigate("/login");
        return;
      }

      toast.error("Failed to logout. Please try again.");
    }
  };

  const navItems =
    user?.role === "admin"
      ? [
          { icon: Users, label: "Sales", path: "/" },
          { icon: UserPlus, label: "Users", path: "/users" },
          { icon: List, label: "Lead Statuses", path: "/statuses" },
          { icon: HelpCircle, label: "Lead Questions", path: "/questions" },
          { icon: Key, label: "API Keys", path: "/api" },
          { icon: BarChart, label: "API Dashboard", path: "/api/dashboard" },
          {
            icon: GitBranch,
            label: "Assignment Rules",
            path: "/assignment-rules",
          },
          { icon: Settings, label: "Settings", path: "/settings" },
        ]
      : [{ icon: Users, label: "Sales", path: "/" }];

  const renderNavItems = () => (
    <nav className="space-y-2 flex-1">
      {navItems.map((item) => (
        <NavLink
          key={item.path}
          to={item.path}
          onClick={() => setIsMobileMenuOpen(false)}
          className={({ isActive }) =>
            clsx(
              "flex items-center space-x-3 px-4 py-2 rounded-lg transition-colors",
              isActive
                ? "bg-gray-700 text-white"
                : "text-gray-400 hover:bg-gray-700 hover:text-white"
            )
          }
        >
          <item.icon size={20} />
          <span>{item.label}</span>
        </NavLink>
      ))}
    </nav>
  );

  return (
    <>
      <button
        onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
        className="lg:hidden fixed top-4 right-4 z-50 p-2 bg-gray-800 rounded-lg text-gray-400 hover:text-white"
      >
        {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
      </button>

      <div
        className={clsx(
          "lg:hidden fixed inset-0 bg-gray-900 z-40 transition-transform duration-300",
          isMobileMenuOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="h-full overflow-y-auto p-4">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-xl font-bold">CRM BackOffice</h1>
            <NotificationBell />
          </div>
          <GlobalSearch />
          {user && (
            <p className="text-sm text-gray-400 mt-4">
              {user.full_name} ({user.role})
            </p>
          )}
          <div className="mt-8">{renderNavItems()}</div>
          <button
            onClick={handleLogout}
            className="mt-4 flex items-center space-x-3 px-4 py-2 rounded-lg text-gray-400 hover:bg-gray-700 hover:text-white transition-colors w-full"
          >
            <LogOut size={20} />
            <span>Logout</span>
          </button>
        </div>
      </div>

      <div className="hidden lg:flex w-64 bg-gray-800 p-4 flex-col">
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-xl font-bold">CRM BackOffice</h1>
            <NotificationBell />
          </div>
          <GlobalSearch />
          {user && (
            <p className="text-sm text-gray-400 mt-4">
              {user.full_name} ({user.role})
            </p>
          )}
        </div>

        {renderNavItems()}

        <button
          onClick={handleLogout}
          className="flex items-center space-x-3 px-4 py-2 rounded-lg text-gray-400 hover:bg-gray-700 hover:text-white transition-colors"
        >
          <LogOut size={20} />
          <span>Logout</span>
        </button>
      </div>
    </>
  );
};

export default Sidebar;
