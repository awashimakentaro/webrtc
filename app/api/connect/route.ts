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
      <script src="https://unpkg.com/peerjs@1.4.7/dist/peerjs.min.js"></script>
      <style>
        body { margin: 0; font-family: sans-serif; }
        #status { padding: 20px; text-align: center; }
        video { width: 100%; height: 100vh; object-fit: cover; }
        .hidden { display: none; }
        #controls {
          position: fixed;
          bottom: 20px;
          left: 0;
          right: 0;
          display: flex;
          justify-content: center;
          gap: 10px;
          z-index: 10;
        }
        button {
          padding: 10px 20px;
          background: #000;
          color: white;
          border: none;
          border-radius: 20px;
          font-weight: bold;
          opacity: 0.8;
        }
      </style>
    </head>
    <body>
      <div id="status">接続中...</div>
      <video id="localVideo" autoplay playsinline muted class="hidden"></video>
      <video id="remoteVideo" autoplay playsinline class="hidden"></video>
      
      <div id="controls" class="hidden">
        <button id="switchCamera">カメラ切替</button>
        <button id="hangup">切断</button>
      </div>

      <script>
        const roomId = "${roomId}";
        const mode = "${mode}";
        const statusDiv = document.getElementById('status');
        const localVideo = document.getElementById('localVideo');
        const remoteVideo = document.getElementById('remoteVideo');
        const controls = document.getElementById('controls');
        const switchCameraBtn = document.getElementById('switchCamera');
        const hangupBtn = document.getElementById('hangup');
        
        let peer;
        let currentCall;
        let localStream;
        let facingMode = "environment"; // デフォルトは背面カメラ
        
        // PeerJSの初期化
        function initPeer() {
          // ユニークなIDを生成（roomId + モード）
          const peerId = mode === "camera" ? roomId + "-camera" : roomId + "-viewer";
          
          peer = new Peer(peerId, {
            debug: 3,
            config: {
              'iceServers': [
                { urls: 'stun:stun.l.google.com:19302' },
                { urls: 'stun:stun1.l.google.com:19302' },
                { urls: 'stun:stun2.l.google.com:19302' },
              ]
            }
          });
          
          peer.on('open', (id) => {
            statusDiv.textContent = 'PeerJSサーバーに接続しました。ID: ' + id;
            
            if (mode === "camera") {
              startCamera();
            } else if (mode === "viewer") {
              connectToCamera();
            }
          });
          
          peer.on('error', (err) => {
            statusDiv.textContent = 'エラーが発生しました: ' + err.type;
            console.error(err);
          });
          
          // 着信処理（カメラモードの場合）
          peer.on('call', (call) => {
            currentCall = call;
            
            if (localStream) {
              call.answer(localStream);
              statusDiv.textContent = '視聴者と接続しました。映像を送信中...';
              controls.classList.remove('hidden');
            } else {
              statusDiv.textContent = 'カメラが準備できていません。';
            }
            
            call.on('stream', (remoteStream) => {
              // カメラモードでは通常リモートストリームは使用しない
            });
            
            call.on('close', () => {
              statusDiv.textContent = '通話が終了しました。';
              controls.classList.add('hidden');
            });
            
            call.on('error', (err) => {
              statusDiv.textContent = '通話エラー: ' + err;
              console.error(err);
            });
          });
        }
        
        // カメラの起動（カメラモード）
        async function startCamera() {
          try {
            localStream = await navigator.mediaDevices.getUserMedia({
              video: { facingMode: facingMode },
              audio: true
            });
            
            localVideo.srcObject = localStream;
            localVideo.classList.remove('hidden');
            controls.classList.remove('hidden');
            statusDiv.textContent = 'カメラを起動しました。視聴者からの接続を待機中...';
          } catch (err) {
            statusDiv.textContent = 'カメラへのアクセスに失敗しました: ' + err.message;
            console.error(err);
          }
        }
        
        // カメラの切り替え
        async function switchCameraFacing() {
          if (!localStream) return;
          
          // 現在のトラックを停止
          localStream.getTracks().forEach(track => track.stop());
          
          // カメラの向きを切り替え
          facingMode = facingMode === "environment" ? "user" : "environment";
          
          try {
            localStream = await navigator.mediaDevices.getUserMedia({
              video: { facingMode: facingMode },
              audio: true
            });
            
            localVideo.srcObject = localStream;
            
            // 通話中なら新しいストリームを送信
            if (currentCall) {
              currentCall.peerConnection.getSenders().forEach(sender => {
                if (sender.track.kind === "video") {
                  const videoTrack = localStream.getVideoTracks()[0];
                  sender.replaceTrack(videoTrack);
                }
              });
            }
            
            statusDiv.textContent = facingMode === "environment" ? '背面カメラに切り替えました' : '前面カメラに切り替えました';
          } catch (err) {
            statusDiv.textContent = 'カメラの切り替えに失敗しました: ' + err.message;
            console.error(err);
          }
        }
        
        // カメラに接続（視聴モード）
        function connectToCamera() {
          const cameraPeerId = roomId + "-camera";
          statusDiv.textContent = 'カメラに接続しています...';
          
          try {
            const call = peer.call(cameraPeerId, new MediaStream()); // 空のストリームで発信
            currentCall = call;
            
            call.on('stream', (remoteStream) => {
              remoteVideo.srcObject = remoteStream;
              remoteVideo.classList.remove('hidden');
              statusDiv.textContent = 'カメラと接続しました。映像を受信中...';
            });
            
            call.on('close', () => {
              statusDiv.textContent = '通話が終了しました。';
              remoteVideo.classList.add('hidden');
            });
            
            call.on('error', (err) => {
              statusDiv.textContent = '通話エラー: ' + err;
              console.error(err);
            });
          } catch (err) {
            statusDiv.textContent = '接続に失敗しました: ' + err.message;
            console.error(err);
          }
        }
        
        // 切断処理
        function hangup() {
          if (currentCall) {
            currentCall.close();
            currentCall = null;
          }
          
          if (localStream) {
            localStream.getTracks().forEach(track => track.stop());
            localStream = null;
          }
          
          if (peer) {
            peer.destroy();
            peer = null;
          }
          
          localVideo.classList.add('hidden');
          remoteVideo.classList.add('hidden');
          controls.classList.add('hidden');
          statusDiv.textContent = '切断しました。';
          
          // 3秒後にメインページに戻る
          setTimeout(() => {
            window.location.href = "/";
          }, 3000);
        }
        
        // イベントリスナー
        switchCameraBtn.addEventListener('click', switchCameraFacing);
        hangupBtn.addEventListener('click', hangup);
        
        // ページを離れる前に接続を閉じる
        window.addEventListener('beforeunload', hangup);
        
        // 初期化
        initPeer();
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
