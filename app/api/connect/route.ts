import { type NextRequest, NextResponse } from "next/server"

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const roomId = searchParams.get("room")
  const mode = searchParams.get("mode")
  const embedded = searchParams.get("embedded") === "true"

  if (!roomId || !mode) {
    return NextResponse.json({ error: "Room ID and mode are required" }, { status: 400 })
  }

  // 最適化されたデータチャネル + 画像転送方式のHTMLを返す
  return new NextResponse(
    `
    <!DOCTYPE html>
    <html lang="ja">
    <head>
      <title>リモートカメラ接続</title>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale: 1.0">
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
        #remote-image-container {
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
        
        #local-video {
          width: 100%;
          height: 100%;
          object-fit: contain;
          background-color: #000;
        }
        
        #remote-image {
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
          <div id="remote-image-container" class="${mode === "camera" ? "hidden" : ""}">
            <img id="remote-image" alt="カメラ映像" />
          </div>
          <div class="connection-indicator" id="connection-indicator"></div>
        </div>
        
        <div id="camera-info" class="${mode === "viewer" ? "hidden" : ""}"></div>
        
        <div id="camera-controls" class="${mode === "viewer" ? "hidden" : ""}">
          <button id="switch-camera-btn" class="btn">カメラ切替</button>
          <button id="torch-btn" class="btn" disabled>ライト</button>
          <select id="camera-select" class="hidden"></select>
        </div>
        
        <div id="quality-controls" class="${mode === "camera" ? "" : "hidden"}">
          <select id="quality-select">
            <option value="high">高画質 (低FPS)</option>
            <option value="medium" selected>標準 (中FPS)</option>
            <option value="low">低画質 (高FPS)</option>
          </select>
        </div>
        
        <div id="control-panel">
          <button id="reconnect-btn" class="btn">再接続</button>
          <button id="fit-toggle-btn" class="btn">表示切替</button>
        </div>
        
        <button id="debug-btn" class="btn" style="position: fixed; bottom: 40px; right: 10px; z-index: 100; font-size: 12px; padding: 5px 10px; opacity: 0.5; min-width: auto;">デバッグ</button>
        
        <div id="status-bar">接続中...</div>
        <div id="debug-panel"></div>
        <div id="performance-stats"></div>
      </div>

      <script>
        // DOM要素
        const app = document.getElementById('app');
        const videoContainer = document.getElementById('video-container');
        const localVideoContainer = document.getElementById('local-video-container');
        const remoteImageContainer = document.getElementById('remote-image-container');
        const localVideo = document.getElementById('local-video');
        const remoteImage = document.getElementById('remote-image');
        const statusBar = document.getElementById('status-bar');
        const debugPanel = document.getElementById('debug-panel');
        const debugBtn = document.getElementById('debug-btn');
        const reconnectBtn = document.getElementById('reconnect-btn');
        const switchCameraBtn = document.getElementById('switch-camera-btn');
        const torchBtn = document.getElementById('torch-btn');
        const cameraInfo = document.getElementById('camera-info');
        const cameraSelect = document.getElementById('camera-select');
        const connectionIndicator = document.getElementById('connection-indicator');
        const fitToggleBtn = document.getElementById('fit-toggle-btn');
        const performanceStats = document.getElementById('performance-stats');
        const qualitySelect = document.getElementById('quality-select');

        // 表示切替ボタンのイベントリスナー
        fitToggleBtn.addEventListener('click', toggleVideoFit);
        
        // デバッグ表示の切り替え
        debugBtn.addEventListener('click', () => {
          debugPanel.style.display = debugPanel.style.display === 'none' ? 'block' : 'none';
        });
        
        // 再接続ボタン
        reconnectBtn.addEventListener('click', () => {
          location.reload();
        });
        
        // 初期状態ではデバッグを表示（問題診断のため）
        debugPanel.style.display = 'block';
        
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
        let peer;
        let localStream;
        let connection;
        let currentFacingMode = "environment"; // デフォルトは背面カメラ
        let torchAvailable = false;
        let torchOn = false;
        let connectionStartTime = Date.now();
        let frameCount = 0;
        let lastFpsUpdate = Date.now();
        let fps = 0;
        let totalBytesTransferred = 0;
        let lastBytesUpdate = Date.now();
        let bytesPerSecond = 0;
        let frameInterval = 100; // デフォルトは10fps
        let imageQuality = 0.7; // デフォルトの画質
        let imageResolution = { width: 640, height: 480 }; // デフォルトの解像度
        let frameIntervalId = null;
        
        // 品質設定の変更イベント
        qualitySelect.addEventListener('change', () => {
          const quality = qualitySelect.value;
          
          switch(quality) {
            case 'high':
              frameInterval = 200; // 5fps
              imageQuality = 0.9;
              imageResolution = { width: 1280, height: 720 };
              break;
            case 'medium':
              frameInterval = 100; // 10fps
              imageQuality = 0.7;
              imageResolution = { width: 640, height: 480 };
              break;
            case 'low':
              frameInterval = 50; // 20fps
              imageQuality = 0.5;
              imageResolution = { width: 480, height: 360 };
              break;
          }
          
          log(\`品質設定変更: \${quality}, FPS: \${1000/frameInterval}, 品質: \${imageQuality}, 解像度: \${imageResolution.width}x\${imageResolution.height}\`);
          
          // フレーム送信を再開
          if (mode === 'camera') {
            stopFrameSending();
            startFrameSending();
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
                ライト: \${torchAvailable ? (torchOn ? 'ON' : 'OFF') : '非対応'}<br>
                FPS: \${fps}<br>
                転送速度: \${(bytesPerSecond / 1024).toFixed(1)} KB/s
              \`;
            }
          }
        }
        
        // パフォーマンス情報を更新
        function updatePerformanceStats() {
          if (mode === 'viewer') {
            performanceStats.innerHTML = \`
              FPS: \${fps}<br>
              受信速度: \${(bytesPerSecond / 1024).toFixed(1)} KB/s<br>
              総受信量: \${(totalBytesTransferred / (1024 * 1024)).toFixed(2)} MB
            \`;
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
              width: { ideal: imageResolution.width },
              height: { ideal: imageResolution.height }
            },
            audio: false // 音声は不要
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
            
            // フレーム送信を再開
            if (mode === 'camera') {
              stopFrameSending();
              startFrameSending();
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
        
        // ビデオ表示モードの切り替え（contain/cover）
        function toggleVideoFit() {
          const elements = [localVideo, remoteImage];
          
          elements.forEach(element => {
            if (element) {
              const currentFit = element.style.objectFit;
              element.style.objectFit = currentFit === 'cover' ? 'contain' : 'cover';
              log(\`表示モード: \${element.style.objectFit}\`);
            }
          });
        }

        // ダブルタップでビデオ表示モードを切り替える
        videoContainer.addEventListener('dblclick', toggleVideoFit);

        // タッチデバイス用のダブルタップ検出
        let lastTap = 0;
        videoContainer.addEventListener('touchend', function(e) {
          const currentTime = new Date().getTime();
          const tapLength = currentTime - lastTap;
          if (tapLength < 500 && tapLength > 0) {
            toggleVideoFit();
            e.preventDefault();
          }
          lastTap = currentTime;
        });
        
        // フレーム送信を開始
        function startFrameSending() {
          if (mode !== 'camera' || !localStream || frameIntervalId) return;
          
          log(\`フレーム送信開始: 間隔=\${frameInterval}ms, 品質=\${imageQuality}, 解像度=\${imageResolution.width}x\${imageResolution.height}\`);
          
          // キャンバスを作成
          const canvas = document.createElement('canvas');
          const context = canvas.getContext('2d');
          
          // 実際のビデオサイズを取得するための関数
          const updateCanvasSize = () => {
            // 実際のビデオの幅と高さを取得
            const videoWidth = localVideo.videoWidth;
            const videoHeight = localVideo.videoHeight;
            
            if (videoWidth && videoHeight) {
              // アスペクト比を計算
              const aspectRatio = videoWidth / videoHeight;
              
              // 目標解像度に基づいて、アスペクト比を維持したサイズを計算
              if (aspectRatio > 1) { // 横長の場合
                canvas.width = imageResolution.width;
                canvas.height = Math.round(imageResolution.width / aspectRatio);
              } else { // 縦長または正方形の場合
                canvas.height = imageResolution.height;
                canvas.width = Math.round(imageResolution.height * aspectRatio);
              }
              
              log(\`ビデオ実寸: \${videoWidth}x\${videoHeight}, アスペクト比: \${aspectRatio.toFixed(2)}, キャンバスサイズ: \${canvas.width}x\${canvas.height}\`);
            }
          };
          
          // 初回のキャンバスサイズ更新
          updateCanvasSize();
          
          // ビデオのサイズが変わった場合に再計算
          localVideo.addEventListener('resize', updateCanvasSize);
          
          frameIntervalId = setInterval(() => {
            if (!localStream || !connection || !connection.open) return;
            
            try {
              // ビデオサイズが変わっていないか確認
              if (localVideo.videoWidth > 0 && 
                  (canvas.width !== localVideo.videoWidth || 
                   canvas.height !== localVideo.videoHeight)) {
                updateCanvasSize();
              }
              
              // ローカルビデオからキャンバスに描画（アスペクト比を維持）
              context.clearRect(0, 0, canvas.width, canvas.height);
              context.drawImage(localVideo, 0, 0, canvas.width, canvas.height);
              
              // 画像データをBase64に変換
              const imageData = canvas.toDataURL('image/jpeg', imageQuality);
              
              // 画像データを送信
              connection.send({
                type: 'image',
                data: imageData,
                timestamp: Date.now(),
                frameNumber: frameCount++,
                width: canvas.width,
                height: canvas.height
              });
              
              // 転送量を計算
              totalBytesTransferred += imageData.length;
              
              // FPSと転送速度を計算
              const now = Date.now();
              if (now - lastFpsUpdate > 1000) {
                fps = frameCount;
                frameCount = 0;
                bytesPerSecond = totalBytesTransferred - (lastBytesUpdate || 0);
                lastBytesUpdate = totalBytesTransferred;
                lastFpsUpdate = now;
                
                // 情報を更新
                updateCameraInfo();
              }
            } catch (err) {
              log('フレーム送信エラー: ' + err);
            }
          }, frameInterval);
        }
        
        // フレーム送信を停止
        function stopFrameSending() {
          if (frameIntervalId) {
            clearInterval(frameIntervalId);
            frameIntervalId = null;
            log('フレーム送信停止');
          }
        }
        
        // PeerJS接続を開始
        function startConnection() {
          // ピアIDの設定
          const peerId = mode === 'camera' ? 'camera-' + roomId : 'viewer-' + roomId;
          
          log('PeerJS初期化: ' + peerId);
          
          // PeerJSの設定
          const peerConfig = {
            debug: 2,
            config: {
              'iceServers': [
                { urls: 'stun:stun.l.google.com:19302' },
                { urls: 'stun:stun1.l.google.com:19302' },
                { urls: 'stun:stun2.l.google.com:19302' },
                { urls: 'stun:stun3.l.google.com:19302' },
                { urls: 'stun:stun4.l.google.com:19302' }
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
              // ピアが見つからない場合は再接続を提案
              updateStatus('カメラが見つかりません - 再接続してください');
            } else if (err.type === 'network' || err.type === 'disconnected') {
              // ネットワークエラーの場合は再接続
              log('ネットワークエラー - 再接続を試みます');
              setTimeout(() => {
                startConnection();
              }, 3000);
            }
          });
          
          // カメラモードの場合のデータ接続処理
          if (mode === 'camera') {
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
                
                // 品質設定の変更リクエスト
                if (data.type === 'quality-change') {
                  log('品質設定変更リクエスト: ' + data.quality);
                  qualitySelect.value = data.quality;
                  qualitySelect.dispatchEvent(new Event('change'));
                }
              });
              
              conn.on('open', () => {
                log('データチャネルオープン');
                updateStatus('視聴者と接続しました');
                
                // フレーム送信を開始
                startFrameSending();
                
                // 定期的にステータスを送信
                setInterval(() => {
                  if (conn.open) {
                    conn.send({ 
                      type: 'status', 
                      streaming: true,
                      fps: fps,
                      quality: qualitySelect.value,
                      resolution: \`\${imageResolution.width}x\${imageResolution.height}\`,
                      timestamp: Date.now() 
                    });
                  }
                }, 5000);
              });
              
              conn.on('close', () => {
                log('データ接続終了');
                updateStatus('視聴者との接続が終了しました');
                stopFrameSending();
              });
            });
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
            connection = peer.connect(targetId);
            
            connection.on('open', () => {
              log('データ接続確立（視聴モード）');
              updateStatus('カメラとデータ接続しました');
              
              // pingを送信
              connection.send({ type: 'ping', timestamp: Date.now() });
              
              // 品質設定の変更を送信
              connection.send({ 
                type: 'quality-change', 
                quality: 'medium' // デフォルトは中品質
              });
              
              // 定期的にpingを送信
              setInterval(() => {
                if (connection && connection.open) {
                  connection.send({ type: 'ping', timestamp: Date.now() });
                }
              }, 10000);
            });
            
            connection.on('data', data => {
              // 画像データの受信
              if (data.type === 'image') {
                remoteImage.src = data.data;
                
                // 画像のサイズ情報があれば設定
                if (data.width && data.height) {
                  // アスペクト比を維持するためのスタイル設定
                  remoteImage.style.aspectRatio = \`\${data.width} / \${data.height}\`;
                }
                
                // 転送量を計算
                totalBytesTransferred += data.data.length;
                
                // フレームカウントを増加
                frameCount++;
                
                // FPSと転送速度を計算
                const now = Date.now();
                if (now - lastFpsUpdate > 1000) {
                  fps = frameCount;
                  frameCount = 0;
                  bytesPerSecond = totalBytesTransferred - (lastBytesUpdate || 0);
                  lastBytesUpdate = totalBytesTransferred;
                  lastFpsUpdate = now;
                  
                  // パフォーマンス情報を更新
                  updatePerformanceStats();
                }
                
                // 人物検出モードの場合、親ウィンドウに画像データを送信
                if (embedded && window.parent) {
                  try {
                    window.parent.postMessage({ 
                      type: 'image-data', 
                      data: data.data,
                      width: data.width,
                      height: data.height
                    }, '*'); // オリジン制限を緩和
                  } catch (e) {
                    log('画像データ送信エラー: ' + e);
                  }
                }
              }
              
              // カメラからのステータス更新
              if (data.type === 'status' && data.streaming) {
                updateStatus(\`接続済み - FPS: \${data.fps}, 品質: \${data.quality}, 解像度: \${data.resolution}\`);
              }
              
              // pongの受信（レイテンシ計測）
              if (data.type === 'pong') {
                const latency = Date.now() - data.timestamp;
                log(\`レイテンシ: \${latency}ms\`);
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
          navigator.mediaDevices.getUserMedia({ 
            video: { 
              facingMode: { ideal: "environment" },
              width: { ideal: imageResolution.width },
              height: { ideal: imageResolution.height },
              aspectRatio: { ideal: 4/3 } // 一般的なアスペクト比を指定
            }, 
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
          
          // リモート画像の初期設定
          remoteImage.style.width = '100%';
          remoteImage.style.height = '100%';
          remoteImage.style.objectFit = 'contain';
          
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
          stopFrameSending();
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
            if (connection && !connection.open) {
              log('接続が切断されました。再接続を試みます。');
              connectToCamera();
            }
          }, 10000);
        }
        
        // 親ウィンドウからのメッセージを受信
        window.addEventListener('message', (event) => {
          if (event.origin === window.location.origin) {
            // 品質設定の変更
            if (event.data && event.data.type === 'quality-change') {
              log('親ウィンドウから品質設定変更: ' + event.data.quality);
              qualitySelect.value = event.data.quality;
              qualitySelect.dispatchEvent(new Event('change'));
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
