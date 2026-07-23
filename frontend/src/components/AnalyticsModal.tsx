import React from "react";
import { useQuery } from "@tanstack/react-query";
import { Activity, Database, Cpu, Zap, CheckCircle, ShieldCheck, BarChart2 } from "lucide-react";

interface AnalyticsData {
  total_documents: number;
  total_chunks: number;
  embedding_model: string;
  reranker_model: string;
  primary_model: string;
  models_ready: boolean;
}

export const AnalyticsModal: React.FC = () => {
  const { data, isLoading, refetch } = useQuery<AnalyticsData>({
    queryKey: ["analytics"],
    queryFn: async () => {
      const res = await fetch("http://localhost:8000/analytics");
      if (!res.ok) throw new Error("Failed to fetch analytics");
      return res.json();
    },
  });

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-950 text-slate-100 overflow-y-auto p-6 space-y-6">
      {/* Top Banner */}
      <div className="flex items-center justify-between p-6 bg-gradient-to-r from-slate-900 via-slate-900 to-purple-950/40 border border-slate-800 rounded-3xl backdrop-blur-md">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-purple-500/10 border border-purple-500/20 text-purple-400 rounded-2xl">
            <Activity className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-100">System Telemetry & Analytics</h1>
            <p className="text-xs text-slate-400">
              Real-time monitoring of vector store index, embedding models, and pipeline performance.
            </p>
          </div>
        </div>
        <button
          onClick={() => refetch()}
          className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl transition-all"
        >
          Refresh Telemetry
        </button>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* Total Documents */}
        <div className="p-5 bg-slate-900/60 border border-slate-800 rounded-2xl backdrop-blur-md flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Total Documents
            </p>
            <h3 className="text-2xl font-bold text-emerald-400 mt-1">
              {isLoading ? "..." : data?.total_documents ?? 0}
            </h3>
          </div>
          <div className="p-3 bg-emerald-500/10 text-emerald-400 rounded-xl">
            <Database className="w-5 h-5" />
          </div>
        </div>

        {/* Total Chunks */}
        <div className="p-5 bg-slate-900/60 border border-slate-800 rounded-2xl backdrop-blur-md flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Vector Chunks
            </p>
            <h3 className="text-2xl font-bold text-cyan-400 mt-1">
              {isLoading ? "..." : data?.total_chunks ?? 0}
            </h3>
          </div>
          <div className="p-3 bg-cyan-500/10 text-cyan-400 rounded-xl">
            <Zap className="w-5 h-5" />
          </div>
        </div>

        {/* Model Warmup Readiness */}
        <div className="p-5 bg-slate-900/60 border border-slate-800 rounded-2xl backdrop-blur-md flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Model Warmup Status
            </p>
            <h3 className="text-sm font-bold text-slate-200 mt-2 flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-emerald-400" />
              {data?.models_ready ? "Models Ready" : "Warming Up"}
            </h3>
          </div>
          <div className="p-3 bg-purple-500/10 text-purple-400 rounded-xl">
            <Cpu className="w-5 h-5" />
          </div>
        </div>

        {/* RAG Verification */}
        <div className="p-5 bg-slate-900/60 border border-slate-800 rounded-2xl backdrop-blur-md flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Retrieval Pipeline
            </p>
            <h3 className="text-sm font-bold text-emerald-400 mt-2 flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4" />
              Hybrid + Rerank
            </h3>
          </div>
          <div className="p-3 bg-emerald-500/10 text-emerald-400 rounded-xl">
            <BarChart2 className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Model Architecture Stack */}
      <div className="p-6 bg-slate-900/50 border border-slate-800 rounded-3xl backdrop-blur-md space-y-4">
        <h2 className="text-sm font-semibold text-slate-200 uppercase tracking-wider">
          Active AI Architecture Stack
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-4 bg-slate-800/50 border border-slate-700/50 rounded-2xl">
            <span className="text-xs text-slate-400 block font-medium">Dense Embedding Model</span>
            <span className="text-sm font-bold text-emerald-400 mt-1 block">
              {data?.embedding_model ?? "BAAI/bge-large-en-v1.5"}
            </span>
          </div>

          <div className="p-4 bg-slate-800/50 border border-slate-700/50 rounded-2xl">
            <span className="text-xs text-slate-400 block font-medium">Cross-Encoder Reranker</span>
            <span className="text-sm font-bold text-cyan-400 mt-1 block">
              {data?.reranker_model ?? "BAAI/bge-reranker-v2-m3"}
            </span>
          </div>

          <div className="p-4 bg-slate-800/50 border border-slate-700/50 rounded-2xl">
            <span className="text-xs text-slate-400 block font-medium">Primary Generation Model</span>
            <span className="text-sm font-bold text-purple-400 mt-1 block">
              {data?.primary_model ?? "groq/llama-3.3-70b-versatile"}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
