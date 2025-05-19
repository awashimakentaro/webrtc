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
            </Button>
            <Button variant="outline" size="sm" onClick={onReset}>
              <RefreshCcwIcon className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-3 gap-4 text-center">
          <div className="flex flex-col">
            <span className="text-sm text-muted-foreground">左→右</span>
            <span className="text-2xl font-bold">{count.leftToRight}</span>
          </div>
          <div className="flex flex-col">
            <span className="text-sm text-muted-foreground">右→左</span>
            <span className="text-2xl font-bold">{count.rightToLeft}</span>
          </div>
          <div className="flex flex-col">
            <span className="text-sm text-muted-foreground">合計</span>
            <span className="text-2xl font-bold">{count.total}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
