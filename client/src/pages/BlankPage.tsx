import { Link } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Construction, ArrowLeft, Home } from "lucide-react"

export function BlankPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-secondary/20 flex items-center justify-center p-4">
      <Card className="w-full max-w-md bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border-0 shadow-2xl">
        <CardHeader className="text-center">
          <div className="flex items-center justify-center mb-4">
            <div className="p-4 bg-gradient-to-r from-orange-500 to-yellow-500 rounded-full">
              <Construction className="h-12 w-12 text-white" />
            </div>
          </div>
          <CardTitle className="text-2xl font-bold bg-gradient-to-r from-orange-600 to-yellow-600 bg-clip-text text-transparent">
            Page Under Construction
          </CardTitle>
          <CardDescription className="text-gray-600 dark:text-gray-300 mt-2">
            This page is currently being developed and will be available soon.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-center space-y-2">
            <p className="text-sm text-muted-foreground">
              We're working hard to bring you this feature. Please check back later!
            </p>
          </div>
          
          <div className="flex flex-col gap-2">
            <Button asChild className="w-full bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700">
              <Link to="/">
                <Home className="h-4 w-4 mr-2" />
                Go to Dashboard
              </Link>
            </Button>
            <Button variant="outline" asChild className="w-full">
              <Link to="javascript:history.back()">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Go Back
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}