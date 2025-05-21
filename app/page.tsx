"use client"
import { useEffect, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { SmartphoneIcon, MonitorIcon, XIcon, PlusIcon } from "lucide-react"
import CameraViewer from "@/components/camera-viewer"

// カメラ接続情報の型定義
interface CameraInfo {
  id: string
  roomId: string
}

export default function Home() {
  const [roomId, setRoomId] = useState("")
  const [isCopied, setIsCopied] = useState(false)
  const [activeTab, setActiveTab] = useState("viewer")
  const [showIframe, setShowIframe] = useState(false)
  const [debugMode, setDebugMode] = useState(false)
  const [scriptsLoaded, setScriptsLoaded] = useState(false)
  const [isLoadingScripts, setIsLoadingScripts] = useState(false)

  // 複数カメラ接続を管理するための状態（シンプルな配列）
  const [cameras, setCameras] = useState<CameraInfo[]>([])
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

  // 新しいカメラ接続を追加
  const addCameraConnection = () => {
    if (!newCameraRoomId) return

    // 既に同じルームIDの接続がある場合は追加しない
    if (cameras.some((cam) => cam.roomId === newCameraRoomId)) {
      alert(`ルームID "${newCameraRoomId}" の接続は既に存在します。`)
      return
    }

    const newConnectionId = `camera-${Date.now()}`

    // シンプルな配列に追加
    setCameras((prev) => [
      ...prev,
      {
        id: newConnectionId,
        roomId: newCameraRoomId,
      },
    ])

    setNewCameraRoomId("")
    setShowAddCamera(false)
  }

  // カメラ接続を削除
  const removeCameraConnection = (connectionId: string) => {
    setCameras((prev) => prev.filter((cam) => cam.id !== connectionId))
  }

  // カメラのルームIDを更新
  const updateCameraRoomId = (connectionId: string, newRoomId: string) => {
    setCameras((prev) => prev.map((cam) => (cam.id === connectionId ? { ...cam, roomId: newRoomId } : cam)))
  }

  // デバッグモードの切り替え
  const toggleDebugMode = () => {
    setDebugMode(!debugMode)
  }

  // カメラモードの場合のレンダリング
  if (activeTab === "camera") {
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
              {cameras.length === 0 && (
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

              {/* カメラ接続リスト - 各カメラを独立したコンポーネントとして表示 */}
              {cameras.map((camera, index) => (
                <CameraViewer
                  key={camera.id}
                  id={camera.id}
                  roomId={camera.roomId}
                  index={index}
                  debugMode={debugMode}
                  scriptsLoaded={scriptsLoaded}
                  isLoadingScripts={isLoadingScripts}
                  onLoadScripts={loadScripts}
                  onRemove={() => removeCameraConnection(camera.id)}
                  onUpdateRoomId={(newRoomId) => updateCameraRoomId(camera.id, newRoomId)}
                  onToggleDebugMode={toggleDebugMode}
                  onCopyUrl={(url) => copyToClipboard(url)}
                />
              ))}

              {/* カメラ追加ボタン */}
              <div className="flex justify-center mt-4">
                <Button onClick={() => setShowAddCamera(true)}>
                  <PlusIcon className="w-4 h-4 mr-2" />
                  カメラを追加
                </Button>
              </div>

              {/* スクリプト読み込み状態 */}
              {isLoadingScripts && (
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
