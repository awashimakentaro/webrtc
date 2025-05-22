import { type NextRequest, NextResponse } from "next/server"

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const roomId = searchParams.get("room")
  const mode = searchParams.get("mode")
  const embedded = searchParams.get("embedded") === "true"

  if (!roomId || !mode) {
    return NextResponse.json({ error: "Room ID and mode are required" }, { status: 400 })
  }

  // MediaStreamを使用した効率的なビデオストリーミングのHTMLを返す
  return new NextResponse(
    `
    <!DOCTYPE html>
    <html lang="ja">
    <head>
      <title>リモートカメラ接続</title>
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
          width: 100%;
          height: 100vh;
          max-height: calc(100vh - 40px);
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
          display: flex;
          align-items: center;
          justify-content: center;
        }
        
        #local-video,
        #remote-video {
          width: 100%;
          height: 100%;
          object-fit: contain;
          background-color: #000;
        }
        
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
        
        #control-panel {
          position: absolute;
          bottom: 50px;
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
          max-width: 200px;
          opacity: 0.7;
        }
        
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
        
        #performance-stats {
          position: absolute;
          bottom: 40px;
          left: 10px;
          background: rgba(0,0,0,0.5);
          color: white;
          padding: 5px;
          font-size: 10px;
          z-index: 95;
          border-radius: 5px;
          max-width: 200px;
          opacity: 0.7;
        }
        
        #quality-controls {
          position: absolute;
          top: 50px;
          right: 10px;
          display: flex;
          flex-direction: column;
          gap: 5px;
          z-index: 95;
        }
        
        #quality-select {
          background: rgba(0,0,0,0.5);
          color: white;
          border: 1px solid rgba(255,255,255,0.3);
          border-radius: 5px;
          padding: 5px;
          font-size: 12px;
        }
        
        #debug-info {
          position: absolute;
          top: 10px;
          left: 10px;
          background: rgba(0,0,0,0.7);
          color: white;
          padding: 10px;
          font-size: 10px;
          z-index: 100;
          border-radius: 5px;
          max-width: 80%;
          max-height: 80%;
          overflow: auto;
          display: none;
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

        /* 画像キャプチャ用のキャンバス（非表示） */
        #capture-canvas {
          display: none;
          position: absolute;
          pointer-events: none;
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
          </div>
          <div class="connection-indicator" id="connection-indicator"></div>
          <!-- 画像キャプチャ用のキャンバス（非表示） -->
          <canvas id="capture-canvas"></canvas>
        </div>
        
        <div id="camera-info" class="${mode === "viewer" ? "hidden" : ""}"></div>
        
        <div id="camera-controls" class="${mode === "viewer" ? "hidden" : ""}">
          <button id="switch-camera-btn" class="btn">カメラ切替</button>
          <button id="torch-btn" class="btn" disabled>ライト</button>
          <select id="camera-select" class="hidden"></select>
        </div>
        
        <div id="quality-controls" class="${mode === "camera" ? "" : "hidden"}">
          <select id="quality-select">
            <option value="high">高画質</option>
            <option value="medium" selected>標準</option>
            <option value="low">低画質（高FPS）</option>
          </select>
        </div>
        
        <div id="control-panel">
          <button id="reconnect-btn" class="btn">再接続</button>
          <button id="debug-btn" class="btn">詳細情報</button>
        </div>
        
        <div id="status-bar">接続中...</div>
        <div id="performance-stats"></div>
        <div id="debug-info"></div>
      </div>

      <script>
        // DOM要素
        const app = document.getElementById('app');
        const videoContainer = document.getElementById('video-container');
        const localVideoContainer = document.getElementById('local-video-container');
        const remoteVideoContainer = document.getElementById('remote-video-container');
        const localVideo = document.getElementById('local-video');
        const remoteVideo = document.getElementById('remote-video');
        const statusBar = document.getElementById('status-bar');
        const reconnectBtn = document.getElementById('reconnect-btn');
        const debugBtn = document.getElementById('debug-btn');
        const switchCameraBtn = document.getElementById('switch-camera-btn');
        const torchBtn = document.getElementById('torch-btn');
        const cameraInfo = document.getElementById('camera-info');
        const cameraSelect = document.getElementById('camera-select');
        const connectionIndicator = document.getElementById('connection-indicator');
        const performanceStats = document.getElementById('performance-stats');
        const qualitySelect = document.getElementById('quality-select');
        const debugInfo = document.getElementById('debug-info');
        const captureCanvas = document.getElementById('capture-canvas');
        
        // デバッグログ配列
        let debugLogs = [];
        const MAX_DEBUG_LOGS = 100;
        
        // 再接続ボタン
        reconnectBtn.addEventListener('click', () => {
          location.reload();
        });
        
        // デバッグボタン
        debugBtn.addEventListener('click', () => {
          if (debugInfo.style.display === 'block') {
            debugInfo.style.display = 'none';
            debugBtn.textContent = '詳細情報';
          } else {
            debugInfo.style.display = 'block';
            debugBtn.textContent = '情報を隠す';
            updateDebugInfo();
          }
        });
        
        // ログ関数
        function log(message) {
          console.log(message);
          
          // デバッグログに追加
          const timestamp = new Date().toLocaleTimeString();
          debugLogs.push(\`[\${timestamp}] \${message}\`);
          
          // 最大数を超えたら古いログを削除
          if (debugLogs.length > MAX_DEBUG_LOGS) {
            debugLogs.shift();
          }
          
          // デバッグ情報を更新
          if (debugInfo.style.display === 'block') {
            updateDebugInfo();
          }
        }
        
        // デバッグ情報を更新
        function updateDebugInfo() {
          debugInfo.innerHTML = debugLogs.join('<br>');
          // 自動スクロール
          debugInfo.scrollTop = debugInfo.scrollHeight;
        }

        // 基本設定
        const roomId = "${roomId}";
        const mode = "${mode}";
        const embedded = ${embedded};
        let peer;
        let localStream;
        let remoteStream;
        let dataConnection;
        let mediaConnection;
        let currentFacingMode = "environment"; // デフォルトは背面カメラ
        let torchAvailable = false;
        let torchOn = false;
        let connectionStartTime = Date.now();
        let frameCount = 0;
        let lastFpsUpdate = Date.now();
        let fps = 0;
        let connectionRetries = 0;
        let maxConnectionRetries = 10;
        let connectionRetryDelay = 2000; // 2秒
        let currentPeerServer = 0; // 現在使用中のPeerJSサーバーインデックス
        let videoQuality = 'medium'; // デフォルトの品質設定
        let statsInterval = null; // 統計情報の更新間隔
        let captureInterval = null; // 画像キャプチャの間隔
        
        // PeerJSサーバーのリスト（フォールバック用）
        const peerServers = [
          { // デフォルトのPeerJSサーバー
            host: '0.peerjs.com',
            secure: true,
            port: 443,
            path: '/',
            key: 'peerjs'
          },
          { // バックアップサーバー1
            host: 'peerjs.herokuapp.com',
            secure: true,
            port: 443,
            path: '/',
            key: 'peerjs'
          },
          { // バックアップサーバー2 - カスタムサーバー
            host: 'peerjs-server.onrender.com',
            secure: true,
            port: 443,
            key: 'peerjs'
          }
        ];
        
        // 品質設定の変更イベント
        qualitySelect.addEventListener('change', () => {
          videoQuality = qualitySelect.value;
          log(\`品質設定変更: \${videoQuality}\`);
          
          if (localStream && mode === 'camera') {
            applyVideoConstraints();
          }
          
          // データ接続経由で視聴者に品質設定を通知
          if (dataConnection && dataConnection.open) {
            dataConnection.send({ 
              type: 'quality-change', 
              quality: videoQuality 
            });
          }
        });
        
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
              }, '*');
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
                ライト: \${torchAvailable ? (torchOn ? 'ON' : 'OFF') : '非対応'}<br>
                FPS: \${fps}<br>
                品質: \${videoQuality}
              \`;
            }
          }
        }
        
        // パフォーマンス情報を更新
        function updatePerformanceStats() {
          if (mode === 'viewer' && remoteVideo) {
            const videoWidth = remoteVideo.videoWidth || 0;
            const videoHeight = remoteVideo.videoHeight || 0;
            
            performanceStats.innerHTML = \`
              FPS: \${fps}<br>
              解像度: \${videoWidth}x\${videoHeight}<br>
              品質: \${videoQuality}
            \`;
            
            // 親ウィンドウに画像データを送信（人物検出用）
            if (embedded && window.parent && remoteVideo.videoWidth > 0) {
              captureAndSendFrame();
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
        
        // 品質設定に基づいてビデオ制約を適用
        function applyVideoConstraints() {
          if (!localStream) return;
          
          const videoTrack = localStream.getVideoTracks()[0];
          if (!videoTrack) return;
          
          let constraints = {};
          
          switch(videoQuality) {
            case 'high':
              constraints = {
                width: { ideal: 1280 },
                height: { ideal: 720 },
                frameRate: { ideal: 30 }
              };
              break;
            case 'medium':
              constraints = {
                width: { ideal: 640 },
                height: { ideal: 480 },
                frameRate: { ideal: 30 }
              };
              break;
            case 'low':
              constraints = {
                width: { ideal: 320 },
                height: { ideal: 240 },
                frameRate: { ideal: 60 } // 高FPS優先
              };
              break;
          }
          
          // 現在のfacingModeを維持
          if (currentFacingMode) {
            constraints.facingMode = { exact: currentFacingMode };
          }
          
          log(\`ビデオ制約を適用: \${JSON.stringify(constraints)}\`);
          
          videoTrack.applyConstraints(constraints)
            .then(() => {
              log('ビデオ制約の適用に成功しました');
              updateCameraInfo();
            })
            .catch(err => {
              log(\`ビデオ制約の適用に失敗: \${err}\`);
            });
        }
        
        // カメラを切り替える
        async function switchCamera(constraints = null) {
          if (!localStream) return;
          
          // 既存のトラックを停止
          localStream.getTracks().forEach(track => track.stop());
          
          // 新しいカメラ設定
          const newConstraints = constraints || {
            video: { 
              facingMode: { exact: currentFacingMode === 'environment' ? 'user' : 'environment' }
            },
            audio: false // 音声は不要
          };
          
          try {
            // 品質設定を適用
            if (!constraints) {
              switch(videoQuality) {
                case 'high':
                  newConstraints.video.width = { ideal: 1280 };
                  newConstraints.video.height = { ideal: 720 };
                  newConstraints.video.frameRate = { ideal: 30 };
                  break;
                case 'medium':
                  newConstraints.video.width = { ideal: 640 };
                  newConstraints.video.height = { ideal: 480 };
                  newConstraints.video.frameRate = { ideal: 30 };
                  break;
                case 'low':
                  newConstraints.video.width = { ideal: 320 };
                  newConstraints.video.height = { ideal: 240 };
                  newConstraints.video.frameRate = { ideal: 60 }; // 高FPS優先
                  break;
              }
            }
            
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
            
            // 既存の接続があれば、新しいストリームに置き換え
            if (mediaConnection && mediaConnection.open) {
              log('既存のメディア接続を更新します');
              mediaConnection.peerConnection.getSenders().forEach(sender => {
                if (sender.track.kind === 'video') {
                  const newVideoTrack = localStream.getVideoTracks()[0];
                  if (newVideoTrack) {
                    sender.replaceTrack(newVideoTrack);
                  }
                }
              });
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
        
        // 画像をキャプチャして親ウィンドウに送信（人物検出用）
        function captureAndSendFrame() {
          if (!remoteVideo || !captureCanvas || remoteVideo.videoWidth === 0) return;
          
          try {
            // キャンバスのサイズをビデオに合わせる
            captureCanvas.width = remoteVideo.videoWidth;
            captureCanvas.height = remoteVideo.videoHeight;
            
            // キャンバスにビデオフレームを描画
            const ctx = captureCanvas.getContext('2d');
            ctx.drawImage(remoteVideo, 0, 0, captureCanvas.width, captureCanvas.height);
            
            // 画像データをBase64に変換
            const imageData = captureCanvas.toDataURL('image/jpeg', 0.7);
            
            // 親ウィンドウに送信
            if (window.parent) {
              window.parent.postMessage({ 
                type: 'image-data', 
                data: imageData,
                width: captureCanvas.width,
                height: captureCanvas.height
              }, '*');
            }
          } catch (e) {
            log('フレームキャプチャエラー: ' + e);
          }
        }
        
        // 次のPeerJSサーバーに切り替え
        function switchToNextPeerServer() {
          currentPeerServer = (currentPeerServer + 1) % peerServers.length;
          log(\`PeerJSサーバーを切り替え: \${peerServers[currentPeerServer].host}\`);
          return peerServers[currentPeerServer];
        }
        
        // PeerJS接続を開始
        function startConnection() {
          // 既存の接続を閉じる
          if (peer) {
            try {
              peer.destroy();
            } catch (e) {
              log('既存のピア接続を閉じる際にエラー: ' + e);
            }
          }
          
          // ピアIDの設定
          const peerId = mode === 'camera' ? 'camera-' + roomId : 'viewer-' + roomId;
          
          // 現在のサーバー設定を取得
          const serverConfig = peerServers[currentPeerServer];
          log(\`PeerJS初期化: \${peerId} (サーバー: \${serverConfig.host})\`);
          
          // PeerJSの設定
          const peerConfig = {
            debug: 2,
            host: serverConfig.host,
            secure: serverConfig.secure,
            port: serverConfig.port,
            path: serverConfig.path,
            key: serverConfig.key,
            config: {
              'iceServers': [
                { urls: 'stun:stun.l.google.com:19302' },
                { urls: 'stun:stun1.l.google.com:19302' },
                { urls: 'stun:stun2.l.google.com:19302' },
                { urls: 'stun:stun3.l.google.com:19302' },
                { urls: 'stun:stun4.l.google.com:19302' },
                { urls: 'stun:stun.stunprotocol.org:3478' },
                { urls: 'stun:stun.ekiga.net:3478' },
                { urls: 'stun:stun.ideasip.com:3478' },
                { urls: 'stun:stun.voiparound.com:3478' }
              ]
            }
          };
          
          // PeerJSインスタンスの作成
          try {
            peer = new Peer(peerId, peerConfig);
            
            // 接続イベント
            peer.on('open', id => {
              log('ピア接続確立: ' + id);
              updateStatus('ピアサーバーに接続しました');
              connectionRetries = 0; // 接続成功したらリトライカウントをリセット
              
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
              log('ピアエラー: ' + err.type + ' - ' + (err.message || ''));
              updateStatus('エラーが発生しました: ' + err.type);
              
              // 既に使用されているIDの場合は、ランダムなIDで再試行
              if (err.type === 'unavailable-id') {
                const randomId = Math.random().toString(36).substring(2, 8);
                const newPeerId = mode === 'camera' ? 'camera-' + randomId : 'viewer-' + randomId;
                log('新しいIDで再試行: ' + newPeerId);
                
                // 既存のピアを破棄して新しいピアを作成
                if (peer) {
                  try {
                    peer.destroy();
                  } catch (e) {
                    log('ピア破棄エラー: ' + e);
                  }
                }
                
                peer = new Peer(newPeerId, peerConfig);
              } else if (err.type === 'peer-unavailable') {
                // ピアが見つからない場合は再接続を提案
                updateStatus('カメラが見つかりません - 再接続してください');
                
                // 一定回数まで自動再試行
                if (connectionRetries < maxConnectionRetries) {
                  connectionRetries++;
                  log(\`接続再試行 (\${connectionRetries}/\${maxConnectionRetries})...\`);
                  setTimeout(() => {
                    if (mode === 'viewer') {
                      connectToCamera();
                    }
                  }, connectionRetryDelay);
                }
              } else if (err.type === 'network' || err.type === 'disconnected' || err.type === 'server-error') {
                // ネットワークエラーまたはサーバーエラーの場合は別のサーバーに切り替え
                log('ネットワークまたはサーバーエラー - 別のサーバーに切り替えます');
                
                // 次のサーバーに切り替え
                switchToNextPeerServer();
                
                // 少し待ってから再接続
                setTimeout(() => {
                  startConnection();
                }, 2000);
              }
            });
            
            // 切断イベント
            peer.on('disconnected', () => {
              log('ピアサーバーから切断されました');
              updateStatus('サーバーから切断されました - 再接続中...');
              
              // 自動再接続を試みる
              setTimeout(() => {
                // 次のサーバーに切り替え
                switchToNextPeerServer();
                
                // 再接続
                startConnection();
              }, 2000);
            });
            
            // カメラモードの場合のメディア接続処理
            if (mode === 'camera') {
              // メディア接続処理
              peer.on('call', call => {
                log('メディア接続要求を受信しました');
                mediaConnection = call;
                
                // ローカルストリームで応答
                call.answer(localStream);
                
                call.on('stream', stream => {
                  log('リモートストリームを受信しました（カメラモード）');
                });
                
                call.on('close', () => {
                  log('メディア接続が閉じられました');
                  updateStatus('視聴者との接続が終了しました');
                });
                
                call.on('error', err => {
                  log('メディア接続エラー: ' + err);
                });
              });
              
              // データ接続処理
              peer.on('connection', conn => {
                log('データ接続要求を受信しました');
                dataConnection = conn;
                
                conn.on('open', () => {
                  log('データチャネルオープン');
                  updateStatus('視聴者と接続しました');
                  
                  // 定期的にステータスを送信
                  setInterval(() => {
                    if (conn.open) {
                      conn.send({ 
                        type: 'status', 
                        streaming: true,
                        quality: videoQuality,
                        timestamp: Date.now() 
                      });
                    }
                  }, 5000);
                });
                
                conn.on('data', data => {
                  log('データ受信: ' + JSON.stringify(data));
                  
                  // pingに対してpongで応答
                  if (data.type === 'ping') {
                    conn.send({ type: 'pong', timestamp: Date.now() });
                  }
                  
                  // 品質設定の変更リクエスト
                  if (data.type === 'quality-change') {
                    log('品質設定変更リクエスト: ' + data.quality);
                    videoQuality = data.quality;
                    qualitySelect.value = data.quality;
                    applyVideoConstraints();
                  }
                });
                
                conn.on('close', () => {
                  log('データ接続終了');
                  updateStatus('視聴者との接続が終了しました');
                });
                
                conn.on('error', err => {
                  log('データ接続エラー: ' + err);
                });
              });
            }
          } catch (err) {
            log('PeerJS初期化エラー: ' + err);
            updateStatus('接続初期化エラー: ' + err);
            
            // 次のサーバーに切り替えて再試行
            setTimeout(() => {
              switchToNextPeerServer();
              startConnection();
            }, 2000);
          }
        }
        
        // 視聴モードでカメラに接続
        function connectToCamera() {
          const targetId = 'camera-' + roomId;
          log('カメラに接続: ' + targetId);
          updateStatus('カメラに接続中...');
          
          // 接続開始時間を記録
          connectionStartTime = Date.now();
          
          try {
            // データ接続
            dataConnection = peer.connect(targetId, {
              reliable: true,
              serialization: 'json'
            });
            
            dataConnection.on('open', () => {
              log('データ接続確立（視聴モード）');
              
              // メディア接続を確立
              log('メディア接続を開始します');
              mediaConnection = peer.call(targetId, new MediaStream()); // 空のストリームで発信
              
              mediaConnection.on('stream', stream => {
                log('リモートストリームを受信しました（視聴モード）');
                remoteStream = stream;
                remoteVideo.srcObject = stream;
                
                // 統計情報の更新を開始
                startStatsUpdates();
                
                // 画像キャプチャを開始（人物検出用）
                startFrameCapture();
                
                updateStatus('カメラと接続しました');
                connectionRetries = 0; // 接続成功したらリトライカウントをリセット
              });
              
              mediaConnection.on('close', () => {
                log('メディア接続が閉じられました');
                updateStatus('カメラとの接続が終了しました');
                stopStatsUpdates();
                stopFrameCapture();
              });
              
              mediaConnection.on('error', err => {
                log('メディア接続エラー: ' + err);
              });
              
              // pingを送信
              dataConnection.send({ type: 'ping', timestamp: Date.now() });
              
              // 品質設定の変更を送信
              dataConnection.send({ 
                type: 'quality-change', 
                quality: videoQuality
              });
              
              // 定期的にpingを送信
              setInterval(() => {
                if (dataConnection && dataConnection.open) {
                  dataConnection.send({ type: 'ping', timestamp: Date.now() });
                }
              }, 10000);
            });
            
            dataConnection.on('data', data => {
              // カメラからのステータス更新
              if (data.type === 'status' && data.streaming) {
                updateStatus(\`接続済み - 品質: \${data.quality}\`);
                videoQuality = data.quality;
              }
              
              // pongの受信（レイテンシ計測）
              if (data.type === 'pong') {
                const latency = Date.now() - data.timestamp;
                log(\`レイテンシ: \${latency}ms\`);
              }
            });
            
            dataConnection.on('error', err => {
              log('データ接続エラー: ' + err);
              updateStatus('接続エラー: ' + err);
            });
            
            dataConnection.on('close', () => {
              log('データ接続終了');
              updateStatus('カメラとの接続が終了しました');
              
              // 一定回数まで自動再接続
              if (connectionRetries < maxConnectionRetries) {
                connectionRetries++;
                log(\`接続再試行 (\${connectionRetries}/\${maxConnectionRetries})...\`);
                setTimeout(() => {
                  connectToCamera();
                }, connectionRetryDelay);
              }
            });
          } catch (err) {
            log('接続エラー: ' + err);
            updateStatus('接続エラー: ' + err);
            
            // 次のサーバーに切り替えて再試行
            setTimeout(() => {
              switchToNextPeerServer();
              startConnection();
            }, 2000);
          }
        }
        
        // 統計情報の更新を開始
        function startStatsUpdates() {
          if (statsInterval) {
            clearInterval(statsInterval);
          }
          
          let lastFrameCount = 0;
          let frameCountStart = Date.now();
          
          statsInterval = setInterval(() => {
            if (remoteVideo && remoteVideo.videoWidth > 0) {
              // FPSの計算
              const currentFrames = remoteVideo.getVideoPlaybackQuality?.() || { totalVideoFrames: 0 };
              const currentFrameCount = currentFrames.totalVideoFrames || 0;
              const framesDelta = currentFrameCount - lastFrameCount;
              const timeElapsed = (Date.now() - frameCountStart) / 1000;
              
              if (timeElapsed > 0 && lastFrameCount > 0) {
                fps = Math.round(framesDelta / timeElapsed);
              }
              
              lastFrameCount = currentFrameCount;
              frameCountStart = Date.now();
              
              // 統計情報を更新
              updatePerformanceStats();
            }
          }, 1000);
        }
        
        // 統計情報の更新を停止
        function stopStatsUpdates() {
          if (statsInterval) {
            clearInterval(statsInterval);
            statsInterval = null;
          }
        }
        
        // 画像キャプチャを開始（人物検出用）
        function startFrameCapture() {
          if (captureInterval) {
            clearInterval(captureInterval);
          }
          
          // 埋め込みモードの場合のみ実行
          if (embedded && window.parent) {
            captureInterval = setInterval(() => {
              captureAndSendFrame();
            }, 200); // 5FPSでキャプチャ
          }
        }
        
        // 画像キャプチャを停止
        function stopFrameCapture() {
          if (captureInterval) {
            clearInterval(captureInterval);
            captureInterval = null;
          }
        }
        
        // ブラウザの互換性チェック
        function checkBrowserCompatibility() {
          const browser = {
            name: '',
            version: '',
            isCompatible: true,
            issues: []
          };
          
          const ua = navigator.userAgent;
          
          if (ua.includes('Safari') && !ua.includes('Chrome') && !ua.includes('Firefox')) {
            browser.name = 'Safari';
            // Safariバージョンの抽出
            const versionMatch = ua.match(/Version\\/(\\d+\\.\\d+)/);
            browser.version = versionMatch ? versionMatch[1] : 'unknown';
            
            if (parseFloat(browser.version) < 13) {
              browser.isCompatible = false;
              browser.issues.push('Safari 13未満はWebRTCの完全サポートがありません');
            }
          }
          
          // iOSの検出
          if (/iPad|iPhone|iPod/.test(ua)) {
            browser.name += ' on iOS';
            browser.issues.push('iOS端末ではWebRTCに制限があります');
          }
          
          log('ブラウザ互換性: ' + JSON.stringify(browser));
          return browser;
        }
        
        // ブラウザ互換性チェックを実行
        const browserCompat = checkBrowserCompatibility();
        if (!browserCompat.isCompatible) {
          log('警告: このブラウザはWebRTCとの完全な互換性がありません');
          updateStatus('警告: ブラウザの互換性に問題があります - ' + browserCompat.issues.join(', '));
        }
        
        // カメラモードの場合はカメラを起動
        if (mode === 'camera') {
          // カメラへのアクセス
          const videoConstraints = { 
            facingMode: { ideal: "environment" },
            width: { ideal: 640 },
            height: { ideal: 480 },
            frameRate: { ideal: 30 }
          };
          
          // 品質設定に基づいて制約を調整
          switch(videoQuality) {
            case 'high':
              videoConstraints.width = { ideal: 1280 };
              videoConstraints.height = { ideal: 720 };
              videoConstraints.frameRate = { ideal: 30 };
              break;
            case 'medium':
              videoConstraints.width = { ideal: 640 };
              videoConstraints.height = { ideal: 480 };
              videoConstraints.frameRate = { ideal: 30 };
              break;
            case 'low':
              videoConstraints.width = { ideal: 320 };
              videoConstraints.height = { ideal: 240 };
              videoConstraints.frameRate = { ideal: 60 }; // 高FPS優先
              break;
          }
          
          navigator.mediaDevices.getUserMedia({ 
            video: videoConstraints, 
            audio: false // 音声は不要
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
          
          // リモートビデオの初期設定
          remoteVideo.style.width = '100%';
          remoteVideo.style.height = '100%';
          remoteVideo.style.objectFit = 'contain';
          
          // 接続開始
          startConnection();
          
          // パフォーマンス情報の表示
          performanceStats.style.display = 'block';
        }

        // ページを離れる前に接続を閉じる
        window.onbeforeunload = () => {
          if (localStream) {
            localStream.getTracks().forEach(track => track.stop());
          }
          if (peer) {
            peer.destroy();
          }
          stopStatsUpdates();
          stopFrameCapture();
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
            if (mediaConnection && !mediaConnection.open) {
              log('メディア接続が切断されました。再接続を試みます。');
              connectToCamera();
            }
          }, 10000);
          
          // リモートビデオの再生イベント
          remoteVideo.onplaying = () => {
            log('リモートビデオの再生開始');
            updateStatus('カメラ映像を受信中');
          };
        }
        
        // 親ウィンドウからのメッセージを受信
        window.addEventListener('message', (event) => {
          // 品質設定の変更
          if (event.data && event.data.type === 'quality-change') {
            log('親ウィンドウから品質設定変更: ' + event.data.quality);
            videoQuality = event.data.quality;
            qualitySelect.value = event.data.quality;
            
            // カメラモードの場合は制約を適用
            if (mode === 'camera') {
              applyVideoConstraints();
            }
            
            // 視聴モードの場合はカメラに通知
            if (mode === 'viewer' && dataConnection && dataConnection.open) {
              dataConnection.send({ 
                type: 'quality-change', 
                quality: videoQuality 
              });
            }
          }
        });
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
