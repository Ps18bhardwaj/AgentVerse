import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Document, Page } from "react-pdf";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ChevronLeft,
  ChevronRight,
  FileWarning,
  Loader2,
  X,
  ZoomIn,
  ZoomOut,
  FileText,
  Trash2,
  Eye,
  UploadCloud,
} from "lucide-react";
import "@/lib/pdf";
import { documentFileUrl, listDocuments, deleteDocument, uploadDocuments, type DocumentInfo } from "@/lib/api";
import { useStore } from "@/store";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

function escapeHtml(t: string) {
  return t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function useSnippetNeedles(snippet?: string) {
  return useMemo(() => {
    if (!snippet) return [];
    const words = snippet.replace(/\s+/g, " ").trim().split(" ");
    return [8, 5, 3]
      .map((n) => words.slice(0, n).join(" "))
      .filter((s, i, arr) => s.length >= 12 && arr.indexOf(s) === i);
  }, [snippet]);
}

export function PdfViewerPanel() {
  const viewer = useStore((s) => s.viewer);
  const closeViewer = useStore((s) => s.closeViewer);
  const openViewer = useStore((s) => s.openViewer);
  const { selectedDocIds, toggleDoc } = useStore();

  const qc = useQueryClient();
  const { data: docs = [], isLoading } = useQuery({
    queryKey: ["documents"],
    queryFn: listDocuments,
  });

  const [numPages, setNumPages] = useState<number>(0);
  const [page, setPage] = useState(viewer?.page ?? 1);
  const [zoom, setZoom] = useState(1);
  const [failed, setFailed] = useState(false);
  const [width, setWidth] = useState(480);
  const [uploading, setUploading] = useState(false);
  const bodyRef = useRef<HTMLDivElement>(null);
  const dropInputRef = useRef<HTMLInputElement>(null);

  const remove = useMutation({
    mutationFn: deleteDocument,
    onSuccess: (_d, docId) => {
      qc.invalidateQueries({ queryKey: ["documents"] });
      if (selectedDocIds.includes(docId)) toggleDoc(docId);
      if (viewer?.docId === docId) closeViewer();
      toast.success("Document deleted.");
    },
    onError: (err) => toast.error(`Delete failed: ${(err as Error).message}`),
  });

  useEffect(() => {
    if (viewer) {
      setPage(viewer.page);
      setFailed(false);
    }
  }, [viewer]);

  useEffect(() => {
    const el = bodyRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setWidth(Math.max(240, el.clientWidth - 24)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const needles = useSnippetNeedles(viewer?.snippet);
  const textRenderer = useCallback(
    ({ str }: { str: string }) => {
      for (const needle of needles) {
        const idx = str.toLowerCase().indexOf(needle.toLowerCase());
        if (idx >= 0) {
          return (
            escapeHtml(str.slice(0, idx)) +
            `<mark class="pdf-hl">${escapeHtml(str.slice(idx, idx + needle.length))}</mark>` +
            escapeHtml(str.slice(idx + needle.length))
          );
        }
      }
      return escapeHtml(str);
    },
    [needles]
  );

  const fileUrl = useMemo(() => (viewer ? documentFileUrl(viewer.docId) : null), [viewer?.docId]);

  const handleDropFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      await uploadDocuments(Array.from(files));
      await qc.invalidateQueries({ queryKey: ["documents"] });
      toast.success("Document(s) indexed!");
    } catch (e: any) {
      toast.error(e.message || "Failed to upload");
    } finally {
      setUploading(false);
    }
  };

  // IF NO SPECIFIC VIEWER SELECTION -> SHOW DOCUMENT REPOSITORY & INSPECTOR LIST
  if (!viewer || !fileUrl) {
    return (
      <div className="flex flex-col h-full bg-card/40 p-4 space-y-4 text-xs">
        {/* Upload Dropzone Header */}
        <div
          onClick={() => dropInputRef.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            handleDropFiles(e.dataTransfer.files);
          }}
          className="border-2 border-dashed border-indigo-500/30 hover:border-indigo-500/60 rounded-xl p-6 text-center cursor-pointer bg-card/60 transition-all space-y-2 group"
        >
          <input
            type="file"
            ref={dropInputRef}
            onChange={(e) => handleDropFiles(e.target.files)}
            multiple
            accept=".pdf,.docx,.txt"
            className="hidden"
          />
          <UploadCloud className="h-8 w-8 mx-auto text-indigo-400 group-hover:scale-110 transition-transform" />
          <div>
            <p className="font-semibold text-foreground text-sm">Drag & Drop Documents Here</p>
            <p className="text-muted-foreground text-[11px] mt-0.5">Supports PDF, DOCX, and TXT files for vector ingestion</p>
          </div>
          {uploading && (
            <p className="text-indigo-400 flex items-center justify-center gap-1.5 font-mono text-[11px]">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Indexing document...
            </p>
          )}
        </div>

        {/* Indexed Documents Header */}
        <div className="flex items-center justify-between">
          <span className="font-bold text-foreground text-xs uppercase tracking-wider">
            Indexed Workspace Documents ({docs.length})
          </span>
        </div>

        {/* List of Documents */}
        <div className="flex-1 overflow-y-auto space-y-2 pr-1">
          {isLoading && (
            <div className="space-y-2">
              <Skeleton className="h-16 w-full rounded-xl" />
              <Skeleton className="h-16 w-full rounded-xl" />
            </div>
          )}

          {!isLoading && docs.length === 0 && (
            <div className="text-center py-10 text-muted-foreground space-y-1">
              <FileText className="h-8 w-8 mx-auto opacity-40 text-indigo-400" />
              <p>No documents uploaded yet.</p>
              <p className="text-[11px]">Upload a document using the dropzone above or the + paperclip in chat.</p>
            </div>
          )}

          {docs.map((doc: DocumentInfo) => (
            <div
              key={doc.doc_id}
              className="p-3 rounded-xl border border-border bg-card/70 hover:border-indigo-500/40 transition-all flex items-start justify-between gap-3 group"
            >
              <div className="flex items-start gap-2.5 min-w-0">
                <FileText className="h-5 w-5 text-indigo-400 shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <p className="font-semibold text-foreground truncate text-xs">{doc.doc_name}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge variant="secondary" className="text-[9px]">
                      {doc.pages} {doc.source_type === "pdf" ? "pages" : "parts"}
                    </Badge>
                    <Badge variant="secondary" className="text-[9px]">
                      {doc.chunks} chunks
                    </Badge>
                  </div>
                  {doc.summary && (
                    <p className="text-muted-foreground text-[10px] line-clamp-2 mt-1.5 leading-tight">
                      {doc.summary}
                    </p>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-1 shrink-0">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => openViewer({ docId: doc.doc_id, docName: doc.doc_name, page: 1 })}
                  className="h-7 text-[10px] gap-1 text-indigo-400 border-indigo-500/30 hover:bg-indigo-500/10"
                >
                  <Eye className="h-3 w-3" /> Preview
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => remove.mutate(doc.doc_id)}
                  className="h-7 w-7 text-muted-foreground hover:text-red-400"
                  title="Delete Document"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ACTIVE DOCUMENT VIEWER
  return (
    <div className="flex h-full min-h-0 flex-col bg-muted/30">
      <div className="flex items-center gap-1 border-b border-border bg-card/60 px-3 py-2">
        <p className="min-w-0 flex-1 truncate text-xs font-medium" title={viewer.docName}>
          {viewer.docName}
        </p>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={() => setZoom((z) => Math.max(0.6, z - 0.2))}
          title="Zoom out"
        >
          <ZoomOut className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={() => setZoom((z) => Math.min(2.4, z + 0.2))}
          title="Zoom in"
        >
          <ZoomIn className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={closeViewer}
          title="Back to list"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div ref={bodyRef} className="scroll-thin flex-1 overflow-auto p-3">
        {failed ? (
          <div className="mt-16 flex flex-col items-center gap-2 text-center text-xs text-muted-foreground">
            <FileWarning className="h-8 w-8" />
            <p>Couldn't load original PDF file.</p>
            <Button size="sm" variant="outline" onClick={closeViewer} className="mt-2 text-xs">
              Return to Document List
            </Button>
          </div>
        ) : (
          <Document
            file={fileUrl}
            onLoadSuccess={({ numPages }) => setNumPages(numPages)}
            onLoadError={() => setFailed(true)}
            loading={
              <div className="space-y-3 p-4">
                <Skeleton className="h-[500px] w-full" />
                <p className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading PDF…
                </p>
              </div>
            }
          >
            <Page
              pageNumber={Math.min(Math.max(page, 1), numPages || page)}
              width={width * zoom}
              customTextRenderer={textRenderer}
              className="mx-auto shadow-md"
              loading={<Skeleton className="h-[500px] w-full" />}
            />
          </Document>
        )}
      </div>

      {!failed && numPages > 0 && (
        <div className="flex items-center justify-center gap-2 border-t border-border bg-card/60 px-3 py-1.5">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-xs text-muted-foreground">
            Page {page} / {numPages}
          </span>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            disabled={page >= numPages}
            onClick={() => setPage((p) => p + 1)}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
}
