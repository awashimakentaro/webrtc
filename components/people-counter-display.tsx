"use client"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { RefreshCcwIcon, EyeIcon, EyeOffIcon } from "lucide-react"

interface PeopleCounterDisplayProps {
  count: {
    leftToRight: number
    rightToLeft: number
    total: number
  }
  onReset: () => void
  onToggleDebug: () => void
  debugMode: boolean
}

export default function PeopleCounterDisplay({ count, onReset, onToggleDebug, debugMode }: PeopleCounterDisplayProps) {
  return (
    <Card className="w-full">
      <CardHeader className="pb-2">
        <div className="flex justify-between items-center">
          <CardTitle className="text-lg">人数カウント</CardTitle>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={onToggleDebug}>
              {debugMode ? <EyeOffIcon className="h-4 w-4" /> : <EyeIcon className="h-4 w-4" />}
              <span className="ml-1 hidden sm:inline">{debugMode ? "詳細非表示" : "詳細表示"}</span>
            </Button>
            <Button variant="outline" size="sm" onClick={onReset}>
              <RefreshCcwIcon className="h-4 w-4" />
              <span className="ml-1 hidden sm:inline">リセット</span>
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-3 gap-4 text-center">
          <div className="flex flex-col p-2 bg-blue-50 dark:bg-blue-950 rounded-lg">
            <span className="text-sm text-muted-foreground flex items-center justify-center">
              <svg className="w-4 h-4 mr-1" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path
                  d="M5 12H19M19 12L13 6M19 12L13 18"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              左→右
            </span>
            <span className="text-2xl font-bold text-blue-600 dark:text-blue-400">{count.leftToRight}</span>
          </div>
          <div className="flex flex-col p-2 bg-amber-50 dark:bg-amber-950 rounded-lg">
            <span className="text-sm text-muted-foreground flex items-center justify-center">
              <svg className="w-4 h-4 mr-1" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path
                  d="M19 12H5M5 12L11 6M5 12L11 18"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              右→左
            </span>
            <span className="text-2xl font-bold text-amber-600 dark:text-amber-400">{count.rightToLeft}</span>
          </div>
          <div className="flex flex-col p-2 bg-green-50 dark:bg-green-950 rounded-lg">
            <span className="text-sm text-muted-foreground">合計</span>
            <span className="text-2xl font-bold text-green-600 dark:text-green-400">{count.total}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
