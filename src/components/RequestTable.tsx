"use client";

import { useState, useMemo } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ChevronDown, ChevronUp, Search, ArrowUpDown } from "lucide-react";
import type { ParsedRequest, RequestType, SeverityLevel } from "@/types/har";
import { formatBytes, formatTime, getShortUrl } from "@/lib/utils";

interface RequestTableProps {
  requests: ParsedRequest[];
  regionName: string;
}

type SortKey = "time" | "size" | "startTime" | "status";
type SortOrder = "asc" | "desc";

const TYPE_COLORS: Record<RequestType, string> = {
  document: "bg-purple-500/20 text-purple-400",
  xhr: "bg-blue-500/20 text-blue-400",
  fetch: "bg-blue-500/20 text-blue-400",
  script: "bg-yellow-500/20 text-yellow-400",
  stylesheet: "bg-green-500/20 text-green-400",
  image: "bg-pink-500/20 text-pink-400",
  font: "bg-orange-500/20 text-orange-400",
  media: "bg-red-500/20 text-red-400",
  other: "bg-zinc-500/20 text-zinc-400",
};

const SEVERITY_COLORS: Record<SeverityLevel, string> = {
  normal: "",
  warning: "bg-yellow-500/10 border-l-2 border-yellow-500",
  critical: "bg-red-500/10 border-l-2 border-red-500",
};

export function RequestTable({ requests, regionName }: RequestTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>("startTime");
  const [sortOrder, setSortOrder] = useState<SortOrder>("asc");
  const [search, setSearch] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState<RequestType | "all">("all");

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortOrder("desc");
    }
  };

  const filteredAndSortedRequests = useMemo(() => {
    let result = [...requests];

    // 搜尋過濾
    if (search) {
      const searchLower = search.toLowerCase();
      result = result.filter((r) => r.url.toLowerCase().includes(searchLower));
    }

    // 類型過濾
    if (typeFilter !== "all") {
      result = result.filter((r) => r.type === typeFilter);
    }

    // 排序
    result.sort((a, b) => {
      const aVal = a[sortKey];
      const bVal = b[sortKey];
      const multiplier = sortOrder === "asc" ? 1 : -1;
      return (aVal - bVal) * multiplier;
    });

    return result;
  }, [requests, search, typeFilter, sortKey, sortOrder]);

  const types = useMemo(() => {
    const typeCounts = requests.reduce((acc, r) => {
      acc[r.type] = (acc[r.type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    return Object.entries(typeCounts).sort((a, b) => b[1] - a[1]);
  }, [requests]);

  return (
    <div className="space-y-4">
      {/* 篩選列 */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
          <Input
            placeholder="搜尋 URL..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant={typeFilter === "all" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setTypeFilter("all")}
          >
            全部 ({requests.length})
          </Button>
          {types.slice(0, 5).map(([type, count]) => (
            <Button
              key={type}
              variant={typeFilter === type ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setTypeFilter(type as RequestType)}
            >
              {type} ({count})
            </Button>
          ))}
        </div>
      </div>

      {/* 表格 */}
      <div className="rounded-lg border border-zinc-800 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-zinc-900/50 hover:bg-zinc-900/50">
              <TableHead className="w-[50%]">URL</TableHead>
              <TableHead className="w-[80px]">類型</TableHead>
              <TableHead className="w-[80px]">狀態</TableHead>
              <TableHead className="w-[100px]">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleSort("size")}
                  className="-ml-3"
                >
                  大小
                  <ArrowUpDown className="ml-1 w-3 h-3" />
                </Button>
              </TableHead>
              <TableHead className="w-[100px]">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleSort("time")}
                  className="-ml-3"
                >
                  耗時
                  <ArrowUpDown className="ml-1 w-3 h-3" />
                </Button>
              </TableHead>
              <TableHead className="w-[40px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredAndSortedRequests.map((request) => (
              <>
                <TableRow
                  key={request.id}
                  className={`cursor-pointer ${
                    SEVERITY_COLORS[request.severity]
                  }`}
                  onClick={() =>
                    setExpandedId(expandedId === request.id ? null : request.id)
                  }
                >
                  <TableCell className="font-mono text-xs">
                    <span className="text-zinc-500 mr-2">{request.method}</span>
                    <span title={request.url}>
                      {getShortUrl(request.url, 60)}
                    </span>
                    {request.issues.length > 0 && (
                      <Badge variant="destructive" className="ml-2 text-xs">
                        {request.issues.length} 問題
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge className={TYPE_COLORS[request.type]}>
                      {request.type}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <span
                      className={
                        request.status >= 400
                          ? "text-red-400"
                          : request.status >= 300
                          ? "text-yellow-400"
                          : "text-green-400"
                      }
                    >
                      {request.status}
                    </span>
                  </TableCell>
                  <TableCell className="text-zinc-400">
                    {formatBytes(request.size)}
                  </TableCell>
                  <TableCell
                    className={
                      request.severity === "critical"
                        ? "text-red-400 font-medium"
                        : request.severity === "warning"
                        ? "text-yellow-400"
                        : "text-zinc-400"
                    }
                  >
                    {formatTime(request.time)}
                  </TableCell>
                  <TableCell>
                    {expandedId === request.id ? (
                      <ChevronUp className="w-4 h-4 text-zinc-500" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-zinc-500" />
                    )}
                  </TableCell>
                </TableRow>
                {expandedId === request.id && (
                  <TableRow>
                    <TableCell colSpan={6} className="bg-zinc-900/30 p-4">
                      <div className="space-y-4">
                        {/* 完整 URL */}
                        <div>
                          <p className="text-xs text-zinc-500 mb-1">完整 URL</p>
                          <p className="text-sm font-mono break-all">
                            {request.url}
                          </p>
                        </div>

                        {/* 時間分解 */}
                        <div>
                          <p className="text-xs text-zinc-500 mb-2">時間分解</p>
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                            <TimingItem
                              label="DNS"
                              value={request.timings.dns || 0}
                            />
                            <TimingItem
                              label="TCP 連線"
                              value={request.timings.connect || 0}
                            />
                            <TimingItem
                              label="SSL"
                              value={request.timings.ssl || 0}
                            />
                            <TimingItem
                              label="TTFB（等待）"
                              value={request.timings.wait}
                              highlight={request.timings.wait > 500}
                            />
                            <TimingItem
                              label="發送"
                              value={request.timings.send}
                            />
                            <TimingItem
                              label="下載"
                              value={request.timings.receive}
                              highlight={request.timings.receive > 1000}
                            />
                            <TimingItem
                              label="阻塞"
                              value={request.timings.blocked || 0}
                              highlight={(request.timings.blocked || 0) > 100}
                            />
                            <TimingItem
                              label="總計"
                              value={request.time}
                              highlight={request.severity !== "normal"}
                            />
                          </div>
                        </div>

                        {/* 問題列表 */}
                        {request.issues.length > 0 && (
                          <div>
                            <p className="text-xs text-zinc-500 mb-2">
                              發現問題
                            </p>
                            <ul className="space-y-1">
                              {request.issues.map((issue, i) => (
                                <li
                                  key={i}
                                  className="text-sm text-yellow-400 flex items-center gap-2"
                                >
                                  <span className="w-1.5 h-1.5 rounded-full bg-yellow-400" />
                                  {issue}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </>
            ))}
          </TableBody>
        </Table>
      </div>

      {filteredAndSortedRequests.length === 0 && (
        <p className="text-center text-zinc-500 py-8">沒有符合條件的請求</p>
      )}
    </div>
  );
}

function TimingItem({
  label,
  value,
  highlight = false,
}: {
  label: string;
  value: number;
  highlight?: boolean;
}) {
  return (
    <div className="p-2 rounded bg-zinc-800/50">
      <p className="text-xs text-zinc-500">{label}</p>
      <p
        className={`text-sm font-medium ${
          highlight ? "text-yellow-400" : "text-zinc-300"
        }`}
      >
        {formatTime(value)}
      </p>
    </div>
  );
}
