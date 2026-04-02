import { FormEvent, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { CheckCircle2, ShieldCheck } from 'lucide-react'
import { getPasswordPolicy, resetPassword } from '@/api/auth'
import { TopBar } from '@/components/home/TopBar'
import { McRepairNav } from '@/components/home/McRepairNav'
import { Footer } from '@/components/Footer'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useToast } from '@/hooks/useToast'

interface PasswordPolicy {
  minLength: number
  requireUppercase: boolean
  requireLowercase: boolean
  requireNumbers: boolean
  requireSpecialChars: boolean
}

const defaultPolicy: PasswordPolicy = {
  minLength: 8,
  requireUppercase: true,
  requireLowercase: true,
  requireNumbers: true,
  requireSpecialChars: false
}

const getRuleList = (policy: PasswordPolicy): string[] => {
  const rules: string[] = [`Mindestens ${policy.minLength} Zeichen`]

  if (policy.requireUppercase) rules.push('Mindestens 1 Grossbuchstabe')
  if (policy.requireLowercase) rules.push('Mindestens 1 Kleinbuchstabe')
  if (policy.requireNumbers) rules.push('Mindestens 1 Zahl')
  if (policy.requireSpecialChars) rules.push('Mindestens 1 Sonderzeichen')

  return rules
}

const validatePassword = (password: string, policy: PasswordPolicy): string[] => {
  const failedRules: string[] = []

  if (password.length < policy.minLength) failedRules.push(`Mindestens ${policy.minLength} Zeichen`) 
  if (policy.requireUppercase && !/[A-Z]/.test(password)) failedRules.push('Mindestens 1 Grossbuchstabe')
  if (policy.requireLowercase && !/[a-z]/.test(password)) failedRules.push('Mindestens 1 Kleinbuchstabe')
  if (policy.requireNumbers && !/[0-9]/.test(password)) failedRules.push('Mindestens 1 Zahl')
  if (policy.requireSpecialChars && !/[^A-Za-z0-9]/.test(password)) failedRules.push('Mindestens 1 Sonderzeichen')

  return failedRules
}

export function ResetPassword() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { toast } = useToast()

  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)
  const [passwordPolicy, setPasswordPolicy] = useState<PasswordPolicy>(defaultPolicy)

  const token = searchParams.get('token') || ''

  useEffect(() => {
    const fetchPolicy = async () => {
      try {
        const policy = await getPasswordPolicy()
        setPasswordPolicy(policy)
      } catch (error) {
        console.error('Password policy could not be loaded:', error)
      }
    }

    fetchPolicy()
  }, [])

  const failedRules = useMemo(() => validatePassword(newPassword, passwordPolicy), [newPassword, passwordPolicy])
  const rules = useMemo(() => getRuleList(passwordPolicy), [passwordPolicy])

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!token) {
      toast({
        title: 'Ungueltiger Link',
        description: 'Es wurde kein gueltiger Reset-Token gefunden.',
        variant: 'destructive'
      })
      return
    }

    if (newPassword !== confirmPassword) {
      toast({
        title: 'Passwoerter stimmen nicht ueberein',
        description: 'Bitte bestaetigen Sie Ihr neues Passwort korrekt.',
        variant: 'destructive'
      })
      return
    }

    if (failedRules.length > 0) {
      toast({
        title: 'Password Policy nicht erfuellt',
        description: failedRules.join(', '),
        variant: 'destructive'
      })
      return
    }

    try {
      setIsLoading(true)
      await resetPassword(token, newPassword, confirmPassword)
      setIsSuccess(true)
      toast({
        title: 'Passwort aktualisiert',
        description: 'Sie koennen sich jetzt mit Ihrem neuen Passwort anmelden.'
      })
      setTimeout(() => navigate('/login'), 1800)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Passwort konnte nicht zurueckgesetzt werden'
      toast({
        title: 'Reset fehlgeschlagen',
        description: message,
        variant: 'destructive'
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div style={{ backgroundColor: 'var(--off-white)', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <TopBar />
      <McRepairNav />

      <section style={{ flex: 1, padding: '80px 24px', maxWidth: '720px', width: '100%', margin: '0 auto' }}>
        <Card className="w-full shadow-xl border-0" style={{ borderRadius: 'var(--radius-lg)' }}>
          <CardHeader
            className="text-center space-y-2"
            style={{
              background: 'linear-gradient(135deg, var(--primary-blue), var(--primary-blue-light))',
              borderTopLeftRadius: 'var(--radius-lg)',
              borderTopRightRadius: 'var(--radius-lg)'
            }}
          >
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-white/20 text-white">
              {isSuccess ? <CheckCircle2 className="h-6 w-6" /> : <ShieldCheck className="h-6 w-6" />}
            </div>
            <CardTitle className="text-white">Neues Passwort setzen</CardTitle>
            <CardDescription className="text-blue-100">
              Das neue Passwort muss die Sicherheitsregeln aus den Admin-Einstellungen erfuellen.
            </CardDescription>
          </CardHeader>

          <CardContent className="pt-6">
            {isSuccess ? (
              <div className="space-y-3 text-sm" style={{ color: 'var(--gray-700)' }}>
                <p>Ihr Passwort wurde erfolgreich aktualisiert.</p>
                <p>Sie werden zum Login weitergeleitet.</p>
                <Link to="/login" className="hover:underline" style={{ color: 'var(--primary-blue)' }}>
                  Jetzt zum Login
                </Link>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2 rounded-md border p-3 text-sm" style={{ backgroundColor: 'var(--off-white)', color: 'var(--gray-700)' }}>
                  <p className="font-medium">Erforderliche Regeln</p>
                  <ul className="list-disc pl-5">
                    {rules.map((rule) => (
                      <li key={rule} className={failedRules.includes(rule) ? 'text-red-600' : ''}>
                        {rule}
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="new-password">Neues Passwort</Label>
                  <Input
                    id="new-password"
                    type="password"
                    value={newPassword}
                    onChange={(event) => setNewPassword(event.target.value)}
                    autoComplete="new-password"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirm-password">Neues Passwort bestaetigen</Label>
                  <Input
                    id="confirm-password"
                    type="password"
                    value={confirmPassword}
                    onChange={(event) => setConfirmPassword(event.target.value)}
                    autoComplete="new-password"
                    required
                  />
                </div>

                <Button
                  type="submit"
                  className="w-full"
                  style={{ background: 'var(--primary-blue)', color: 'white' }}
                  disabled={isLoading || !token}
                >
                  {isLoading ? 'Aktualisiere Passwort...' : 'Passwort speichern'}
                </Button>

                {!token && (
                  <p className="text-sm text-red-600">Der Reset-Link ist ungueltig oder unvollstaendig.</p>
                )}

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
