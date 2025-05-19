import { type NextRequest, NextResponse } from "next/server"

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const roomId = searchParams.get("room")
  const mode = searchParams.get("mode")
  const embedded = searchParams.get("embedded") === "true"
  const fallback = searchParams.get("fallback") === "true"

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
        * {
          box-sizing: border-box;
          margin: 0;
          padding: 0;
        }
        
        html, body {
          width: 100%;
          height: 100%;
          overflow: hidden;
          background-color: #000;
          font-family: sans-serif;
        }
        
        #app {
          position: relative;
          width: 100%;
          height: 100%;
          display: flex;
          flex-direction: column;
        }
        
        #video-container {
          flex: 1;
          position: relative;
          background-color: #000;
          overflow: hidden;
        }
        
        #local-video-container,
        #remote-video-container {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          overflow: hidden;
          background-color: #000;
        }
        
        #local-video,
        #remote-video {
          width: 100%;
          height: 100%;
          object-fit: contain;
          background-color: #000;
        }
        
        /* ステータスバーを下部に固定し、高さを制限 */
        #status-bar {
          position: absolute;
          bottom: 0;
          left: 0;
          right: 0;
          padding: 5px;
          background: rgba(0,0,0,0.5);
          color: white;
          text-align: center;
          font-size: 12px;
          z-index: 100;
          height: 30px;
          line-height: 20px;
        }
        
        /* デバッグパネルを右下に配置し、サイズを制限 */
        #debug-panel {
          position: fixed;
          bottom: 40px;
          right: 10px;
          width: 250px;
          max-height: 150px;
          overflow-y: auto;
          background: rgba(0,0,0,0.5);
          color: white;
          padding: 5px;
          font-size: 10px;
          z-index: 90;
          border-radius: 5px;
          display: none;
          opacity: 0.7;
        }
        
        /* コントロールパネルを下部に配置し、ステータスバーと重ならないように */
        #control-panel {
          position: absolute;
          bottom: 40px;
          left: 0;
          right: 0;
          display: flex;
          justify-content: center;
          gap: 10px;
          padding: 10px;
          z-index: 95;
        }
        
        .btn {
          background: rgba(0,0,0,0.5);
          border: 1px solid rgba(255,255,255,0.3);
          color: white;
          padding: 8px 15px;
          border-radius: 20px;
          cursor: pointer;
          font-size: 14px;
          min-width: 80px;
          text-align: center;
        }
        
        .btn:hover {
          background: rgba(0,0,0,0.7);
        }
        
        .btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
        
        /* カメラ情報を左上に配置し、サイズを制限 */
        #camera-info {
          position: absolute;
          top: 10px;
          left: 10px;
          background: rgba(0,0,0,0.5);
          color: white;
          padding: 5px;
          font-size: 10px;
          z-index: 95;
          border-radius: 5px;
          max-width: 150px;
          opacity: 0.7;
        }
        
        /* カメラコントロールを右上に配置 */
        #camera-controls {
          position: absolute;
          top: 10px;
          right: 10px;
          display: flex;
          flex-direction: column;
          gap: 10px;
          z-index: 95;
        }
        
        #camera-select {
          background: rgba(0,0,0,0.5);
          color: white;
          border: 1px solid rgba(255,255,255,0.3);
          border-radius: 5px;
          padding: 5px;
          font-size: 12px;
        }
        
        .hidden {
          display: none !important;
        }
        
        /* 接続インジケーターを右上に配置し、サイズを小さく */
        .connection-indicator {
          position: absolute;
          top: 10px;
          right: 10px;
          width: 10px;
          height: 10px;
          border-radius: 50%;
          background-color: red;
          z-index: 90;
        }
        
        .connection-indicator.connected {
          background-color: green;
        }
        
        .connection-indicator.connecting {
          background-color: orange;
        }
        
        /* 代替接続モードのコンテナを中央に配置 */
        #fallback-container {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          text-align: center;
          color: white;
          z-index: 90;
          display: none;
          background: rgba(0,0,0,0.7);
          padding: 20px;
          border-radius: 10px;
        }
        
        #fallback-container.active {
          display: block;
        }
        
        #fallback-qr {
          margin: 20px auto;
          padding: 10px;
          background: white;
          border-radius: 5px;
        }
        
        #fallback-image {
          max-width: 100%;
          max-height: 70vh;
          display: block;
          margin: 0 auto;
          border: 1px solid rgba(255,255,255,0.3);
          border-radius: 5px;
        }
        
        /* デバッグボタンを右下に固定 */
        #debug-btn {
          position: fixed;
          bottom: 40px;
          right: 10px;
          z-index: 100;
          font-size: 12px;
          padding: 5px 10px;
          opacity: 0.5;
          min-width: auto;
        }
        
        /* カメラモードのボタンサイズを調整 */
        #camera-controls .btn {
          font-size: 12px;
          padding: 5px 10px;
          min-width: auto;
        }
        
        /* 小さい画面用の調整 */
        @media (max-height: 500px) {
          #control-panel {
            bottom: 35px;
          }
          
          .btn {
            padding: 5px 10px;
            font-size: 12px;
          }
          
          #status-bar {
            height: 25px;
            font-size: 10px;
            line-height: 15px;
          }
        }
      </style>
    </head>
    <body>
      <div id="app">
        <div id="video-container">
          <div id="local-video-container" class="${mode === "viewer" ? "hidden" : ""}">
            <video id="local-video" autoplay playsinline muted></video>
          </div>
          <div id="remote-video-container" class="${mode === "camera" ? "hidden" : ""}">
            <video id="remote-video" autoplay playsinline></video>
            <img id="fallback-image" class="hidden" alt="カメラ映像" />
          </div>
          <div class="connection-indicator" id="connection-indicator"></div>
        </div>
        
        <div id="camera-info" class="${mode === "viewer" ? "hidden" : ""}"></div>
        
        <div id="camera-controls" class="${mode === "viewer" ? "hidden" : ""}">
          <button id="switch-camera-btn" class="btn">カメラ切替</button>
          <button id="torch-btn" class="btn" disabled>ライト</button>
          <select id="camera-select" class="hidden"></select>
        </div>
        
        <div id="control-panel">
          <button id="reconnect-btn" class="btn">再接続</button>
          <button id="fallback-btn" class="btn">代替接続</button>
        </div>
        
        <button id="debug-btn" class="btn">デバッグ</button>
        
        <div id="status-bar">接続中...</div>
        <div id="debug-panel"></div>
        
        <div id="fallback-container">
          <h3>代替接続モード</h3>
          <p>WebRTC接続に問題があります。<br>代替接続を試みます。</p>
          <div id="fallback-qr"></div>
        </div>
      </div>

      <script>
        // DOM要素
        const app = document.getElementById('app');
        const videoContainer = document.getElementById('video-container');
        const localVideoContainer = document.getElementById('local-video-container');
        const remoteVideoContainer = document.getElementById('remote-video-container');
        const localVideo = document.getElementById('local-video');
        const remoteVideo = document.getElementById('remote-video');
        const fallbackImage = document.getElementById('fallback-image');
        const statusBar = document.getElementById('status-bar');
        const debugPanel = document.getElementById('debug-panel');
        const debugBtn = document.getElementById('debug-btn');
        const reconnectBtn = document.getElementById('reconnect-btn');
        const fallbackBtn = document.getElementById('fallback-btn');
        const switchCameraBtn = document.getElementById('switch-camera-btn');
        const torchBtn = document.getElementById('torch-btn');
        const cameraInfo = document.getElementById('camera-info');
        const cameraSelect = document.getElementById('camera-select');
        const connectionIndicator = document.getElementById('connection-indicator');
        const fallbackContainer = document.getElementById('fallback-container');
        const fallbackQr = document.getElementById('fallback-qr');
        
        // デバッグ表示の切り替え
        debugBtn.addEventListener('click', () => {
          debugPanel.style.display = debugPanel.style.display === 'none' ? 'block' : 'none';
        });
        
        // 再接続ボタン
        reconnectBtn.addEventListener('click', () => {
          location.reload();
        });
        
        // 代替接続ボタン
        fallbackBtn.addEventListener('click', () => {
          activateFallbackMode();
        });
        
        // 初期状態ではデバッグを非表示
        debugPanel.style.display = 'none';
        
        // ログ関数
        function log(message) {
          console.log(message);
          const timestamp = new Date().toLocaleTimeString();
          debugPanel.innerHTML += \`[\${timestamp}] \${message}<br>\`;
          debugPanel.scrollTop = debugPanel.scrollHeight;
        }

        // 基本設定
        const roomId = "${roomId}";
        const mode = "${mode}";
        const embedded = ${embedded};
        const initialFallback = ${fallback};
        let peer;
        let localStream;
        let remoteStream;
        let connection;
        let currentFacingMode = "environment"; // デフォルトは背面カメラ
        let torchAvailable = false;
        let torchOn = false;
        let activeCall = null;
        let connectionTimeout;
        let usingFallbackMode = initialFallback;
        let fallbackInterval;
        
        // 接続状態を親ウィンドウに通知
        function updateStatus(status) {
          statusBar.textContent = status;
          log('ステータス更新: ' + status);
          
          // 接続状態インジケーターの更新
          if (status.includes('接続済み')) {
            connectionIndicator.className = 'connection-indicator connected';
          } else if (status.includes('接続中')) {
            connectionIndicator.className = 'connection-indicator connecting';
          } else {
            connectionIndicator.className = 'connection-indicator';
          }
          
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
                カメラ: \${videoTrack.label.substring(0, 20)}...<br>
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
            
            // ビデオ要素にストリームをセット
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
            if (peer && peer.open && !usingFallbackMode) {
              // 既存の接続を閉じる
              if (activeCall) {
                activeCall.close();
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
            torchBtn.textContent = torchOn ? 'ライトOFF' : 'ライトON';
            updateCameraInfo();
          } catch (err) {
            log('ライト切り替えエラー: ' + err);
          }
        }
        
        // カメラ切り替えボタンのイベント
        switchCameraBtn.addEventListener('click', () => switchCamera());
        
        // ICE接続状態の監視
        function monitorIceConnectionState(pc) {
          if (!pc) return;
          
          pc.oniceconnectionstatechange = () => {
            log('ICE接続状態変更: ' + pc.iceConnectionState);
            
            if (pc.iceConnectionState === 'connected' || pc.iceConnectionState === 'completed') {
              updateStatus('ICE接続確立');
              clearTimeout(connectionTimeout);
            } else if (pc.iceConnectionState === 'failed' || pc.iceConnectionState === 'disconnected') {
              updateStatus('ICE接続失敗');
              
              // 再接続を試みる
              if (mode === 'viewer') {
                log('ICE接続失敗 - 再接続を試みます');
                setTimeout(() => {
                  if (peer && peer.open) {
                    connectToCamera();
                  }
                }, 2000);
              }
            }
          };
          
          // ICE候補の詳細ログを追加
          pc.onicecandidate = (event) => {
            if (event.candidate) {
              log('ICE候補追加: ' + JSON.stringify(event.candidate));
            } else {
              log('ICE候補収集完了');
            }
          };
          
          // 接続統計情報の定期的な収集
          if (mode === 'viewer') {
            const statsInterval = setInterval(() => {
              if (pc.connectionState === 'connected') {
                pc.getStats().then(stats => {
                  stats.forEach(report => {
                    if (report.type === 'inbound-rtp' && report.kind === 'video') {
                      log('受信統計: フレーム数=' + report.framesReceived + 
                          ', デコード数=' + report.framesDecoded + 
                          ', 破棄数=' + report.framesDropped);
                    }
                  });
                });
              } else if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') {
                clearInterval(statsInterval);
              }
            }, 5000);
          }
        }
        
        // 単純化されたPeerJS実装
        function startConnection() {
          // 代替接続モードの場合は処理しない
          if (usingFallbackMode) {
            activateFallbackMode();
            return;
          }
          
          // ピアIDの設定
          const peerId = mode === 'camera' ? 'camera-' + roomId : 'viewer-' + roomId;
          
          log('PeerJS初期化: ' + peerId);
          
          // PeerJSの設定 - シンプルな設定に修正
          const peerConfig = {
            debug: 3,
            config: {
              'iceServers': [
                { urls: 'stun:stun.l.google.com:19302' },
                { urls: 'stun:stun1.l.google.com:19302' }
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
            } else if (err.type === 'peer-unavailable') {
              // ピアが見つからない場合は代替接続モードを提案
              log('ピアが見つかりません - 代替接続モードを提案');
              fallbackBtn.style.display = 'inline-block';
            } else if (err.type === 'network' || err.type === 'disconnected') {
              // ネットワークエラーの場合は再接続
              log('ネットワークエラー - 再接続を試みます');
              setTimeout(() => {
                if (!usingFallbackMode) {
                  startConnection();
                }
              }, 3000);
            }
          });
          
          // カメラモードの場合の着信処理
          if (mode === 'camera') {
            // 着信コール処理
            peer.on('call', call => {
              log('着信コール受信');
              updateStatus('着信コールを受信しました');
              
              // 既存のコールがあれば閉じる
              if (activeCall) {
                activeCall.close();
              }
              
              // 新しいコールを保存
              activeCall = call;
              
              // ローカルストリームで応答
              call.answer(localStream);
              log('ローカルストリームで応答');
              updateStatus('コールに応答しました');
              
              // ICE接続状態の監視
              if (call.peerConnection) {
                monitorIceConnectionState(call.peerConnection);
              }
              
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
                activeCall = null;
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
                
                // 代替接続モードのリクエスト
                if (data.type === 'request-fallback') {
                  log('代替接続モードのリクエストを受信');
                  activateFallbackMode();
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
          
          // 接続タイムアウト設定
          clearTimeout(connectionTimeout);
          connectionTimeout = setTimeout(() => {
            if (!remoteStream) {
              log('接続タイムアウト - 代替接続モードに自動切り替え');
              updateStatus('接続タイムアウト - 代替モードに切り替えます');
              
              // 代替接続モードを自動的に有効化
              activateFallbackMode();
            }
          }, 15000);
          
          try {
            // データ接続
            connection = peer.connect(targetId);
            
            connection.on('open', () => {
              log('データ接続確立（視聴モード）');
              updateStatus('カメラとデータ接続しました');
              
              // pingを送信
              connection.send({ type: 'ping', timestamp: Date.now() });
              
              // 既存のコールがあれば閉じる
              if (activeCall) {
                activeCall.close();
              }
              
              try {
                // カメラからのビデオストリームを要求
                const call = peer.call(targetId, new MediaStream());
                activeCall = call;
                log('発信コール送信');
                
                // ICE接続状態の監視
                if (call.peerConnection) {
                  monitorIceConnectionState(call.peerConnection);
                }
                
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
                  
                  // リモートストリームを保存
                  remoteStream = stream;
                  
                  // ビデオ要素にストリームをセット
                  remoteVideo.srcObject = stream;
                  
                  // ビデオの読み込みイベント
                  remoteVideo.onloadedmetadata = () => {
                    log('ビデオメタデータ読み込み完了');
                    
                    // ビデオ要素のスタイルを強制的に設定
                    remoteVideo.style.width = '100%';
                    remoteVideo.style.height = '100%';
                    remoteVideo.style.objectFit = 'contain';
                    
                    // ビデオ再生
                    remoteVideo.play().catch(e => {
                      log('ビデオ再生エラー: ' + e);
                      
                      // 自動再生ポリシーによるエラーの場合、ユーザー操作を待つ
                      if (e.name === 'NotAllowedError') {
                        log('自動再生が許可されていません。ユーザー操作を待ちます。');
                        
                        // 画面タップで再生を試みる
                        document.addEventListener('click', () => {
                          remoteVideo.play().catch(err => log('再試行エラー: ' + err));
                        }, { once: true });
                      }
                    });
                  };
                  
                  // エラーイベント
                  remoteVideo.onerror = (e) => {
                    log('ビデオエラー: ' + e);
                  };
                  
                  // タイムアウトをクリア
                  clearTimeout(connectionTimeout);
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
                  activeCall = null;
                });
              } catch (err) {
                log('コール作成エラー: ' + err);
                updateStatus('コール作成エラー: ' + err);
              }
            });
            
            connection.on('data', data => {
              log('データ受信: ' + JSON.stringify(data));
              
              // カメラからのステータス更新
              if (data.type === 'status' && data.streaming) {
                updateStatus('接続済み - ストリーミング中');
              }
              
              // 代替接続モードの画像データ
              if (data.type === 'image' && usingFallbackMode) {
                fallbackImage.src = data.data;
                fallbackImage.classList.remove('hidden');
                remoteVideo.classList.add('hidden');
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
          } catch (err) {
            log('接続エラー: ' + err);
            updateStatus('接続エラー: ' + err);
          }
        }
        
        // 代替接続モードを有効化
        function activateFallbackMode() {
          if (usingFallbackMode) return;
          
          usingFallbackMode = true;
          log('代替接続モードを有効化');
          updateStatus('代替接続モードに切り替え中...');
          
          // 既存の接続を閉じる
          if (activeCall) {
            activeCall.close();
            activeCall = null;
          }
          
          // 代替接続モードのUIを表示
          if (mode === 'viewer') {
            // 視聴モードの場合、カメラモード用のQRコードを表示
            const fallbackUrl = \`https://remote-gamma.vercel.app/?room=\${roomId}&mode=camera&fallback=true\`;
            
            // QRコードライブラリを動的に読み込み
            const script = document.createElement('script');
            script.src = 'https://cdn.jsdelivr.net/npm/qrcode@1.5.1/build/qrcode.min.js';
            script.onload = () => {
              // QRコードを生成
              QRCode.toCanvas(fallbackQr, fallbackUrl, { width: 200 }, (error) => {
                if (error) {
                  log('QRコード生成エラー: ' + error);
                  fallbackQr.innerHTML = fallbackUrl;
                }
              });
            };
            document.head.appendChild(script);
            
            fallbackContainer.classList.add('active');
            updateStatus('スマートフォンでQRコードをスキャンしてください');
            
            // 既存の接続があれば代替接続モードをリクエスト
            if (connection && connection.open) {
              connection.send({ type: 'request-fallback' });
            }
            
            // 代替接続モードでは画像を表示
            remoteVideo.classList.add('hidden');
            fallbackImage.classList.remove('hidden');
          } else if (mode === 'camera') {
            // カメラモードの場合、定期的に画像をキャプチャして送信
            updateStatus('代替接続モード - 画像送信中');
            
            // 既存のインターバルをクリア
            clearInterval(fallbackInterval);
            
            // キャンバスを作成
            const canvas = document.createElement('canvas');
            const context = canvas.getContext('2d');
            
            // 定期的に画像をキャプチャして送信
            fallbackInterval = setInterval(() => {
              if (!localStream || !connection || !connection.open) return;
              
              try {
                // ローカルビデオからキャンバスに描画
                const videoTrack = localStream.getVideoTracks()[0];
                if (videoTrack) {
                  canvas.width = localVideo.videoWidth;
                  canvas.height = localVideo.videoHeight;
                  context.drawImage(localVideo, 0, 0, canvas.width, canvas.height);
                  
                  // 画像データをBase64に変換（品質と更新頻度のバランスを調整）
                  const imageData = canvas.toDataURL('image/jpeg', 0.7);
                  
                  // 画像データを送信
                  if (connection && connection.open) {
                    connection.send({
                      type: 'image',
                      data: imageData,
                      timestamp: Date.now()
                    });
                    log('画像送信: ' + Math.floor(imageData.length / 1024) + 'KB');
                  }
                }
              } catch (err) {
                log('画像キャプチャエラー: ' + err);
              }
            }, 500); // 0.5秒ごとに送信（更新頻度を上げる）
          }
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
            
            // ビデオ要素にストリームをセット
            localVideo.srcObject = stream;
            
            // ビデオの読み込みイベント
            localVideo.onloadedmetadata = () => {
              log('ローカルビデオメタデータ読み込み完了');
              
              // ビデオ要素のスタイルを強制的に設定
              localVideo.style.width = '100%';
              localVideo.style.height = '100%';
              localVideo.style.objectFit = 'contain';
              
              // ビデオ再生
              localVideo.play().catch(e => {
                log('ローカルビデオ再生エラー: ' + e);
                
                // 自動再生ポリシーによるエラーの場合、ユーザー操作を待つ
                if (e.name === 'NotAllowedError') {
                  log('自動再生が許可されていません。ユーザー操作を待ちます。');
                  
                  // 画面タップで再生を試みる
                  document.addEventListener('click', () => {
                    localVideo.play().catch(err => log('再試行エラー: ' + err));
                  }, { once: true });
                }
              });
            };
            
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
            if (usingFallbackMode) {
              activateFallbackMode();
            } else {
              startConnection();
            }
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
          if (usingFallbackMode) {
            activateFallbackMode();
          } else {
            startConnection();
          }
        }

        // ページを離れる前に接続を閉じる
        window.onbeforeunload = () => {
          if (localStream) {
            localStream.getTracks().forEach(track => track.stop());
          }
          if (peer) {
            peer.destroy();
          }
          clearInterval(fallbackInterval);
        };
        
        // iOS Safariでのカメラ表示問題対策
        if (mode === 'camera') {
          // iOSのSafariでのカメラ表示問題を解決するための追加対策
          document.addEventListener('click', () => {
            if (localVideo && localVideo.paused && localStream) {
              log('ユーザー操作によるビデオ再生試行');
              localVideo.play().catch(e => log('ビデオ再生エラー: ' + e));
            }
          }, { once: true });
          
          // ビデオ要素のサイズを明示的に設定
          setTimeout(() => {
            const videoWidth = localVideoContainer.clientWidth;
            const videoHeight = localVideoContainer.clientHeight;
            log(\`ビデオコンテナサイズ: \${videoWidth}x\${videoHeight}\`);
            
            // ビデオ要素のスタイルを強制的に設定
            localVideo.style.width = '100%';
            localVideo.style.height = '100%';
            localVideo.style.objectFit = 'contain';
            
            // ビデオ要素の表示を確認
            log(\`ローカルビデオ表示状態: \${window.getComputedStyle(localVideo).display}\`);
          }, 1000);
        }
        
        // 視聴モードでの追加対策
        if (mode === 'viewer') {
          // 定期的に接続状態を確認
          setInterval(() => {
            if (!usingFallbackMode && activeCall && activeCall.peerConnection) {
              const state = activeCall.peerConnection.iceConnectionState;
              log('ICE接続状態確認: ' + state);
              
              // 接続が切断された場合は再接続
              if (state === 'disconnected' || state === 'failed') {
                log('接続が切断されました。再接続を試みます。');
                connectToCamera();
              }
            }
          }, 10000);
          
          // ビデオ要素の表示を確認
          setTimeout(() => {
            if (remoteVideo) {
              const videoWidth = remoteVideoContainer.clientWidth;
              const videoHeight = remoteVideoContainer.clientHeight;
              log(\`リモートビデオコンテナサイズ: \${videoWidth}x\${videoHeight}\`);
              
              // ビデオ要素のスタイルを強制的に設定
              remoteVideo.style.width = '100%';
              remoteVideo.style.height = '100%';
              remoteVideo.style.objectFit = 'contain';
              
              // ビデオ要素の表示を確認
              log(\`リモートビデオ表示状態: \${window.getComputedStyle(remoteVideo).display}\`);
              
              // ビデオが再生されていない場合は再生を試みる
              if (remoteVideo.paused && remoteVideo.srcObject) {
                log('リモートビデオが一時停止中です。再生を試みます。');
                remoteVideo.play().catch(e => log('リモートビデオ再生エラー: ' + e));
              }
            }
          }, 3000);
        }
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
