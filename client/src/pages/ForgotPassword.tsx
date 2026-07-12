import { FormEvent, useState } from 'react'
import { SEO } from '@/components/SEO'
import { Link } from 'react-router-dom'
import { Mail } from 'lucide-react'
import { forgotPassword } from '@/api/auth'
import { TopBar } from '@/components/home/TopBar'
import { McRepairNav } from '@/components/home/McRepairNav'
import { Footer } from '@/components/Footer'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useToast } from '@/hooks/useToast'

export function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const { toast } = useToast()

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!email.trim()) {
      toast({
        title: 'E-Mail erforderlich',
        description: 'Bitte geben Sie Ihre E-Mail-Adresse ein.',
        variant: 'destructive'
      })
      return
    }

    try {
      setIsLoading(true)
      await forgotPassword(email.trim())
      setSubmitted(true)
      toast({
        title: 'Anfrage gesendet',
        description: 'Wenn ein Konto existiert, erhalten Sie einen Link zum Zuruecksetzen des Passworts.'
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Fehler beim Senden der Anfrage'
      toast({
        title: 'Fehler',
        description: message,
        variant: 'destructive'
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div style={{ backgroundColor: 'var(--off-white)', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <SEO
        title="Passwort vergessen – McRepair.de"
        description="Passwort zurücksetzen leicht gemacht. Geben Sie Ihre E-Mail-Adresse ein und erhalten Sie einen Link zum Zurücksetzen."
        canonical="/forgot-password"
        noindex={true}
      />
      <TopBar />
      <McRepairNav />

      <section style={{ flex: 1, padding: '80px 24px', maxWidth: '680px', width: '100%', margin: '0 auto' }}>
        <Card className="w-full shadow-xl border-0" style={{ borderRadius: 'var(--radius-lg)' }}>
          <CardHeader className="space-y-2 text-center" style={{ background: 'linear-gradient(135deg, var(--primary-blue), var(--primary-blue-light))', borderTopLeftRadius: 'var(--radius-lg)', borderTopRightRadius: 'var(--radius-lg)' }}>
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-white/20 text-white">
              <Mail className="h-6 w-6" />
            </div>
            <CardTitle className="text-white">Passwort vergessen</CardTitle>
            <CardDescription className="text-blue-100">
              Geben Sie Ihre E-Mail-Adresse ein. Wir senden Ihnen einen sicheren Reset-Link.
            </CardDescription>
          </CardHeader>

          <CardContent className="pt-6">
            {submitted ? (
              <div className="space-y-4 text-sm" style={{ color: 'var(--gray-700)' }}>
                <p>
                  Wenn ein Konto mit dieser E-Mail-Adresse existiert, wurde ein Link zum Zuruecksetzen
                  versendet.
                </p>
                <p>Bitte pruefen Sie auch Ihren Spam-Ordner.</p>
                <Link to="/login" className="hover:underline" style={{ color: 'var(--primary-blue)' }}>
                  Zurueck zum Login
                </Link>
              </div>
            ) : (
              <form className="space-y-4" onSubmit={handleSubmit}>
                <div className="space-y-2">
                  <Label htmlFor="email">E-Mail</Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="name@beispiel.de"
                    autoComplete="email"
                    required
                  />
                </div>

                <Button
                  type="submit"
                  className="w-full"
                  style={{ background: 'var(--primary-blue)', color: 'white' }}
                  disabled={isLoading}
                >
                  {isLoading ? 'Sende Link...' : 'Reset-Link senden'}
                </Button>

                <div className="text-center text-sm">
                  <Link to="/login" className="hover:underline" style={{ color: 'var(--primary-blue)' }}>
                    Zurueck zum Login
                  </Link>
                </div>
              </form>
            )}
          </CardContent>
        </Card>
      </section>

      <Footer />
    </div>
  )
}
