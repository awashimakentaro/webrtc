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
    <html lang="ja">
    <head>
      <title>WebRTC Connection</title>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <script src="https://unpkg.com/peerjs@1.4.7/dist/peerjs.min.js"></script>
      <style>
        body { margin: 0; font-family: sans-serif; }
        #status { padding: 20px; text-align: center; }
        video { width: 100%; height: 100vh; object-fit: cover; }
        .hidden { display: none; }
        #debug { position: fixed; bottom: 10px; left: 10px; background: rgba(0,0,0,0.5); color: white; padding: 5px; font-size: 12px; max-width: 80%; overflow: auto; max-height: 100px; }
      </style>
    </head>
    <body>
      <div id="status">接続中...</div>
      <video id="localVideo" autoplay playsinline muted class="hidden"></video>
      <video id="remoteVideo" autoplay playsinline class="hidden"></video>
      <div id="debug"></div>

      <script>
        // デバッグログ
        const debugDiv = document.getElementById('debug');
        function log(message) {
          console.log(message);
          debugDiv.innerHTML += message + '<br>';
          debugDiv.scrollTop = debugDiv.scrollHeight;
        }

        const roomId = "${roomId}";
        const mode = "${mode}";
        let peer;
        let localStream;
        let conn;

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

        // PeerJSの初期化
        function initPeer(userId) {
          log('PeerJS初期化: ' + userId);
          
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
            log('着信コール受信');
            updateStatus("着信コールを受信しました");
            
            // カメラモードの場合、ローカルストリームで応答
            if (mode === "camera" && localStream) {
              call.answer(localStream);
              updateStatus("コールに応答しました");
            } else {
              call.answer();
            }
            
            call.on('stream', (remoteStream) => {
              log('リモートストリーム受信');
              updateStatus("接続済み");
              remoteVideo.srcObject = remoteStream;
              remoteVideo.classList.remove('hidden');
              
              // 親ウィンドウにストリームを転送（視聴モードの場合）
              if (mode === "viewer" && window.opener) {
                try {
                  // MediaStreamを直接送信できないため、ビデオ要素のIDを通知
                  window.opener.postMessage({ 
                    type: 'stream-ready', 
                    status: '接続済み'
                  }, '*');
                  
                  // 親ウィンドウからのメッセージを待ち受ける
                  window.addEventListener('message', (event) => {
                    if (event.data.type === 'request-stream-transfer') {
                      // ストリーム転送のためのRTCPeerConnectionを作成
                      const pc = new RTCPeerConnection();
                      remoteStream.getTracks().forEach(track => {
                        pc.addTrack(track, remoteStream);
                      });
                      
                      pc.onicecandidate = e => {
                        if (e.candidate) {
                          window.opener.postMessage({
                            type: 'ice-candidate',
                            candidate: e.candidate
                          }, '*');
                        }
                      };
                      
                      // オファーを作成して親ウィンドウに送信
                      pc.createOffer().then(offer => {
                        pc.setLocalDescription(offer);
                        window.opener.postMessage({
                          type: 'offer',
                          offer: offer
                        }, '*');
                      });
                      
                      // 親ウィンドウからの応答を処理
                      window.addEventListener('message', (e) => {
                        if (e.data.type === 'answer') {
                          pc.setRemoteDescription(new RTCSessionDescription(e.data.answer));
                        }
                        if (e.data.type === 'ice-candidate') {
                          pc.addIceCandidate(new RTCIceCandidate(e.data.candidate));
                        }
                      });
                    }
                  });
                } catch (err) {
                  log('ストリーム転送エラー: ' + err);
                }
              }
            });
            
            call.on('error', (err) => {
              log('コールエラー: ' + err);
              updateStatus("コールエラー: " + err);
            });
            
            call.on('close', () => {
              log('コール終了');
              updateStatus("コールが終了しました");
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
              const call = peer.call(targetId, new MediaStream());
              log('発信コール送信');
              
              call.on('stream', (remoteStream) => {
                log('リモートストリーム受信');
                updateStatus("接続済み");
                remoteVideo.srcObject = remoteStream;
                remoteVideo.classList.remove('hidden');
              });
              
              call.on('error', (err) => {
                log('コールエラー: ' + err);
                updateStatus("コールエラー: " + err);
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
