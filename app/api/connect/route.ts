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
        .video-container {
          position: relative;
          width: 100%;
          height: calc(100% - 40px);
          overflow: hidden;
          background-color: #000;
          display: flex;
          justify-content: center;
          align-items: center;
        }
        video { 
          width: 100%; 
          height: 100%; 
          object-fit: contain; 
          background-color: #000;
        }
        .camera-preview {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          z-index: 5;
        }
        .remote-view {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          z-index: 4;
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
        .camera-info {
          position: absolute;
          top: 10px;
          left: 10px;
          background: rgba(0,0,0,0.5);
          color: white;
          padding: 5px;
          font-size: 12px;
          z-index: 15;
          border-radius: 4px;
        }
        .torch-btn {
          position: absolute;
          top: 10px;
          right: 10px;
          z-index: 15;
        }
        .camera-select {
          position: absolute;
          top: 50px;
          right: 10px;
          z-index: 15;
          background: rgba(0,0,0,0.5);
          color: white;
          border: 1px solid white;
          border-radius: 4px;
          padding: 5px;
        }
      </style>
    </head>
    <body class="${embedded ? "embedded" : ""}">
      <div class="video-container">
        <div class="camera-preview">
          <video id="localVideo" autoplay playsinline muted></video>
        </div>
        <div class="remote-view">
          <video id="remoteVideo" autoplay playsinline></video>
        </div>
      </div>
      <div id="status">接続中...</div>
      <div id="debug"></div>
      <div class="controls">
        <button id="debugBtn" class="btn">デバッグ表示</button>
        <button id="reconnectBtn" class="btn">再接続</button>
        <button id="switchCameraBtn" class="btn">カメラ切替</button>
      </div>
      <div class="camera-info" id="cameraInfo"></div>
      <button id="torchBtn" class="torch-btn btn">ライト ON/OFF</button>
      <select id="cameraSelect" class="camera-select hidden"></select>

      <script>
        // デバッグログ
        const debugDiv = document.getElementById('debug');
        const debugBtn = document.getElementById('debugBtn');
        const reconnectBtn = document.getElementById('reconnectBtn');
        const switchCameraBtn = document.getElementById('switchCameraBtn');
        const torchBtn = document.getElementById('torchBtn');
        const cameraInfo = document.getElementById('cameraInfo');
        const cameraSelect = document.getElementById('cameraSelect');
        
        // デバッグ表示の切り替え
        debugBtn.addEventListener('click', () => {
          debugDiv.style.display = debugDiv.style.display === 'none' ? 'block' : 'none';
        });
        
        // 再接続ボタン
        reconnectBtn.addEventListener('click', () => {
          location.reload();
        });
        
        // 初期状態ではデバッグを表示
        debugDiv.style.display = 'block';
        
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
        let connection;
        let currentFacingMode = "environment"; // デフォルトは背面カメラ
        let torchAvailable = false;
        let torchOn = false;
        
        // ビデオ要素
        const localVideo = document.getElementById('localVideo');
        const remoteVideo = document.getElementById('remoteVideo');
        const statusDiv = document.getElementById('status');
        
        // カメラ関連のUIを初期化
        if (mode === 'camera') {
          document.querySelector('.remote-view').classList.add('hidden');
          switchCameraBtn.classList.remove('hidden');
          torchBtn.classList.remove('hidden');
        } else {
          document.querySelector('.camera-preview').classList.add('hidden');
          switchCameraBtn.classList.add('hidden');
          torchBtn.classList.add('hidden');
        }

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
        
        // カメラ情報を表示
        function updateCameraInfo() {
          if (mode === 'camera' && localStream) {
            const videoTrack = localStream.getVideoTracks()[0];
            if (videoTrack) {
              const settings = videoTrack.getSettings();
              cameraInfo.innerHTML = \`
                カメラ: \${videoTrack.label}<br>
                解像度: \${settings.width}x\${settings.height}<br>
                向き: \${currentFacingMode === 'environment' ? '背面' : '前面'}<br>
                ライト: \${torchAvailable ? (torchOn ? 'ON' : 'OFF') : '非対応'}
              \`;
            }
          }
        }
        
        // 利用可能なカメラを取得
        async function getAvailableCameras() {
          if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) {
            log('カメラ一覧の取得に対応していません');
            return [];
          }
          
          try {
            const devices = await navigator.mediaDevices.enumerateDevices();
            const cameras = devices.filter(device => device.kind === 'videoinput');
            log(\`利用可能なカメラ: \${cameras.length}台\`);
            
            // カメラ選択肢を更新
            cameraSelect.innerHTML = '';
            cameras.forEach((camera, index) => {
              const option = document.createElement('option');
              option.value = camera.deviceId;
              option.text = camera.label || \`カメラ \${index + 1}\`;
              cameraSelect.appendChild(option);
            });
            
            if (cameras.length > 1) {
              cameraSelect.classList.remove('hidden');
              cameraSelect.addEventListener('change', () => {
                const deviceId = cameraSelect.value;
                switchCamera({ deviceId: { exact: deviceId } });
              });
            }
            
            return cameras;
          } catch (err) {
            log('カメラ一覧の取得エラー: ' + err);
            return [];
          }
        }
        
        // カメラを切り替える
        async function switchCamera(constraints = null) {
          if (!localStream) return;
          
          // 既存のトラックを停止
          localStream.getTracks().forEach(track => track.stop());
          
          // 新しいカメラ設定
          const newConstraints = constraints || {
            video: { 
              facingMode: { exact: currentFacingMode === 'environment' ? 'user' : 'environment' },
              width: { ideal: 1280 },
              height: { ideal: 720 }
            },
            audio: true
          };
          
          try {
            // 新しいストリームを取得
            const newStream = await navigator.mediaDevices.getUserMedia(newConstraints);
            localStream = newStream;
            localVideo.srcObject = newStream;
            
            // カメラの向きを更新
            const videoTrack = newStream.getVideoTracks()[0];
            if (videoTrack) {
              const settings = videoTrack.getSettings();
              currentFacingMode = settings.facingMode || 
                                 (constraints && constraints.video.facingMode ? 
                                  (constraints.video.facingMode.exact || currentFacingMode) : 
                                  currentFacingMode === 'environment' ? 'user' : 'environment');
              
              // ライト機能の確認
              checkTorchAvailability(videoTrack);
            }
            
            // カメラ情報を更新
            updateCameraInfo();
            
            log(\`カメラを切り替えました: \${currentFacingMode}\`);
            
            // 接続中の場合は再接続
            if (peer && peer.open) {
              // 既存の接続を閉じる
              if (peer) {
                peer.destroy();
              }
              
              // 再接続
              startConnection();
            }
          } catch (err) {
            log('カメラ切り替えエラー: ' + err);
            updateStatus('カメラの切り替えに失敗しました: ' + err);
          }
        }
        
        // ライト機能の確認
        function checkTorchAvailability(videoTrack) {
          if (!videoTrack) return;
          
          const capabilities = videoTrack.getCapabilities();
          torchAvailable = capabilities.torch || false;
          
          if (torchAvailable) {
            torchBtn.disabled = false;
            torchBtn.addEventListener('click', toggleTorch);
          } else {
            torchBtn.disabled = true;
          }
        }
        
        // ライトのON/OFF切り替え
        async function toggleTorch() {
          if (!localStream || !torchAvailable) return;
          
          const videoTrack = localStream.getVideoTracks()[0];
          if (!videoTrack) return;
          
          try {
            torchOn = !torchOn;
            await videoTrack.applyConstraints({
              advanced: [{ torch: torchOn }]
            });
            log(\`ライト: \${torchOn ? 'ON' : 'OFF'}\`);
            updateCameraInfo();
          } catch (err) {
            log('ライト切り替えエラー: ' + err);
          }
        }
        
        // カメラ切り替えボタンのイベント
        switchCameraBtn.addEventListener('click', () => switchCamera());
        
        // 単純化されたPeerJS実装
        function startConnection() {
          // ピアIDの設定
          const peerId = mode === 'camera' ? 'camera-' + roomId : 'viewer-' + roomId;
          
          log('PeerJS初期化: ' + peerId);
          
          // PeerJSの設定
          const peerConfig = {
            debug: 3,
            config: {
              'iceServers': [
                { urls: 'stun:stun.l.google.com:19302' },
                { urls: 'stun:stun1.l.google.com:19302' },
                { urls: 'stun:stun2.l.google.com:19302' },
                { urls: 'stun:stun3.l.google.com:19302' },
                { urls: 'stun:stun4.l.google.com:19302' },
                { urls: 'stun:stun.stunprotocol.org:3478' },
                {
                  urls: 'turn:numb.viagenie.ca',
                  credential: 'muazkh',
                  username: 'webrtc@live.com'
                }
              ]
            }
          };
          
          // PeerJSインスタンスの作成
          peer = new Peer(peerId, peerConfig);
          
          // 接続イベント
          peer.on('open', id => {
            log('ピア接続確立: ' + id);
            updateStatus('ピアサーバーに接続しました');
            
            if (mode === 'camera') {
              // カメラモードの場合は待機
              updateStatus('視聴者からの接続を待機中...');
            } else {
              // 視聴モードの場合はカメラに接続
              connectToCamera();
            }
          });
          
          // エラーイベント
          peer.on('error', err => {
            log('ピアエラー: ' + err.type);
            updateStatus('エラーが発生しました: ' + err.type);
            
            // 既に使用されているIDの場合は、ランダムなIDで再試行
            if (err.type === 'unavailable-id') {
              const randomId = Math.random().toString(36).substring(2, 8);
              const newPeerId = mode === 'camera' ? 'camera-' + randomId : 'viewer-' + randomId;
              log('新しいIDで再試行: ' + newPeerId);
              peer = new Peer(newPeerId, peerConfig);
            }
          });
          
          // カメラモードの場合の着信処理
          if (mode === 'camera') {
            // 着信コール処理
            peer.on('call', call => {
              log('着信コール受信');
              updateStatus('着信コールを受信しました');
              
              // ローカルストリームで応答
              call.answer(localStream);
              log('ローカルストリームで応答');
              updateStatus('コールに応答しました');
              
              // リモートストリーム受信時の処理
              call.on('stream', stream => {
                log('リモートストリーム受信（カメラモード）');
                // カメラモードでは視聴者からのストリームは表示しない
              });
              
              // エラー処理
              call.on('error', err => {
                log('コールエラー: ' + err);
                updateStatus('コールエラー: ' + err);
              });
              
              // 切断処理
              call.on('close', () => {
                log('コール終了');
                updateStatus('コールが終了しました');
              });
            });
            
            // データ接続処理
            peer.on('connection', conn => {
              connection = conn;
              log('データ接続確立（カメラモード）');
              
              conn.on('data', data => {
                log('データ受信: ' + JSON.stringify(data));
                
                // pingに対してpongで応答
                if (data.type === 'ping') {
                  conn.send({ type: 'pong', timestamp: Date.now() });
                }
              });
              
              conn.on('open', () => {
                log('データチャネルオープン');
                updateStatus('視聴者と接続しました');
                
                // 定期的にステータスを送信
                setInterval(() => {
                  if (conn.open) {
                    conn.send({ 
                      type: 'status', 
                      streaming: true,
                      timestamp: Date.now() 
                    });
                  }
                }, 5000);
              });
              
              conn.on('close', () => {
                log('データ接続終了');
                updateStatus('視聴者との接続が終了しました');
              });
            });
          }
        }
        
        // 視聴モードでカメラに接続
        function connectToCamera() {
          const targetId = 'camera-' + roomId;
          log('カメラに接続: ' + targetId);
          updateStatus('カメラに接続中...');
          
          // データ接続
          connection = peer.connect(targetId);
          
          connection.on('open', () => {
            log('データ接続確立（視聴モード）');
            updateStatus('カメラとデータ接続しました');
            
            // pingを送信
            connection.send({ type: 'ping', timestamp: Date.now() });
            
            // カメラからのビデオストリームを要求
            const call = peer.call(targetId, new MediaStream());
            log('発信コール送信');
            
            // リモートストリーム受信時の処理
            call.on('stream', stream => {
              log('リモートストリーム受信（視聴モード）');
              updateStatus('接続済み');
              
              // ストリームの内容をログ
              const tracks = stream.getTracks();
              log(\`受信したトラック数: \${tracks.length}\`);
              tracks.forEach((track, i) => {
                log(\`トラック\${i+1}: \${track.kind} - \${track.readyState}\`);
              });
              
              // ビデオ要素にストリームをセット
              remoteVideo.srcObject = stream;
              
              // ビデオの読み込みイベント
              remoteVideo.onloadedmetadata = () => {
                log('ビデオメタデータ読み込み完了');
                remoteVideo.play().catch(e => log('ビデオ再生エラー: ' + e));
              };
            });
            
            // エラー処理
            call.on('error', err => {
              log('コールエラー: ' + err);
              updateStatus('コールエラー: ' + err);
            });
            
            // 切断処理
            call.on('close', () => {
              log('コール終了');
              updateStatus('コールが終了しました');
            });
          });
          
          connection.on('data', data => {
            log('データ受信: ' + JSON.stringify(data));
            
            // カメラからのステータス更新
            if (data.type === 'status' && data.streaming) {
              updateStatus('接続済み - ストリーミング中');
            }
          });
          
          connection.on('error', err => {
            log('データ接続エラー: ' + err);
            updateStatus('接続エラー: ' + err);
          });
          
          connection.on('close', () => {
            log('データ接続終了');
            updateStatus('カメラとの接続が終了しました');
          });
        }
        
        // カメラモードの場合はカメラを起動
        if (mode === 'camera') {
          // カメラへのアクセス
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
            
            // カメラ情報を表示
            const videoTrack = stream.getVideoTracks()[0];
            if (videoTrack) {
              checkTorchAvailability(videoTrack);
              updateCameraInfo();
            }
            
            // 利用可能なカメラを取得
            getAvailableCameras();
            
            log('カメラアクセス成功');
            updateStatus('カメラ準備完了');
            
            // 接続開始
            startConnection();
          })
          .catch(err => {
            log('カメラエラー: ' + err.message);
            updateStatus('カメラへのアクセスに失敗しました: ' + err.message);
          });
        } 
        // 視聴モードの場合
        else if (mode === 'viewer') {
          log('視聴モード開始');
          
          // 接続開始
          startConnection();
        }

        // ページを離れる前に接続を閉じる
        window.onbeforeunload = () => {
          if (localStream) {
            localStream.getTracks().forEach(track => track.stop());
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
