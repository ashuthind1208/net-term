import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import {
  User, Mail, Phone, Briefcase, Building2, Upload, Save,
  Camera, MapPin, Calendar, Clock, Star, Shield, Award, CheckCircle2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format, differenceInMonths } from "date-fns";
import { parseLocalDate } from "@/lib/dateUtils";

const DEPARTMENTS = ["Engineering", "Operations", "Finance", "HR", "Sales", "Marketing", "Legal", "Management", "Field"];
const EMPLOYMENT_TYPES = ["Full-time", "Part-time", "Contractor", "Consultant"];
const SKILL_OPTIONS = ["Project Management", "Field Operations", "Financial Analysis", "Client Relations", "Technical Writing", "Safety Compliance", "Procurement", "Scheduling", "Quality Control", "Estimating"];

export default function Profile() {
  const [user, setUser] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [timesheets, setTimesheets] = useState([]);
  const [form, setForm] = useState({
    phone: "", job_title: "", department: "",
    location: "", bio: "", employment_type: "",
    start_date: "", emergency_contact: "", skills: [], hourly_rate: ""
  });
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    base44.auth.me().then(async u => {
      setUser(u);
      setForm({
        phone: u.phone || "",
        job_title: u.job_title || "",
        department: u.department || "",
        location: u.location || "",
        bio: u.bio || "",
        employment_type: u.employment_type || "",
        start_date: u.start_date || "",
        emergency_contact: u.emergency_contact || "",
        skills: u.skills || [],
        hourly_rate: u.hourly_rate || "",
      });
      const [tR, tsR] = await Promise.allSettled([
        base44.entities.Task.list(),
        base44.entities.Timesheet.list(),
      ]);
      const allT = tR.status === "fulfilled" ? tR.value : [];
      const allTs = tsR.status === "fulfilled" ? tsR.value : [];
      setTasks(allT.filter(t => t.assigned_to?.includes(u.email)));
      setTimesheets(allTs.filter(ts => ts.employee_email === u.email));
    });
  }, []);

  const handleSave = async () => {
    setSaving(true);
    await base44.auth.updateMe(form);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
    setSaving(false);
  };

  const handlePhotoUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    await base44.auth.updateMe({ photo_url: file_url });
    setUser(u => ({ ...u, photo_url: file_url }));
    setUploading(false);
  };

  const toggleSkill = (skill) => {
    setForm(f => ({
      ...f,
      skills: f.skills.includes(skill) ? f.skills.filter(s => s !== skill) : [...f.skills, skill]
    }));
  };

  if (!user) return (
    <div className="flex items-center justify-center h-48">
      <div className="w-8 h-8 border-4 border-[#A55B4B] border-t-transparent rounded-full animate-spin" />
    </div>
  );

  // Activity stats
  const completedTasks = tasks.filter(t => t.status === "completed").length;
  const totalHours = timesheets.filter(t => t.status === "approved").reduce((s, t) => s + (t.hours || 0), 0);
  const pendingTimesheets = timesheets.filter(t => t.status === "pending").length;
  const tenure = form.start_date
    ? differenceInMonths(new Date(), parseLocalDate(form.start_date))
    : null;

  // Earned badges
  const badges = [];
  if (completedTasks >= 1) badges.push({ label: "Task Closer", icon: CheckCircle2, color: "bg-green-100 text-green-700" });
  if (completedTasks >= 10) badges.push({ label: "10 Tasks Done", icon: Star, color: "bg-yellow-100 text-yellow-700" });
  if (totalHours >= 40) badges.push({ label: "40h Logged", icon: Clock, color: "bg-blue-100 text-blue-700" });
  if (totalHours >= 200) badges.push({ label: "200h Contributor", icon: Award, color: "bg-purple-100 text-purple-700" });
  if (tenure !== null && tenure >= 6) badges.push({ label: `${tenure}m Tenure`, icon: Shield, color: "bg-[#F5F0FF] text-[#4F1C51]" });
  if (user.role === "admin") badges.push({ label: "Admin", icon: Shield, color: "bg-purple-100 text-purple-700" });

  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto space-y-5">
      <h2 className="text-xl font-bold text-[#210F37]">My Profile</h2>

      {/* Avatar & identity */}
      <Card className="border-0 shadow-sm">
        <CardContent className="p-6">
          <div className="flex flex-col sm:flex-row items-center gap-5">
            <div className="relative flex-shrink-0">
              <Avatar className="w-24 h-24 border-4 border-[#A55B4B]">
                <AvatarImage src={user.photo_url} />
                <AvatarFallback className="bg-gradient-to-br from-[#A55B4B] to-[#4F1C51] text-white text-2xl">
                  {user.full_name?.[0] || user.email?.[0] || "U"}
                </AvatarFallback>
              </Avatar>
              <label className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-[#A55B4B] flex items-center justify-center cursor-pointer hover:bg-[#4F1C51] transition-colors border-2 border-white">
                <Camera className="w-4 h-4 text-white" />
                <input type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} />
              </label>
            </div>
            <div className="flex-1 text-center sm:text-left">
              <h3 className="text-xl font-bold text-[#210F37]">{user.full_name || "—"}</h3>
              <p className="text-gray-500 text-sm">{form.job_title || user.email}</p>
              {form.department && <p className="text-xs text-gray-400">{form.department} · {form.employment_type || "Full-time"}</p>}
              {form.location && (
                <p className="text-xs text-gray-400 flex items-center gap-1 mt-1 justify-center sm:justify-start">
                  <MapPin className="w-3 h-3" /> {form.location}
                </p>
              )}
              {uploading && <p className="text-xs text-[#A55B4B] mt-1">Uploading photo…</p>}
              <div className="flex gap-2 mt-2 flex-wrap justify-center sm:justify-start">
                <Badge className={user.role === "admin" ? "bg-purple-100 text-purple-700" : "bg-green-100 text-green-700"}>
                  {user.role || "user"}
                </Badge>
                {form.employment_type && <Badge className="bg-gray-100 text-gray-600">{form.employment_type}</Badge>}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Activity stats */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="border-0 shadow-sm text-center">
          <CardContent className="p-3">
            <p className="text-2xl font-bold text-[#A55B4B]">{completedTasks}</p>
            <p className="text-xs text-gray-400 mt-0.5">Tasks Done</p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm text-center">
          <CardContent className="p-3">
            <p className="text-2xl font-bold text-[#4F1C51]">{totalHours}h</p>
            <p className="text-xs text-gray-400 mt-0.5">Hours Logged</p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm text-center">
          <CardContent className="p-3">
            <p className="text-2xl font-bold text-orange-500">{pendingTimesheets}</p>
            <p className="text-xs text-gray-400 mt-0.5">Pending TS</p>
          </CardContent>
        </Card>
      </div>

      {/* Badges */}
      {badges.length > 0 && (
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-[#210F37] flex items-center gap-2">
              <Award className="w-4 h-4 text-[#DCA06D]" /> Earned Badges
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {badges.map((b, i) => {
                const Icon = b.icon;
                return (
                  <div key={i} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium ${b.color}`}>
                    <Icon className="w-3.5 h-3.5" /> {b.label}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Profile Details */}
      <Card className="border-0 shadow-sm">
        <CardHeader><CardTitle className="text-base text-[#210F37]">Profile Details</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label className="flex items-center gap-2"><Mail className="w-4 h-4 text-gray-400" /> Email</Label>
            <Input value={user.email} disabled className="mt-1 bg-gray-50" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label className="flex items-center gap-2"><Phone className="w-4 h-4 text-gray-400" /> Phone</Label>
              <Input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="+1 555 000 0000" className="mt-1" />
            </div>
            <div>
              <Label className="flex items-center gap-2"><MapPin className="w-4 h-4 text-gray-400" /> Location / Site</Label>
              <Input value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} placeholder="e.g. Toronto, ON or Site A" className="mt-1" />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label className="flex items-center gap-2"><Briefcase className="w-4 h-4 text-gray-400" /> Job Title</Label>
              <Input value={form.job_title} onChange={e => setForm(f => ({ ...f, job_title: e.target.value }))} placeholder="e.g. Field Technician" className="mt-1" />
            </div>
            <div>
              <Label className="flex items-center gap-2"><Building2 className="w-4 h-4 text-gray-400" /> Department</Label>
              <Select value={form.department} onValueChange={v => setForm(f => ({ ...f, department: v }))}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Select department" /></SelectTrigger>
                <SelectContent>
                  {DEPARTMENTS.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label className="flex items-center gap-2"><User className="w-4 h-4 text-gray-400" /> Employment Type</Label>
              <Select value={form.employment_type} onValueChange={v => setForm(f => ({ ...f, employment_type: v }))}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Select type" /></SelectTrigger>
                <SelectContent>
                  {EMPLOYMENT_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="flex items-center gap-2"><Calendar className="w-4 h-4 text-gray-400" /> Start Date</Label>
              <Input type="date" value={form.start_date} onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))} className="mt-1" />
            </div>
          </div>
          <div>
            <Label className="flex items-center gap-2"><User className="w-4 h-4 text-gray-400" /> Emergency Contact</Label>
            <Input value={form.emergency_contact} onChange={e => setForm(f => ({ ...f, emergency_contact: e.target.value }))} placeholder="Name & phone number" className="mt-1" />
          </div>
          <div>
            <Label className="flex items-center gap-2"><Clock className="w-4 h-4 text-gray-400" /> Hourly Rate ($/hr)</Label>
            <Input type="number" min="0" step="0.01" value={form.hourly_rate} onChange={e => setForm(f => ({ ...f, hourly_rate: e.target.value }))} placeholder="e.g. 45.00" className="mt-1" />
            <p className="text-xs text-gray-400 mt-1">Used for labour cost calculations in project finance</p>
          </div>
          <div>
            <Label>Bio / Notes</Label>
            <Textarea value={form.bio} onChange={e => setForm(f => ({ ...f, bio: e.target.value }))} placeholder="Brief description of your role and experience…" className="mt-1" rows={3} />
          </div>
          <div>
            <Label className="block mb-2">Skills & Expertise</Label>
            <div className="flex flex-wrap gap-2">
              {SKILL_OPTIONS.map(skill => (
                <button
                  key={skill}
                  type="button"
                  onClick={() => toggleSkill(skill)}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition-all border ${
                    form.skills.includes(skill)
                      ? "bg-[#A55B4B] text-white border-[#A55B4B]"
                      : "bg-white text-gray-600 border-gray-200 hover:border-[#A55B4B]"
                  }`}
                >
                  {skill}
                </button>
              ))}
            </div>
          </div>
          <Button onClick={handleSave} disabled={saving} className="w-full bg-[#A55B4B] hover:bg-[#4F1C51] text-white">
            {saved ? "✓ Saved!" : saving ? "Saving…" : <><Save className="w-4 h-4 mr-2" /> Save Changes</>}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}