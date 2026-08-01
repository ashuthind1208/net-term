import { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { FileText, Upload, Search, Folder, ExternalLink, Trash2, Plus, File } from "lucide-react";

const CAT_COLORS = { sop:"bg-blue-100 text-blue-700", contract:"bg-purple-100 text-purple-700", meeting_notes:"bg-yellow-100 text-yellow-700", report:"bg-green-100 text-green-700", specification:"bg-orange-100 text-orange-700", other:"bg-gray-100 text-gray-600" };

export default function DocumentHub() {
  const [docs, setDocs] = useState([]);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterCat, setFilterCat] = useState("all");
  const [filterProject, setFilterProject] = useState("all");
  const [showDialog, setShowDialog] = useState(false);
  const [form, setForm] = useState({ title:"", category:"other", project_id:"", description:"", version:"1.0", tags:"" });
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [file, setFile] = useState(null);
  const fileRef = useRef();
  const [user, setUser] = useState(null);

  useEffect(() => {
    loadData();
    base44.auth.me().then(setUser).catch(()=>{});
  }, []);

  async function loadData() {
    const [d, p] = await Promise.all([base44.entities.Document.list('-created_date'), base44.entities.Project.list()]);
    setDocs(d); setProjects(p); setLoading(false);
  }

  async function handleSave() {
    if (!form.title) return;
    setSaving(true);
    let file_url = "";
    if (file) {
      setUploading(true);
      const res = await base44.integrations.Core.UploadFile({ file });
      file_url = res.file_url;
      setUploading(false);
    }
    const proj = projects.find(p => p.id === form.project_id);
    const tags = form.tags ? form.tags.split(",").map(t=>t.trim()).filter(Boolean) : [];
    await base44.entities.Document.create({
      ...form, project_name: proj?.name || "", file_url,
      tags, uploaded_by: user?.email || "", uploaded_by_name: user?.full_name || ""
    });
    await loadData();
    setSaving(false); setShowDialog(false);
    setForm({ title:"", category:"other", project_id:"", description:"", version:"1.0", tags:"" });
    setFile(null);
  }

  async function handleDelete(id) {
    await base44.entities.Document.delete(id);
    setDocs(d => d.filter(doc => doc.id !== id));
  }

  const filtered = docs.filter(d => {
    const q = search.toLowerCase();
    return (d.title?.toLowerCase().includes(q) || d.description?.toLowerCase().includes(q) || d.tags?.join(" ").toLowerCase().includes(q))
      && (filterCat === "all" || d.category === filterCat)
      && (filterProject === "all" || d.project_id === filterProject);
  });

  const catGroups = [...new Set(filtered.map(d => d.category))];

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-4 border-[#210F37] border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div><h2 className="text-xl font-bold text-[#210F37]">Document & Knowledge Hub</h2><p className="text-gray-500 text-sm">{docs.length} documents · SOPs, Contracts, Reports & more</p></div>
        <Button onClick={() => setShowDialog(true)} className="bg-[#210F37] hover:bg-[#4F1C51] text-white"><Plus className="w-4 h-4 mr-1" /> Upload Doc</Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {["sop","contract","report","meeting_notes"].map(cat => (
          <Card key={cat} className="border-0 shadow-sm cursor-pointer hover:shadow-md transition-all" onClick={() => setFilterCat(filterCat === cat ? "all" : cat)}>
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold text-[#210F37]">{docs.filter(d=>d.category===cat).length}</p>
              <p className="text-xs text-gray-500 capitalize mt-0.5">{cat.replace("_"," ")}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input placeholder="Search documents, tags…" className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <Select value={filterCat} onValueChange={setFilterCat}>
          <SelectTrigger className="w-36"><SelectValue placeholder="Category" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {["sop","contract","meeting_notes","report","specification","other"].map(c => <SelectItem key={c} value={c}>{c.replace("_"," ")}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterProject} onValueChange={setFilterProject}>
          <SelectTrigger className="w-44"><SelectValue placeholder="All Projects" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Projects</SelectItem>
            {projects.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Documents Grid */}
      {filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-400"><Folder className="w-12 h-12 mx-auto mb-2 opacity-30" /><p>No documents found</p></div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(doc => (
            <div key={doc.id} className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 hover:shadow-md transition-all group">
              <div className="flex items-start justify-between gap-2 mb-3">
                <div className="w-10 h-10 bg-[#210F37]/10 rounded-lg flex items-center justify-center flex-shrink-0">
                  <FileText className="w-5 h-5 text-[#210F37]" />
                </div>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  {doc.file_url && <a href={doc.file_url} target="_blank" rel="noopener noreferrer"><Button size="icon" variant="ghost" className="h-7 w-7"><ExternalLink className="w-3.5 h-3.5" /></Button></a>}
                  <Button size="icon" variant="ghost" className="h-7 w-7 text-red-500 hover:text-red-700" onClick={() => handleDelete(doc.id)}><Trash2 className="w-3.5 h-3.5" /></Button>
                </div>
              </div>
              <p className="font-semibold text-sm text-[#210F37] mb-1 line-clamp-2">{doc.title}</p>
              {doc.description && <p className="text-xs text-gray-500 mb-2 line-clamp-2">{doc.description}</p>}
              <div className="flex flex-wrap gap-1 mb-2">
                <Badge className={`text-xs ${CAT_COLORS[doc.category] || "bg-gray-100 text-gray-600"}`}>{doc.category?.replace("_"," ")}</Badge>
                {doc.version && <Badge variant="outline" className="text-xs">v{doc.version}</Badge>}
              </div>
              {doc.tags?.length > 0 && <div className="flex flex-wrap gap-1 mb-2">{doc.tags.slice(0,3).map(t=><span key={t} className="bg-gray-100 text-gray-600 text-xs px-2 py-0.5 rounded-full">#{t}</span>)}</div>}
              <div className="text-xs text-gray-400 flex items-center justify-between mt-2 pt-2 border-t border-gray-100">
                <span>{doc.project_name || "No project"}</span>
                <span>{doc.uploaded_by_name || "Unknown"}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle className="text-[#210F37]">Upload Document</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div><Label>Title *</Label><Input value={form.title} onChange={e => setForm(f=>({...f,title:e.target.value}))} placeholder="Document title" className="mt-1" /></div>
            <div><Label>Category</Label>
              <Select value={form.category} onValueChange={v => setForm(f=>({...f,category:v}))}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>{["sop","contract","meeting_notes","report","specification","other"].map(c=><SelectItem key={c} value={c}>{c.replace("_"," ")}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Project</Label>
              <Select value={form.project_id} onValueChange={v => setForm(f=>({...f,project_id:v}))}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Select project" /></SelectTrigger>
                <SelectContent>{projects.map(p=><SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Description</Label><textarea value={form.description} onChange={e => setForm(f=>({...f,description:e.target.value}))} rows={2} className="w-full mt-1 rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm outline-none focus:ring-1 focus:ring-ring" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Version</Label><Input value={form.version} onChange={e => setForm(f=>({...f,version:e.target.value}))} placeholder="1.0" className="mt-1" /></div>
              <div><Label>Tags (comma separated)</Label><Input value={form.tags} onChange={e => setForm(f=>({...f,tags:e.target.value}))} placeholder="tag1, tag2" className="mt-1" /></div>
            </div>
            <div>
              <Label>File</Label>
              <div className="mt-1 border-2 border-dashed border-gray-200 rounded-lg p-4 text-center cursor-pointer hover:border-[#210F37]/50 transition-colors" onClick={() => fileRef.current?.click()}>
                {file ? <p className="text-sm text-[#210F37] flex items-center justify-center gap-2"><File className="w-4 h-4" />{file.name}</p> : <><Upload className="w-6 h-6 mx-auto text-gray-400 mb-1" /><p className="text-xs text-gray-400">Click to select a file</p></>}
                <input ref={fileRef} type="file" className="hidden" onChange={e => setFile(e.target.files?.[0] || null)} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving || !form.title} className="bg-[#210F37] hover:bg-[#4F1C51] text-white">{uploading ? "Uploading…" : saving ? "Saving…" : "Upload"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}