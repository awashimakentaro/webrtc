import { type NextRequest, NextResponse } from "next/server"

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const roomId = searchParams.get("room")
  const mode = searchParams.get("mode")

  if (!roomId || !mode) {
    return NextResponse.json({ error: "Room ID and mode are required" }, { status: 400 })
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
        
        // シグナリングサーバーのURL（Vercelのデプロイ環境用）
        const signalingServerUrl = "https://webrtc-signaling-server.onrender.com";
        const socket = io(signalingServerUrl);
        
        let peer;
        let localStream;

        // ビデオ要素
        const localVideo = document.getElementById('localVideo');
        const remoteVideo = document.getElementById('remoteVideo');
        const statusDiv = document.getElementById('status');

        // 接続状態を親ウィンドウに通知
        function updateStatus(status) {
          statusDiv.textContent = status;
          if (window.opener) {
            window.opener.postMessage({ type: 'connection-status', status }, '*');
          } else if (window.parent) {
            window.parent.postMessage({ type: 'connection-status', status }, '*');
          }
        }

        updateStatus("接続中...");

        // カメラモードの場合はカメラを起動
        if (mode === "camera") {
          localVideo.classList.remove('hidden');
          navigator.mediaDevices.getUserMedia({ 
            video: { 
              facingMode: { ideal: "environment" },
              width: { ideal: 1280 },
              height: { ideal: 720 }
            }, 
            audio: true 
          })
            .then(stream => {
              localStream = stream;
              localVideo.srcObject = stream;
              updateStatus("カメラ準備完了、接続待機中...");
              
              socket.emit("join", roomId, "camera");
              
              socket.on("user-connected", ({ id, mode }) => {
                if (mode === "viewer") {
                  updateStatus("視聴者が接続しました。映像を送信中...");
                  startPeer(id, stream, true);
                }
              });
            })
            .catch(err => {
              updateStatus("カメラへのアクセスに失敗しました: " + err.message);
              console.error("カメラエラー:", err);
            });
        } 
        // 視聴モードの場合
        else if (mode === "viewer") {
          remoteVideo.classList.remove('hidden');
          updateStatus("接続待機中...");
          
          socket.emit("join", roomId, "viewer");
          
          socket.on("user-connected", ({ id, mode }) => {
            if (mode === "camera") {
              updateStatus("カメラが接続されました。映像を受信中...");
              startPeer(id, null, false);
            }
          });
        }

        // WebRTC接続の開始
        function startPeer(id, stream, initiator) {
          peer = new SimplePeer({
            initiator: initiator,
            stream: stream,
            trickle: false,
            config: {
              iceServers: [
                { urls: 'stun:stun.l.google.com:19302' },
                { urls: 'stun:stun1.l.google.com:19302' },
                { urls: 'stun:stun2.l.google.com:19302' },
                { urls: 'stun:stun3.l.google.com:19302' },
                { urls: 'stun:stun4.l.google.com:19302' },
                { urls: 'stun:stun.stunprotocol.org:3478' },
                { 
                  urls: 'turn:numb.viagenie.ca',
                  username: 'webrtc@live.com',
                  credential: 'muazkh'
                }
              ]
            }
          });

          peer.on("signal", data => {
            console.log("シグナル送信:", id);
            socket.emit("signal", id, data);
          });

          peer.on("connect", () => {
            updateStatus("接続済み");
            console.log("ピア接続確立");
          });

          peer.on("stream", stream => {
            console.log("ストリーム受信");
            if (mode === "viewer") {
              remoteVideo.srcObject = stream;
            }
          });

          peer.on("error", err => {
            updateStatus("エラーが発生しました: " + err.message);
            console.error("ピアエラー:", err);
          });

          socket.on("signal", ({ from, signal }) => {
            if (from === id) {
              console.log("シグナル受信:", from);
              peer.signal(signal);
            }
          });

          socket.on("user-disconnected", userId => {
            if (userId === id && peer) {
              updateStatus("相手が切断しました。");
              console.log("ユーザー切断:", userId);
              peer.destroy();
            }
          });
        }

        // 接続状態のデバッグ
        socket.on("connect", () => {
          console.log("シグナリングサーバーに接続しました");
        });

        socket.on("connect_error", (err) => {
          console.error("シグナリングサーバー接続エラー:", err);
          updateStatus("シグナリングサーバーに接続できません");
        });

        // ページを離れる前に接続を閉じる
        window.onbeforeunload = () => {
          if (localStream) {
            localStream.getTracks().forEach(track => track.stop());
          }
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
