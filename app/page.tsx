"use client"

import { useEffect, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { CopyIcon, SmartphoneIcon, MonitorIcon, WifiIcon, XIcon, Settings2Icon } from "lucide-react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

export default function Home() {
  const [roomId, setRoomId] = useState("")
  const [isCopied, setIsCopied] = useState(false)
  const [activeTab, setActiveTab] = useState("viewer")
  const [showIframe, setShowIframe] = useState(false)
  const [connectionStatus, setConnectionStatus] = useState("未接続")
  const [quality, setQuality] = useState("medium")
  const iframeRef = useRef<HTMLIFrameElement>(null)

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
