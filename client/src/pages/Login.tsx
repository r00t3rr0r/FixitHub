import { useState } from "react"
import { useForm } from "react-hook-form"
import { Link, useNavigate } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/hooks/useToast"
import { useAuth } from "@/contexts/AuthContext"
import { Eye, EyeOff, LogIn, User, Shield, Wrench, Copy } from "lucide-react"

interface LoginForm {
  email: string
  password: string
}

const exampleLogins = [
  {
    role: "Customer",
    email: "customer@example.com",
    password: "password123",
    icon: User,
    color: "bg-green-500",
    description: "Access customer dashboard, create orders, track repairs"
  },
  {
    role: "Staff",
    email: "staff@example.com",
    password: "password123",
    icon: Wrench,
    color: "bg-blue-500",
    description: "Manage assigned orders, track time, update repair status"
  },
  {
    role: "Admin",
    email: "admin@example.com",
    password: "admin123",
    icon: Shield,
    color: "bg-red-500",
    description: "Full system access, user management, analytics"
  }
]

export function Login() {
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const { register, handleSubmit, setValue, formState: { errors } } = useForm<LoginForm>()
  const { login } = useAuth()
  const navigate = useNavigate()
  const { toast } = useToast()

  const onSubmit = async (data: LoginForm) => {
    try {
      setIsLoading(true)
      await login(data.email, data.password)
      navigate("/")
    } catch (error: any) {
      toast({
        title: "Login Failed",
        description: error.message || "Invalid email or password",
        variant: "destructive"
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleExampleLogin = (email: string, password: string) => {
    setValue("email", email)
    setValue("password", password)

    // Store user info based on email for the mock system
    let role = 'customer';
    let name = 'John Doe';

    if (email === 'admin@example.com') {
      role = 'admin';
      name = 'Admin User';
    } else if (email === 'staff@example.com') {
      role = 'staff';
      name = 'Staff Member';
    }

    // Store in localStorage for the mock system
    localStorage.setItem('currentUserRole', role);
    localStorage.setItem('currentUserEmail', email);
    localStorage.setItem('currentUserName', name);

    toast({
      title: "Credentials filled",
      description: "Click 'Sign In' to login with these credentials"
    })
  }

  const copyToClipboard = (text: string, type: string) => {
    navigator.clipboard.writeText(text)
    toast({
      title: "Copied!",
      description: `${type} copied to clipboard`
    })
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 flex items-center justify-center p-4">
      <div className="w-full max-w-6xl grid lg:grid-cols-2 gap-8 items-center">
        {/* Left side - Login Form */}
        <div className="flex justify-center">
          <Card className="w-full max-w-md bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border-0 shadow-2xl">
            <CardHeader className="space-y-1 text-center">
              <div className="flex items-center justify-center mb-4">
                <div className="p-3 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full">
                  <LogIn className="h-8 w-8 text-white" />
                </div>
              </div>
              <CardTitle className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                Welcome to FixitHub
              </CardTitle>
              <CardDescription className="text-gray-600 dark:text-gray-300">
                Sign in to your account to continue
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="Enter your email"
                    {...register("email", {
                      required: "Email is required",
                      pattern: {
                        value: /^\S+@\S+$/i,
                        message: "Invalid email address"
                      }
                    })}
                    className="bg-white/50 dark:bg-gray-700/50 border-gray-200 dark:border-gray-600"
                  />
                  {errors.email && (
                    <p className="text-sm text-red-500">{errors.email.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      placeholder="Enter your password"
                      {...register("password", { required: "Password is required" })}
                      className="bg-white/50 dark:bg-gray-700/50 border-gray-200 dark:border-gray-600 pr-10"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                      onClick={() => setShowPassword(!showPassword)}
                      disabled={isLoading}
                    >
                      {showPassword ? (
                        <EyeOff className="h-4 w-4 text-gray-500" />
                      ) : (
                        <Eye className="h-4 w-4 text-gray-500" />
                      )}
                    </Button>
                  </div>
                  {errors.password && (
                    <p className="text-sm text-red-500">{errors.password.message}</p>
                  )}
                </div>

                <Button
                  type="submit"
                  className="w-full bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white font-medium py-2.5 transition-all duration-200 shadow-lg hover:shadow-xl"
                  disabled={isLoading}
                >
                  {isLoading ? "Signing in..." : "Sign In"}
                </Button>
              </form>

              <div className="mt-6 text-center">
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Don't have an account?{" "}
                  <Link
                    to="/register"
                    className="font-medium text-blue-600 hover:text-blue-500 transition-colors"
                  >
                    Sign up
                  </Link>
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right side - Example Logins */}
        <div className="space-y-6">
          <div className="text-center lg:text-left">
            <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
              Try Different User Roles
            </h2>
            <p className="text-gray-600 dark:text-gray-300 text-lg">
              Use these example accounts to explore the platform from different perspectives
            </p>
          </div>

          <div className="space-y-4">
            {exampleLogins.map((example) => {
              const IconComponent = example.icon
              return (
                <Card
                  key={example.role}
                  className="bg-white/60 dark:bg-gray-800/60 backdrop-blur-sm border border-gray-200/50 dark:border-gray-700/50 hover:shadow-lg transition-all duration-200 cursor-pointer group"
                  onClick={() => handleExampleLogin(example.email, example.password)}
                >
                  <CardContent className="p-6">
                    <div className="flex items-start gap-4">
                      <div className={`p-3 ${example.color} rounded-lg group-hover:scale-110 transition-transform duration-200`}>
                        <IconComponent className="h-6 w-6 text-white" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2">
                          <h3 className="font-semibold text-gray-900 dark:text-white">
                            {example.role} Account
                          </h3>
                          <Badge variant="outline" className="text-xs">
                            Demo
                          </Badge>
                        </div>
                        <p className="text-sm text-gray-600 dark:text-gray-300 mb-3">
                          {example.description}
                        </p>
                        <div className="space-y-2">
                          <div className="flex items-center gap-2 text-sm">
                            <span className="text-gray-500 dark:text-gray-400 w-16">Email:</span>
                            <code className="bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded text-xs font-mono flex-1">
                              {example.email}
                            </code>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0"
                              onClick={(e) => {
                                e.stopPropagation()
                                copyToClipboard(example.email, "Email")
                              }}
                            >
                              <Copy className="h-3 w-3" />
                            </Button>
                          </div>
                          <div className="flex items-center gap-2 text-sm">
                            <span className="text-gray-500 dark:text-gray-400 w-16">Password:</span>
                            <code className="bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded text-xs font-mono flex-1">
                              {example.password}
                            </code>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0"
                              onClick={(e) => {
                                e.stopPropagation()
                                copyToClipboard(example.password, "Password")
                              }}
                            >
                              <Copy className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="mt-4 pt-4 border-t border-gray-200/50 dark:border-gray-700/50">
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full group-hover:bg-primary group-hover:text-primary-foreground transition-colors"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleExampleLogin(example.email, example.password)
                        }}
                      >
                        Use This Account
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>

          <Alert className="bg-blue-50/50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800">
            <LogIn className="h-4 w-4 text-blue-600" />
            <AlertDescription className="text-blue-800 dark:text-blue-200">
              <strong>Quick Start:</strong> Click on any account card above to automatically fill the login form, then click "Sign In" to access that user role.
            </AlertDescription>
          </Alert>
        </div>
      </div>
    </div>
  )
}