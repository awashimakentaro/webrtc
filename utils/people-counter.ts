// 人物検出と追跡のためのクラス
export class PeopleCounter {
    private model: any = null
    private isModelLoading = false
    private crossingLine: { x1: number; y1: number; x2: number; y2: number } = { x1: 0, y1: 0, x2: 0, y2: 0 }
    private trackedPeople: Map<string, { id: string; box: any; crossed: boolean; direction: string | null }> = new Map()
    private peopleCount = { leftToRight: 0, rightToLeft: 0, total: 0 }
    private lastDetectionTime = 0
    private detectionInterval = 150 // ミリ秒単位での検出間隔
    private cleanupInterval = 2000 // 追跡データのクリーンアップ間隔
    private onCountUpdate: ((count: { leftToRight: number; rightToLeft: number; total: number }) => void) | null = null
    private debugMode = false
  
    constructor() {
      // クリーンアップタイマーの設定
      setInterval(() => this.cleanupTrackedPeople(), this.cleanupInterval)
    }
  
    // モデルの読み込み
    async loadModel() {
      if (this.model || this.isModelLoading) return
  
      this.isModelLoading = true
      try {
        // グローバルオブジェクトからCOCO-SSDモデルを取得
        if (typeof window !== "undefined" && (window as any).cocoSsd) {
          this.model = await (window as any).cocoSsd.load()
          console.log("人物検出モデルを読み込みました")
        } else {
          console.error("COCO-SSDモデルが見つかりません")
        }
      } catch (error) {
        console.error("モデル読み込みエラー:", error)
      } finally {
        this.isModelLoading = false
      }
    }
  
    // 横断ラインの設定
    setCrossingLine(x1: number, y1: number, x2: number, y2: number) {
      this.crossingLine = { x1, y1, x2, y2 }
    }
  
    // カウント更新時のコールバック設定
    setCountUpdateCallback(callback: (count: { leftToRight: number; rightToLeft: number; total: number }) => void) {
      this.onCountUpdate = callback
    }
  
    // デバッグモードの設定
    setDebugMode(enabled: boolean) {
      this.debugMode = enabled
    }
  
    // 人物検出の実行
    async detectPeople(imageElement: HTMLImageElement | HTMLVideoElement, canvas: HTMLCanvasElement) {
      if (!this.model) {
        await this.loadModel()
        if (!this.model) {
          console.error("モデルが読み込まれていません")
          return
        }
      }
  
      const now = Date.now()
      if (now - this.lastDetectionTime < this.detectionInterval) return
      this.lastDetectionTime = now
  
      try {
        // 画像が読み込まれているか確認
        if (imageElement instanceof HTMLImageElement && !imageElement.complete) {
          console.log("画像がまだ読み込まれていません")
          return
        }
  
        // キャンバスのコンテキスト取得
        const ctx = canvas.getContext("2d")
        if (!ctx) {
          console.error("キャンバスコンテキストを取得できません")
          return
        }
  
        console.log("人物検出を実行します...")
  
        // 画像サイズに合わせてキャンバスをリサイズ
        let imgWidth = 0
        let imgHeight = 0
  
        if (imageElement instanceof HTMLImageElement) {
          // 画像要素の場合
          imgWidth = imageElement.width || imageElement.clientWidth || 640
          imgHeight = imageElement.height || imageElement.clientHeight || 480
          console.log(`画像サイズ: ${imgWidth}x${imgHeight}`)
        } else {
          // ビデオ要素の場合
          imgWidth = imageElement.videoWidth || imageElement.clientWidth || 640
          imgHeight = imageElement.videoHeight || imageElement.clientHeight || 480
          console.log(`ビデオサイズ: ${imgWidth}x${imgHeight}`)
        }
  
        // キャンバスのサイズを設定
        canvas.width = imgWidth
        canvas.height = imgHeight
        console.log(`キャンバスサイズを設定: ${canvas.width}x${canvas.height}`)
  
        // キャンバスのクリア
        ctx.clearRect(0, 0, canvas.width, canvas.height)
  
        // デバッグモードの場合は横断ラインを描画
        if (this.debugMode) {
          this.drawCrossingLine(ctx)
        }
  
        // 人物検出の実行
        const predictions = await this.model.detect(imageElement)
        console.log(`検出結果: ${predictions.length}個のオブジェクトを検出`)
  
        // 人物の検出と追跡
        this.trackPeople(predictions, ctx)
      } catch (error) {
        console.error("検出エラー:", error)
      }
    }
  
    // 横断ラインの描画
    private drawCrossingLine(ctx: CanvasRenderingContext2D) {
      ctx.beginPath()
      ctx.moveTo(this.crossingLine.x1, this.crossingLine.y1)
      ctx.lineTo(this.crossingLine.x2, this.crossingLine.y2)
      ctx.strokeStyle = "red"
      ctx.lineWidth = 2
      ctx.stroke()
    }
  
    // 人物の追跡処理
    private trackPeople(predictions: any[], ctx: CanvasRenderingContext2D) {
      // 人物のみをフィルタリング
      const people = predictions.filter((pred) => pred.class === "person")
      console.log(`${people.length}人の人物を検出しました`)
  
      // 現在のフレームで検出された人物のID
      const currentIds = new Set<string>()
  
      for (const person of people) {
        // 検出された人物のバウンディングボックス
        const [x, y, width, height] = person.bbox
        const centerX = x + width / 2
        const centerY = y + height / 2
  
        // 最も近い追跡中の人物を見つける
        const closestId = this.findClosestPerson(centerX, centerY, person.bbox)
  
        if (closestId) {
          // 既存の人物を更新
          const trackedPerson = this.trackedPeople.get(closestId)!
          trackedPerson.box = person.bbox
          currentIds.add(closestId)
  
          // 横断ラインとの交差チェック
          this.checkLineCrossing(trackedPerson, centerX, centerY)
        } else {
          // 新しい人物を追加
          const newId = `person_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
          this.trackedPeople.set(newId, {
            id: newId,
            box: person.bbox,
            crossed: false,
            direction: null,
          })
          currentIds.add(newId)
          console.log(`新しい人物を追跡開始: ID=${newId}`)
        }
  
        // デバッグモードの場合はバウンディングボックスを描画
        if (this.debugMode) {
          ctx.strokeStyle = "green"
          ctx.lineWidth = 2
          ctx.strokeRect(x, y, width, height)
  
          ctx.fillStyle = "white"
          ctx.fillRect(centerX - 3, centerY - 3, 6, 6)
  
          // 信頼度を表示
          ctx.fillStyle = "white"
          ctx.font = "12px Arial"
          ctx.fillText(`${Math.round(person.score * 100)}%`, x, y - 5)
        }
      }
  
      // カウント情報を更新
      if (this.onCountUpdate) {
        this.onCountUpdate(this.peopleCount)
      }
    }
  
    // 最も近い追跡中の人物を見つける
    private findClosestPerson(centerX: number, centerY: number, bbox: number[]) {
      const [x, y, width, height] = bbox
      let closestId = null
      let minDistance = Number.MAX_VALUE
  
      for (const [id, person] of this.trackedPeople.entries()) {
        const [px, py, pwidth, pheight] = person.box
        const pcenterX = px + pwidth / 2
        const pcenterY = py + pheight / 2
  
        // 中心点間の距離を計算
        const distance = Math.sqrt(Math.pow(centerX - pcenterX, 2) + Math.pow(centerY - pcenterY, 2))
  
        // 距離が閾値以下で最小の場合、この人物を選択
        if (distance < Math.max(width, height) * 0.8 && distance < minDistance) {
          minDistance = distance
          closestId = id
        }
      }
  
      return closestId
    }
  
    // 横断ラインとの交差チェック
    private checkLineCrossing(
      person: { id: string; box: any; crossed: boolean; direction: string | null },
      centerX: number,
      centerY: number,
    ) {
      if (person.crossed) return
  
      // ラインとの交差判定
      if (this.isPointCrossingLine(centerX, centerY)) {
        // 交差方向の判定
        const direction = this.determineDirection(centerX)
  
        if (!person.direction) {
          person.direction = direction
          console.log(`人物(${person.id})の初期方向: ${direction}`)
        } else if (person.direction !== direction) {
          // 方向が変わった場合、ラインを横切ったとみなす
          person.crossed = true
  
          if (direction === "right") {
            this.peopleCount.leftToRight++
          } else {
            this.peopleCount.rightToLeft++
          }
  
          this.peopleCount.total = this.peopleCount.leftToRight + this.peopleCount.rightToLeft
  
          console.log(`人物(${person.id})がラインを横切りました: ${person.direction} -> ${direction}`)
          console.log(
            `現在のカウント: 左→右=${this.peopleCount.leftToRight}, 右→左=${this.peopleCount.rightToLeft}, 合計=${this.peopleCount.total}`,
          )
        }
      }
    }
  
    // 点がラインを横切っているかチェック
    private isPointCrossingLine(x: number, y: number) {
      const { x1, y1, x2, y2 } = this.crossingLine
  
      // ラインの方程式: ax + by + c = 0
      const a = y2 - y1
      const b = x1 - x2
      const c = x2 * y1 - x1 * y2
  
      // 点とラインの距離
      const distance = Math.abs(a * x + b * y + c) / Math.sqrt(a * a + b * b)
  
      // 距離が閾値以下ならラインに近いと判断
      return distance < 5
    }
  
    // 横断方向の判定
    private determineDirection(x: number) {
      // 横断ラインの中点を基準に左右を判定
      const lineCenterX = (this.crossingLine.x1 + this.crossingLine.x2) / 2
      console.log(`ライン中点: ${lineCenterX}, 人物位置: ${x}`)
      return x > lineCenterX ? "right" : "left"
    }
  
    // 追跡データのクリーンアップ
    private cleanupTrackedPeople() {
      const now = Date.now()
  
      for (const [id, person] of this.trackedPeople.entries()) {
        // 一定時間検出されなかった人物を削除
        if (now - this.lastDetectionTime > 5000) {
          this.trackedPeople.delete(id)
        }
      }
    }
  
    // カウントのリセット
    resetCount() {
      this.peopleCount = { leftToRight: 0, rightToLeft: 0, total: 0 }
      if (this.onCountUpdate) {
        this.onCountUpdate(this.peopleCount)
      }
    }
  }
  