"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { HarUploader } from "@/components/HarUploader";
import { RequestTable } from "@/components/RequestTable";
import { WaterfallChart } from "@/components/WaterfallChart";
import { RegionComparison } from "@/components/RegionComparison";
import { Recommendations } from "@/components/Recommendations";
import { UXTimeline } from "@/components/UXTimeline";
import { parseHarFile } from "@/lib/harParser";
import { analyzeHarFiles } from "@/lib/analyzer";
import { formatBytes, formatTime } from "@/lib/utils";
import type { AnalysisResult, RegionData } from "@/types/har";
import {
  Activity,
  BarChart3,
  Globe,
  Lightbulb,
  ArrowLeft,
  AlertTriangle,
  Clock,
  FileText,
  Timer,
} from "lucide-react";

interface UploadedFile {
  file: File;
  regionName: string;
}

export default function Home() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [selectedRegion, setSelectedRegion] = useState<string | null>(null);

  const handleAnalyze = async (files: UploadedFile[]) => {
    setIsLoading(true);
    setError(null);

    try {
      const regions: RegionData[] = [];

      for (const { file, regionName } of files) {
        const content = await file.text();
        const regionData = parseHarFile(content, regionName, file.name);
        regions.push(regionData);
      }

      const analysisResult = analyzeHarFiles(regions);
      setResult(analysisResult);
      setSelectedRegion(regions[0]?.name || null);
    } catch (err) {
      console.error("分析錯誤：", err);
      setError(err instanceof Error ? err.message : "解析 HAR 檔案時發生錯誤");
    } finally {
      setIsLoading(false);
    }
  };

  const handleReset = () => {
    setResult(null);
    setSelectedRegion(null);
    setError(null);
  };

  const currentRegion = result?.regions.find((r) => r.name === selectedRegion);

  return (
    <main className="min-h-screen bg-gradient-to-br from-zinc-950 via-zinc-900 to-zinc-950">
      {/* Header */}
      <header className="border-b border-zinc-800 bg-zinc-950/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600">
                <Activity className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold">HAR 分析器</h1>
                <p className="text-xs text-zinc-500">多地區效能診斷工具</p>
              </div>
            </div>
            {result && (
              <Button variant="outline" size="sm" onClick={handleReset}>
                <ArrowLeft className="w-4 h-4 mr-2" />
                重新上傳
              </Button>
            )}
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        {!result ? (
          // 上傳介面
          <div className="max-w-2xl mx-auto">
            <div className="text-center mb-8">
              <h2 className="text-3xl font-bold mb-4 bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
                分析網路效能瓶頸
              </h2>
              <p className="text-zinc-400">
                上傳不同地區的 HAR 檔案，找出請求延遲的原因
              </p>
            </div>

            <HarUploader onAnalyze={handleAnalyze} isLoading={isLoading} />

            {error && (
              <Card className="mt-6 border-red-500/50 bg-red-500/10">
                <CardContent className="flex items-center gap-3 py-4">
                  <AlertTriangle className="w-5 h-5 text-red-400" />
                  <p className="text-red-400">{error}</p>
                </CardContent>
              </Card>
            )}

            {/* 使用說明 */}
            <Card className="mt-8 bg-zinc-900/50">
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2">
                  <FileText className="w-4 h-4" />
                  如何取得 HAR 檔案?
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-zinc-400 space-y-2">
                <p>1. 在 Chrome 中開啟 DevTools（按 F12）</p>
                <p>2. 切換到 Network 分頁</p>
                <p>3. 重新載入頁面以捕獲請求</p>
                <p>4. 右鍵點擊請求列表 → Export HAR...</p>
              </CardContent>
            </Card>
          </div>
        ) : (
          // 分析結果介面
          <div className="space-y-6">
            {/* 地區概覽卡片 */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {result.regions.map((region) => (
                <Card
                  key={region.name}
                  className={`cursor-pointer transition-all hover:border-blue-500/50 ${
                    selectedRegion === region.name
                      ? "border-blue-500 bg-blue-500/10"
                      : "bg-zinc-900/50"
                  }`}
                  onClick={() => setSelectedRegion(region.name)}
                >
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-semibold">{region.name}</h3>
                      {region.slowRequests > 0 && (
                        <Badge variant="destructive">
                          {region.slowRequests} 慢
                        </Badge>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="text-zinc-500">請求數</p>
                        <p className="text-lg font-medium">
                          {region.requestCount}
                        </p>
                      </div>
                      <div>
                        <p className="text-zinc-500">總大小</p>
                        <p className="text-lg font-medium">
                          {formatBytes(region.totalSize)}
                        </p>
                      </div>
                      <div className="col-span-2">
                        <p className="text-zinc-500">總時間</p>
                        <p className="text-lg font-medium flex items-center gap-1">
                          <Clock className="w-4 h-4" />
                          {formatTime(region.totalTime)}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* 主要內容區 */}
            <Tabs defaultValue="requests" className="space-y-4">
              <TabsList className="bg-zinc-800/50">
                <TabsTrigger value="requests" className="gap-2">
                  <BarChart3 className="w-4 h-4" />
                  請求列表
                </TabsTrigger>
                <TabsTrigger value="waterfall" className="gap-2">
                  <Activity className="w-4 h-4" />
                  瀑布圖
                </TabsTrigger>
                <TabsTrigger value="comparison" className="gap-2">
                  <Globe className="w-4 h-4" />
                  地區比較
                </TabsTrigger>
                <TabsTrigger value="recommendations" className="gap-2">
                  <Lightbulb className="w-4 h-4" />
                  建議
                  {result.recommendations.length > 0 && (
                    <Badge variant="secondary" className="ml-1">
                      {result.recommendations.length}
                    </Badge>
                  )}
                </TabsTrigger>
                <TabsTrigger value="ux-timeline" className="gap-2">
                  <Timer className="w-4 h-4" />
                  使用者體驗
                </TabsTrigger>
              </TabsList>

              <TabsContent value="requests">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <BarChart3 className="w-5 h-5" />
                      {selectedRegion} - 請求列表
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {currentRegion && (
                      <RequestTable
                        requests={currentRegion.requests}
                        regionName={currentRegion.name}
                      />
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="waterfall">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Activity className="w-5 h-5" />
                      {selectedRegion} - 瀑布圖
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {currentRegion && (
                      <WaterfallChart
                        requests={currentRegion.requests}
                        maxTime={currentRegion.totalTime}
                      />
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="comparison">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Globe className="w-5 h-5" />
                      地區效能比較
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <RegionComparison comparisons={result.comparisons} />
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="recommendations">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Lightbulb className="w-5 h-5" />
                      優化建議
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Recommendations recommendations={result.recommendations} />
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="ux-timeline">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Timer className="w-5 h-5" />
                      {selectedRegion} - 使用者體驗時間軸
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {currentRegion && <UXTimeline region={currentRegion} />}
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>
        )}
      </div>
    </main>
  );
}
