"use client"

import React from "react"

import { useEffect, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  CopyIcon,
  SmartphoneIcon,
  MonitorIcon,
  WifiIcon,
  XIcon,
  Settings2Icon,
  PlusIcon,
  TrashIcon,
} from "lucide-react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import PeopleCounterDisplay from "@/components/people-counter-display"
import { PeopleCounter } from "@/utils/people-counter"
import { Badge } from "@/components/ui/badge"

// カメラ接続情報の型定義
interface CameraConnection {
  id: string
  roomId: string
  iframeRef: React.RefObject<HTMLIFrameElement>
  remoteImageRef: React.RefObject<HTMLImageElement>
  analysisCanvasRef: React.RefObject<HTMLCanvasElement>
  peopleCounterRef: React.MutableRefObject<PeopleCounter | null>
  connectionStatus: string
  quality: string
  showPeopleCounter: boolean
  peopleCount: { leftToRight: number; rightToLeft: number; total: number }
}

export default function Home() {
  const [roomId, setRoomId] = useState("")
  const [isCopied, setIsCopied] = useState(false)
  const [activeTab, setActiveTab] = useState("viewer")
  const [showIframe, setShowIframe] = useState(false)
  const [quality, setQuality] = useState("medium")
  const [debugMode, setDebugMode] = useState(false)
  const [scriptsLoaded, setScriptsLoaded] = useState(false) // スクリプト読み込み状態
  const [isLoadingScripts, setIsLoadingScripts] = useState(false) // スクリプト読み込み中フラグ

  // 複数カメラ接続を管理するための状態
  const [cameraConnections, setCameraConnections] = useState<CameraConnection[]>([])
  const [newCameraRoomId, setNewCameraRoomId] = useState("")
  const [showAddCamera, setShowAddCamera] = useState(false)

  const containerRef = useRef<HTMLDivElement>(null)
  const iframeRef = useRef<HTMLIFrameElement>(null)

  // ページロード時にデフォルトのルームIDを設定
  useEffect(() => {
    setRoomId("aizu")
    setNewCameraRoomId("aizu")
  }, [])

  // 接続URLの生成
  const cameraUrl = typeof window !== "undefined" ? `${window.location.origin}?room=${roomId}&mode=camera` : ""

  // クリップボードにコピー
  const copyToClipboard = (url: string) => {
    navigator.clipboard.writeText(url)
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
        setNewCameraRoomId(room)
      }
    }
  }, [])

  // TensorFlow.jsとCOCO-SSDモデルのスクリプトを読み込む
  const loadScripts = () => {
    // すでに読み込まれている場合は何もしない
    if (scriptsLoaded || isLoadingScripts) {
      console.log("スクリプトは既に読み込まれているか読み込み中です")
      return
    }

    console.log("スクリプトの読み込みを開始します...")
    setIsLoadingScripts(true)

    // グローバルオブジェクトにスクリプト読み込み状態を追跡するプロパティを追加
    if (typeof window !== "undefined") {
      // TensorFlow.jsの読み込み
      const tfScript = document.createElement("script")
      tfScript.src = "https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@3.20.0/dist/tf.min.js"
      tfScript.async = true
      tfScript.onload = () => {
        console.log("TensorFlow.js読み込み完了")

        // TensorFlow.jsの読み込み完了後にCOCO-SSDを読み込む
        const cocoSsdScript = document.createElement("script")
        cocoSsdScript.src = "https://cdn.jsdelivr.net/npm/@tensorflow-models/coco-ssd@2.2.2/dist/coco-ssd.min.js"
        cocoSsdScript.async = true
        cocoSsdScript.onload = () => {
          console.log("COCO-SSDモデル読み込み完了")
          setScriptsLoaded(true)
          setIsLoadingScripts(false)

          // スクリプト読み込み完了後に人物カウンターを初期化
          setTimeout(() => {
            // すべてのカメラ接続の人物カウンターを初期化
            cameraConnections.forEach((connection) => {
              if (connection.showPeopleCounter) {
                initPeopleCounter(connection.id)
              }
            })
          }, 500)
        }
        cocoSsdScript.onerror = (e) => {
          console.error("COCO-SSDモデル読み込みエラー:", e)
          setIsLoadingScripts(false)
        }
        document.head.appendChild(cocoSsdScript)
      }
      tfScript.onerror = (e) => {
        console.error("TensorFlow.js読み込みエラー:", e)
        setIsLoadingScripts(false)
      }
      document.head.appendChild(tfScript)
    }
  }

  // 人物カウント機能が有効になったらスクリプトを読み込む
  useEffect(() => {
    const anyPeopleCounterEnabled = cameraConnections.some((conn) => conn.showPeopleCounter)

    if (anyPeopleCounterEnabled && !scriptsLoaded && !isLoadingScripts) {
      loadScripts()
    } else if (anyPeopleCounterEnabled && scriptsLoaded) {
      // スクリプトは読み込まれているが、人物カウンターがまだ初期化されていないカメラを初期化
      cameraConnections.forEach((connection) => {
        if (connection.showPeopleCounter && !connection.peopleCounterRef.current) {
          initPeopleCounter(connection.id)
        }
      })
    }
  }, [cameraConnections, scriptsLoaded, isLoadingScripts])

  // 人物カウンターの初期化
  const initPeopleCounter = (connectionId: string) => {
    const connectionIndex = cameraConnections.findIndex((conn) => conn.id === connectionId)
    if (connectionIndex === -1) return

    const connection = cameraConnections[connectionIndex]

    console.log(`カメラ ${connectionId} の人物カウンター初期化開始:`, {
      current: connection.peopleCounterRef.current,
      scriptsLoaded,
      analysisCanvas: connection.analysisCanvasRef.current,
    })

    if (!connection.peopleCounterRef.current && scriptsLoaded) {
      console.log(`カメラ ${connectionId} の人物カウンターを初期化しています...`)

      // グローバルオブジェクトのcocoSsdが存在するか確認
      if (typeof window !== "undefined" && !(window as any).cocoSsd) {
        console.error("COCO-SSDモデルがグローバルオブジェクトに見つかりません")
        return
      }

      connection.peopleCounterRef.current = new PeopleCounter()
      connection.peopleCounterRef.current.setCountUpdateCallback((count) => {
        console.log(`カメラ ${connectionId} のカウント更新:`, count)

        // 特定のカメラ接続のカウント情報を更新
        setCameraConnections((prev) =>
          prev.map((conn) => (conn.id === connectionId ? { ...conn, peopleCount: count } : conn)),
        )
      })
      connection.peopleCounterRef.current.setDebugMode(debugMode)

      if (connection.analysisCanvasRef.current) {
        console.log(`カメラ ${connectionId} の分析キャンバスを設定します`)
        connection.peopleCounterRef.current.setAnalysisCanvas(connection.analysisCanvasRef.current)
      } else {
        console.warn(`カメラ ${connectionId} の分析キャンバスが見つかりません`)
      }

      // 横断ラインを設定
      updateCrossingLine(connectionId)

      console.log(`カメラ ${connectionId} の人物カウンター初期化完了`)
    } else if (connection.peopleCounterRef.current) {
      console.log(`カメラ ${connectionId} の人物カウンターは既に初期化されています`)
    } else {
      console.warn("スクリプトが読み込まれていないため、人物カウンターを初期化できません")
    }
  }

  // 横断ラインの更新
  const updateCrossingLine = (connectionId: string) => {
    const connection = cameraConnections.find((conn) => conn.id === connectionId)
    if (!connection) return

    if (!connection.peopleCounterRef.current) {
      console.warn(`カメラ ${connectionId} の人物カウンターが初期化されていないため、横断ラインを設定できません`)
      return
    }

    if (!connection.analysisCanvasRef.current) {
      console.warn(`カメラ ${connectionId} の分析キャンバスが見つからないため、横断ラインを設定できません`)
      return
    }

    // キャンバスの寸法を取得
    const width = connection.analysisCanvasRef.current.width
    const height = connection.analysisCanvasRef.current.height

    console.log(`カメラ ${connectionId} の横断ラインを設定: キャンバスサイズ=${width}x${height}`)

    // 画面の中央に横断ラインを設定（左から右へ）
    connection.peopleCounterRef.current.setCrossingLine(
      width * 0.2, // 左端から20%の位置
      height * 0.5, // 上端から50%の位置
      width * 0.8, // 左端から80%の位置
      height * 0.5, // 上端から50%の位置
    )
  }

  // 画像の読み込み完了ハンドラ
  const handleImageLoad = (connectionId: string) => {
    console.log(`カメラ ${connectionId} の画像が読み込まれました`)

    const connection = cameraConnections.find((conn) => conn.id === connectionId)
    if (!connection) return

    if (
      connection.showPeopleCounter &&
      connection.peopleCounterRef.current &&
      connection.analysisCanvasRef.current &&
      scriptsLoaded
    ) {
      console.log(`カメラ ${connectionId} の画像読み込み完了 - 人物検出を実行します`)
      connection.peopleCounterRef.current.detectPeople(
        connection.remoteImageRef.current!,
        connection.analysisCanvasRef.current,
      )
    } else {
      console.log(`カメラ ${connectionId} の画像は読み込まれましたが、人物検出の条件が揃っていません:`, {
        showPeopleCounter: connection.showPeopleCounter,
        peopleCounter: !!connection.peopleCounterRef.current,
        analysisCanvas: !!connection.analysisCanvasRef.current,
        scriptsLoaded,
      })
    }
  }

  // メッセージイベントリスナー
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      // 接続状態の更新
      if (event.data && event.data.type === "connection-status") {
        // イベントの送信元のiframeを特定
        const sourceIframe = Array.from(document.querySelectorAll("iframe")).find(
          (iframe) => iframe.contentWindow === event.source,
        ) as HTMLIFrameElement | undefined

        if (sourceIframe) {
          // iframeのIDからカメラ接続を特定
          const connectionId = sourceIframe.dataset.connectionId
          if (connectionId) {
            // 接続状態を更新
            setCameraConnections((prev) =>
              prev.map((conn) => (conn.id === connectionId ? { ...conn, connectionStatus: event.data.status } : conn)),
            )
          }
        }
      }

      // 画像データの受信（人物検出用）
      if (event.data && event.data.type === "image-data") {
        // イベントの送信元のiframeを特定
        const sourceIframe = Array.from(document.querySelectorAll("iframe")).find(
          (iframe) => iframe.contentWindow === event.source,
        ) as HTMLIFrameElement | undefined

        if (sourceIframe) {
          // iframeのIDからカメラ接続を特定
          const connectionId = sourceIframe.dataset.connectionId
          if (connectionId) {
            const connection = cameraConnections.find((conn) => conn.id === connectionId)
            if (connection && connection.remoteImageRef.current) {
              // 画像データを設定
              connection.remoteImageRef.current.src = event.data.data

              // 画像が読み込まれたら人物検出を実行
              if (
                connection.showPeopleCounter &&
                connection.peopleCounterRef.current &&
                connection.analysisCanvasRef.current &&
                scriptsLoaded
              ) {
                console.log(`カメラ ${connectionId} の画像データを受信しました - 人物検出を実行します`)
                // 少し遅延を入れて画像の読み込みを待つ
                setTimeout(() => {
                  if (
                    connection.peopleCounterRef.current &&
                    connection.remoteImageRef.current &&
                    connection.analysisCanvasRef.current
                  ) {
                    connection.peopleCounterRef.current.detectPeople(
                      connection.remoteImageRef.current,
                      connection.analysisCanvasRef.current,
                    )
                  }
                }, 100)
              }
            }
          }
        }
      }
    }

    window.addEventListener("message", handleMessage)

    return () => {
      window.removeEventListener("message", handleMessage)
    }
  }, [cameraConnections, scriptsLoaded])

  // 品質設定の変更
  const handleQualityChange = (connectionId: string, value: string) => {
    // 特定のカメラ接続の品質設定を更新
    setCameraConnections((prev) => prev.map((conn) => (conn.id === connectionId ? { ...conn, quality: value } : conn)))

    // 対応するiframeに品質変更メッセージを送信
    const connection = cameraConnections.find((conn) => conn.id === connectionId)
    if (connection && connection.iframeRef.current && connection.iframeRef.current.contentWindow) {
      connection.iframeRef.current.contentWindow.postMessage(
        {
          type: "quality-change",
          quality: value,
        },
        "*",
      )
    }
  }

  // 人物カウントのリセット
  const resetPeopleCount = (connectionId: string) => {
    const connection = cameraConnections.find((conn) => conn.id === connectionId)
    if (connection && connection.peopleCounterRef.current) {
      connection.peopleCounterRef.current.resetCount()
    }
  }

  // デバッグモードの切り替え
  const toggleDebugMode = () => {
    const newDebugMode = !debugMode
    setDebugMode(newDebugMode)

    // すべてのカメラ接続のデバッグモードを更新
    cameraConnections.forEach((connection) => {
      if (connection.peopleCounterRef.current) {
        connection.peopleCounterRef.current.setDebugMode(newDebugMode)
      }
    })
  }

  // 人物カウント機能の切り替え
  const togglePeopleCounter = (connectionId: string) => {
    setCameraConnections((prev) =>
      prev.map((conn) => {
        if (conn.id === connectionId) {
          const newState = !conn.showPeopleCounter
          return { ...conn, showPeopleCounter: newState }
        }
        return conn
      }),
    )

    // 有効にする場合は、スクリプトの読み込みと初期化を確認
    const connection = cameraConnections.find((conn) => conn.id === connectionId)
    if (connection) {
      const newState = !connection.showPeopleCounter
      if (newState) {
        console.log(`カメラ ${connectionId} の人物カウント機能を有効にします`)
        if (!scriptsLoaded && !isLoadingScripts) {
          loadScripts()
        } else if (scriptsLoaded && !connection.peopleCounterRef.current) {
          initPeopleCounter(connectionId)
        }
      } else {
        console.log(`カメラ ${connectionId} の人物カウント機能を無効にします`)
      }
    }
  }

  // 新しいカメラ接続を追加
  const addCameraConnection = () => {
    if (!newCameraRoomId) return

    // 既に同じルームIDの接続がある場合は追加しない
    if (cameraConnections.some((conn) => conn.roomId === newCameraRoomId)) {
      alert(`ルームID "${newCameraRoomId}" の接続は既に存在します。`)
      return
    }

    const newConnectionId = `camera-${Date.now()}`

    setCameraConnections((prev) => [
      ...prev,
      {
        id: newConnectionId,
        roomId: newCameraRoomId,
        iframeRef: React.createRef<HTMLIFrameElement>(),
        remoteImageRef: React.createRef<HTMLImageElement>(),
        analysisCanvasRef: React.createRef<HTMLCanvasElement>(),
        peopleCounterRef: React.useRef<PeopleCounter | null>(null),
        connectionStatus: "未接続",
        quality: "medium",
        showPeopleCounter: false,
        peopleCount: { leftToRight: 0, rightToLeft: 0, total: 0 },
      },
    ])

    setNewCameraRoomId("")
    setShowAddCamera(false)
  }

  // カメラ接続を削除
  const removeCameraConnection = (connectionId: string) => {
    setCameraConnections((prev) => prev.filter((conn) => conn.id !== connectionId))
  }

  // カメラモードの場合のレンダリング
  if (activeTab === "camera") {
    const connectionStatusClassName = cameraConnections[0]?.connectionStatus.includes("接続済み")
      ? "text-green-500"
      : cameraConnections[0]?.connectionStatus.includes("接続中")
        ? "text-amber-500"
        : "text-gray-500"
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
                      <span className={connectionStatusClassName}>
                        {cameraConnections[0]?.connectionStatus || "未接続"}
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

  // 視聴モードの場合のレンダリング
  return (
    <div className="container flex items-center justify-center min-h-screen py-4">
      <Card className="w-full max-w-6xl">
        <CardHeader className="pb-2">
          <CardTitle className="text-2xl text-center">リモートカメラビューアー</CardTitle>
          <CardDescription className="text-center">
            複数のスマートフォンカメラの映像をブラウザに表示します
          </CardDescription>
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
              {/* カメラ接続がない場合の表示 */}
              {cameraConnections.length === 0 && (
                <div className="flex flex-col items-center justify-center p-8 bg-gray-50 rounded-lg">
                  <p className="mb-4 text-gray-500">カメラが接続されていません</p>
                  <Button onClick={() => setShowAddCamera(true)}>
                    <PlusIcon className="w-4 h-4 mr-2" />
                    カメラを追加
                  </Button>
                </div>
              )}

              {/* カメラ追加フォーム */}
              {showAddCamera && (
                <Card className="mb-4">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-lg">新しいカメラを追加</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex gap-2">
                      <div className="flex-1">
                        <Label htmlFor="new-room-id" className="text-sm">
                          ルームID
                        </Label>
                        <Input
                          id="new-room-id"
                          value={newCameraRoomId}
                          onChange={(e) => setNewCameraRoomId(e.target.value)}
                          placeholder="ルームIDを入力"
                        />
                      </div>
                      <div className="flex items-end gap-2">
                        <Button onClick={addCameraConnection}>追加</Button>
                        <Button variant="outline" onClick={() => setShowAddCamera(false)}>
                          キャンセル
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* カメラ接続リスト */}
              {cameraConnections.map((connection, index) => (
                <div key={connection.id} className="mb-8 border rounded-lg p-4">
                  <div className="flex justify-between items-center mb-4">
                    <div className="flex items-center gap-2">
                      <h3 className="text-lg font-medium">カメラ {index + 1}</h3>
                      <Badge variant={connection.connectionStatus.includes("接続済み") ? "success" : "secondary"}>
                        {connection.connectionStatus}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          copyToClipboard(`${window.location.origin}?room=${connection.roomId}&mode=camera`)
                        }
                      >
                        <CopyIcon className="w-4 h-4 mr-1" />
                        URLをコピー
                      </Button>
                      <Button variant="destructive" size="sm" onClick={() => removeCameraConnection(connection.id)}>
                        <TrashIcon className="w-4 h-4 mr-1" />
                        削除
                      </Button>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 mb-2">
                    <div className="flex-1">
                      <Label htmlFor={`room-id-${connection.id}`} className="text-sm">
                        ルームID
                      </Label>
                      <Input
                        id={`room-id-${connection.id}`}
                        value={connection.roomId}
                        onChange={(e) => {
                          setCameraConnections((prev) =>
                            prev.map((conn) =>
                              conn.id === connection.id ? { ...conn, roomId: e.target.value } : conn,
                            ),
                          )
                        }}
                        placeholder="ルームIDを入力"
                      />
                    </div>

                    <div className="flex items-center gap-2">
                      <Settings2Icon className="w-4 h-4" />
                      <Select
                        value={connection.quality}
                        onValueChange={(value) => handleQualityChange(connection.id, value)}
                      >
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
                        {connection.showPeopleCounter && (
                          <img
                            ref={connection.remoteImageRef}
                            className="hidden"
                            alt="カメラ映像"
                            crossOrigin="anonymous"
                            width={640}
                            height={480}
                            onLoad={() => handleImageLoad(connection.id)}
                          />
                        )}

                        {/* 映像を表示するiframe */}
                        <iframe
                          ref={connection.iframeRef}
                          data-connection-id={connection.id}
                          src={`/api/connect?room=${connection.roomId}&mode=viewer&embedded=true`}
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
                      {!connection.showPeopleCounter ? (
                        <div className="w-full h-full flex items-center justify-center text-gray-400">
                          人物カウント機能を有効にすると分析映像が表示されます
                        </div>
                      ) : (
                        <canvas
                          ref={connection.analysisCanvasRef}
                          className="w-full h-full object-contain"
                          width={640}
                          height={480}
                          style={{ background: "#000" }}
                        />
                      )}
                    </div>
                  </div>

                  <div className="flex gap-2 mb-4">
                    <Button
                      variant={connection.showPeopleCounter ? "default" : "outline"}
                      onClick={() => togglePeopleCounter(connection.id)}
                      className="flex-1"
                    >
                      人物カウント {connection.showPeopleCounter ? "オフ" : "オン"}
                    </Button>
                  </div>

                  {/* 人物カウント表示 */}
                  {connection.showPeopleCounter && (
                    <div className="mt-2">
                      <PeopleCounterDisplay
                        count={connection.peopleCount}
                        onReset={() => resetPeopleCount(connection.id)}
                        onToggleDebug={toggleDebugMode}
                        debugMode={debugMode}
                      />
                    </div>
                  )}
                </div>
              ))}

              {/* カメラ追加ボタン */}
              <div className="flex justify-center mt-4">
                <Button onClick={() => setShowAddCamera(true)}>
                  <PlusIcon className="w-4 h-4 mr-2" />
                  カメラを追加
                </Button>
              </div>

              {/* スクリプト読み込み状態 */}
              {cameraConnections.some((conn) => conn.showPeopleCounter) && isLoadingScripts && (
                <div className="mt-2 text-center text-sm text-amber-500">
                  人物検出モデルを読み込み中... しばらくお待ちください。
                </div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  )
}
