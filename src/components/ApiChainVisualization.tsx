"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { ChevronDown, ChevronUp, AlertCircle } from "lucide-react";
import type { ApiChain } from "@/types/har";
import { formatTime, getShortUrl } from "@/lib/utils";

interface ApiChainVisualizationProps {
  chains: ApiChain[];
}

export function ApiChainVisualization({ chains }: ApiChainVisualizationProps) {
  const [expandedChain, setExpandedChain] = useState<string | null>(
    chains[0]?.id || null
  );

  if (chains.length === 0) {
    return (
      <div className="text-center text-zinc-500 py-8">
        沒有偵測到 API 依賴鏈
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {chains.map((chain) => {
        const isExpanded = expandedChain === chain.id;

        return (
          <div
            key={chain.id}
            className="rounded-lg border border-zinc-700 overflow-hidden"
          >
            {/* 鏈條摘要 */}
            <div
              className="p-3 bg-zinc-800/50 flex items-center justify-between cursor-pointer hover:bg-zinc-800"
              onClick={() => setExpandedChain(isExpanded ? null : chain.id)}
            >
              <div className="flex items-center gap-3">
                <Badge variant="outline" className="text-blue-400">
                  {chain.chainLength} 個請求
                </Badge>
                <span className="text-sm text-zinc-300">
                  依賴鏈總時間:
                  <span className="font-mono ml-1 text-yellow-400">
                    {formatTime(chain.totalDuration)}
                  </span>
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="destructive" className="text-xs">
                  <AlertCircle className="w-3 h-3 mr-1" />
                  瓶頸: {formatTime(chain.bottleneck.request.time)}
                </Badge>
                {isExpanded ? (
                  <ChevronUp className="w-4 h-4 text-zinc-500" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-zinc-500" />
                )}
              </div>
            </div>

            {/* 展開的鏈條詳情 */}
            {isExpanded && (
              <div className="p-4 bg-zinc-900/30">
                <div className="relative">
                  {/* 連接線 */}
                  <div className="absolute left-4 top-4 bottom-4 w-0.5 bg-zinc-700" />

                  {/* 節點 */}
                  <div className="space-y-4">
                    {chain.nodes.map((node, i) => {
                      const isBottleneck =
                        node.request.id === chain.bottleneck.request.id;

                      return (
                        <div
                          key={i}
                          className="relative flex items-start gap-4"
                        >
                          {/* 節點圓點 */}
                          <div
                            className={`w-8 h-8 rounded-full flex items-center justify-center z-10 ${
                              isBottleneck
                                ? "bg-red-500/20 border-2 border-red-500"
                                : "bg-zinc-800 border-2 border-zinc-600"
                            }`}
                          >
                            <span className="text-xs font-medium">{i + 1}</span>
                          </div>

                          {/* 節點內容 */}
                          <div
                            className={`flex-1 p-3 rounded-lg ${
                              isBottleneck
                                ? "bg-red-500/10 border border-red-500/30"
                                : "bg-zinc-800/50"
                            }`}
                          >
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-sm font-mono truncate max-w-md">
                                {getShortUrl(node.request.url, 50)}
                              </span>
                              <span
                                className={`text-sm font-mono ${
                                  isBottleneck
                                    ? "text-red-400 font-medium"
                                    : "text-zinc-400"
                                }`}
                              >
                                {formatTime(node.request.time)}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 text-xs text-zinc-500">
                              <span>開始: {formatTime(node.startTime)}</span>
                              <span>|</span>
                              <span>結束: {formatTime(node.endTime)}</span>
                              {node.dependsOn && (
                                <>
                                  <span>|</span>
                                  <span>等待前一請求完成</span>
                                </>
                              )}
                            </div>
                            {isBottleneck && (
                              <div className="mt-2 flex items-center gap-2">
                                <AlertCircle className="w-3 h-3 text-red-400" />
                                <span className="text-xs text-red-400">
                                  此請求為鏈條瓶頸，建議優化
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
