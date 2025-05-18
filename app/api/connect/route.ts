import { type NextRequest, NextResponse } from "next/server"

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const roomId = searchParams.get("room")
  const mode = searchParams.get("mode")
  const embedded = searchParams.get("embedded") === "true"

  if (!roomId || !mode) {
    return NextResponse.json({ error: "Room ID and mode are required" }, { status: 400 })
  }

  // WebRTCクライアントコードを含むHTMLを返す
  return new NextResponse(
    `
    <!DOCTYPE html>
    <html lang="ja">
    <head>
      <title>WebRTC Connection</title>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <script src="https://unpkg.com/peerjs@1.4.7/dist/peerjs.min.js"></script>
      <style>
        body { 
          margin: 0; 
          font-family: sans-serif;
          overflow: hidden;
          width: 100%;
          height: 100vh;
          background-color: #000;
        }
        #status { 
          padding: 10px; 
          text-align: center; 
          position: absolute;
          bottom: 0;
          left: 0;
          right: 0;
          background: rgba(0,0,0,0.5);
          color: white;
          z-index: 10;
          font-size: 14px;
        }
        video { 
          width: 100%; 
          height: 100%; 
          object-fit: contain; 
          background-color: #000;
          position: absolute;
          top: 0;
          left: 0;
        }
        .hidden { 
          display: none !important; 
        }
        #debug { 
          position: fixed; 
          bottom: 40px; 
          left: 10px; 
          background: rgba(0,0,0,0.5); 
          color: white; 
          padding: 5px; 
          font-size: 12px; 
          max-width: 80%; 
          overflow: auto; 
          max-height: 100px;
          z-index: 20;
        }
        .embedded {
          height: 100%;
          width: 100%;
          overflow: hidden;
        }
        .video-container {
          position: relative;
          width: 100%;
          height: calc(100% - 40px);
          overflow: hidden;
          background-color: #000;
        }
        .controls {
          position: absolute;
          bottom: 10px;
          left: 50%;
          transform: translateX(-50%);
          z-index: 30;
          display: flex;
          gap: 10px;
        }
        .btn {
          background: rgba(255,255,255,0.2);
          border: none;
          color: white;
          padding: 5px 10px;
          border-radius: 4px;
          cursor: pointer;
        }
        .btn:hover {
          background: rgba(255,255,255,0.3);
        }
      </style>
    </head>
    <body class="${embedded ? "embedded" : ""}">
      <div class="video-container">
        <video id="localVideo" autoplay playsinline muted class="hidden"></video>
        <video id="remoteVideo" autoplay playsinline class="hidden"></video>
      </div>
      <div id="status">接続中...</div>
      <div id="debug"></div>
      <div class="controls">
        <button id="debugBtn" class="btn">デバッグ表示</button>
        <button id="reconnectBtn" class="btn">再接続</button>
      </div>

      <script>
        // デバッグログ
        const debugDiv = document.getElementById('debug');
        const debugBtn = document.getElementById('debugBtn');
        const reconnectBtn = document.getElementById('reconnectBtn');
        
        // デバッグ表示の切り替え
        debugBtn.addEventListener('click', () => {
          debugDiv.style.display = debugDiv.style.display === 'none' ? 'block' : 'none';
        });
        
        // 再接続ボタン
        reconnectBtn.addEventListener('click', () => {
          location.reload();
        });
        
        // 初期状態ではデバッグを非表示
        debugDiv.style.display = 'none';
        
        function log(message) {
          console.log(message);
          const timestamp = new Date().toLocaleTimeString();
          debugDiv.innerHTML += \`[\${timestamp}] \${message}<br>\`;
          debugDiv.scrollTop = debugDiv.scrollHeight;
        }

        const roomId = "${roomId}";
        const mode = "${mode}";
        const embedded = ${embedded};
        let peer;
        let localStream;
        let conn;
        let currentCall;

        // ビデオ要素
        const localVideo = document.getElementById('localVideo');
        const remoteVideo = document.getElementById('remoteVideo');
        const statusDiv = document.getElementById('status');

        // 接続状態を親ウィンドウに通知
        function updateStatus(status) {
          statusDiv.textContent = status;
          log('ステータス更新: ' + status);
          
          // 埋め込みモードの場合、親ウィンドウに通知
          if (embedded && window.parent) {
            try {
              window.parent.postMessage({ 
                type: 'connection-status', 
                status: status 
              }, window.location.origin);
            } catch (e) {
              log('親ウィンドウへの通知エラー: ' + e);
            }
          }
        }

        updateStatus("接続中...");

        // PeerJSの初期化
        function initPeer(userId) {
          log('PeerJS初期化: ' + userId);
          
          // 既存のピア接続を破棄
          if (peer) {
            peer.destroy();
          }
          
          peer = new Peer(userId, {
            config: {
              'iceServers': [
                { urls: 'stun:stun.l.google.com:19302' },
                { urls: 'stun:stun1.l.google.com:19302' },
                { urls: 'stun:stun2.l.google.com:19302' },
                { urls: 'stun:stun3.l.google.com:19302' },
                { urls: 'stun:stun4.l.google.com:19302' },
                { urls: 'stun:stun.stunprotocol.org:3478' }
              ]
            },
            debug: 2
          });

          peer.on('open', (id) => {
            log('ピア接続確立: ' + id);
            updateStatus("ピアサーバーに接続しました");
            
            if (mode === "camera") {
              // カメラモードの場合は待機
              updateStatus("視聴者からの接続を待機中...");
            } else if (mode === "viewer") {
              // 視聴モードの場合はカメラに接続
              connectToCamera();
            }
          });

          peer.on('error', (err) => {
            log('ピアエラー: ' + err.type);
            updateStatus("エラーが発生しました: " + err.type);
          });

          // 着信コールの処理
          peer.on('call', (call) => {
            currentCall = call;
            log('着信コール受信');
            updateStatus("着信コールを受信しました");
            
            // カメラモードの場合、ローカルストリームで応答
            if (mode === "camera" && localStream) {
              log('ローカルストリームで応答');
              call.answer(localStream);
              updateStatus("コールに応答しました");
            } else {
              log('空のストリームで応答');
              call.answer();
            }
            
            call.on('stream', (remoteStream) => {
              log('リモートストリーム受信');
              updateStatus("接続済み");
              
              // ストリームの内容をログ
              const tracks = remoteStream.getTracks();
              log(\`受信したトラック数: \${tracks.length}\`);
              tracks.forEach((track, i) => {
                log(\`トラック\${i+1}: \${track.kind} - \${track.readyState}\`);
              });
              
              // ビデオ要素にストリームをセット
              remoteVideo.srcObject = remoteStream;
              remoteVideo.classList.remove('hidden');
              
              // ビデオの読み込みイベント
              remoteVideo.onloadedmetadata = () => {
                log('ビデオメタデータ読み込み完了');
                remoteVideo.play().catch(e => log('ビデオ再生エラー: ' + e));
              };
              
              // エラーイベント
              remoteVideo.onerror = (e) => {
                log('ビデオエラー: ' + e);
              };
            });
            
            call.on('error', (err) => {
              log('コールエラー: ' + err);
              updateStatus("コールエラー: " + err);
            });
            
            call.on('close', () => {
              log('コール終了');
              updateStatus("コールが終了しました");
              remoteVideo.classList.add('hidden');
            });
          });

          // データ接続の処理
          peer.on('connection', (dataConn) => {
            conn = dataConn;
            log('データ接続確立');
            
            conn.on('data', (data) => {
              log('データ受信: ' + JSON.stringify(data));
            });
            
            conn.on('close', () => {
              log('データ接続終了');
            });
          });
        }

        // カメラに接続
        function connectToCamera() {
          const targetId = roomId + "-camera";
          log('カメラに接続: ' + targetId);
          updateStatus("カメラに接続中...");
          
          // データ接続
          conn = peer.connect(targetId);
          
          conn.on('open', () => {
            log('データ接続確立');
            conn.send({ type: 'hello', message: 'ビューアーから接続しました' });
            
            // ビデオ通話
            if (mode === "viewer") {
              // 空のストリームを作成
              const emptyStream = new MediaStream();
              currentCall = peer.call(targetId, emptyStream);
              log('発信コール送信');
              
              currentCall.on('stream', (remoteStream) => {
                log('リモートストリーム受信');
                updateStatus("接続済み");
                
                // ストリームの内容をログ
                const tracks = remoteStream.getTracks();
                log(\`受信したトラック数: \${tracks.length}\`);
                tracks.forEach((track, i) => {
                  log(\`トラック\${i+1}: \${track.kind} - \${track.readyState}\`);
                });
                
                // ビデオ要素にストリームをセット
                remoteVideo.srcObject = remoteStream;
                remoteVideo.classList.remove('hidden');
                
                // ビデオの読み込みイベント
                remoteVideo.onloadedmetadata = () => {
                  log('ビデオメタデータ読み込み完了');
                  remoteVideo.play().catch(e => log('ビデオ再生エラー: ' + e));
                };
                
                // エラーイベント
                remoteVideo.onerror = (e) => {
                  log('ビデオエラー: ' + e);
                };
              });
              
              currentCall.on('error', (err) => {
                log('コールエラー: ' + err);
                updateStatus("コールエラー: " + err);
              });
              
              currentCall.on('close', () => {
                log('コール終了');
                updateStatus("コールが終了しました");
                remoteVideo.classList.add('hidden');
              });
            }
          });
          
          conn.on('error', (err) => {
            log('データ接続エラー: ' + err);
            updateStatus("接続エラー: " + err);
          });
        }

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
            
            // ストリームの内容をログ
            const tracks = stream.getTracks();
            log(\`カメラストリームのトラック数: \${tracks.length}\`);
            tracks.forEach((track, i) => {
              log(\`トラック\${i+1}: \${track.kind} - \${track.readyState}\`);
            });
            
            log('カメラアクセス成功');
            updateStatus("カメラ準備完了");
            
            // PeerJSの初期化
            initPeer(roomId + "-camera");
          })
          .catch(err => {
            log('カメラエラー: ' + err.message);
            updateStatus("カメラへのアクセスに失敗しました: " + err.message);
          });
        } 
        // 視聴モードの場合
        else if (mode === "viewer") {
          remoteVideo.classList.remove('hidden');
          log('視聴モード開始');
          
          // PeerJSの初期化
          initPeer(roomId + "-viewer");
        }

        // ページを離れる前に接続を閉じる
        window.onbeforeunload = () => {
          if (localStream) {
            localStream.getTracks().forEach(track => track.stop());
          }
          if (currentCall) {
            currentCall.close();
          }
          if (peer) {
            peer.destroy();
          }
        };
      </script>
    </body>
    </html>
  `,
    {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
      },
    },
  )
}
