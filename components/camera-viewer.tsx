"use client"

import { useEffect, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { CopyIcon, TrashIcon, Settings2Icon } from "lucide-react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import PeopleCounterDisplay from "@/components/people-counter-display"
import { PeopleCounter } from "@/utils/people-counter"
import { Badge } from "@/components/ui/badge"

interface CameraViewerProps {
  id: string
  roomId: string
  index: number
  debugMode: boolean
  scriptsLoaded: boolean
  isLoadingScripts: boolean
  onLoadScripts: () => void
  onRemove: () => void
  onUpdateRoomId: (roomId: string) => void
  onToggleDebugMode: () => void
  onCopyUrl: (url: string) => void
}

export default function CameraViewer({
  id,
  roomId,
  index,
  debugMode,
  scriptsLoaded,
  isLoadingScripts,
  onLoadScripts,
  onRemove,
  onUpdateRoomId,
  onToggleDebugMode,
  onCopyUrl,
}: CameraViewerProps) {
  // 各カメラ接続の状態
  const [connectionStatus, setConnectionStatus] = useState("未接続")
  const [quality, setQuality] = useState("medium")
  const [showPeopleCounter, setShowPeopleCounter] = useState(false)
  const [peopleCount, setPeopleCount] = useState({ leftToRight: 0, rightToLeft: 0, total: 0 })
  const [imageReceived, setImageReceived] = useState(false)

  // 各カメラ接続のref
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const remoteImageRef = useRef<HTMLImageElement>(null)
  const analysisCanvasRef = useRef<HTMLCanvasElement>(null)
  const peopleCounterRef = useRef<PeopleCounter | null>(null)

  // カメラURLの生成
  const cameraUrl = typeof window !== "undefined" ? `${window.location.origin}?room=${roomId}&mode=camera` : ""

  // 人物カウント機能が有効になったらスクリプトを読み込む
  useEffect(() => {
    if (showPeopleCounter && !scriptsLoaded && !isLoadingScripts) {
      onLoadScripts()
    } else if (showPeopleCounter && scriptsLoaded && !peopleCounterRef.current) {
      initPeopleCounter()
    }
  }, [showPeopleCounter, scriptsLoaded, isLoadingScripts])

  // スクリプトが読み込まれたら人物カウンターを初期化
  useEffect(() => {
    if (scriptsLoaded && showPeopleCounter && !peopleCounterRef.current) {
      initPeopleCounter()
    }
  }, [scriptsLoaded, showPeopleCounter])

  // デバッグモードが変更されたら人物カウンターのデバッグモードも更新
  useEffect(() => {
    if (peopleCounterRef.current) {
      peopleCounterRef.current.setDebugMode(debugMode)
    }
  }, [debugMode])

  // 人物カウンターの初期化
  const initPeopleCounter = () => {
    console.log(`カメラ ${id} の人物カウンター初期化開始:`, {
      current: peopleCounterRef.current,
      scriptsLoaded,
      analysisCanvas: analysisCanvasRef.current,
    })

    if (!peopleCounterRef.current && scriptsLoaded) {
      console.log(`カメラ ${id} の人物カウンターを初期化しています...`)

      // グローバルオブジェクトのcocoSsdが存在するか確認
      if (typeof window !== "undefined" && !(window as any).cocoSsd) {
        console.error("COCO-SSDモデルがグローバルオブジェクトに見つかりません")
        return
      }

      peopleCounterRef.current = new PeopleCounter()
      peopleCounterRef.current.setCountUpdateCallback((count) => {
        console.log(`カメラ ${id} のカウント更新:`, count)
        setPeopleCount(count)
      })
      peopleCounterRef.current.setDebugMode(debugMode)

      if (analysisCanvasRef.current) {
        console.log(`カメラ ${id} の分析キャンバスを設定します`)
        peopleCounterRef.current.setAnalysisCanvas(analysisCanvasRef.current)
      } else {
        console.warn(`カメラ ${id} の分析キャンバスが見つかりません`)
      }

      // 横断ラインを設定
      updateCrossingLine()

      console.log(`カメラ ${id} の人物カウンター初期化完了`)

      // 既に画像が受信されている場合は、人物検出を実行
      if (imageReceived && remoteImageRef.current && analysisCanvasRef.current) {
        console.log(`カメラ ${id} の初期化後に既存の画像で人物検出を実行します`)
        setTimeout(() => {
          if (peopleCounterRef.current && remoteImageRef.current && analysisCanvasRef.current) {
            peopleCounterRef.current.detectPeople(remoteImageRef.current, analysisCanvasRef.current)
          }
        }, 500)
      }
    }
  }

  // 横断ラインの更新
  const updateCrossingLine = () => {
    if (!peopleCounterRef.current) {
      console.warn(`カメラ ${id} の人物カウンターが初期化されていないため、横断ラインを設定できません`)
      return
    }

    if (!analysisCanvasRef.current) {
      console.warn(`カメラ ${id} の分析キャンバスが見つからないため、横断ラインを設定できません`)
      return
    }

    // キャンバスの寸法を取得
    const width = analysisCanvasRef.current.width
    const height = analysisCanvasRef.current.height

    console.log(`カメラ ${id} の横断ラインを設定: キャンバスサイズ=${width}x${height}`)

    // 画面の中央に横断ラインを設定（左から右へ）
    peopleCounterRef.current.setCrossingLine(
      width * 0.2, // 左端から20%の位置
      height * 0.5, // 上端から50%の位置
      width * 0.8, // 左端から80%の位置
      height * 0.5, // 上端から50%の位置
    )
  }

  // 画像の読み込み完了ハンドラ
  const handleImageLoad = () => {
    console.log(`カメラ ${id} の画像が読み込まれました`)
    setImageReceived(true)

    if (showPeopleCounter && peopleCounterRef.current && analysisCanvasRef.current && scriptsLoaded) {
      console.log(`カメラ ${id} の画像読み込み完了 - 人物検出を実行します`)
      peopleCounterRef.current.detectPeople(remoteImageRef.current!, analysisCanvasRef.current)
    } else {
      console.log(`カメラ ${id} の画像は読み込まれましたが、人物検出の条件が揃っていません:`, {
        showPeopleCounter,
        peopleCounter: !!peopleCounterRef.current,
        analysisCanvas: !!analysisCanvasRef.current,
        scriptsLoaded,
      })
    }
  }

  // メッセージイベントリスナー
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      // 接続状態の更新
      if (
        event.data &&
        event.data.type === "connection-status" &&
        iframeRef.current &&
        event.source === iframeRef.current.contentWindow
      ) {
        setConnectionStatus(event.data.status)
      }

      // 画像データの受信（人物検出用）
      if (
        event.data &&
        event.data.type === "image-data" &&
        iframeRef.current &&
        event.source === iframeRef.current.contentWindow &&
        remoteImageRef.current
      ) {
        // 画像データを設定
        remoteImageRef.current.src = event.data.data
        setImageReceived(true)

        // 画像が読み込まれたら人物検出を実行
        if (showPeopleCounter && peopleCounterRef.current && analysisCanvasRef.current && scriptsLoaded) {
          console.log(`カメラ ${id} の画像データを受信しました - 人物検出を実行します`)
          // 少し遅延を入れて画像の読み込みを待つ
          setTimeout(() => {
            if (peopleCounterRef.current && remoteImageRef.current && analysisCanvasRef.current) {
              peopleCounterRef.current.detectPeople(remoteImageRef.current, analysisCanvasRef.current)
            }
          }, 100)
        }
      }
    }

    window.addEventListener("message", handleMessage)

    return () => {
      window.removeEventListener("message", handleMessage)
    }
  }, [id, showPeopleCounter, scriptsLoaded])

  // 品質設定の変更
  const handleQualityChange = (value: string) => {
    setQuality(value)
    if (iframeRef.current && iframeRef.current.contentWindow) {
      iframeRef.current.contentWindow.postMessage(
        {
          type: "quality-change",
          quality: value,
        },
        "*",
      )
    }
  }

  // 人物カウントのリセット
  const resetPeopleCount = () => {
    if (peopleCounterRef.current) {
      peopleCounterRef.current.resetCount()
    }
  }

  // 人物カウント機能の切り替え
  const togglePeopleCounter = () => {
    const newState = !showPeopleCounter
    setShowPeopleCounter(newState)

    // 有効にする場合は、スクリプトの読み込みと初期化を確認
    if (newState) {
      console.log(`カメラ ${id} の人物カウント機能を有効にします`)
      if (!scriptsLoaded && !isLoadingScripts) {
        onLoadScripts()
      } else if (scriptsLoaded && !peopleCounterRef.current) {
        initPeopleCounter()
      }
    } else {
      console.log(`カメラ ${id} の人物カウント機能を無効にします`)
    }
  }

  return (
    <div className="mb-8 border rounded-lg p-4">
      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center gap-2">
          <h3 className="text-lg font-medium">カメラ {index + 1}</h3>
          <Badge variant={connectionStatus.includes("接続済み") ? "success" : "secondary"}>{connectionStatus}</Badge>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => onCopyUrl(cameraUrl)}>
            <CopyIcon className="w-4 h-4 mr-1" />
            URLをコピー
          </Button>
          <Button variant="destructive" size="sm" onClick={onRemove}>
            <TrashIcon className="w-4 h-4 mr-1" />
            削除
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-4 mb-2">
        <div className="flex-1">
          <Label htmlFor={`room-id-${id}`} className="text-sm">
            ルームID
          </Label>
          <Input
            id={`room-id-${id}`}
            value={roomId}
            onChange={(e) => onUpdateRoomId(e.target.value)}
            placeholder="ルームIDを入力"
          />
        </div>

        <div className="flex items-center gap-2">
          <Settings2Icon className="w-4 h-4" />
          <Select value={quality} onValueChange={handleQualityChange}>
            <SelectTrigger className="w-[120px] h-8">
              <SelectValue placeholder="画質設定" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="high">高画質 (低FPS)</SelectItem>
              <SelectItem value="medium">標準 (中FPS)</SelectItem>
              <SelectItem value="low">低画質 (高FPS)</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        {/* メインの映像表示エリア */}
        <div>
          <div className="relative h-[300px] md:h-[400px] bg-black rounded-md overflow-hidden">
            {/* 人物検出用の非表示画像要素 */}
            {showPeopleCounter && (
              <img
                ref={remoteImageRef}
                className="hidden"
                alt="カメラ映像"
                crossOrigin="anonymous"
                width={640}
                height={480}
                onLoad={handleImageLoad}
              />
            )}

            {/* 映像を表示するiframe */}
            <iframe
              ref={iframeRef}
              src={`/api/connect?room=${roomId}&mode=viewer&embedded=true`}
              className="w-full h-full rounded-md border-0"
              allow="camera;microphone"
              title={`カメラ ${index + 1}`}
            />
          </div>
        </div>

        {/* 分析映像表示エリア */}
        <div className="relative h-[300px] md:h-[400px] bg-black rounded-md overflow-hidden">
          <div className="absolute top-2 left-2 z-10">
            <span className="text-xs text-white bg-black bg-opacity-50 px-2 py-1 rounded">分析映像</span>
          </div>
          {!showPeopleCounter ? (
            <div className="w-full h-full flex items-center justify-center text-gray-400">
              人物カウント機能を有効にすると分析映像が表示されます
            </div>
          ) : (
            <canvas
              ref={analysisCanvasRef}
              className="w-full h-full object-contain"
              width={640}
              height={480}
              style={{ background: "#000" }}
            />
          )}
        </div>
      </div>

      <div className="flex gap-2 mb-4">
        <Button variant={showPeopleCounter ? "default" : "outline"} onClick={togglePeopleCounter} className="flex-1">
          人物カウント {showPeopleCounter ? "オフ" : "オン"}
        </Button>
      </div>

      {/* 人物カウント表示 */}
      {showPeopleCounter && (
        <div className="mt-2">
          <PeopleCounterDisplay
            count={peopleCount}
            onReset={resetPeopleCount}
            onToggleDebug={onToggleDebugMode}
            debugMode={debugMode}
          />
        </div>
      )}
    </div>
  )
}
