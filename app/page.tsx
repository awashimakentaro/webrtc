"use client"

import { useEffect, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { CopyIcon, SmartphoneIcon, MonitorIcon } from "lucide-react"
import QRCode from "./components/qr-code"

export default function Home() {
  const [roomId, setRoomId] = useState("")
  const [isCopied, setIsCopied] = useState(false)
  const [activeTab, setActiveTab] = useState("viewer")
  const videoRef = useRef<HTMLVideoElement>(null)
  const [isConnected, setIsConnected] = useState(false)

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

  return (
    <div className="container flex items-center justify-center min-h-screen py-8">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl text-center">リモートカメラビューアー</CardTitle>
          <CardDescription className="text-center">
            WebRTCを使用してスマートフォンカメラの映像をPCに表示します
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
                <p className="text-sm mb-2">カメラ映像：</p>
                <div className="relative aspect-video bg-gray-100 rounded-md overflow-hidden">
                  {isConnected ? (
                    <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center text-gray-400">
                      カメラが接続されるとここに映像が表示されます
                    </div>
                  )}
                </div>
              </div>

              <Button
                className="w-full"
                onClick={() => (window.location.href = `/api/connect?room=${roomId}&mode=viewer`)}
              >
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
                <p className="text-sm mb-2">カメラプレビュー：</p>
                <div className="relative aspect-video bg-gray-100 rounded-md overflow-hidden">
                  <video id="camera-preview" autoPlay playsInline muted className="w-full h-full object-cover" />
                </div>
              </div>

              <Button
                className="w-full"
                onClick={() => (window.location.href = `/api/connect?room=${roomId}&mode=camera`)}
              >
                カメラを開始
              </Button>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  )
}
