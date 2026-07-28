import { trpc } from "@/lib/trpc";
import { invalidateTaskDomain } from "@/lib/queryHelpers";
import { cn } from "@/lib/utils";
import { Download, Upload, FileText, CheckCircle2, AlertTriangle, Loader2, ChevronDown, ChevronUp, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useState, useRef } from "react";
import { toast } from "sonner";
import { format } from "date-fns";
import { Skeleton } from "@/components/ui/skeleton";

export default function ImportPage() {
  const utils = trpc.useUtils();
  const [dragOver, setDragOver] = useState(false);
  const [importing, setImporting] = useState(false);
  const [expandedLog, setExpandedLog] = useState<number | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const { data: logs, isLoading: logsLoading } = trpc.import.logs.useQuery();

  const importMutation = trpc.import.notionCsv.useMutation({
    onSuccess: (result) => {
      utils.import.logs.invalidate();
      invalidateTaskDomain(utils);
      setImporting(false);
      toast.success(`Import complete! ${result.projectsImported} projects, ${result.tasksImported} tasks imported.`);
    },
    onError: (e) => {
      setImporting(false);
      toast.error(`Import failed: ${e.message}`);
    },
  });

  const handleFile = async (file: File) => {
    if (!file) return;
    const isZip = file.name.endsWith(".zip");
    const isCsv = file.name.endsWith(".csv");
    if (!isZip && !isCsv) {
      toast.error("Please upload a .csv or .zip file from Notion export");
      return;
    }
    setImporting(true);
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      importMutation.mutate({ fileContent: content, fileName: file.name, fileType: isZip ? "zip" : "csv" });
    };
    if (isZip) reader.readAsDataURL(file);
    else reader.readAsText(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
          <Download className="w-5 h-5 text-primary" /> Import from Notion
        </h1>
        <p className="text-muted-foreground text-sm mt-0.5">
          Import your Notion Project Board and Task Board exports into BOSS OS
        </p>
      </div>

      {/* Instructions */}
      <div className="glass-card rounded-xl p-5 border border-blue-400/20">
        <div className="flex items-start gap-3">
          <Info className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" />
          <div className="space-y-2">
            <h3 className="font-semibold text-sm text-blue-400">How to export from Notion</h3>
            <ol className="text-xs text-muted-foreground space-y-1.5 list-decimal list-inside">
              <li>Open your Notion database (Project Board or Task Board)</li>
              <li>Click the <strong className="text-foreground">···</strong> menu at the top right of the database</li>
              <li>Select <strong className="text-foreground">Export</strong></li>
              <li>Choose <strong className="text-foreground">CSV</strong> format and download</li>
              <li>Upload the .csv file below (or the .zip if you exported multiple databases)</li>
            </ol>
            <div className="mt-3 p-3 bg-blue-400/5 rounded-lg border border-blue-400/15">
              <p className="text-xs text-blue-300/80">
                <strong>Supported fields:</strong> Name, Status, Priority, Due Date, Start Date, Area, Notes, % Complete, Tags, and more. 
                The importer automatically maps Notion fields to BOSS OS data model.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Upload Zone */}
      <div
        className={cn(
          "glass-card rounded-xl p-10 border-2 border-dashed transition-all duration-200 text-center cursor-pointer",
          dragOver ? "border-primary bg-primary/5" : "border-border/50 hover:border-primary/40 hover:bg-muted/20",
          importing && "pointer-events-none opacity-60"
        )}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => fileRef.current?.click()}
      >
        <input
          ref={fileRef}
          type="file"
          accept=".csv,.zip"
          className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ""; }}
        />
        {importing ? (
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="w-10 h-10 text-primary animate-spin" />
            <p className="text-sm font-medium text-foreground">Importing your data...</p>
            <p className="text-xs text-muted-foreground">Parsing CSV and mapping to BOSS OS format</p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3">
            <div className="w-14 h-14 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center">
              <Upload className="w-6 h-6 text-primary" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">Drop your Notion export here</p>
              <p className="text-xs text-muted-foreground mt-1">or click to browse · Supports .csv and .zip files</p>
            </div>
            <div className="flex gap-2">
              <Badge variant="outline" className="text-xs">Project Board CSV</Badge>
              <Badge variant="outline" className="text-xs">Task Board CSV</Badge>
              <Badge variant="outline" className="text-xs">ZIP Export</Badge>
            </div>
          </div>
        )}
      </div>

      {/* Import History */}
      <div className="glass-card rounded-xl p-5">
        <h2 className="font-semibold text-sm flex items-center gap-2 mb-4">
          <FileText className="w-4 h-4 text-primary" /> Import History
        </h2>
        {logsLoading ? (
          <div className="space-y-2">{[1,2].map((i) => <Skeleton key={i} className="h-12 rounded-lg" />)}</div>
        ) : !logs || logs.length === 0 ? (
          <p className="text-muted-foreground text-sm text-center py-6">No imports yet</p>
        ) : (
          <div className="space-y-2">
            {logs.map((log) => (
              <div key={log.id} className="border border-border/50 rounded-lg overflow-hidden">
                <button
                  className="w-full flex items-center gap-3 p-3 hover:bg-muted/20 transition-colors text-left"
                  onClick={() => setExpandedLog(expandedLog === log.id ? null : log.id)}
                >
                  {log.status === "completed" ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                  ) : log.status === "failed" ? (
                    <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0" />
                  ) : (
                    <Loader2 className="w-4 h-4 text-blue-400 animate-spin flex-shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-foreground truncate">{log.fileName}</div>
                    <div className="text-xs text-muted-foreground">
                      {format(new Date(log.createdAt), "MMM d, yyyy h:mm a")} ·{" "}
                      {log.projectsImported ?? 0} projects, {log.tasksImported ?? 0} tasks
                    </div>
                  </div>
                  <Badge className={cn("text-[10px] flex-shrink-0",
                    log.status === "completed" ? "bg-emerald-400/10 text-emerald-400 border-emerald-400/30" :
                    log.status === "failed" ? "bg-red-400/10 text-red-400 border-red-400/30" :
                    "bg-blue-400/10 text-blue-400 border-blue-400/30"
                  )}>
                    {log.status}
                  </Badge>
                  {expandedLog === log.id ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />}
                </button>
                {expandedLog === log.id && log.errorMessage && (
                  <div className="px-3 pb-3 border-t border-border/30">
                    <p className="text-xs text-red-400 mt-2 font-mono bg-red-400/5 p-2 rounded">{log.errorMessage}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
