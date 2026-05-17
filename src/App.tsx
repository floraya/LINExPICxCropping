/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { 
  Upload, 
  Grid3X3, 
  Download, 
  Eraser, 
  Image as ImageIcon, 
  Move, 
  Maximize, 
  Minimize,
  RefreshCw,
  Trash2,
  FileDown
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import JSZip from 'jszip';
import confetti from 'canvas-confetti';
import { cn } from './lib/utils';

// --- Types ---
interface Slice {
  id: string;
  dataUrl: string;
  isMain?: boolean;
  isTab?: boolean;
}

const TRANSLATIONS = {
  zh: {
    title: "貼圖切割手",
    version: "v2.0",
    import: "匯入圖片",
    exportZip: "打包下載",
    adjustment: "調整工具",
    rows: "行數",
    cols: "列數",
    dragHint: "提示：您可以點擊並拖動預覽圖上的線條來手動調整切割範圍。",
    presets: "常用配置",
    aiTitle: "AI 去背工具",
    smartCut: "智慧去背",
    saveTrans: "儲存去背原圖",
    generate: "開始切割",
    lineFormats: "LINE 規格設定",
    mainIcon: "主貼圖 (Main)",
    tabIcon: "標籤圖 (Tab)",
    assignMain: "設為主圖",
    assignTab: "設為標籤",
    dropHint: "將圖片拖移至此",
    clickHint: "或點擊瀏覽檔案",
    processing: "Gemini AI 處理中...",
    processingHint: "正在識別主體並優化透明遮罩...",
    downloadAll: "下載 ZIP 包",
    reset: "重設視角",
    clear: "清除",
    resolution: "來源解析度",
    slices: "區塊數",
    grid: "網格",
    aiActive: "AI 已啟動",
    history: "已切割區塊",
    assignHint: "將區塊標記為 MAIN 或 TAB 以填滿此處",
    compliance: "確保貼圖解析度在 320x320 以內以符合 LINE 規範。",
    ready: "準備就緒",
    downloadMain: "下載主圖",
    downloadTab: "下載標籤",
    source: "解析度",
    region: "地區",
    cutLineSettings: "切割線設定",
    quickBuild: "可快速建立 2x2、3x3、4x4，或直接在預覽圖上新增和拖曳切割線。",
    resetLines: "重設",
    addVertical: "新增直線",
    addHorizontal: "新增橫線",
    verticalLines: "垂直線 X",
    horizontalLines: "水平線 Y",
    addLine: "新增",
    delete: "刪除",
    line: "線",
    viewOriginal: "原圖模式",
    viewProcessed: "去背模式",
    bgMode: "背景模式",
  },
  en: {
    title: "LineCutRyder",
    version: "v2.0",
    import: "Import Image",
    exportZip: "Export Zip",
    adjustment: "Adjustment Tools",
    rows: "Rows",
    cols: "Cols",
    dragHint: "Hint: You can click and drag the lines on the preview to manually adjust the slice regions.",
    presets: "Presets",
    aiTitle: "AI Background Removal",
    smartCut: "Smart Cut-out",
    saveTrans: "Save Transparency",
    generate: "Generate Slices",
    lineFormats: "LINE Formats",
    mainIcon: "Main Icon",
    tabIcon: "Tab Icon",
    assignMain: "MAIN",
    assignTab: "TAB",
    dropHint: "Drop images here",
    clickHint: "or click to browse local files",
    processing: "Gemini AI Processing",
    processingHint: "Isolating subjects and refining transparency masks...",
    downloadAll: "Download ZIP Package",
    reset: "Reset View",
    clear: "Clear",
    resolution: "Resolution",
    slices: "Slices",
    grid: "Grid",
    aiActive: "AI Active",
    history: "Generated Slices",
    assignHint: "Assign a slice as MAIN or TAB to fill this slot",
    compliance: "Ensure sticker resolution is within 320x320 for LINE standard.",
    ready: "Ready",
    downloadMain: "Download Main",
    downloadTab: "Download Tab",
    source: "Source",
    region: "Region",
    cutLineSettings: "Line Settings",
    quickBuild: "Quickly build 2x2, 3x3, 4x4, or directly add and drag cutting lines on the preview.",
    resetLines: "Reset",
    addVertical: "Add Vertical",
    addHorizontal: "Add Horizontal",
    verticalLines: "Vertical X",
    horizontalLines: "Horizontal Y",
    addLine: "Add",
    delete: "Del",
    line: "Line",
    viewOriginal: "Original",
    viewProcessed: "Processed",
    bgMode: "BG Mode",
  }
};

export default function App() {
  const [lang, setLang] = useState<'zh' | 'en'>('zh');
  const t = TRANSLATIONS[lang];

  const [image, setImage] = useState<string | null>(null);
  const [originalImage, setOriginalImage] = useState<string | null>(null);
  const [processedImage, setProcessedImage] = useState<string | null>(null);
  const [bgMode, setBgMode] = useState<'original' | 'processed'>('original');

  const [imageEl, setImageEl] = useState<HTMLImageElement | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  
  // Cutting lines (0 to 1) - INITIALIZE with 2x4 grid default
  const [rowLines, setRowLines] = useState<number[]>([0.5]);
  const [colLines, setColLines] = useState<number[]>([0.25, 0.5, 0.75]);
  
  const rows = rowLines.length + 1;
  const cols = colLines.length + 1;
  
  const [slices, setSlices] = useState<Slice[]>([]);
  const [isLocked, setIsLocked] = useState(false);
  
  // Image position and scale
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [scale, setScale] = useState(1);
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0 });

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const workspaceRef = useRef<HTMLDivElement>(null);

  // --- Handlers ---
  const onDrop = useCallback((acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const url = e.target?.result as string;
        setImage(url);
        setOriginalImage(url);
        setProcessedImage(null);
        setBgMode('original');
        
        const img = new Image();
        img.src = url;
        img.onload = () => {
          setImageEl(img);
          resetTransform(img);
        };
      };
      reader.readAsDataURL(file);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'image/jpeg': [], 'image/png': [], 'image/webp': [] },
    multiple: false,
  } as any);

  const resetTransform = (img: HTMLImageElement) => {
    if (!workspaceRef.current) return;
    const { width, height } = workspaceRef.current.getBoundingClientRect();
    const s = Math.min((width - 100) / img.width, (height - 100) / img.height);
    setScale(s);
    setPos({ x: (width - img.width * s) / 2, y: (height - img.height * s) / 2 });
  };

  const handleRemoveBackground = async () => {
    if (!originalImage) return;
    setIsProcessing(true);
    try {
      const res = await fetch('/api/remove-background', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: originalImage }),
      });
      const data = await res.json();
      if (data.imageUrl) {
        setProcessedImage(data.imageUrl);
        setBgMode('processed');
        setImage(data.imageUrl);

        const img = new Image();
        img.src = data.imageUrl;
        img.onload = () => {
          setImageEl(img);
        };
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsProcessing(false);
    }
  };

  const toggleBgMode = (mode: 'original' | 'processed') => {
    const targetUrl = mode === 'original' ? originalImage : processedImage;
    if (!targetUrl) return;
    
    setBgMode(mode);
    setImage(targetUrl);
    
    const img = new Image();
    img.src = targetUrl;
    img.onload = () => {
      setImageEl(img);
    };
  };

  const handleSlice = () => {
    if (!imageEl) return;
    
    const newSlices: Slice[] = [];
    const tempCanvas = document.createElement('canvas');
    const ctx = tempCanvas.getContext('2d');
    if (!ctx) return;

    // Boundary lines including edges
    const hLines = [0, ...rowLines, 1].sort((a, b) => a - b);
    const vLines = [0, ...colLines, 1].sort((a, b) => a - b);

    for (let r = 0; r < hLines.length - 1; r++) {
      for (let c = 0; c < vLines.length - 1; c++) {
        tempCanvas.width = 320; 
        tempCanvas.height = 320;
        ctx.clearRect(0, 0, 320, 320);
        
        const sx = vLines[c] * imageEl.width;
        const sy = hLines[r] * imageEl.height;
        const sw = (vLines[c+1] - vLines[c]) * imageEl.width;
        const sh = (hLines[r+1] - hLines[r]) * imageEl.height;
        
        // Proportional draw (no stretch)
        const ratio = Math.min(320 / sw, 320 / sh);
        const tw = sw * ratio;
        const th = sh * ratio;
        const tx = (320 - tw) / 2;
        const ty = (320 - th) / 2;
        
        ctx.drawImage(imageEl, sx, sy, sw, sh, tx, ty, tw, th);
        
        newSlices.push({
          id: `slice-${r}-${c}`,
          dataUrl: tempCanvas.toDataURL('image/png'),
        });
      }
    }
    setSlices(newSlices);
    confetti({
      particleCount: 100,
      spread: 70,
      origin: { y: 0.6 },
      colors: ['#2563eb', '#3b82f6', '#ffffff']
    });
    setIsLocked(true); // Auto lock when generated to focus on results
  };

  const downloadAll = async () => {
    const zip = new JSZip();
    const tempCanvas = document.createElement('canvas');
    const ctx = tempCanvas.getContext('2d');
    if (!ctx) return;

    for (let i = 0; i < slices.length; i++) {
      const s = slices[i];
      let name = `sticker_${String(i + 1).padStart(2, '0')}.png`;
      let width = 320;
      let height = 320;

      if (s.isMain) {
        name = 'main.png';
        width = 240;
        height = 240;
      } else if (s.isTab) {
        name = 'tab.png';
        width = 96;
        height = 74;
      }

      tempCanvas.width = width;
      tempCanvas.height = height;
      ctx.clearRect(0, 0, width, height);
      
      const img = new Image();
      img.src = s.dataUrl;
      await new Promise(resolve => { img.onload = resolve; });
      
      // Proportional draw to final package sizes
      const sRatio = img.width / img.height;
      const tRatio = width / height;
      let dw, dh, dx, dy;
      
      if (sRatio > tRatio) {
        dw = width;
        dh = width / sRatio;
        dx = 0;
        dy = (height - dh) / 2;
      } else {
        dh = height;
        dw = height * sRatio;
        dy = 0;
        dx = (width - dw) / 2;
      }

      ctx.drawImage(img, dx, dy, dw, dh);
      const outputData = tempCanvas.toDataURL('image/png').split(',')[1];
      zip.file(name, outputData, { base64: true });
    }

    const content = await zip.generateAsync({ type: 'blob' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(content);
    link.download = 'line_stickers_package.zip';
    link.click();
  };

  const downloadSingle = async (s: Slice, index: number) => {
    const tempCanvas = document.createElement('canvas');
    const ctx = tempCanvas.getContext('2d');
    if (!ctx) return;

    let width = 320;
    let height = 320;
    let name = `sticker_${String(index + 1).padStart(2, '0')}.png`;

    if (s.isMain) {
      name = 'main.png';
      width = 240;
      height = 240;
    } else if (s.isTab) {
      name = 'tab.png';
      width = 96;
      height = 74;
    }

    tempCanvas.width = width;
    tempCanvas.height = height;
    ctx.clearRect(0, 0, width, height);
    const img = new Image();
    img.src = s.dataUrl;
    await new Promise(resolve => { img.onload = resolve; });
    
    // Proportional draw
    const sRatio = img.width / img.height;
    const tRatio = width / height;
    let dw, dh, dx, dy;
    
    if (sRatio > tRatio) {
      dw = width;
      dh = width / sRatio;
      dx = 0;
      dy = (height - dh) / 2;
    } else {
      dh = height;
      dw = height * sRatio;
      dy = 0;
      dx = (width - dw) / 2;
    }

    ctx.drawImage(img, dx, dy, dw, dh);
    
    const link = document.createElement('a');
    link.href = tempCanvas.toDataURL('image/png');
    link.download = name;
    link.click();
  };

  const toggleSpecial = (id: string, type: 'main' | 'tab') => {
    setSlices(prev => prev.map(s => {
      if (s.id === id) {
        return { 
          ...s, 
          [type === 'main' ? 'isMain' : 'isTab']: !s[type === 'main' ? 'isMain' : 'isTab'] 
        };
      }
      return { 
        ...s, 
        [type === 'main' ? 'isMain' : 'isTab']: false 
      };
    }));
  };

  // --- Interaction ---
  const handleMouseDown = (e: React.MouseEvent) => {
    if (isLocked) return;
    setIsDragging(true);
    dragStart.current = { x: e.clientX - pos.x, y: e.clientY - pos.y };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || isLocked) return;
    setPos({
      x: e.clientX - dragStart.current.x,
      y: e.clientY - dragStart.current.y
    });
  };

  const handleMouseUp = () => setIsDragging(false);

  const handleWheel = (e: React.WheelEvent) => {
    if (isLocked) return;
    const delta = -e.deltaY;
    const factor = delta > 0 ? 1.1 : 0.9;
    setScale(prev => Math.max(0.1, Math.min(10, prev * factor)));
  };

  const mainSticker = slices.find(s => s.isMain);
  const tabSticker = slices.find(s => s.isTab);

  return (
    <div className="h-screen bg-[#0F0F0F] text-white flex flex-col font-sans overflow-hidden select-none">
      {/* Header */}
      <header className="h-14 border-b border-white/10 flex items-center justify-between px-6 bg-[#151515] shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-blue-600 rounded flex items-center justify-center font-bold text-xl shadow-lg shadow-blue-500/20">L</div>
          <span className="font-bold tracking-tight text-lg">{t.title} <span className="text-white/40 font-normal text-sm">{t.version}</span></span>
        </div>
        <div className="flex gap-4">
          <div className="flex bg-white/5 p-1 rounded-md border border-white/5">
            <button 
              onClick={() => setIsLocked(!isLocked)}
              className={cn(
                "px-2 py-0.5 text-[10px] rounded transition-all flex items-center gap-1",
                isLocked ? "bg-red-500/20 text-red-400" : "text-white/40 hover:text-white/60"
              )}
            >
              {isLocked ? <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" /> : null}
              {isLocked ? (lang === 'zh' ? '已鎖定' : 'Locked') : (lang === 'zh' ? '畫布解鎖' : 'Unlocked')}
            </button>
          </div>
          <div className="flex bg-white/5 p-1 rounded-md border border-white/5">
            <button 
              onClick={() => setLang('zh')}
              className={cn("px-2 py-0.5 text-[10px] rounded transition-all", lang === 'zh' ? "bg-white/10 text-white" : "text-white/40 hover:text-white/60")}
            >繁中</button>
            <button 
              onClick={() => setLang('en')}
              className={cn("px-2 py-0.5 text-[10px] rounded transition-all", lang === 'en' ? "bg-white/10 text-white" : "text-white/40 hover:text-white/60")}
            >EN</button>
          </div>
          <div {...getRootProps()} className="cursor-pointer">
            <input {...getInputProps()} />
            <button className="px-4 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-md text-sm transition-colors flex items-center gap-2">
              <Upload className="w-4 h-4" />
              {t.import}
            </button>
          </div>
          <button 
            onClick={downloadAll}
            disabled={slices.length === 0}
            className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 rounded-md text-sm font-semibold transition-colors shadow-lg shadow-blue-900/20 disabled:opacity-30 disabled:grayscale"
          >
            {t.exportZip}
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 flex overflow-hidden">
        
        {/* Left Sidebar: Tools */}
        <aside className="w-72 border-r border-white/10 bg-[#151515] flex flex-col shrink-0 overflow-y-auto">
          <div className="p-5 space-y-6">
            <section>
              <h3 className="text-[10px] uppercase tracking-widest text-white/40 mb-4 font-bold">{t.bgMode}</h3>
              <div className="flex bg-white/5 p-1 rounded-md border border-white/5">
                <button 
                  onClick={() => toggleBgMode('original')}
                  className={cn(
                    "flex-1 py-1.5 text-xs rounded transition-all",
                    bgMode === 'original' ? "bg-white/10 text-white" : "text-white/40 hover:text-white/60"
                  )}
                >
                  {t.viewOriginal}
                </button>
                <button 
                  onClick={() => toggleBgMode('processed')}
                  disabled={!processedImage}
                  className={cn(
                    "flex-1 py-1.5 text-xs rounded transition-all disabled:opacity-30",
                    bgMode === 'processed' ? "bg-white/10 text-white" : "text-white/40 hover:text-white/60"
                  )}
                >
                  {t.viewProcessed}
                </button>
              </div>
            </section>

            <section>
              <h3 className="text-[10px] uppercase tracking-widest text-white/40 mb-2 font-bold">{t.cutLineSettings}</h3>
              <p className="text-[10px] text-zinc-500 mb-4">{t.quickBuild}</p>
              
              <div className="grid grid-cols-4 gap-2 mb-4">
                {[
                  [2, 2], [3, 3], [4, 4]
                ].map(([r, c]) => (
                  <button 
                    key={`${r}-${c}`}
                    disabled={isLocked}
                    onClick={() => { 
                      const nr = []; for(let i=1; i<r; i++) nr.push(i/r);
                      const nc = []; for(let i=1; i<c; i++) nc.push(i/c);
                      setRowLines(nr);
                      setColLines(nc);
                    }}
                    className="py-2 border border-white/10 rounded bg-white/5 text-[10px] hover:border-white/30 transition-all disabled:opacity-30"
                  >
                    {r}x{c}
                  </button>
                ))}
                <button 
                  disabled={isLocked}
                  onClick={() => { setRowLines([0.5]); setColLines([0.25, 0.5, 0.75]); }}
                  className="py-2 border border-white/10 rounded bg-white/5 text-[10px] hover:border-white/30 transition-all disabled:opacity-30"
                >
                  {t.resetLines}
                </button>
              </div>

              <div className="flex gap-2 mb-6">
                <button 
                  disabled={isLocked}
                  onClick={() => setColLines(prev => [...prev, 0.5].sort((a,b)=>a-b))}
                  className="flex-1 py-2 border border-white/10 rounded bg-white/5 text-[11px] hover:border-white/30 transition-all disabled:opacity-30"
                >
                  {t.addVertical}
                </button>
                <button 
                  disabled={isLocked}
                  onClick={() => setRowLines(prev => [...prev, 0.5].sort((a,b)=>a-b))}
                  className="flex-1 py-2 border border-white/10 rounded bg-white/5 text-[11px] hover:border-white/30 transition-all disabled:opacity-30"
                >
                  {t.addHorizontal}
                </button>
              </div>

              {/* Vertical Lines List */}
              <div className="space-y-4 mb-6">
                <div className="flex justify-between items-center">
                  <h4 className="text-[11px] font-bold text-white/80">{t.verticalLines}</h4>
                  <button 
                    disabled={isLocked}
                    onClick={() => setColLines(prev => [...prev, 0.5].sort((a,b)=>a-b))}
                    className="text-[10px] bg-white/5 px-2 py-0.5 rounded border border-white/10 hover:bg-white/10 disabled:opacity-30"
                  >
                    {t.addLine}
                  </button>
                </div>
                <div className="space-y-3">
                  {colLines.map((line, idx) => (
                    <div key={`col-${idx}`} className="bg-white/[0.03] border border-white/5 rounded-lg p-3">
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-[10px] text-zinc-500">{t.line} {idx + 1}</span>
                        <button 
                          disabled={isLocked}
                          onClick={() => setColLines(prev => prev.filter((_, i) => i !== idx))}
                          className="text-[9px] text-zinc-600 hover:text-red-400 disabled:opacity-30"
                        >
                          {t.delete}
                        </button>
                      </div>
                      <div className="flex items-center gap-3">
                        <input 
                          type="range"
                          min="0" max="100" step="0.01"
                          value={line * 100}
                          disabled={isLocked}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value) / 100;
                            setColLines(curr => {
                              const next = [...curr];
                              next[idx] = val;
                              return next;
                            });
                          }}
                          className="flex-1 accent-blue-500 h-1 bg-white/10 rounded-full appearance-none"
                        />
                        <div className="relative">
                          <input 
                            type="number"
                            value={(line * 100).toFixed(2)}
                            disabled={isLocked}
                            onChange={(e) => {
                              const val = parseFloat(e.target.value) / 100;
                              if (!isNaN(val)) {
                                setColLines(curr => {
                                  const next = [...curr];
                                  next[idx] = Math.max(0, Math.min(1, val));
                                  return next;
                                });
                              }
                            }}
                            className="w-16 bg-[#0F0F0F] border border-white/10 rounded px-2 py-1 text-[10px] text-right focus:border-blue-500 outline-none"
                          />
                          <span className="absolute right-[-14px] top-1/2 -translate-y-1/2 text-[10px] text-zinc-500">%</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Horizontal Lines List */}
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <h4 className="text-[11px] font-bold text-white/80">{t.horizontalLines}</h4>
                  <button 
                    disabled={isLocked}
                    onClick={() => setRowLines(prev => [...prev, 0.5].sort((a,b)=>a-b))}
                    className="text-[10px] bg-white/5 px-2 py-0.5 rounded border border-white/10 hover:bg-white/10 disabled:opacity-30"
                  >
                    {t.addLine}
                  </button>
                </div>
                <div className="space-y-3">
                  {rowLines.map((line, idx) => (
                    <div key={`row-${idx}`} className="bg-white/[0.03] border border-white/5 rounded-lg p-3">
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-[10px] text-zinc-500">{t.line} {idx + 1}</span>
                        <button 
                          disabled={isLocked}
                          onClick={() => setRowLines(prev => prev.filter((_, i) => i !== idx))}
                          className="text-[9px] text-zinc-600 hover:text-red-400 disabled:opacity-30"
                        >
                          {t.delete}
                        </button>
                      </div>
                      <div className="flex items-center gap-3">
                        <input 
                          type="range"
                          min="0" max="100" step="0.01"
                          value={line * 100}
                          disabled={isLocked}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value) / 100;
                            setRowLines(curr => {
                              const next = [...curr];
                              next[idx] = val;
                              return next;
                            });
                          }}
                          className="flex-1 accent-blue-500 h-1 bg-white/10 rounded-full appearance-none"
                        />
                        <div className="relative">
                          <input 
                            type="number"
                            value={(line * 100).toFixed(2)}
                            disabled={isLocked}
                            onChange={(e) => {
                              const val = parseFloat(e.target.value) / 100;
                              if (!isNaN(val)) {
                                setRowLines(curr => {
                                  const next = [...curr];
                                  next[idx] = Math.max(0, Math.min(1, val));
                                  return next;
                                });
                              }
                            }}
                            className="w-16 bg-[#0F0F0F] border border-white/10 rounded px-2 py-1 text-[10px] text-right focus:border-blue-500 outline-none"
                          />
                          <span className="absolute right-[-14px] top-1/2 -translate-y-1/2 text-[10px] text-zinc-500">%</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

            </section>

            <section>
              <h3 className="text-[10px] uppercase tracking-widest text-white/40 mb-4 font-bold">{t.aiTitle}</h3>
              <div className="space-y-2">
                <button 
                  onClick={handleRemoveBackground}
                  disabled={!image || isProcessing}
                  className="w-full py-2.5 px-4 bg-blue-600/10 border border-blue-500/30 rounded text-left text-sm flex justify-between items-center hover:bg-blue-600/20 transition-colors group disabled:opacity-30"
                >
                  <span className="text-blue-300 font-medium flex items-center gap-2">
                    <Eraser className="w-4 h-4" />
                    {t.smartCut}
                  </span>
                  <span className="text-[9px] px-1.5 py-0.5 bg-blue-500/20 text-blue-400 rounded uppercase font-bold tracking-tighter">Gemini</span>
                </button>
                <button 
                  onClick={() => {
                    if (!image) return;
                    const link = document.createElement('a');
                    link.href = image;
                    link.download = 'cut_ryder_transparency.png';
                    link.click();
                  }}
                  disabled={!image}
                  className="w-full py-2.5 px-4 bg-white/5 border border-white/10 rounded text-left text-sm hover:bg-white/10 transition-colors text-white/60 flex items-center gap-2 disabled:opacity-30"
                >
                  <Download className="w-4 h-4" />
                  {t.saveTrans}
                </button>
              </div>
            </section>

            <section className="pt-2">
              <button 
                onClick={handleSlice}
                disabled={!image}
                className="w-full bg-blue-600 hover:bg-blue-500 py-3 rounded-md text-xs font-bold uppercase tracking-widest transition-all shadow-lg shadow-blue-500/10 active:scale-95 disabled:opacity-30 disabled:grayscale"
              >
                {t.generate}
              </button>
            </section>
          </div>
          
          <div className="mt-auto p-5 border-t border-white/10 bg-black/20">
            <div className="flex items-center gap-3 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded">
              <div className="w-2 h-2 shrink-0 rounded-full bg-yellow-500"></div>
              <p className="text-[10px] text-yellow-200/60 leading-snug">{t.compliance}</p>
            </div>
          </div>
        </aside>

        {/* Center: Canvas Area */}
        <div className="flex-1 bg-[#0a0a0a] relative flex items-center justify-center p-8 overflow-hidden">
          {/* Grid Overlay Background */}
          <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: 'linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)', backgroundSize: '40px 40px' }}></div>
          
          <div 
             ref={workspaceRef}
             className={cn(
               "w-full h-full relative overflow-hidden flex items-center justify-center transition-all",
               isLocked ? "cursor-default" : "cursor-move"
             )}
             onMouseDown={handleMouseDown}
             onMouseMove={handleMouseMove}
             onMouseUp={handleMouseUp}
             onMouseLeave={handleMouseUp}
             onWheel={handleWheel}
          >
            {imageEl ? (
              <div 
                style={{
                  transform: `translate(${pos.x}px, ${pos.y}px) scale(${scale})`,
                  transformOrigin: '0 0',
                  transition: isDragging ? 'none' : 'transform 0.1s ease-out',
                  position: 'absolute'
                }}
                className="pointer-events-none shadow-2xl"
              >
                <img 
                  src={image!} 
                  alt="Working" 
                  draggable={false}
                  className="block"
                  style={{ width: imageEl.width, height: imageEl.height }}
                />
                
                {/* Cutting Grid Lines */}
                <div className="absolute inset-0 pointer-events-none">
                  {/* Vertical Lines */}
                  {colLines.map((line, idx) => (
                    <div 
                      key={`v-${idx}`}
                      className="absolute top-0 bottom-0 w-px bg-blue-500/80 pointer-events-auto cursor-col-resize group shadow-[0_0_10px_rgba(59,130,246,0.5)]"
                      style={{ left: `${line * 100}%` }}
                      onMouseDown={(e) => {
                        e.stopPropagation();
                        const move = (moveEvent: MouseEvent) => {
                          const rect = (e.currentTarget.parentElement as HTMLElement).getBoundingClientRect();
                          const newOffset = Math.max(0.01, Math.min(0.99, (moveEvent.clientX - rect.left) / rect.width));
                          setColLines(curr => {
                            const next = [...curr];
                            next[idx] = newOffset;
                            return next;
                          });
                        };
                        const up = () => {
                          window.removeEventListener('mousemove', move);
                          window.removeEventListener('mouseup', up);
                        };
                        window.addEventListener('mousemove', move);
                        window.addEventListener('mouseup', up);
                      }}
                    >
                      <div className="absolute top-0 bottom-0 -left-2 -right-2 group-hover:bg-blue-500/30 transition-colors"></div>
                    </div>
                  ))}

                  {/* Horizontal Lines */}
                  {rowLines.map((line, idx) => (
                    <div 
                      key={`h-${idx}`}
                      className="absolute left-0 right-0 h-px bg-blue-500/80 pointer-events-auto cursor-row-resize group shadow-[0_0_10px_rgba(59,130,246,0.5)]"
                      style={{ top: `${line * 100}%` }}
                      onMouseDown={(e) => {
                        e.stopPropagation();
                        const move = (moveEvent: MouseEvent) => {
                          const rect = (e.currentTarget.parentElement as HTMLElement).getBoundingClientRect();
                          const newOffset = Math.max(0.01, Math.min(0.99, (moveEvent.clientY - rect.top) / rect.height));
                          setRowLines(curr => {
                            const next = [...curr];
                            next[idx] = newOffset;
                            return next;
                          });
                        };
                        const up = () => {
                          window.removeEventListener('mousemove', move);
                          window.removeEventListener('mouseup', up);
                        };
                        window.addEventListener('mousemove', move);
                        window.addEventListener('mouseup', up);
                      }}
                    >
                      <div className="absolute left-0 right-0 -top-2 -bottom-2 group-hover:bg-blue-500/30 transition-colors"></div>
                    </div>
                  ))}

                  {/* Cell Numbers (Visual Only) */}
                  <div className="absolute inset-0 grid pointer-events-none" style={{
                    gridTemplateRows: [...rowLines, 1].map((curr, i, arr) => `${(curr - (arr[i-1] || 0)) * 100}%`).join(' '),
                    gridTemplateColumns: [...colLines, 1].map((curr, i, arr) => `${(curr - (arr[i-1] || 0)) * 100}%`).join(' '),
                  }}>
                    {Array.from({ length: rows * cols }).map((_, i) => (
                      <div key={i} className="relative border border-blue-500/10">
                        <div className="absolute top-1 left-1 text-[9px] text-blue-400 bg-black/60 px-1 border border-white/5 font-mono">
                          {String(i + 1).padStart(2, '0')}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div {...getRootProps()} className="group relative w-full h-full flex items-center justify-center">
                <input {...getInputProps()} />
                <div className="p-12 border-2 border-dashed border-white/5 group-hover:border-blue-500/30 rounded-3xl flex flex-col items-center gap-4 transition-all bg-white/[0.02]">
                  <div className="w-16 h-16 rounded-full bg-blue-600/10 flex items-center justify-center border border-blue-500/20 group-hover:scale-110 transition-transform">
                    <Upload className="w-8 h-8 text-blue-500" />
                  </div>
                  <div className="text-center">
                    <p className="font-semibold text-lg text-white/80">{t.dropHint}</p>
                    <p className="text-zinc-500 text-sm mt-1">{t.clickHint}</p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Floating Control Bar */}
          {imageEl && (
            <div className="absolute bottom-10 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-[#1A1A1A] p-2 rounded-full border border-white/10 shadow-2xl">
              <button 
                onClick={() => setScale(s => s * 1.2)}
                className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-white/5 text-zinc-400 hover:text-white"
              >
                <Maximize className="w-4 h-4" />
              </button>
              <button 
                onClick={() => setScale(s => s * 0.8)}
                className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-white/5 text-zinc-400 hover:text-white"
              >
                <Minimize className="w-4 h-4" />
              </button>
              <div className="h-6 w-px bg-white/10 mx-1"></div>
              <button 
                onClick={() => resetTransform(imageEl)}
                className="px-4 py-2 text-xs font-medium text-zinc-400 hover:text-white hover:bg-white/5 rounded-full"
              >
                {t.reset}
              </button>
              <button 
                onClick={() => { setImage(null); setImageEl(null); setSlices([]); }}
                className="px-4 py-2 text-xs font-medium text-red-400 hover:bg-red-500/10 rounded-full"
              >
                {t.clear}
              </button>
            </div>
          )}
        </div>

        {/* Right Sidebar: Output & Slots */}
        <aside className="w-72 border-l border-white/10 bg-[#151515] flex flex-col shrink-0">
          <div className="p-5 flex-1 flex flex-col overflow-hidden">
            <h3 className="text-[10px] uppercase tracking-widest text-white/40 mb-4 font-bold">{t.lineFormats}</h3>
            
            <div className="space-y-4 overflow-y-auto pr-2 custom-scrollbar flex-1">
              {/* Main Slot */}
              <div className={cn(
                "p-3 bg-white/5 border rounded-lg transition-all",
                mainSticker ? "border-blue-500/50" : "border-white/10"
              )}>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-[11px] font-bold text-white/80 uppercase">{t.mainIcon}</span>
                  <span className="text-[9px] text-white/40">240 x 240</span>
                </div>
                <div className="aspect-square w-full bg-black rounded-md flex items-center justify-center border border-dashed border-white/20 mb-3 overflow-hidden">
                  {mainSticker ? (
                    <img src={mainSticker.dataUrl} alt="Main" className="w-full h-full object-contain p-2" />
                  ) : (
                    <span className="text-[9px] text-white/20 text-center px-4">{t.assignHint}</span>
                  )}
                </div>
                {mainSticker && (
                  <button 
                    onClick={() => downloadSingle(mainSticker, -1)}
                    className="w-full py-1.5 text-[9px] bg-blue-600/10 border border-blue-500/40 text-blue-400 rounded uppercase font-bold"
                  >
                    {t.downloadMain}
                  </button>
                )}
              </div>

              {/* Tab Slot */}
              <div className={cn(
                "p-3 bg-white/5 border rounded-lg transition-all",
                tabSticker ? "border-red-500/50" : "border-white/10"
              )}>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-[11px] font-bold text-white/80 uppercase">{t.tabIcon}</span>
                  <span className="text-[9px] text-white/40 text-red-500/60">96 x 74</span>
                </div>
                <div className="h-20 w-full bg-black rounded-md flex items-center justify-center border border-dashed border-white/20 mb-3 overflow-hidden">
                  {tabSticker ? (
                    <img src={tabSticker.dataUrl} alt="Tab" className="h-full object-contain p-1" />
                  ) : (
                    <span className="text-[9px] text-white/20">{t.assignTab}</span>
                  )}
                </div>
                {tabSticker && (
                  <button 
                    onClick={() => downloadSingle(tabSticker, -1)}
                    className="w-full py-1.5 text-[9px] bg-red-600/10 border border-red-500/40 text-red-400 rounded uppercase font-bold"
                  >
                    {t.downloadTab}
                  </button>
                )}
              </div>

              {/* History/Slices list */}
              {slices.length > 0 && (
                <div className="pt-4 mt-4 border-t border-white/10">
                  <h3 className="text-[10px] uppercase tracking-widest text-white/40 mb-3 font-bold">{t.history}</h3>
                  <div className="grid grid-cols-3 gap-2 pb-6">
                    {slices.map((s, idx) => (
                      <div 
                        key={s.id} 
                        className={cn(
                          "aspect-square rounded border relative group overflow-hidden cursor-pointer",
                          s.isMain ? "border-blue-500 bg-blue-500/10" : s.isTab ? "border-red-500 bg-red-500/10" : "border-white/10 bg-black/40 hover:border-white/30"
                        )}
                        onClick={() => downloadSingle(s, idx)}
                      >
                        <img src={s.dataUrl} alt={`Slice ${idx}`} className="w-full h-full object-contain p-1" />
                        <div className="absolute inset-0 bg-blue-600/80 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center gap-1 transition-opacity">
                          <button 
                            className="text-[8px] bg-black text-white px-1 py-0.5 rounded"
                            onClick={(e) => { e.stopPropagation(); toggleSpecial(s.id, 'main'); }}
                          >{t.assignMain}</button>
                          <button 
                            className="text-[8px] bg-black text-white px-1 py-0.5 rounded"
                            onClick={(e) => { e.stopPropagation(); toggleSpecial(s.id, 'tab'); }}
                          >{t.assignTab}</button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="p-5 mt-auto">
            <button 
              onClick={downloadAll}
              disabled={slices.length === 0}
              className="w-full py-3 bg-white text-black font-bold text-xs rounded hover:bg-gray-200 transition-colors uppercase tracking-widest disabled:opacity-30"
            >
              {t.downloadAll}
            </button>
          </div>
        </aside>
      </main>

      {/* Bottom Status Bar */}
      <footer className="h-8 border-t border-white/10 bg-[#151515] flex items-center justify-between px-6 text-[10px] text-zinc-500 shrink-0 uppercase font-mono tracking-tighter">
        <div className="flex gap-6">
          <span>{imageEl ? `${t.source}: ${imageEl.width}x${imageEl.height}` : "..."}</span>
          <span>{t.slices}: {slices.length}</span>
          <span>{t.grid}: {rows}x{cols}</span>
        </div>
        <div className="flex gap-4">
          <span className="text-blue-500/60 font-bold">● {t.aiActive}</span>
          <span>{t.ready}</span>
        </div>
      </footer>

      {/* Loading Overlay */}
      <AnimatePresence>
        {isProcessing && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-8"
          >
            <div className="bg-[#151515] border border-white/10 p-10 rounded-xl shadow-2xl flex flex-col items-center gap-6 max-w-sm w-full">
              <div className="relative">
                <div className="w-16 h-16 border-2 border-blue-500/20 border-t-blue-500 rounded-lg animate-spin"></div>
                <ImageIcon className="absolute inset-0 m-auto w-6 h-6 text-blue-500 animate-pulse" />
              </div>
              <div className="text-center space-y-2">
                <h3 className="text-lg font-bold tracking-tight">{t.processing}</h3>
                <p className="text-zinc-500 text-xs">{t.processingHint}</p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

