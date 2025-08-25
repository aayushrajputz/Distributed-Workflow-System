"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useToast } from "@/hooks/use-toast"
import { clearAllDummyData } from "@/lib/clear-dummy-data"

export default function ClearDataPage() {
  const { toast } = useToast()

  const handleClearData = () => {
    if (confirm('This will remove all dummy workflows and tasks. Are you sure?')) {
      clearAllDummyData()
      toast({
        title: "Data Cleared",
        description: "All dummy workflows and tasks have been removed. The page will reload.",
      })
    }
  }

  return (
    <div className="container mx-auto p-6">
      <Card>
        <CardHeader>
          <CardTitle>Clear Dummy Data</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="mb-4 text-muted-foreground">
            Remove all sample/dummy workflows and tasks from the application.
            Only user-created content will remain.
          </p>
          <Button onClick={handleClearData} variant="destructive">
            Clear All Dummy Data
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
