import { type NextRequest, NextResponse } from "next/server"

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const roomId = searchParams.get("room")
  const mode = searchParams.get("mode")

  if (!roomId || !mode) {
    return NextResponse.json({ error: "Room ID and mode are required" }, { status: 400 })
  }

  // 文字化けを防ぐためにシンプルなHTMLを返す
  return new NextResponse(
    `<!DOCTYPE html>
<html>
<head>
  <title>WebRTC Connection</title>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <script src="https://unpkg.com/peerjs@1.4.7/dist/peerjs.min.js"></script>
  <style>
    body { margin: 0; font-family: sans-serif; background-color: #f5f5f5; color: #333; }
    #status { padding: 20px; text-align: center; background-color: #fff; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
    #debug { padding: 10px; margin: 10px; background-color: #f0f0f0; border-radius: 5px; font-size: 12px; white-space: pre-wrap; display: none; }
    video { 
      width: 100%; 
      height: 100vh; 
      object-fit: cover; 
      background-color: #000; 
      display: block;
    }
    .hidden { 
      display: none !important; 
    }
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
      padding: 12px 24px;
      background: #000;
      color: white;
      border: none;
      border-radius: 24px;
      font-weight: bold;
      opacity: 0.8;
      box-shadow: 0 2px 8px rgba(0,0,0,0.2);
    }
    #showDebug {
      position: fixed;
      top: 10px;
      right: 10px;
      background: rgba(0,0,0,0.5);
      color: white;
      border: none;
      border-radius: 50%;
      width: 30px;
      height: 30px;
      font-size: 16px;
      line-height: 1;
      z-index: 100;
    }
  </style>
</head>
<body>
  <div id="status">接続中...</div>
  <div id="debug"></div>
  <video id="localVideo" autoplay playsinline muted class="hidden"></video>
  <video id="remoteVideo" autoplay playsinline class="hidden"></video>
  
  <button id="showDebug">?</button>
  
  <div id="controls" class="hidden">
    <button id="switchCamera">カメラ切替</button>
    <button id="hangup">切断</button>
  </div>

  <script>
    // ルームIDとモードを取得
    const roomId = "${roomId}";
    const mode = "${mode}";
    
    // DOM要素
    const statusDiv = document.getElementById('status');
    const debugDiv = document.getElementById('debug');
    const localVideo = document.getElementById('localVideo');
    const remoteVideo = document.getElementById('remoteVideo');
    const controls = document.getElementById('controls');
    const switchCameraBtn = document.getElementById('switchCamera');
    const hangupBtn = document.getElementById('hangup');
    const showDebugBtn = document.getElementById('showDebug');
    
    // 変数
    let peer;
    let currentCall;
    let localStream;
    let facingMode = "environment"; // デフォルトは背面カメラ
    let debugLog = [];
    
    // デバッグログ関数
    function log(message) {
      const timestamp = new Date().toLocaleTimeString();
      const logMessage = "[" + timestamp + "] " + message;
      console.log(logMessage);
      debugLog.push(logMessage);
      debugDiv.textContent = debugLog.join('\\n');
    }
    
    // デバッグ表示切替
    showDebugBtn.addEventListener('click', () => {
      if (debugDiv.style.display === 'none' || !debugDiv.style.display) {
        debugDiv.style.display = 'block';
      } else {
        debugDiv.style.display = 'none';
      }
    });
    
    // PeerJSの初期化
    function initPeer() {
      try {
        // 予測可能なIDを使用（ランダムサフィックスなし）
        const peerId = mode === "camera" 
          ? roomId + "-camera"
          : roomId + "-viewer";
        
        log("PeerJS初期化開始: " + peerId);
        
        // 複数のICEサーバーを設定
        peer = new Peer(peerId, {
          debug: 2,
          config: {
            'iceServers': [
              { urls: 'stun:stun.l.google.com:19302' },
              { urls: 'stun:stun1.l.google.com:19302' },
              { urls: 'stun:stun2.l.google.com:19302' },
              { urls: 'stun:stun3.l.google.com:19302' },
              { urls: 'stun:stun4.l.google.com:19302' },
              { urls: 'stun:stun.stunprotocol.org:3478' },
              // 無料のTURNサーバー
              {
                urls: 'turn:openrelay.metered.ca:80',
                username: 'openrelayproject',
                credential: 'openrelayproject'
              }
            ]
          }
        });
        
        peer.on('open', (id) => {
          log("PeerJSサーバーに接続しました。ID: " + id);
          statusDiv.textContent = 'サーバーに接続しました';
          
          if (mode === "camera") {
            startCamera();
          } else if (mode === "viewer") {
            // 少し待ってからカメラに接続
            setTimeout(() => {
              connectToCamera();
            }, 1000);
          }
        });
        
        peer.on('error', (err) => {
          log("PeerJSエラー: " + err.type + " - " + err.message);
          statusDiv.textContent = 'エラーが発生しました: ' + err.type;
          
          // 特定のエラーの場合は再接続を試みる
          if (err.type === 'peer-unavailable' && mode === 'viewer') {
            statusDiv.textContent = 'カメラが見つかりません。再試行中...';
            setTimeout(() => {
              connectToCamera();
            }, 3000);
          } else if (err.type === 'unavailable-id') {
            // IDが既に使用されている場合、ランダムサフィックスを追加して再試行
            log("IDが既に使用されています。ランダムIDで再試行します");
            const randomSuffix = Math.random().toString(36).substring(2, 7);
            const newPeerId = peerId + "-" + randomSuffix;
            
            statusDiv.textContent = '別のIDで再接続しています...';
            
            // 既存のピアを破棄
            if (peer) {
              peer.destroy();
            }
            
            // 新しいIDで再初期化
            setTimeout(() => {
              peer = new Peer(newPeerId, {
                debug: 2,
                config: {
                  'iceServers': [
                    { urls: 'stun:stun.l.google.com:19302' },
                    { urls: 'stun:stun1.l.google.com:19302' },
                    { urls: 'stun:stun2.l.google.com:19302' },
                    { urls: 'stun:stun3.l.google.com:19302' },
                    { urls: 'stun:stun4.l.google.com:19302' },
                    { urls: 'stun:stun.stunprotocol.org:3478' },
                    {
                      urls: 'turn:openrelay.metered.ca:80',
                      username: 'openrelayproject',
                      credential: 'openrelayproject'
                    }
                  ]
                }
              });
              
              // イベントハンドラを再設定
              setupPeerEventHandlers();
            }, 1000);
          }
        });
        
        setupPeerEventHandlers();
      } catch (err) {
        log("PeerJS初期化エラー: " + err.message);
        statusDiv.textContent = '初期化エラー: ' + err.message;
      }
    }
    
    // ピアのイベントハンドラを設定
    function setupPeerEventHandlers() {
      // 着信処理（カメラモードの場合）
      peer.on('call', (call) => {
        log('着信がありました');
        currentCall = call;
        
        if (localStream) {
          // ストリーム情報を詳細にログ
          const videoTracks = localStream.getVideoTracks();
          const audioTracks = localStream.getAudioTracks();
          log(\`送信前ストリーム情報: ビデオトラック \${videoTracks.length}個, オーディオトラック \${audioTracks.length}個\`);
          
          if (videoTracks.length > 0) {
            const track = videoTracks[0];
            log(\`送信ビデオトラック: \${track.label}, 有効: \${track.enabled}, 状態: \${track.readyState}\`);
            
            // トラックが無効になっていたら有効にする
            if (!track.enabled) {
              log('ビデオトラックを有効化します');
              track.enabled = true;
            }
            
            // トラックの設定を取得
            const settings = track.getSettings();
            log(\`送信ビデオ設定: \${settings.width}x\${settings.height}@\${settings.frameRate}fps, デバイスID: \${settings.deviceId}\`);
          }
          
          // 着信に応答
          call.answer(localStream);
          log('着信に応答しました');
          
          statusDiv.textContent = '視聴者と接続しました。映像を送信中...';
          controls.classList.remove('hidden');
          
          // ICE接続状態の監視を追加
          call.on('iceStateChanged', (state) => {
            log(\`ICE接続状態変更: \${state}\`);
            
            // 接続状態に応じたメッセージを表示
            if (state === 'checking') {
              statusDiv.textContent = 'ネットワーク接続を確認中...';
            } else if (state === 'connected' || state === 'completed') {
              statusDiv.textContent = '視聴者と接続しました。映像を送信中...';
            } else if (state === 'failed' || state === 'disconnected') {
              statusDiv.textContent = 'ネットワーク接続に問題があります。';
            }
            
            // PeerConnectionの状態を詳細にログ
            if (call.peerConnection) {
              const pc = call.peerConnection;
              log(\`PeerConnection状態: \${pc.connectionState}, ICE状態: \${pc.iceConnectionState}, シグナリング状態: \${pc.signalingState}\`);
              
              // 送信トラックの状態を確認
              const senders = pc.getSenders();
              senders.forEach(sender => {
                if (sender.track && sender.track.kind === 'video') {
                  log(\`送信中ビデオトラック: \${sender.track.label || 'ラベルなし'}, 有効: \${sender.track.enabled}, 状態: \${sender.track.readyState}\`);
                }
              });
            }
          });
        } else {
          log('カメラが準備できていないため着信に応答できません');
          statusDiv.textContent = 'カメラが準備できていません。';
        }

        call.on('stream', (remoteStream) => {
          log('リモートストリームを受信しました');
          // カメラモードでは通常リモートストリームは使用しない
        });

        call.on('close', () => {
          log('通話が終了しました');
          statusDiv.textContent = '通話が終了しました。';
          controls.classList.add('hidden');
        });
        
        call.on('error', (err) => {
          log("通話エラー: " + err);
          statusDiv.textContent = '通話エラー: ' + err;
        });
      });
    }
    
    // カメラの起動（カメラモード）
    async function startCamera() {
      try {
        log('カメラ起動開始');
        statusDiv.textContent = 'カメラにアクセス中...';
        
        // より詳細なビデオ制約を設定
        const constraints = {
          video: { 
            facingMode: facingMode,
            width: { ideal: 1280 },
            height: { ideal: 720 },
            frameRate: { ideal: 30 }
          },
          audio: true
        };
        
        log("メディア取得開始: " + JSON.stringify(constraints));
        localStream = await navigator.mediaDevices.getUserMedia(constraints);
        
        log('カメラアクセス成功');
        localVideo.srcObject = localStream;
        localVideo.classList.remove('hidden');
        controls.classList.remove('hidden');
        
        // ストリーム情報をログに記録
        const videoTracks = localStream.getVideoTracks();
        const audioTracks = localStream.getAudioTracks();
        log(\`ローカルストリーム情報: ビデオトラック \${videoTracks.length}個, オーディオトラック \${audioTracks.length}個\`);
        
        if (videoTracks.length > 0) {
          const settings = videoTracks[0].getSettings();
          log(\`ビデオ設定: \${settings.width}x\${settings.height}@\${settings.frameRate}fps\`);
        }
        
        statusDiv.textContent = 'カメラを起動しました。視聴者からの接続を待機中...';
        
        // デバイス情報をログに記録
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = devices.filter(device => device.kind === 'videoinput');
        log("利用可能なカメラデバイス: " + videoDevices.length + "台");
        videoDevices.forEach((device, index) => {
          log("カメラ[" + index + "]: " + (device.label || 'ラベルなし'));
        });
      } catch (err) {
        log("カメラアクセスエラー: " + err.message);
        statusDiv.textContent = 'カメラへのアクセスに失敗しました: ' + err.message;
      }
    }
    
    // カメラの切り替え
    async function switchCameraFacing() {
      if (!localStream) return;
      
      try {
        log('カメラ切替開始');
        // 現在のトラックを停止
        localStream.getTracks().forEach(track => {
          log("トラック停止: " + track.kind);
          track.stop();
        });
        
        // カメラの向きを切り替え
        facingMode = facingMode === "environment" ? "user" : "environment";
        log("カメラ向き変更: " + facingMode);
        
        localStream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: facingMode },
          audio: true
        });
        
        localVideo.srcObject = localStream;
        
        // 通話中なら新しいストリームを送信
        if (currentCall && currentCall.peerConnection) {
          log('通話中のカメラ切替');
          const videoTrack = localStream.getVideoTracks()[0];
          const senders = currentCall.peerConnection.getSenders();
          
          const videoSender = senders.find(sender => 
            sender.track && sender.track.kind === 'video'
          );
          
          if (videoSender) {
            log('ビデオトラック置換');
            videoSender.replaceTrack(videoTrack);
          }
        }
        
        statusDiv.textContent = facingMode === "environment" ? '背面カメラに切り替えました' : '前面カメラに切り替えました';
      } catch (err) {
        log("カメラ切替エラー: " + err.message);
        statusDiv.textContent = 'カメラの切り替えに失敗しました: ' + err.message;
      }
    }
    
    // カメラに接続（視聴モード）
    function connectToCamera() {
      if (!peer || peer.disconnected) {
        log('ピア接続がありません。再初期化します');
        initPeer();
        return;
      }
      
      log('カメラに接続しています...');
      statusDiv.textContent = 'カメラに接続しています...';
      
      try {
        // 空のストリームで発信（受信のみモード）
        const emptyStream = new MediaStream();
        
        // 接続先のIDを指定
        const cameraPeerId = roomId + "-camera";
        
        log("発信先: " + cameraPeerId);
        const call = peer.call(cameraPeerId, emptyStream);
        
        if (!call) {
          log('発信に失敗しました');
          throw new Error('発信に失敗しました');
        }
        
        currentCall = call;
        log('発信成功');
        
        call.on('stream', (remoteStream) => {
          log('リモートストリーム受信');
          
          // ストリーム情報をログに記録
          const videoTracks = remoteStream.getVideoTracks();
          const audioTracks = remoteStream.getAudioTracks();
          log(\`受信ストリーム情報: ビデオトラック \${videoTracks.length}個, オーディオトラック \${audioTracks.length}個\`);
          
          if (videoTracks.length > 0) {
            log(\`ビデオトラック: \${videoTracks[0].label}, 有効: \${videoTracks[0].enabled}, 状態: \${videoTracks[0].readyState}\`);
          }
          
          // ビデオ要素のスタイルを明示的に設定
          remoteVideo.style.display = 'block';
          remoteVideo.style.width = '100%';
          remoteVideo.style.height = '100vh';
          remoteVideo.style.objectFit = 'cover';
          
          // ビデオ要素にストリームを設定
          remoteVideo.srcObject = remoteStream;
          remoteVideo.classList.remove('hidden');
          
          // 自動再生に失敗した場合に備えて手動で再生を試みる
          remoteVideo.play().catch(err => {
            log(\`ビデオ再生エラー: \${err.message}\`);
            statusDiv.textContent = 'ビデオの自動再生に失敗しました。下のボタンをタップしてください。';
            
            // ユーザーのインタラクションで再生を試みるためのボタンを表示
            const playButton = document.createElement('button');
            playButton.textContent = '映像を再生';
            playButton.style.position = 'fixed';
            playButton.style.top = '50%';
            playButton.style.left = '50%';
            playButton.style.transform = 'translate(-50%, -50%)';
            playButton.style.zIndex = '1000';
            playButton.style.padding = '16px 32px';
            playButton.style.backgroundColor = '#000';
            playButton.style.color = '#fff';
            playButton.style.border = 'none';
            playButton.style.borderRadius = '8px';
            playButton.style.fontWeight = 'bold';
            
            playButton.onclick = () => {
              remoteVideo.play().then(() => {
                log('手動再生成功');
                document.body.removeChild(playButton);
                statusDiv.textContent = 'カメラと接続しました。映像を受信中...';
              }).catch(e => {
                log(\`手動再生失敗: \${e.message}\`);
                statusDiv.textContent = '再生に失敗しました: ' + e.message;
              });
            };
            
            document.body.appendChild(playButton);
          });
          
          statusDiv.textContent = 'カメラと接続しました。映像を受信中...';
        });
        
        // ICE接続状態の監視を追加
        call.on('iceStateChanged', (state) => {
          log(\`ICE接続状態変更: \${state}\`);
          
          // 接続状態に応じたメッセージを表示
          if (state === 'checking') {
            statusDiv.textContent = 'ネットワーク接続を確認中...';
          } else if (state === 'connected' || state === 'completed') {
            statusDiv.textContent = 'カメラと接続しました。映像を受信中...';
          } else if (state === 'failed' || state === 'disconnected') {
            statusDiv.textContent = 'ネットワーク接続に問題があります。再接続を試みています...';
            // 再接続を試みる
            setTimeout(() => {
              if (currentCall) {
                currentCall.close();
                currentCall = null;
              }
              connectToCamera();
            }, 3000);
          }
          
          // PeerConnectionの状態を詳細にログ
          if (call.peerConnection) {
            const pc = call.peerConnection;
            log(\`PeerConnection状態: \${pc.connectionState}, ICE状態: \${pc.iceConnectionState}, シグナリング状態: \${pc.signalingState}\`);
            
            // 受信トラックの状態を確認
            const receivers = pc.getReceivers();
            receivers.forEach(receiver => {
              if (receiver.track && receiver.track.kind === 'video') {
                log(\`受信ビデオトラック: \${receiver.track.label || 'ラベルなし'}, 有効: \${receiver.track.enabled}, 状態: \${receiver.track.readyState}\`);
              }
            });
          }
        });
        
        call.on('close', () => {
          log('通話終了');
          statusDiv.textContent = '通話が終了しました。';
          remoteVideo.classList.add('hidden');
        });
        
        call.on('error', (err) => {
          log("通話エラー: " + err);
          statusDiv.textContent = '通話エラー: ' + err;
        });
      } catch (err) {
        log("接続エラー: " + err.message);
        statusDiv.textContent = '接続に失敗しました: ' + err.message;
        
        // エラー後に再試行
        setTimeout(() => {
          connectToCamera();
        }, 3000);
      }
    }
    
    // 切断処理
    function hangup() {
      log('切断処理開始');
      
      if (currentCall) {
        log('通話を終了します');
        currentCall.close();
        currentCall = null;
      }
      
      if (localStream) {
        log('ローカルストリームを停止します');
        localStream.getTracks().forEach(track => track.stop());
        localStream = null;
      }
      
      if (peer) {
        log('ピア接続を破棄します');
        peer.destroy();
        peer = null;
      }
      
      localVideo.classList.add('hidden');
      remoteVideo.classList.add('hidden');
      controls.classList.add('hidden');
      statusDiv.textContent = '切断しました。';
      
      log('メインページに戻ります');
      // 3秒後にメインページに戻る
      setTimeout(() => {
        window.location.href = "/";
      }, 3000);
    }
    
    // イベントリスナー
    switchCameraBtn.addEventListener('click', switchCameraFacing);
    hangupBtn.addEventListener('click', hangup);
    
    // ページを離れる前に接続を閉じる
    window.addEventListener('beforeunload', () => {
      log('ページ離脱');
      hangup();
    });
    
    // 初期化
    log("初期化開始: モード=" + mode + ", ルームID=" + roomId);
    initPeer();
  </script>
</body>
</html>`,
    {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
      },
    },
  )
}
