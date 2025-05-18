import { type NextRequest, NextResponse } from "next/server"
import { Server as SocketIOServer } from "socket.io"
import { createServer } from "http"

// シグナリングサーバーの状態を保持するグローバル変数
let io: any

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const roomId = searchParams.get("room")
  const mode = searchParams.get("mode")

  if (!roomId || !mode) {
    return NextResponse.json({ error: "Room ID and mode are required" }, { status: 400 })
  }

  // シグナリングサーバーが初期化されていない場合は初期化
  if (!io) {
    const httpServer = createServer()
    io = new SocketIOServer(httpServer, {
      cors: {
        origin: "*",
        methods: ["GET", "POST"],
      },
    })

    io.on("connection", (socket: any) => {
      // ルームに参加
      socket.on("join", (roomId: string, mode: string) => {
        socket.join(roomId)
        socket.to(roomId).emit("user-connected", { id: socket.id, mode })
      })

      // シグナリングメッセージの転送
      socket.on("signal", (to: string, signal: any) => {
        socket.to(to).emit("signal", {
          from: socket.id,
          signal,
        })
      })

      // 切断時の処理
      socket.on("disconnect", () => {
        io.emit("user-disconnected", socket.id)
      })
    })

    httpServer.listen(3001)
  }

  // WebRTCクライアントコードを含むHTMLを返す
  return new NextResponse(
    `
    <!DOCTYPE html>
    <html>
    <head>
      <title>WebRTC Connection</title>
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <script src="https://cdn.socket.io/4.4.1/socket.io.min.js"></script>
      <script src="https://unpkg.com/simple-peer@9.11.0/simplepeer.min.js"></script>
      <style>
        body { margin: 0; font-family: sans-serif; }
        #status { padding: 20px; text-align: center; }
        video { width: 100%; height: 100vh; object-fit: cover; }
        .hidden { display: none; }
      </style>
    </head>
    <body>
      <div id="status">接続中...</div>
      <video id="localVideo" autoplay playsinline muted class="hidden"></video>
      <video id="remoteVideo" autoplay playsinline class="hidden"></video>

      <script>
        const roomId = "${roomId}";
        const mode = "${mode}";
        const socket = io("http://localhost:3001");
        let peer;

        // ビデオ要素
        const localVideo = document.getElementById('localVideo');
        const remoteVideo = document.getElementById('remoteVideo');
        const statusDiv = document.getElementById('status');

        // カメラモードの場合はカメラを起動
        if (mode === "camera") {
          localVideo.classList.remove('hidden');
          navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: true })
            .then(stream => {
              localVideo.srcObject = stream;
              socket.emit("join", roomId, "camera");
              
              socket.on("user-connected", ({ id, mode }) => {
                if (mode === "viewer") {
                  statusDiv.textContent = "視聴者が接続しました。映像を送信中...";
                  startPeer(id, stream, true);
                }
              });
            })
            .catch(err => {
              statusDiv.textContent = "カメラへのアクセスに失敗しました: " + err.message;
            });
        } 
        // 視聴モードの場合
        else if (mode === "viewer") {
          remoteVideo.classList.remove('hidden');
          socket.emit("join", roomId, "viewer");
          
          socket.on("user-connected", ({ id, mode }) => {
            if (mode === "camera") {
              statusDiv.textContent = "カメラが接続されました。映像を受信中...";
              startPeer(id, null, false);
            }
          });
        }

        // WebRTC接続の開始
        function startPeer(id, stream, initiator) {
          peer = new SimplePeer({
            initiator: initiator,
            stream: stream,
            trickle: false
          });

          peer.on("signal", data => {
            socket.emit("signal", id, data);
          });

          peer.on("connect", () => {
            statusDiv.textContent = "接続が確立されました！";
          });

          peer.on("stream", stream => {
            remoteVideo.srcObject = stream;
          });

          peer.on("error", err => {
            statusDiv.textContent = "エラーが発生しました: " + err.message;
          });

          socket.on("signal", ({ from, signal }) => {
            if (from === id) {
              peer.signal(signal);
            }
          });

          socket.on("user-disconnected", userId => {
            if (userId === id && peer) {
              statusDiv.textContent = "相手が切断しました。";
              peer.destroy();
            }
          });
        }

        // ページを離れる前に接続を閉じる
        window.onbeforeunload = () => {
          if (peer) {
            peer.destroy();
          }
          socket.disconnect();
        };
      </script>
    </body>
    </html>
  `,
    {
      headers: {
        "Content-Type": "text/html",
      },
    },
  )
}
