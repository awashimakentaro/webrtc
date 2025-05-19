"use client"

import { useEffect, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { CopyIcon, SmartphoneIcon, MonitorIcon, WifiIcon, XIcon, Settings2Icon } from "lucide-react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import PeopleCounterDisplay from "../components/people-counter-display"
import { PeopleCounter } from "@/utils/people-counter"

export default function Home() {
  const [roomId, setRoomId] = useState("")
  const [isCopied, setIsCopied] = useState(false)
  const [activeTab, setActiveTab] = useState("viewer")
  const [showIframe, setShowIframe] = useState(false)
  const [connectionStatus, setConnectionStatus] = useState("未接続")
  const [quality, setQuality] = useState("medium")
  const [peopleCount, setPeopleCount] = useState({ leftToRight: 0, rightToLeft: 0, total: 0 })
  const [debugMode, setDebugMode] = useState(false)
  const [showPeopleCounter, setShowPeopleCounter] = useState(false)

  const iframeRef = useRef<HTMLIFrameElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const peopleCounterRef = useRef<PeopleCounter | null>(null)
  const remoteImageRef = useRef<HTMLImageElement | null>(null)

  // ページロード時に一意のルームIDを生成
  useEffect(() => {
    const generatedRoomId = Math.random().toString(36).substring(2, 8)
    setRoomId(generatedRoomId)
  }, [])

  // 接続URLの生成
  const cameraUrl = typeof window !== "undefined" ? `${window.location.origin}?room=${roomId}&mode=camera` : ""

  // クリップボードにコピー
  const copyToClipboard = () => {
    navigator.clipboard.writeText(cameraUrl)
    setIsCopied(true)
    setTimeout(() => setIsCopied(false), 2000)
  }

  // URLパラメータからモードとルームIDを取得
  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search)
      const mode = params.get("mode")
      const room = params.get("room")

      if (mode === "camera") {
        setActiveTab("camera")
      }

      if (room) {
        setRoomId(room)
      }
    }
  }, [])

  // メッセージイベントリスナー
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      // 接続状態の更新
      if (event.data && event.data.type === "connection-status") {
        setConnectionStatus(event.data.status)
      }
    }

    window.addEventListener("message", handleMessage)

    return () => {
      window.removeEventListener("message", handleMessage)
    }
  }, [])

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

  // 人物カウンターの初期化
  useEffect(() => {
    // TensorFlow.jsとCOCO-SSDモデルのスクリプトを動的に読み込み
    const loadTensorflowScripts = async () => {
      try {
        // TensorFlow.jsのスクリプトを読み込み
        const tfScript = document.createElement("script")
        tfScript.src = "https://cdn.jsdelivr.net/npm/@tensorflow/tfjs"
        tfScript.async = true
        document.body.appendChild(tfScript)

        // COCO-SSDモデルのスクリプトを読み込み
        const cocoSsdScript = document.createElement("script")
        cocoSsdScript.src = "https://cdn.jsdelivr.net/npm/@tensorflow-models/coco-ssd"
        cocoSsdScript.async = true
        document.body.appendChild(cocoSsdScript)

        // スクリプトの読み込みを待機
        await new Promise((resolve) => {
          cocoSsdScript.onload = resolve
        })

        console.log("TensorFlow.jsとCOCO-SSDモデルを読み込みました")
      } catch (error) {
        console.error("スクリプト読み込みエラー:", error)
      }
    }

    loadTensorflowScripts()

    // 人物カウンターのインスタンスを作成
    peopleCounterRef.current = new PeopleCounter()
    peopleCounterRef.current.setCountUpdateCallback(setPeopleCount)

    return () => {
      // クリーンアップ処理
    }
  }, [])

  // 人物検出の実行
  useEffect(() => {
    if (!showPeopleCounter || activeTab !== "viewer" || !showIframe) return

    let animationFrameId: number
    const peopleCounter = peopleCounterRef.current
    const canvas = canvasRef.current

    if (!peopleCounter || !canvas) return

    // 画面の中央に横断ラインを設定
    const setLine = () => {
      const width = window.innerWidth
      const height = window.innerHeight
      peopleCounter.setCrossingLine(width * 0.2, height * 0.5, width * 0.8, height * 0.5)
    }

    setLine()
    window.addEventListener("resize", setLine)

    // デバッグモードの設定
    peopleCounter.setDebugMode(debugMode)

    // 人物検出ループ
    const detectLoop = () => {
      if (remoteImageRef.current && canvas) {
        peopleCounter.detectPeople(remoteImageRef.current, canvas)
      }
      animationFrameId = requestAnimationFrame(detectLoop)
    }

    // モデルを読み込んで検出を開始
    peopleCounter.loadModel().then(() => {
      animationFrameId = requestAnimationFrame(detectLoop)
    })

    return () => {
      cancelAnimationFrame(animationFrameId)
      window.removeEventListener("resize", setLine)
    }
  }, [showPeopleCounter, activeTab, showIframe, debugMode])

  // リモート画像の参照を取得するためのコールバック
  const handleRemoteImageRef = (node: HTMLImageElement | null) => {
    remoteImageRef.current = node
  }

  // 人物カウントのリセット
  const resetPeopleCount = () => {
    if (peopleCounterRef.current) {
      peopleCounterRef.current.resetCount()
    }
  }

  // デバッグモードの切り替え
  const toggleDebugMode = () => {
    setDebugMode(!debugMode)
  }

  return (
    <div className="container flex items-center justify-center min-h-screen py-4">
      <Card className="w-full max-w-4xl">
        <CardHeader className="pb-2">
          <CardTitle className="text-2xl text-center">リモートカメラビューアー</CardTitle>
          <CardDescription className="text-center">スマートフォンカメラの映像をブラウザに表示します</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-4">
              <TabsTrigger value="viewer">
                <MonitorIcon className="w-4 h-4 mr-2" />
                視聴モード（PC）
              </TabsTrigger>
              <TabsTrigger value="camera">
                <SmartphoneIcon className="w-4 h-4 mr-2" />
                カメラモード（スマホ）
              </TabsTrigger>
            </TabsList>

            <TabsContent value="viewer" className="space-y-4">
              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <Label htmlFor="room-id" className="text-sm">
                    ルームID
                  </Label>
                  <div className="flex gap-2">
                    <Input
                      id="room-id"
                      value={roomId}
                      onChange={(e) => setRoomId(e.target.value)}
                      placeholder="ルームIDを入力"
                    />
                    <Button variant="outline" size="icon" onClick={copyToClipboard}>
                      <CopyIcon className="w-4 h-4" />
                    </Button>
                  </div>
                  {isCopied && <p className="text-xs text-green-500">コピーしました！</p>}
                </div>

                <div className="flex items-center gap-2">
                  <WifiIcon className="w-4 h-4" />
                  <p className="text-sm whitespace-nowrap">
                    接続状態:{" "}
                    <span
                      className={
                        connectionStatus.includes("接続済み")
                          ? "text-green-500"
                          : connectionStatus.includes("接続中")
                            ? "text-amber-500"
                            : "text-gray-500"
                      }
                    >
                      {connectionStatus}
                    </span>
                  </p>
                </div>

                {showIframe && (
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
                )}
              </div>

              <div className="mt-2">
                {!showIframe ? (
                  <div className="relative h-[500px] md:h-[600px] bg-gray-100 rounded-md overflow-hidden flex items-center justify-center text-gray-400">
                    カメラが接続されるとここに映像が表示されます
                  </div>
                ) : (
                  <div className="relative h-[500px] md:h-[600px]">
                    <div className="absolute top-2 right-2 z-10">
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-6 w-6 rounded-full bg-white"
                        onClick={() => setShowIframe(false)}
                      >
                        <XIcon className="h-3 w-3" />
                      </Button>
                    </div>

                    {/* 人物検出用のキャンバス */}
                    {showPeopleCounter && (
                      <canvas
                        ref={canvasRef}
                        className="absolute top-0 left-0 w-full h-full z-20 pointer-events-none"
                      />
                    )}

                    {/* iframeの代わりに使用する画像要素（人物検出用） */}
                    {showPeopleCounter ? (
                      <div className="w-full h-full rounded-md border-0 overflow-hidden">
                        <img
                          ref={handleRemoteImageRef}
                          id="remote-image-for-detection"
                          className="w-full h-full object-contain"
                          alt="カメラ映像"
                        />
                      </div>
                    ) : (
                      <iframe
                        ref={iframeRef}
                        src={`/api/connect?room=${roomId}&mode=viewer&embedded=true`}
                        className="w-full h-full rounded-md border-0"
                        allow="camera;microphone"
                        title="リモートカメラ"
                      />
                    )}
                  </div>
                )}
              </div>

              <div className="flex gap-2">
                <Button className="flex-1" onClick={() => setShowIframe(true)} disabled={showIframe}>
                  接続開始
                </Button>

                {showIframe && (
                  <Button
                    variant={showPeopleCounter ? "default" : "outline"}
                    onClick={() => setShowPeopleCounter(!showPeopleCounter)}
                  >
                    人物カウント {showPeopleCounter ? "オフ" : "オン"}
                  </Button>
                )}
              </div>

              {/* 人物カウント表示 */}
              {showPeopleCounter && showIframe && (
                <div className="mt-4">
                  <PeopleCounterDisplay
                    count={peopleCount}
                    onReset={resetPeopleCount}
                    onToggleDebug={toggleDebugMode}
                    debugMode={debugMode}
                  />
                </div>
              )}
            </TabsContent>

            <TabsContent value="camera" className="space-y-4">
              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <Label htmlFor="camera-room-id" className="text-sm">
                    ルームID
                  </Label>
                  <Input
                    id="camera-room-id"
                    value={roomId}
                    onChange={(e) => setRoomId(e.target.value)}
                    placeholder="ルームIDを入力"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <WifiIcon className="w-4 h-4" />
                  <p className="text-sm whitespace-nowrap">
                    接続状態:{" "}
                    <span
                      className={
                        connectionStatus.includes("接続済み")
                          ? "text-green-500"
                          : connectionStatus.includes("接続中")
                            ? "text-amber-500"
                            : "text-gray-500"
                      }
                    >
                      {connectionStatus}
                    </span>
                  </p>
                </div>
              </div>

              <div className="mt-2">
                {!showIframe ? (
                  <div className="relative h-[500px] md:h-[600px] bg-gray-100 rounded-md overflow-hidden flex items-center justify-center text-gray-400">
                    「カメラを開始」ボタンをクリックしてカメラを起動します
                  </div>
                ) : (
                  <div className="relative h-[500px] md:h-[600px]">
                    <div className="absolute top-2 right-2 z-10">
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-6 w-6 rounded-full bg-white"
                        onClick={() => setShowIframe(false)}
                      >
                        <XIcon className="h-3 w-3" />
                      </Button>
                    </div>
                    <iframe
                      ref={iframeRef}
                      src={`/api/connect?room=${roomId}&mode=camera&embedded=true`}
                      className="w-full h-full rounded-md border-0"
                      allow="camera;microphone"
                      title="カメラプレビュー"
                    />
                  </div>
                )}
              </div>

              <Button className="w-full" onClick={() => setShowIframe(true)} disabled={showIframe}>
                カメラを開始
              </Button>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  )
}
