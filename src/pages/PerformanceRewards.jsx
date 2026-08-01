import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Trophy, Star, Zap, Award, TrendingUp, CheckCircle2, Clock, Medal } from "lucide-react";
import { parseLocalDate } from "@/lib/dateUtils";

const BADGES = [
  { id: "streak7", label: "7-Day Streak", icon: "🔥", desc: "Active 7 days in a row", condition: (stats) => stats.activeDays >= 7 },
  { id: "tasks10", label: "Task Master", icon: "✅", desc: "Completed 10+ tasks", condition: (stats) => stats.completedTasks >= 10 },
  { id: "hours100", label: "Centurion", icon: "⏱️", desc: "Logged 100+ hours", condition: (stats) => stats.totalHours >= 100 },
  { id: "ontime", label: "On-Time Hero", icon: "🎯", desc: "80%+ tasks on time", condition: (stats) => stats.onTimeRate >= 80 },
  { id: "collab", label: "Team Player", icon: "🤝", desc: "Worked on 3+ projects", condition: (stats) => stats.projectCount >= 3 },
  { id: "top", label: "Top Performer", icon: "🌟", desc: "Highest completion rate", condition: (stats) => stats.rank === 1 },
];

export default function PerformanceRewards() {
  const [users, setUsers] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [timesheets, setTimesheets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState(null);

  useEffect(() => {
    loadData();
    base44.auth.me().then(setCurrentUser).catch(()=>{});
  }, []);

  async function loadData() {
    const [u, t, ts] = await Promise.all([base44.entities.User.list(), base44.entities.Task.list(), base44.entities.Timesheet.list()]);
    setUsers(u); setTasks(t); setTimesheets(ts); setLoading(false);
  }

  function getUserStats(user) {
    const userTasks = tasks.filter(t => (t.assigned_to || []).includes(user.email));
    const completedTasks = userTasks.filter(t => t.status === "completed").length;
    const onTimeTasks = userTasks.filter(t => t.status === "completed" && (!t.due_date || new Date(t.completed_at||Date.now()) <= parseLocalDate(t.due_date))).length;
    const onTimeRate = completedTasks ? Math.round(onTimeTasks / completedTasks * 100) : 0;
    const totalHours = timesheets.filter(ts => ts.employee_email === user.email && ts.status === "approved").reduce((s, ts) => s + (ts.hours || 0), 0);
    const projectIds = [...new Set(userTasks.map(t => t.project_id).filter(Boolean))];
    const completionRate = userTasks.length ? Math.round(completedTasks / userTasks.length * 100) : 0;
    const activeDays = Math.min(30, timesheets.filter(ts => ts.employee_email === user.email).length);
    return { completedTasks, onTimeRate, totalHours, projectCount: projectIds.length, completionRate, activeDays, totalTasks: userTasks.length };
  }

  const leaderboard = users.map((u, i) => {
    const stats = getUserStats(u);
    const score = stats.completedTasks * 10 + stats.totalHours * 2 + stats.onTimeRate;
    return { ...u, stats, score };
  }).sort((a, b) => b.score - a.score).map((u, i) => ({ ...u, stats: { ...u.stats, rank: i + 1 } }));

  const myStats = leaderboard.find(u => u.email === currentUser?.email);
  const myBadges = myStats ? BADGES.filter(b => b.condition(myStats.stats)) : [];

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-4 border-[#210F37] border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-gradient-to-br from-[#DCA06D] to-[#A55B4B] rounded-xl flex items-center justify-center">
          <Trophy className="w-5 h-5 text-white" />
        </div>
        <div><h2 className="text-xl font-bold text-[#210F37]">Performance & Rewards</h2><p className="text-gray-500 text-sm">Leaderboard · Achievements · Streaks</p></div>
      </div>

      {/* My Stats Card */}
      {myStats && (
        <Card className="border-0 shadow-sm bg-gradient-to-r from-[#210F37] to-[#4F1C51] text-white overflow-hidden relative">
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -translate-y-8 translate-x-8" />
          <CardContent className="p-5">
            <div className="flex items-center gap-4 mb-4">
              <Avatar className="w-14 h-14 border-2 border-[#DCA06D]">
                <AvatarImage src={myStats.photo_url} />
                <AvatarFallback className="bg-[#A55B4B] text-white text-lg">{myStats.full_name?.[0] || "U"}</AvatarFallback>
              </Avatar>
              <div>
                <p className="text-white font-bold text-lg">{myStats.full_name}</p>
                <div className="flex items-center gap-2">
                  <Medal className="w-4 h-4 text-[#DCA06D]" />
                  <p className="text-[#DCA06D] text-sm">Rank #{myStats.stats.rank} of {leaderboard.length}</p>
                </div>
              </div>
              <div className="ml-auto text-right">
                <p className="text-3xl font-bold text-[#DCA06D]">{myStats.score}</p>
                <p className="text-white/60 text-xs">points</p>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3 mb-4">
              <div className="text-center"><p className="text-xl font-bold text-white">{myStats.stats.completedTasks}</p><p className="text-xs text-white/60">Tasks Done</p></div>
              <div className="text-center"><p className="text-xl font-bold text-white">{myStats.stats.totalHours}h</p><p className="text-xs text-white/60">Hours Logged</p></div>
              <div className="text-center"><p className="text-xl font-bold text-white">{myStats.stats.onTimeRate}%</p><p className="text-xs text-white/60">On-Time Rate</p></div>
            </div>
            {myBadges.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {myBadges.map(b => (
                  <div key={b.id} className="flex items-center gap-1 bg-white/10 rounded-full px-3 py-1 text-xs"><span>{b.icon}</span><span>{b.label}</span></div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Leaderboard */}
        <div className="lg:col-span-2">
          <h3 className="font-semibold text-[#210F37] flex items-center gap-2 mb-3"><Trophy className="w-4 h-4 text-[#DCA06D]" /> Team Leaderboard</h3>
          <div className="space-y-2">
            {leaderboard.slice(0, 10).map((u, i) => {
              const isMe = u.email === currentUser?.email;
              const rankColors = ["text-yellow-500", "text-gray-400", "text-orange-500"];
              return (
                <div key={u.id} className={`flex items-center gap-3 p-3 rounded-xl transition-all ${isMe ? "bg-[#210F37]/10 border border-[#210F37]/20" : "bg-white border border-gray-100"} shadow-sm`}>
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0 ${i < 3 ? "bg-gradient-to-br from-[#DCA06D] to-[#A55B4B] text-white" : "bg-gray-100 text-gray-600"}`}>
                    {i < 3 ? ["🥇","🥈","🥉"][i] : i + 1}
                  </div>
                  <Avatar className="w-8 h-8 flex-shrink-0">
                    <AvatarImage src={u.photo_url} />
                    <AvatarFallback className="bg-[#A55B4B] text-white text-xs">{u.full_name?.[0] || "U"}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium truncate ${isMe ? "text-[#210F37] font-semibold" : "text-gray-800"}`}>{u.full_name || u.email} {isMe && <span className="text-xs text-[#A55B4B]">(you)</span>}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <Progress value={u.stats.completionRate} className="h-1 w-20" />
                      <span className="text-xs text-gray-400">{u.stats.completionRate}%</span>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-sm font-bold text-[#210F37]">{u.score}</p>
                    <p className="text-xs text-gray-400">pts</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Badges Panel */}
        <div>
          <h3 className="font-semibold text-[#210F37] flex items-center gap-2 mb-3"><Award className="w-4 h-4 text-[#DCA06D]" /> Achievement Badges</h3>
          <div className="space-y-2">
            {BADGES.map(b => {
              const earned = myStats && b.condition(myStats.stats);
              return (
                <div key={b.id} className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${earned ? "bg-[#DCA06D]/10 border-[#DCA06D]/30" : "bg-gray-50 border-gray-100 opacity-50"}`}>
                  <div className={`text-2xl flex-shrink-0 ${earned ? "" : "grayscale"}`}>{b.icon}</div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-semibold ${earned ? "text-[#210F37]" : "text-gray-500"}`}>{b.label}</p>
                    <p className="text-xs text-gray-400">{b.desc}</p>
                  </div>
                  {earned && <CheckCircle2 className="w-4 h-4 text-[#DCA06D] flex-shrink-0" />}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}