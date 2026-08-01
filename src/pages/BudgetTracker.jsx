import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import {
  DollarSign, TrendingUp, TrendingDown, AlertTriangle,
  CheckCircle2, BarChart3, Filter, Calendar
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, PieChart, Pie, Legend
} from "recharts";
import { format, differenceInDays } from "date-fns";
import { parseLocalDate } from "@/lib/dateUtils";

const COLORS = ["#A55B4B", "#4F1C51", "#DCA06D", "#210F37", "#7B3F6E", "#2D9CDB", "#27AE60", "#EB5757"];

export default function BudgetTracker() {
  const [projects, setProjects] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState("all");
  const [sortBy, setSortBy] = useState("budget_used");

  useEffect(() => {
    Promise.allSettled([
      base44.entities.Project.list(),
      base44.entities.Expense.list(),
    ]).then(([pR, eR]) => {
      setProjects(pR.status === "fulfilled" ? pR.value : []);
      setExpenses(eR.status === "fulfilled" ? eR.value : []);
      setLoading(false);
    });
  }, []);

  const enriched = projects
    .filter(p => p.budget > 0) // only projects with a budget
    .map(p => {
      const pExp = expenses.filter(e => e.project_id === p.id);
      const approved = pExp.filter(e => e.status === "approved").reduce((s, e) => s + (e.amount || 0), 0);
      const pending = pExp.filter(e => e.status === "pending").reduce((s, e) => s + (e.amount || 0), 0);
      const committed = approved + pending; // approved + pending = committed
      const remaining = p.budget - approved;
      const budgetUsed = Math.round((approved / p.budget) * 100);
      const committedPct = Math.min(Math.round((committed / p.budget) * 100), 100);

      // Burn rate: approved spend / days since project start
      const daysRunning = p.start_date
        ? Math.max(1, differenceInDays(new Date(), parseLocalDate(p.start_date)))
        : 30;
      const dailyBurnRate = approved / daysRunning;

      // Days until budget exhausted at current burn rate
      const daysUntilExhausted = dailyBurnRate > 0 ? Math.round(remaining / dailyBurnRate) : null;

      // Category breakdown
      const byCategory = pExp
        .filter(e => e.status === "approved")
        .reduce((acc, e) => {
          acc[e.category || "Other"] = (acc[e.category || "Other"] || 0) + (e.amount || 0);
          return acc;
        }, {});
      const categoryData = Object.entries(byCategory).map(([name, value]) => ({ name, value }));

      let healthStatus = "on_track";
      if (budgetUsed >= 100) healthStatus = "over_budget";
      else if (budgetUsed >= 85) healthStatus = "critical";
      else if (budgetUsed >= 70) healthStatus = "warning";

      return {
        ...p, approved, pending, committed, remaining, budgetUsed, committedPct,
        dailyBurnRate, daysUntilExhausted, categoryData, healthStatus
      };
    })
    .filter(p => filterStatus === "all" || p.healthStatus === filterStatus || p.status === filterStatus)
    .sort((a, b) => {
      if (sortBy === "budget_used") return b.budgetUsed - a.budgetUsed;
      if (sortBy === "remaining") return a.remaining - b.remaining;
      if (sortBy === "budget") return b.budget - a.budget;
      return 0;
    });

  const totalBudget = enriched.reduce((s, p) => s + p.budget, 0);
  const totalSpent = enriched.reduce((s, p) => s + p.approved, 0);
  const totalPending = enriched.reduce((s, p) => s + p.pending, 0);
  const overBudgetCount = enriched.filter(p => p.healthStatus === "over_budget").length;
  const atRiskCount = enriched.filter(p => p.healthStatus === "critical" || p.healthStatus === "warning").length;

  const healthColor = {
    on_track: { badge: "bg-green-100 text-green-700", bar: "bg-green-500", icon: CheckCircle2, iconColor: "text-green-500" },
    warning: { badge: "bg-yellow-100 text-yellow-700", bar: "bg-yellow-500", icon: TrendingUp, iconColor: "text-yellow-500" },
    critical: { badge: "bg-orange-100 text-orange-700", bar: "bg-orange-500", icon: AlertTriangle, iconColor: "text-orange-500" },
    over_budget: { badge: "bg-red-100 text-red-700", bar: "bg-red-500", icon: TrendingDown, iconColor: "text-red-600" },
  };

  // Summary chart data
  const summaryData = enriched.map(p => ({
    name: p.name?.substring(0, 12) + (p.name?.length > 12 ? "…" : ""),
    Budget: p.budget,
    Spent: p.approved,
    Pending: p.pending,
  }));

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-4 border-[#A55B4B] border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-[#210F37] flex items-center gap-2">
          <DollarSign className="w-5 h-5 text-[#A55B4B]" /> Budget Tracker
        </h2>
        <p className="text-gray-500 text-sm mt-1">Real-time budget vs. actual spend across all projects</p>
      </div>

      {/* Summary KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Total Budget", value: `$${totalBudget.toLocaleString()}`, icon: BarChart3, color: "bg-[#4F1C51]", sub: `${enriched.length} projects` },
          { label: "Total Spent", value: `$${totalSpent.toLocaleString()}`, icon: DollarSign, color: "bg-[#A55B4B]", sub: `${Math.round((totalSpent / totalBudget) * 100) || 0}% of budget` },
          { label: "Pending", value: `$${totalPending.toLocaleString()}`, icon: Calendar, color: "bg-[#DCA06D]", sub: "awaiting approval" },
          { label: "At Risk", value: `${overBudgetCount + atRiskCount}`, icon: AlertTriangle, color: overBudgetCount > 0 ? "bg-red-500" : "bg-orange-400", sub: `${overBudgetCount} over budget` },
        ].map(({ label, value, icon: Icon, color, sub }) => (
          <Card key={label} className="border-0 shadow-sm">
            <CardContent className="p-4 flex items-center gap-3">
              <div className={`p-2 rounded-xl ${color} flex-shrink-0`}><Icon className="w-4 h-4 text-white" /></div>
              <div>
                <p className="text-xs text-gray-400">{label}</p>
                <p className="font-bold text-[#210F37] text-lg leading-tight">{value}</p>
                <p className="text-xs text-gray-400">{sub}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Overall budget bar */}
      {totalBudget > 0 && (
        <Card className="border-0 shadow-sm">
          <CardContent className="p-5">
            <div className="flex justify-between text-sm mb-2">
              <span className="font-medium text-[#210F37]">Overall Portfolio Budget</span>
              <span className="text-gray-500">{Math.round((totalSpent / totalBudget) * 100)}% used</span>
            </div>
            <div className="relative h-4 bg-gray-100 rounded-full overflow-hidden">
              <div className="absolute left-0 top-0 h-full bg-[#A55B4B] rounded-full transition-all" style={{ width: `${Math.min((totalSpent / totalBudget) * 100, 100)}%` }} />
              {totalPending > 0 && (
                <div className="absolute top-0 h-full bg-[#DCA06D] opacity-60 rounded-full" style={{ left: `${Math.min((totalSpent / totalBudget) * 100, 100)}%`, width: `${Math.min((totalPending / totalBudget) * 100, 100 - (totalSpent / totalBudget) * 100)}%` }} />
              )}
            </div>
            <div className="flex gap-4 mt-2 text-xs text-gray-500">
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[#A55B4B] inline-block" /> Approved ${totalSpent.toLocaleString()}</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[#DCA06D] inline-block" /> Pending ${totalPending.toLocaleString()}</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-gray-200 inline-block" /> Remaining ${(totalBudget - totalSpent).toLocaleString()}</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Budget vs Spent chart */}
      {summaryData.length > 0 && (
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-[#210F37]">Budget vs. Spent by Project</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={summaryData} barGap={4}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip formatter={v => [`$${Number(v).toLocaleString()}`, ""]} />
                <Legend iconSize={10} wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="Budget" fill="#E8E0F0" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Spent" fill="#A55B4B" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Pending" fill="#DCA06D" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <Filter className="w-4 h-4 text-gray-400" />
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-40"><SelectValue placeholder="Filter by health" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Projects</SelectItem>
            <SelectItem value="over_budget">Over Budget</SelectItem>
            <SelectItem value="critical">Critical (&gt;85%)</SelectItem>
            <SelectItem value="warning">Warning (&gt;70%)</SelectItem>
            <SelectItem value="on_track">On Track</SelectItem>
          </SelectContent>
        </Select>
        <Select value={sortBy} onValueChange={setSortBy}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="budget_used">Sort: % Used</SelectItem>
            <SelectItem value="remaining">Sort: Remaining</SelectItem>
            <SelectItem value="budget">Sort: Budget Size</SelectItem>
          </SelectContent>
        </Select>
        <span className="text-sm text-gray-400">{enriched.length} projects with budget</span>
      </div>

      {/* Per-project breakdown */}
      {enriched.length === 0 ? (
        <Card className="border-0 shadow-sm">
          <CardContent className="py-16 text-center">
            <DollarSign className="w-12 h-12 text-gray-200 mx-auto mb-3" />
            <p className="text-gray-400">No projects with budgets found. Add a budget to your projects to track spending.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {enriched.map(p => {
            const h = healthColor[p.healthStatus];
            const HealthIcon = h.icon;
            return (
              <Card key={p.id} className="border-0 shadow-sm overflow-hidden">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between gap-3 mb-4">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-3 h-3 rounded-full flex-shrink-0 mt-1" style={{ background: p.color || "#A55B4B" }} />
                      <div className="min-w-0">
                        <h3 className="font-semibold text-[#210F37] truncate">{p.name}</h3>
                        <p className="text-xs text-gray-400">{p.client_name || "Internal"} • {p.status}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <HealthIcon className={`w-4 h-4 ${h.iconColor}`} />
                      <Badge className={`text-xs ${h.badge}`}>{p.healthStatus.replace("_", " ")}</Badge>
                    </div>
                  </div>

                  {/* Main budget bar */}
                  <div className="mb-3">
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-gray-500">Budget utilization</span>
                      <span className={`font-semibold ${p.budgetUsed >= 100 ? "text-red-600" : p.budgetUsed >= 85 ? "text-orange-500" : "text-green-600"}`}>
                        {p.budgetUsed}%
                      </span>
                    </div>
                    <div className="relative h-3 bg-gray-100 rounded-full overflow-hidden">
                      <div className={`absolute left-0 top-0 h-full rounded-full transition-all ${h.bar}`}
                        style={{ width: `${Math.min(p.budgetUsed, 100)}%` }} />
                      {p.pending > 0 && p.budgetUsed < 100 && (
                        <div className="absolute top-0 h-full bg-[#DCA06D] opacity-70"
                          style={{ left: `${Math.min(p.budgetUsed, 100)}%`, width: `${Math.min(p.committedPct - p.budgetUsed, 100 - p.budgetUsed)}%` }} />
                      )}
                    </div>
                  </div>

                  {/* Numbers row */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div>
                      <p className="text-xs text-gray-400">Total Budget</p>
                      <p className="font-bold text-[#210F37]">${p.budget.toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-400">Approved Spend</p>
                      <p className="font-bold text-[#A55B4B]">${p.approved.toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-400">Pending</p>
                      <p className="font-bold text-[#DCA06D]">${p.pending.toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-400">Remaining</p>
                      <p className={`font-bold ${p.remaining < 0 ? "text-red-600" : "text-green-600"}`}>
                        {p.remaining < 0 ? "-" : ""}${Math.abs(p.remaining).toLocaleString()}
                      </p>
                    </div>
                  </div>

                  {/* Burn rate & forecast */}
                  {p.dailyBurnRate > 0 && (
                    <div className="mt-3 pt-3 border-t border-gray-100 flex flex-wrap gap-4 text-xs text-gray-500">
                      <span>Daily burn rate: <strong className="text-[#210F37]">${p.dailyBurnRate.toFixed(0)}/day</strong></span>
                      {p.daysUntilExhausted !== null && p.remaining > 0 && (
                        <span>Budget runs out in: <strong className={p.daysUntilExhausted < 14 ? "text-red-600" : "text-[#210F37]"}>{p.daysUntilExhausted} days</strong></span>
                      )}
                      {p.end_date && (
                        <span>Project ends: <strong className="text-[#210F37]">{format(parseLocalDate(p.end_date), "MMM d, yyyy")}</strong></span>
                      )}
                    </div>
                  )}

                  {/* Category pie - only show if there are categories */}
                  {p.categoryData.length > 1 && (
                    <div className="mt-4 pt-3 border-t border-gray-100">
                      <p className="text-xs font-medium text-gray-500 mb-2">Spend by Category</p>
                      <div className="flex items-center gap-4">
                        <ResponsiveContainer width={80} height={80}>
                          <PieChart>
                            <Pie data={p.categoryData} cx="50%" cy="50%" innerRadius={22} outerRadius={36} dataKey="value" paddingAngle={3}>
                              {p.categoryData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                            </Pie>
                          </PieChart>
                        </ResponsiveContainer>
                        <div className="flex flex-wrap gap-x-4 gap-y-1">
                          {p.categoryData.map((d, i) => (
                            <div key={d.name} className="flex items-center gap-1 text-xs text-gray-600">
                              <span className="w-2 h-2 rounded-full inline-block" style={{ background: COLORS[i % COLORS.length] }} />
                              {d.name}: ${d.value.toFixed(0)}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}