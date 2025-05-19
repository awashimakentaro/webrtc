"use client"

import { useEffect, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { CopyIcon, SmartphoneIcon, MonitorIcon, WifiIcon, XIcon } from "lucide-react"
import QRCode from "./components/qr-code"

export default function Home() {
  const [roomId, setRoomId] = useState("")
  const [isCopied, setIsCopied] = useState(false)
  const [activeTab, setActiveTab] = useState("viewer")
  const [showIframe, setShowIframe] = useState(false)
  const [connectionStatus, setConnectionStatus] = useState("未接続")
  const iframeRef = useRef<HTMLIFrameElement>(null)

  // ページロード時に一意のルームIDを生成
  useEffect(() => {
    const generatedRoomId = Math.random().toString(36).substring(2, 8)
    setRoomId(generatedRoomId)
  }, [])

  // QRコード用のURL生成
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

  return (
    <div className="container flex items-center justify-center min-h-screen py-8">
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <CardTitle className="text-2xl text-center">リモートカメラビューアー</CardTitle>
          <CardDescription className="text-center">
            WebRTCを使用してスマートフォンカメラの映像をブラウザに表示します
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-2">
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
              <div className="space-y-2">
                <Label htmlFor="room-id">ルームID</Label>
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

              <div className="mt-4">
                <p className="text-sm mb-2">スマートフォンでこのQRコードをスキャンしてください：</p>
                <div className="flex justify-center p-4 bg-white rounded-md">
                  <QRCode value={cameraUrl} size={200} />
                </div>
              </div>

              <div className="mt-4">
                <div className="flex items-center gap-2 mb-2">
                  <WifiIcon className="w-4 h-4" />
                  <p className="text-sm">
                    接続状態:{" "}
                    <span
                      className={
                        connectionStatus === "接続済み"
                          ? "text-green-500"
                          : connectionStatus === "接続中..."
                            ? "text-amber-500"
                            : "text-gray-500"
                      }
                    >
                      {connectionStatus}
                    </span>
                  </p>
                </div>

                {!showIframe ? (
                  <div className="relative h-[400px] md:h-[500px] bg-gray-100 rounded-md overflow-hidden flex items-center justify-center text-gray-400">
                    カメラが接続されるとここに映像が表示されます
                  </div>
                ) : (
                  <div className="relative h-[400px] md:h-[500px]">
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
                      src={`/api/connect?room=${roomId}&mode=viewer&embedded=true`}
                      className="w-full h-full rounded-md border-0"
                      allow="camera;microphone"
                      title="リモートカメラ"
                    />
                  </div>
                )}
              </div>

              <Button className="w-full" onClick={() => setShowIframe(true)} disabled={showIframe}>
                接続開始
              </Button>
            </TabsContent>

            <TabsContent value="camera" className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="camera-room-id">ルームID</Label>
                <Input
                  id="camera-room-id"
                  value={roomId}
                  onChange={(e) => setRoomId(e.target.value)}
                  placeholder="ルームIDを入力"
                />
              </div>

              <div className="mt-4">
                <div className="flex items-center gap-2 mb-2">
                  <WifiIcon className="w-4 h-4" />
                  <p className="text-sm">
                    接続状態:{" "}
                    <span
                      className={
                        connectionStatus === "接続済み"
                          ? "text-green-500"
                          : connectionStatus === "接続中..."
                            ? "text-amber-500"
                            : "text-gray-500"
                      }
                    >
                      {connectionStatus}
                    </span>
                  </p>
                </div>

                {!showIframe ? (
                  <div className="relative h-[400px] md:h-[500px] bg-gray-100 rounded-md overflow-hidden flex items-center justify-center text-gray-400">
                    「カメラを開始」ボタンをクリックしてカメラを起動します
                  </div>
                ) : (
                  <div className="relative h-[400px] md:h-[500px]">
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
