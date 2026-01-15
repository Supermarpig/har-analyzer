"use client";

import { useCallback, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Upload, X, FileText } from "lucide-react";

interface UploadedFile {
  file: File;
  regionName: string;
}

interface HarUploaderProps {
  onAnalyze: (files: UploadedFile[]) => void;
  isLoading?: boolean;
}

const PRESET_REGIONS = ["北京", "上海", "广州", "深圳"];

export function HarUploader({ onAnalyze, isLoading }: HarUploaderProps) {
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);

      const droppedFiles = Array.from(e.dataTransfer.files).filter(
        (f) => f.name.endsWith(".har") || f.type === "application/json"
      );

      if (droppedFiles.length > 0) {
        const newFiles = droppedFiles.map((file, index) => ({
          file,
          regionName:
            PRESET_REGIONS[files.length + index] ||
            `地區 ${files.length + index + 1}`,
        }));
        setFiles((prev) => [...prev, ...newFiles]);
      }
    },
    [files.length]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const selectedFiles = Array.from(e.target.files || []).filter(
        (f) => f.name.endsWith(".har") || f.type === "application/json"
      );

      if (selectedFiles.length > 0) {
        const newFiles = selectedFiles.map((file, index) => ({
          file,
          regionName:
            PRESET_REGIONS[files.length + index] ||
            `地區 ${files.length + index + 1}`,
        }));
        setFiles((prev) => [...prev, ...newFiles]);
      }
      e.target.value = "";
    },
    [files.length]
  );

  const updateRegionName = useCallback((index: number, name: string) => {
    setFiles((prev) =>
      prev.map((f, i) => (i === index ? { ...f, regionName: name } : f))
    );
  }, []);

  const removeFile = useCallback((index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const handleAnalyze = useCallback(() => {
    if (files.length > 0) {
      onAnalyze(files);
    }
  }, [files, onAnalyze]);

  return (
    <div className="space-y-6">
      {/* 拖放區域 */}
      <Card
        className={`border-2 border-dashed transition-colors cursor-pointer ${
          isDragging
            ? "border-blue-500 bg-blue-500/10"
            : "border-zinc-700 hover:border-zinc-500"
        }`}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
      >
        <CardContent className="flex flex-col items-center justify-center py-12">
          <Upload className="w-12 h-12 text-zinc-500 mb-4" />
          <p className="text-lg font-medium text-zinc-300 mb-2">
            拖放 HAR 檔案到這裡
          </p>
          <p className="text-sm text-zinc-500 mb-4">或點擊下方按鈕選擇檔案</p>
          <Label htmlFor="file-upload" className="cursor-pointer">
            <Button variant="outline" asChild>
              <span>
                <FileText className="w-4 h-4 mr-2" />
                選擇 HAR 檔案
              </span>
            </Button>
          </Label>
          <Input
            id="file-upload"
            type="file"
            accept=".har,application/json"
            multiple
            className="hidden"
            onChange={handleFileInput}
          />
        </CardContent>
      </Card>

      {/* 已上傳的檔案列表 */}
      {files.length > 0 && (
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">
                已選擇 {files.length} 個檔案
              </h3>
              <Badge variant="secondary">{files.length} / 4 地區</Badge>
            </div>
            <div className="space-y-3">
              {files.map((f, index) => (
                <div
                  key={index}
                  className="flex items-center gap-4 p-3 rounded-lg bg-zinc-900/50"
                >
                  <FileText className="w-5 h-5 text-blue-400 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">
                      {f.file.name}
                    </p>
                    <p className="text-xs text-zinc-500">
                      {(f.file.size / 1024).toFixed(1)} KB
                    </p>
                  </div>
                  <Input
                    value={f.regionName}
                    onChange={(e) => updateRegionName(index, e.target.value)}
                    className="w-32"
                    placeholder="地區名稱"
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => removeFile(index)}
                    className="flex-shrink-0 text-zinc-500 hover:text-red-400"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>
            <Button
              className="w-full mt-6"
              size="lg"
              onClick={handleAnalyze}
              disabled={isLoading}
            >
              {isLoading ? "分析中..." : "開始分析"}
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
