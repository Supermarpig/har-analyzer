import type {
  RegionData,
  ComparisonResult,
  Recommendation,
  AnalysisResult,
  ParsedRequest,
} from "@/types/har";
import { getDomain } from "./utils";

/**
 * 比較不同地區的相同請求
 */
function compareRegions(regions: RegionData[]): ComparisonResult[] {
  if (regions.length < 2) return [];

  // 建立 URL 到各地區請求的映射
  const urlMap = new Map<
    string,
    Map<string, { time: number; timings: RegionData["requests"][0]["timings"] }>
  >();

  for (const region of regions) {
    for (const request of region.requests) {
      // 移除查詢參數來比對相同的 API
      const baseUrl = getBaseUrl(request.url);

      if (!urlMap.has(baseUrl)) {
        urlMap.set(baseUrl, new Map());
      }

      const regionMap = urlMap.get(baseUrl)!;
      // 如果同一地區有多個相同請求，取最慢的
      const existing = regionMap.get(region.name);
      if (!existing || request.time > existing.time) {
        regionMap.set(region.name, {
          time: request.time,
          timings: request.timings,
        });
      }
    }
  }

  // 篩選所有地區都有的請求，並計算差異
  const comparisons: ComparisonResult[] = [];

  for (const [url, regionMap] of urlMap) {
    // 至少要有兩個地區的數據才能比較
    if (regionMap.size < 2) continue;

    const regionResults = Array.from(regionMap.entries()).map(
      ([name, data]) => ({
        name,
        time: data.time,
        timings: data.timings,
      })
    );

    const times = regionResults.map((r) => r.time);
    const maxTime = Math.max(...times);
    const minTime = Math.min(...times);
    const maxDiff = maxTime - minTime;

    // 只保留有明顯差異的比較（差異 > 100ms 或 > 50%）
    if (maxDiff > 100 || maxDiff / minTime > 0.5) {
      comparisons.push({
        url,
        regions: regionResults,
        maxDiff,
        slowestRegion: regionResults.find((r) => r.time === maxTime)!.name,
        fastestRegion: regionResults.find((r) => r.time === minTime)!.name,
      });
    }
  }

  // 按差異大小排序
  return comparisons.sort((a, b) => b.maxDiff - a.maxDiff);
}

/**
 * 取得 URL 的基本路徑（移除動態參數）
 */
function getBaseUrl(url: string): string {
  try {
    const parsed = new URL(url);
    // 保留域名和路徑，移除查詢參數和雜湊
    return `${parsed.origin}${parsed.pathname}`;
  } catch {
    return url;
  }
}

interface IssueDetail {
  url: string;
  value: number;
  region: string;
  breakdown?: {
    dns?: number;
    connect?: number;
    ssl?: number;
    wait?: number;
    receive?: number;
  };
}

/**
 * 生成動態的最佳化建議
 */
function generateRecommendations(
  regions: RegionData[],
  comparisons: ComparisonResult[]
): Recommendation[] {
  const recommendations: Recommendation[] = [];

  // 收集所有請求的詳細問題
  const dnsIssues: IssueDetail[] = [];
  const connectIssues: IssueDetail[] = [];
  const sslIssues: IssueDetail[] = [];
  const ttfbIssues: IssueDetail[] = [];
  const downloadIssues: IssueDetail[] = [];

  for (const region of regions) {
    for (const request of region.requests) {
      const t = request.timings;

      if (t.dns && t.dns > 100) {
        dnsIssues.push({
          url: request.url,
          value: t.dns,
          region: region.name,
          breakdown: { dns: t.dns },
        });
      }

      if (t.connect && t.connect > 200) {
        connectIssues.push({
          url: request.url,
          value: t.connect,
          region: region.name,
          breakdown: { connect: t.connect, ssl: t.ssl },
        });
      }

      if (t.ssl && t.ssl > 200) {
        sslIssues.push({
          url: request.url,
          value: t.ssl,
          region: region.name,
          breakdown: { ssl: t.ssl },
        });
      }

      if (t.wait > 500) {
        ttfbIssues.push({
          url: request.url,
          value: t.wait,
          region: region.name,
          breakdown: { wait: t.wait },
        });
      }

      if (t.receive > 1000) {
        downloadIssues.push({
          url: request.url,
          value: t.receive,
          region: region.name,
          breakdown: { receive: t.receive },
        });
      }
    }
  }

  // DNS 問題
  if (dnsIssues.length > 0) {
    const sorted = dnsIssues.sort((a, b) => b.value - a.value);
    const avgDns = sorted.reduce((sum, i) => sum + i.value, 0) / sorted.length;
    const maxDns = sorted[0].value;
    const affectedDomains = [...new Set(sorted.map((i) => getDomain(i.url)))];
    const affectedRegions = [...new Set(sorted.map((i) => i.region))];

    recommendations.push({
      priority: maxDns > 300 ? "high" : "medium",
      category: "dns",
      title: `DNS 查詢過慢：平均 ${Math.round(avgDns)}ms，最高 ${Math.round(
        maxDns
      )}ms`,
      description: JSON.stringify({
        type: "dns",
        stats: {
          count: dnsIssues.length,
          avgTime: Math.round(avgDns),
          maxTime: Math.round(maxDns),
          domains: affectedDomains.slice(0, 5),
        },
        details: sorted.slice(0, 50).map((i) => ({
          url: i.url,
          dns: Math.round(i.value),
          region: i.region,
        })),
      }),
      affectedUrls: sorted.slice(0, 50).map((i) => i.url),
      affectedRegions,
    });
  }

  // 連線問題
  if (connectIssues.length > 0) {
    const sorted = connectIssues.sort((a, b) => b.value - a.value);
    const avgConnect =
      sorted.reduce((sum, i) => sum + i.value, 0) / sorted.length;
    const maxConnect = sorted[0].value;
    const affectedRegions = [...new Set(sorted.map((i) => i.region))];

    recommendations.push({
      priority: maxConnect > 500 ? "high" : "medium",
      category: "connection",
      title: `TCP 連線過慢：平均 ${Math.round(avgConnect)}ms，最高 ${Math.round(
        maxConnect
      )}ms`,
      description: JSON.stringify({
        type: "connection",
        stats: {
          count: connectIssues.length,
          avgTime: Math.round(avgConnect),
          maxTime: Math.round(maxConnect),
        },
        details: sorted.slice(0, 50).map((i) => ({
          url: i.url,
          connect: Math.round(i.value),
          ssl: i.breakdown?.ssl ? Math.round(i.breakdown.ssl) : 0,
          region: i.region,
        })),
      }),
      affectedUrls: sorted.slice(0, 50).map((i) => i.url),
      affectedRegions,
    });
  }

  // TTFB 問題
  if (ttfbIssues.length > 0) {
    const sorted = ttfbIssues.sort((a, b) => b.value - a.value);
    const avgTtfb = sorted.reduce((sum, i) => sum + i.value, 0) / sorted.length;
    const maxTtfb = sorted[0].value;
    const affectedRegions = [...new Set(sorted.map((i) => i.region))];

    // 按 URL 分組，找出哪些 API 在所有地區都慢
    const urlStats = new Map<string, { times: number[]; regions: string[] }>();
    for (const issue of sorted) {
      const baseUrl = getBaseUrl(issue.url);
      if (!urlStats.has(baseUrl)) {
        urlStats.set(baseUrl, { times: [], regions: [] });
      }
      urlStats.get(baseUrl)!.times.push(issue.value);
      urlStats.get(baseUrl)!.regions.push(issue.region);
    }

    recommendations.push({
      priority: maxTtfb > 1500 ? "high" : "medium",
      category: "server",
      title: `伺服器回應過慢 (TTFB)：平均 ${Math.round(
        avgTtfb
      )}ms，最高 ${Math.round(maxTtfb)}ms`,
      description: JSON.stringify({
        type: "ttfb",
        stats: {
          count: ttfbIssues.length,
          avgTime: Math.round(avgTtfb),
          maxTime: Math.round(maxTtfb),
        },
        details: sorted.slice(0, 50).map((i) => ({
          url: i.url,
          ttfb: Math.round(i.value),
          region: i.region,
        })),
      }),
      affectedUrls: sorted.slice(0, 50).map((i) => i.url),
      affectedRegions,
    });
  }

  // 下載問題
  if (downloadIssues.length > 0) {
    const sorted = downloadIssues.sort((a, b) => b.value - a.value);
    const avgDownload =
      sorted.reduce((sum, i) => sum + i.value, 0) / sorted.length;
    const maxDownload = sorted[0].value;
    const affectedRegions = [...new Set(sorted.map((i) => i.region))];

    recommendations.push({
      priority: maxDownload > 3000 ? "high" : "medium",
      category: "payload",
      title: `下載時間過長：平均 ${Math.round(
        avgDownload
      )}ms，最高 ${Math.round(maxDownload)}ms`,
      description: JSON.stringify({
        type: "download",
        stats: {
          count: downloadIssues.length,
          avgTime: Math.round(avgDownload),
          maxTime: Math.round(maxDownload),
        },
        details: sorted.slice(0, 50).map((i) => ({
          url: i.url,
          download: Math.round(i.value),
          region: i.region,
        })),
      }),
      affectedUrls: sorted.slice(0, 50).map((i) => i.url),
      affectedRegions,
    });
  }

  // 地區特定問題
  if (comparisons.length > 0) {
    // 找出哪個地區最常是最慢的
    const slowestCounts = new Map<string, number>();
    for (const comp of comparisons) {
      const count = slowestCounts.get(comp.slowestRegion) || 0;
      slowestCounts.set(comp.slowestRegion, count + 1);
    }

    const sortedRegions = Array.from(slowestCounts.entries()).sort(
      (a, b) => b[1] - a[1]
    );

    if (sortedRegions.length > 0 && sortedRegions[0][1] >= 3) {
      const [problematicRegion, count] = sortedRegions[0];
      const regionComparisons = comparisons.filter(
        (c) => c.slowestRegion === problematicRegion
      );
      const avgDiff =
        regionComparisons.reduce((sum, c) => sum + c.maxDiff, 0) /
        regionComparisons.length;

      recommendations.push({
        priority: "high",
        category: "cdn",
        title: `${problematicRegion} 地區在 ${count} 個請求中明顯較慢（平均慢 ${Math.round(
          avgDiff
        )}ms）`,
        description: JSON.stringify({
          type: "region",
          stats: {
            region: problematicRegion,
            slowCount: count,
            avgDiff: Math.round(avgDiff),
            totalComparisons: comparisons.length,
          },
          details: regionComparisons.slice(0, 50).map((c) => ({
            url: c.url,
            thisRegion: Math.round(
              c.regions.find((r) => r.name === problematicRegion)?.time || 0
            ),
            fastest: Math.round(
              c.regions.find((r) => r.name === c.fastestRegion)?.time || 0
            ),
            fastestRegion: c.fastestRegion,
            diff: Math.round(c.maxDiff),
          })),
        }),
        affectedUrls: regionComparisons.slice(0, 50).map((c) => c.url),
        affectedRegions: [problematicRegion],
      });
    }
  }

  return recommendations;
}

/**
 * 主要分析函數
 */
export function analyzeHarFiles(regions: RegionData[]): AnalysisResult {
  const comparisons = compareRegions(regions);
  const recommendations = generateRecommendations(regions, comparisons);

  return {
    regions,
    comparisons,
    recommendations,
  };
}
