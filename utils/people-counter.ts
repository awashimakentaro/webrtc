// 人物検出と追跡のためのクラス
export class PeopleCounter {
    private model: any = null
    private isModelLoading = false
    private crossingLine: { x1: number; y1: number; x2: number; y2: number } = { x1: 0, y1: 0, x2: 0, y2: 0 }
    private trackedPeople: Map<
      string,
      { id: string; box: any; crossed: boolean; direction: string | null; lastPosition: { x: number; y: number } }
    > = new Map()
    private peopleCount = { leftToRight: 0, rightToLeft: 0, total: 0 }
    private lastDetectionTime = 0
    private detectionInterval = 150 // ミリ秒単位での検出間隔
    private cleanupInterval = 2000 // 追跡データのクリーンアップ間隔
    private onCountUpdate: ((count: { leftToRight: number; rightToLeft: number; total: number }) => void) | null = null
    private debugMode = false
    private canvasWidth = 0
    private canvasHeight = 0
    private analysisCanvas: HTMLCanvasElement | null = null // 分析表示用のキャンバス
    private modelLoadPromise: Promise<any> | null = null // モデル読み込みのPromise
  
    constructor() {
      // クリーンアップタイマーの設定
      setInterval(() => this.cleanupTrackedPeople(), this.cleanupInterval)
  
      // 初期化時にモデルの読み込みを開始
      this.loadModel()
    }
  
    // モデルの読み込み
    async loadModel() {
      if (this.model) {
        console.log("モデルは既に読み込まれています")
        return this.model
      }
  
      if (this.modelLoadPromise) {
        console.log("モデルを読み込み中です...")
        return this.modelLoadPromise
      }
  
      console.log("モデルの読み込みを開始します")
      this.isModelLoading = true
  
      // モデル読み込みのPromiseを作成
      this.modelLoadPromise = new Promise(async (resolve, reject) => {
        try {
          // グローバルオブジェクトからCOCO-SSDモデルを取得
          if (typeof window !== "undefined" && (window as any).cocoSsd) {
            console.log("COCO-SSDモデルを読み込みます...")
            const loadedModel = await (window as any).cocoSsd.load()
            console.log("人物検出モデルを読み込みました")
            this.model = loadedModel
            this.isModelLoading = false
            resolve(loadedModel)
          } else {
            console.error("COCO-SSDモデルが見つかりません")
            console.log("window.cocoSsd:", typeof window !== "undefined" ? (window as any).cocoSsd : "undefined")
            this.isModelLoading = false
            reject(new Error("COCO-SSDモデルが見つかりません"))
          }
        } catch (error) {
          console.error("モデル読み込みエラー:", error)
          this.isModelLoading = false
          reject(error)
        }
      })
  
      return this.modelLoadPromise
    }
  
    // 横断ラインの設定
    setCrossingLine(x1: number, y1: number, x2: number, y2: number) {
      this.crossingLine = { x1, y1, x2, y2 }
      console.log(`横断ラインを設定: (${x1}, ${y1}) - (${x2}, ${y2})`)
    }
  
    // カウント更新時のコールバック設定
    setCountUpdateCallback(callback: (count: { leftToRight: number; rightToLeft: number; total: number }) => void) {
      this.onCountUpdate = callback
    }
  
    // デバッグモードの設定
    setDebugMode(enabled: boolean) {
      this.debugMode = enabled
    }
  
    // 分析キャンバスの設定
    setAnalysisCanvas(canvas: HTMLCanvasElement | null) {
      this.analysisCanvas = canvas
      console.log("分析キャンバスを設定しました:", canvas ? `${canvas.width}x${canvas.height}` : "null")
    }
  
    // 人物検出の実行
    async detectPeople(imageElement: HTMLImageElement | HTMLVideoElement, canvas: HTMLCanvasElement) {
      try {
        // モデルが読み込まれていない場合は読み込む
        if (!this.model) {
          console.log("モデルが読み込まれていないため、読み込みを開始します")
          try {
            this.model = await this.loadModel()
          } catch (error) {
            console.error("モデル読み込みに失敗しました:", error)
            return
          }
        }
  
        const now = Date.now()
        if (now - this.lastDetectionTime < this.detectionInterval) {
          // 検出間隔が短すぎる場合はスキップ
          return
        }
        this.lastDetectionTime = now
  
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
          imgWidth = imageElement.naturalWidth || imageElement.width || 640
          imgHeight = imageElement.naturalHeight || imageElement.height || 480
          console.log(`画像サイズ: ${imgWidth}x${imgHeight}`)
  
          // 画像が正しく読み込まれているか確認
          if (imgWidth === 0 || imgHeight === 0) {
            console.error("画像のサイズが取得できません")
            console.log("画像の状態:", imageElement.complete, imageElement.naturalWidth, imageElement.naturalHeight)
            return
          }
        } else {
          // ビデオ要素の場合
          imgWidth = imageElement.videoWidth || imageElement.clientWidth || 640
          imgHeight = imageElement.videoHeight || imageElement.clientHeight || 480
          console.log(`ビデオサイズ: ${imgWidth}x${imgHeight}`)
        }
  
        // キャンバスのサイズを設定
        canvas.width = imgWidth
        canvas.height = imgHeight
        this.canvasWidth = imgWidth
        this.canvasHeight = imgHeight
        console.log(`キャンバスサイズを設定: ${canvas.width}x${canvas.height}`)
  
        // キャンバスのクリア
        ctx.clearRect(0, 0, canvas.width, canvas.height)
  
        // 分析キャンバスに元の画像を描画
        ctx.drawImage(imageElement, 0, 0, imgWidth, imgHeight)
        console.log("キャンバスに画像を描画しました")
  
        // 人物検出の実行
        console.log("モデルによる検出を実行します")
        const predictions = await this.model.detect(imageElement)
        console.log(`検出結果: ${predictions.length}個のオブジェクトを検出`)
  
        // 人物の検出と追跡
        this.trackPeople(predictions, ctx)
  
        // 横断ラインを描画
        this.drawCrossingLine(ctx)
  
        // デバッグ用に検出状態を表示
        if (this.debugMode) {
          ctx.fillStyle = "rgba(255, 255, 255, 0.7)"
          ctx.fillRect(0, 0, 200, 20)
          ctx.fillStyle = "black"
          ctx.font = "12px Arial"
          ctx.fillText(
            `検出: ${predictions.length}個, 人物: ${predictions.filter((p) => p.class === "person").length}人`,
            5,
            15,
          )
        }
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
  
      // ラインの方向を示す矢印を描画
      const midX = (this.crossingLine.x1 + this.crossingLine.x2) / 2
      const midY = (this.crossingLine.y1 + this.crossingLine.y2) / 2
  
      // 左右方向の表示
      ctx.fillStyle = "white"
      ctx.font = "12px Arial"
      ctx.fillText("左", this.crossingLine.x1 - 20, midY)
      ctx.fillText("右", this.crossingLine.x2 + 10, midY)
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
  
          // 前回の位置を保存
          const lastPosition = trackedPerson.lastPosition
  
          // 位置を更新
          trackedPerson.box = person.bbox
          trackedPerson.lastPosition = { x: centerX, y: centerY }
  
          currentIds.add(closestId)
  
          // 横断ラインとの交差チェック
          this.checkLineCrossing(trackedPerson, centerX, centerY, lastPosition, ctx)
        } else {
          // 新しい人物を追加
          const newId = `person_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
          this.trackedPeople.set(newId, {
            id: newId,
            box: person.bbox,
            crossed: false,
            direction: null,
            lastPosition: { x: centerX, y: centerY },
          })
          currentIds.add(newId)
          console.log(`新しい人物を追跡開始: ID=${newId}, 位置=(${centerX.toFixed(0)}, ${centerY.toFixed(0)})`)
        }
  
        // バウンディングボックスを描画
        this.drawBoundingBox(ctx, person, centerX, centerY, this.findClosestPerson(centerX, centerY, person.bbox))
      }
  
      // 追跡中の人物の状態を更新
      for (const [id, person] of this.trackedPeople.entries()) {
        if (!currentIds.has(id)) {
          // このフレームで検出されなかった人物
          this.drawDisappearedPerson(ctx, person)
        }
      }
  
      // カウント情報を更新
      if (this.onCountUpdate) {
        this.onCountUpdate(this.peopleCount)
      }
    }
  
    // バウンディングボックスの描画
    private drawBoundingBox(
      ctx: CanvasRenderingContext2D,
      person: any,
      centerX: number,
      centerY: number,
      id: string | null,
    ) {
      const [x, y, width, height] = person.bbox
  
      // バウンディングボックスを描画
      ctx.strokeStyle = "green"
      ctx.lineWidth = 2
      ctx.strokeRect(x, y, width, height)
  
      // 中心点を描画
      ctx.fillStyle = "white"
      ctx.fillRect(centerX - 3, centerY - 3, 6, 6)
  
      // 信頼度を表示
      ctx.fillStyle = "white"
      ctx.font = "12px Arial"
      ctx.fillText(`${Math.round(person.score * 100)}%`, x, y - 5)
  
      // ID表示
      const displayId = id || "新規"
      ctx.fillText(`ID: ${displayId.substring(0, 8)}`, x, y - 20)
    }
  
    // 消失した人物の描画
    private drawDisappearedPerson(
      ctx: CanvasRenderingContext2D,
      person: {
        id: string
        box: any
        crossed: boolean
        direction: string | null
        lastPosition: { x: number; y: number }
      },
    ) {
      const [x, y, width, height] = person.box
      const centerX = x + width / 2
      const centerY = y + height / 2
  
      // 消失した人物を薄く表示
      ctx.strokeStyle = "rgba(255, 0, 0, 0.5)"
      ctx.lineWidth = 1
      ctx.strokeRect(x, y, width, height)
  
      // 中心点を描画
      ctx.fillStyle = "rgba(255, 0, 0, 0.5)"
      ctx.fillRect(centerX - 3, centerY - 3, 6, 6)
  
      // ID表示
      ctx.fillStyle = "rgba(255, 255, 255, 0.5)"
      ctx.font = "12px Arial"
      ctx.fillText(`ID: ${person.id.substring(0, 8)} (消失)`, x, y - 20)
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
      person: {
        id: string
        box: any
        crossed: boolean
        direction: string | null
        lastPosition: { x: number; y: number }
      },
      centerX: number,
      centerY: number,
      lastPosition: { x: number; y: number },
      ctx: CanvasRenderingContext2D,
    ) {
      if (person.crossed) return
  
      // 前回の位置と現在の位置の間でラインを横切ったかチェック
      const crossed = this.lineSegmentIntersection(
        lastPosition.x,
        lastPosition.y,
        centerX,
        centerY,
        this.crossingLine.x1,
        this.crossingLine.y1,
        this.crossingLine.x2,
        this.crossingLine.y2,
      )
  
      if (crossed) {
        // 横断方向の判定
        const direction = this.determineDirection(centerX, lastPosition.x)
  
        console.log(`人物(${person.id})がラインを横切りました: 方向=${direction}`)
        person.crossed = true
  
        if (direction === "right") {
          this.peopleCount.leftToRight++
        } else {
          this.peopleCount.rightToLeft++
        }
  
        this.peopleCount.total = this.peopleCount.leftToRight + this.peopleCount.rightToLeft
  
        console.log(
          `現在のカウント: 左→右=${this.peopleCount.leftToRight}, 右→左=${this.peopleCount.rightToLeft}, 合計=${this.peopleCount.total}`,
        )
  
        // 軌跡を描画
        this.drawTrajectory(ctx, lastPosition, centerX, centerY, direction)
      } else {
        // 移動軌跡を描画
        this.drawMovementPath(ctx, lastPosition, centerX, centerY)
      }
    }
  
    // 横断時の軌跡を描画
    private drawTrajectory(
      ctx: CanvasRenderingContext2D,
      lastPosition: { x: number; y: number },
      centerX: number,
      centerY: number,
      direction: string,
    ) {
      ctx.beginPath()
      ctx.moveTo(lastPosition.x, lastPosition.y)
      ctx.lineTo(centerX, centerY)
      ctx.strokeStyle = direction === "right" ? "rgba(0, 255, 0, 0.8)" : "rgba(255, 0, 0, 0.8)"
      ctx.lineWidth = 2
      ctx.stroke()
  
      // 交差点を強調表示
      const intersection = this.getIntersectionPoint(
        lastPosition.x,
        lastPosition.y,
        centerX,
        centerY,
        this.crossingLine.x1,
        this.crossingLine.y1,
        this.crossingLine.x2,
        this.crossingLine.y2,
      )
  
      if (intersection) {
        ctx.fillStyle = "yellow"
        ctx.beginPath()
        ctx.arc(intersection.x, intersection.y, 5, 0, Math.PI * 2)
        ctx.fill()
      }
    }
  
    // 移動軌跡を描画
    private drawMovementPath(
      ctx: CanvasRenderingContext2D,
      lastPosition: { x: number; y: number },
      centerX: number,
      centerY: number,
    ) {
      ctx.beginPath()
      ctx.moveTo(lastPosition.x, lastPosition.y)
      ctx.lineTo(centerX, centerY)
      ctx.strokeStyle = "rgba(0, 255, 255, 0.5)"
      ctx.lineWidth = 1
      ctx.stroke()
    }
  
    // 2つの線分の交差判定
    private lineSegmentIntersection(
      x1: number,
      y1: number,
      x2: number,
      y2: number,
      x3: number,
      y3: number,
      x4: number,
      y4: number,
    ): boolean {
      // 線分1: (x1, y1) - (x2, y2)
      // 線分2: (x3, y3) - (x4, y4)
  
      // 線分の方向ベクトル
      const dx1 = x2 - x1
      const dy1 = y2 - y1
      const dx2 = x4 - x3
      const dy2 = y4 - y3
  
      // 交差判定の行列式
      const denominator = dy2 * dx1 - dx2 * dy1
  
      // 平行な場合は交差しない
      if (denominator === 0) return false
  
      // パラメータt, u
      const t = ((x3 - x1) * dy2 - (y3 - y1) * dx2) / denominator
      const u = ((x3 - x1) * dy1 - (y3 - y1) * dx1) / denominator
  
      // 線分の範囲内で交差するかチェック
      return t >= 0 && t <= 1 && u >= 0 && u <= 1
    }
  
    // 交差点の座標を取得
    private getIntersectionPoint(
      x1: number,
      y1: number,
      x2: number,
      y2: number,
      x3: number,
      y3: number,
      x4: number,
      y4: number,
    ): { x: number; y: number } | null {
      // 線分1: (x1, y1) - (x2, y2)
      // 線分2: (x3, y3) - (x4, y4)
  
      // 線分の方向ベクトル
      const dx1 = x2 - x1
      const dy1 = y2 - y1
      const dx2 = x4 - x3
      const dy2 = y4 - y3
  
      // 交差判定の行列式
      const denominator = dy2 * dx1 - dx2 * dy1
  
      // 平行な場合は交差しない
      if (denominator === 0) return null
  
      // パラメータt, u
      const t = ((x3 - x1) * dy2 - (y3 - y1) * dx2) / denominator
      const u = ((x3 - x1) * dy1 - (y3 - y1) * dx1) / denominator
  
      // 線分の範囲内で交差するかチェック
      if (t >= 0 && t <= 1 && u >= 0 && u <= 1) {
        return {
          x: x1 + t * dx1,
          y: y1 + t * dy1,
        }
      }
  
      return null
    }
  
    // 横断方向の判定
    private determineDirection(currentX: number, lastX: number) {
      // 移動方向で左右を判定
      return currentX > lastX ? "right" : "left"
    }
  
    // 追跡データのクリーンアップ
    private cleanupTrackedPeople() {
      const now = Date.now()
      let cleanupCount = 0
  
      for (const [id, person] of this.trackedPeople.entries()) {
        // 一定時間検出されなかった人物を削除
        if (now - this.lastDetectionTime > 5000) {
          this.trackedPeople.delete(id)
          cleanupCount++
        }
      }
  
      if (cleanupCount > 0) {
        console.log(`${cleanupCount}人の追跡データをクリーンアップしました`)
      }
    }
  
    // カウントのリセット
    resetCount() {
      this.peopleCount = { leftToRight: 0, rightToLeft: 0, total: 0 }
  
      // 追跡データもリセット
      this.trackedPeople.clear()
  
      console.log("カウントをリセットしました")
  
      if (this.onCountUpdate) {
        this.onCountUpdate(this.peopleCount)
      }
    }
  }
  