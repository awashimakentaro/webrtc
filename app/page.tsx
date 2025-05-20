"use client"

import { useEffect, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { CopyIcon, SmartphoneIcon, MonitorIcon, WifiIcon, XIcon, Settings2Icon } from "lucide-react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import PeopleCounterDisplay from "@/components/people-counter-display"
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
  const [scriptsLoaded, setScriptsLoaded] = useState(false) // スクリプト読み込み状態

  const iframeRef = useRef<HTMLIFrameElement>(null)
  const analysisCanvasRef = useRef<HTMLCanvasElement>(null) // 分析表示用のキャンバス
  const peopleCounterRef = useRef<PeopleCounter | null>(null)
  const remoteImageRef = useRef<HTMLImageElement | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

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

  // TensorFlow.jsとCOCO-SSDモデルのスクリプトを読み込む
  const loadScripts = () => {
    // すでに読み込まれている場合は何もしない
    if (scriptsLoaded) {
      console.log("スクリプトは既に読み込まれています")
      return
    }

    console.log("スクリプトの読み込みを開始します...")

    // グローバルオブジェクトにスクリプト読み込み状態を追跡するプロパティを追加
    if (typeof window !== "undefined") {
      ;(window as any).tfLoaded = false
      ;(window as any).cocoSsdLoaded = false

      // TensorFlow.jsの読み込み
      const tfScript = document.createElement("script")
      tfScript.src = "https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@3.20.0/dist/tf.min.js"
      tfScript.async = true
      tfScript.onload = () => {
        console.log("TensorFlow.js読み込み完了")
        ;(window as any).tfLoaded = true
        checkScriptsLoaded()

        // TensorFlow.jsの読み込み完了後にCOCO-SSDを読み込む
        const cocoSsdScript = document.createElement("script")
        cocoSsdScript.src = "https://cdn.jsdelivr.net/npm/@tensorflow-models/coco-ssd@2.2.2/dist/coco-ssd.min.js"
        cocoSsdScript.async = true
        cocoSsdScript.onload = () => {
          console.log("COCO-SSDモデル読み込み完了")
          ;(window as any).cocoSsdLoaded = true
          checkScriptsLoaded()
        }
        cocoSsdScript.onerror = (e) => {
          console.error("COCO-SSDモデル読み込みエラー:", e)
        }
        document.head.appendChild(cocoSsdScript)
      }
      tfScript.onerror = (e) => {
        console.error("TensorFlow.js読み込みエラー:", e)
      }
      document.head.appendChild(tfScript)
    }
  }

  // スクリプトの読み込み状態をチェック
  const checkScriptsLoaded = () => {
    if (typeof window !== "undefined" && (window as any).tfLoaded && (window as any).cocoSsdLoaded) {
      console.log("すべてのスクリプトが読み込まれました")
      setScriptsLoaded(true)
      initPeopleCounter()
    }
  }

  // 人物カウント機能が有効になったらスクリプトを読み込む
  useEffect(() => {
    if (showPeopleCounter && !scriptsLoaded) {
      loadScripts()
    }
  }, [showPeopleCounter, scriptsLoaded])

  // 人物カウンターの初期化
  const initPeopleCounter = () => {
    console.log("人物カウンター初期化開始:", {
      current: peopleCounterRef.current,
      scriptsLoaded,
      analysisCanvas: analysisCanvasRef.current,
    })

    if (!peopleCounterRef.current && scriptsLoaded) {
      console.log("人物カウンターを初期化しています...")
      peopleCounterRef.current = new PeopleCounter()
      peopleCounterRef.current.setCountUpdateCallback((count) => {
        console.log("カウント更新:", count)
        setPeopleCount(count)
      })
      peopleCounterRef.current.setDebugMode(true) // 常にデバッグモードを有効に

      if (analysisCanvasRef.current) {
        console.log("分析キャンバスを設定します")
        peopleCounterRef.current.setAnalysisCanvas(analysisCanvasRef.current)
      } else {
        console.warn("分析キャンバスが見つかりません")
      }

      // 横断ラインを設定
      updateCrossingLine()

      console.log("人物カウンター初期化完了")
    } else if (peopleCounterRef.current) {
      console.log("人物カウンターは既に初期化されています")
    } else {
      console.warn("スクリプトが読み込まれていないため、人物カウンターを初期化できません")
    }
  }

  // 横断ラインの更新
  const updateCrossingLine = () => {
    if (!peopleCounterRef.current || !containerRef.current) return

    // コンテナの寸法を取得
    const containerRect = containerRef.current.getBoundingClientRect()
    const width = containerRect.width
    const height = containerRect.height

    // 画面の中央に横断ラインを設定（左から右へ）
    peopleCounterRef.current.setCrossingLine(
      width * 0.2, // 左端から20%の位置
      height * 0.5, // 上端から50%の位置
      width * 0.8, // 左端から80%の位置
      height * 0.5, // 上端から50%の位置
    )
  }

  // ウィンドウサイズ変更時に横断ラインを更新
  useEffect(() => {
    if (!showPeopleCounter) return

    const handleResize = () => {
      updateCrossingLine()
    }

    window.addEventListener("resize", handleResize)
    return () => {
      window.removeEventListener("resize", handleResize)
    }
  }, [showPeopleCounter])

  // 画像の読み込み完了ハンドラ
  const handleImageLoad = () => {
    console.log("画像が読み込まれました")
    if (showPeopleCounter && peopleCounterRef.current && analysisCanvasRef.current && scriptsLoaded) {
      peopleCounterRef.current.detectPeople(remoteImageRef.current!, analysisCanvasRef.current)
    }
  }

  // メッセージイベントリスナー
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      // 接続状態の更新
      if (event.data && event.data.type === "connection-status") {
        setConnectionStatus(event.data.status)
      }

      // 画像データの受信（人物検出用）
      if (event.data && event.data.type === "image-data" && remoteImageRef.current) {
        // 画像データを設定
        remoteImageRef.current.src = event.data.data

        // 画像が読み込まれたら人物検出を実行（onLoadイベントでも実行されるが、念のため直接も呼び出す）
        if (showPeopleCounter && peopleCounterRef.current && analysisCanvasRef.current && scriptsLoaded) {
          console.log("画像データを受信しました - 人物検出を実行します")
          // 少し遅延を入れて画像の読み込みを待つ
          setTimeout(() => {
            peopleCounterRef.current!.detectPeople(remoteImageRef.current!, analysisCanvasRef.current!)
          }, 50)
        }
      }
    }

    window.addEventListener("message", handleMessage)

    return () => {
      window.removeEventListener("message", handleMessage)
    }
  }, [showPeopleCounter, scriptsLoaded])

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

  // デバッグモードの切り替え
  const toggleDebugMode = () => {
    const newDebugMode = !debugMode
    setDebugMode(newDebugMode)
    if (peopleCounterRef.current) {
      peopleCounterRef.current.setDebugMode(newDebugMode)
    }
  }

  // 人物カウント機能の切り替え
  const togglePeopleCounter = () => {
    const newState = !showPeopleCounter
    setShowPeopleCounter(newState)

    // 有効にする場合は、スクリプトの読み込みと初期化を確認
    if (newState) {
      console.log("人物カウント機能を有効にします")
      if (!scriptsLoaded) {
        loadScripts()
      } else if (!peopleCounterRef.current) {
        initPeopleCounter()
      }
    } else {
      console.log("人物カウント機能を無効にします")
    }
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

              <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* メインの映像表示エリア - 元の映像のみ */}
                <div>
                  {!showIframe ? (
                    <div className="relative h-[500px] md:h-[600px] bg-gray-100 rounded-md overflow-hidden flex items-center justify-center text-gray-400">
                      カメラが接続されるとここに映像が表示されます
                    </div>
                  ) : (
                    <div ref={containerRef} className="relative h-[500px] md:h-[600px]">
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

                      {/* 人物検出用の非表示画像要素 */}
                      {showPeopleCounter && (
                        <img
                          ref={remoteImageRef}
                          id="remote-image-for-detection"
                          className="hidden"
                          alt="カメラ映像"
                          crossOrigin="anonymous"
                          width={640}
                          height={480}
                          onLoad={handleImageLoad}
                        />
                      )}

                      {/* 元の映像のみを表示するiframe */}
                      <iframe
                        ref={iframeRef}
                        src={`/api/connect?room=${roomId}&mode=viewer&embedded=true`}
                        className="w-full h-full rounded-md border-0"
                        allow="camera;microphone"
                        title="リモートカメラ"
                      />
                    </div>
                  )}
                </div>

                {/* 分析映像表示エリア - 常に表示 */}
                <div className="relative h-[500px] md:h-[600px] bg-black rounded-md overflow-hidden">
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

              <div className="flex gap-2">
                <Button className="flex-1" onClick={() => setShowIframe(true)} disabled={showIframe}>
                  接続開始
                </Button>

                {showIframe && (
                  <Button variant={showPeopleCounter ? "default" : "outline"} onClick={togglePeopleCounter}>
                    人物カウント {showPeopleCounter ? "オフ" : "オン"}
                  </Button>
                )}
              </div>

              {/* スクリプト読み込み状態 */}
              {showPeopleCounter && !scriptsLoaded && (
                <div className="mt-2 text-center text-sm text-amber-500">
                  人物検出モデルを読み込み中... しばらくお待ちください。
                </div>
              )}

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
