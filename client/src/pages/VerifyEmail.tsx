import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useToast } from '@/hooks/useToast'
import { TopBar } from '@/components/home/TopBar'
import { McRepairNav } from '@/components/home/McRepairNav'
import { Footer } from '@/components/Footer'
import { CheckCircle, AlertCircle, Loader } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { mergeGuestCartWithUserCart } from '@/utils/guestCart'
import { addToCart, addRepairOrderToCart } from '@/api/shop'

export function VerifyEmail() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { toast } = useToast()
  const [verifying, setVerifying] = useState(true)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState<string>('')

  useEffect(() => {
    const verifyEmail = async () => {
      const token = searchParams.get('token')
      const redirectParam = searchParams.get('redirect')
      const source = searchParams.get('source')

      if (!token) {
        setError('Kein Verifizierungstoken gefunden. Der Link ist möglicherweise ungültig.')
        setVerifying(false)
        return
      }

      try {
        const response = await fetch('/api/auth/verify-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token })
        })

        const data = await response.json()

        if (response.ok && data.success) {
          if (data.accessToken && data.refreshToken) {
            localStorage.setItem('accessToken', data.accessToken)
            localStorage.setItem('refreshToken', data.refreshToken)
          }

          if (data.user) {
            const userPayload = {
              _id: data.user._id,
              email: data.user.email,
              firstName: data.user.firstName,
              lastName: data.user.lastName,
              role: data.user.role,
            }
            localStorage.setItem('user', JSON.stringify(userPayload))
          }

          // Merge guest cart (localStorage) into the freshly activated user's server cart.
          // Without this, services chosen before registration are lost after verification.
          try {
            await mergeGuestCartWithUserCart({ addToCart, addRepairOrderToCart })
            console.log('VerifyEmail: Guest cart merged into user cart')
          } catch (mergeError) {
            console.error('VerifyEmail: Failed to merge guest cart:', mergeError)
            // Non-fatal: continue with verification success flow
          }

          setSuccess(true)
          toast({ title: 'Erfolg', description: data.message || 'E-Mail-Adresse erfolgreich verifiziert!' })

          const hasCheckoutSource = source === 'checkout' || redirectParam?.includes('/cart')
          const safeRedirectTarget = redirectParam && redirectParam.startsWith('/') ? redirectParam : '/login'

          setTimeout(() => {
            if (hasCheckoutSource) {
              window.location.href = safeRedirectTarget
              return
            }
            navigate(safeRedirectTarget)
          }, 3000)
        } else {
          setError(data.message || 'Die E-Mail-Verificarung ist fehlgeschlagen. Der Token ist möglicherweise abgelaufen.')
          toast({ title: 'Fehler', description: data.message || 'Verifikation fehlgeschlagen', variant: 'destructive' })
        }
      } catch (err: any) {
        setError(err.message || 'Ein Fehler ist aufgetreten. Bitte versuchen Sie es später erneut.')
        toast({ title: 'Verbindungsfehler', description: err.message || 'Verifikation konnte nicht durchgeführt werden', variant: 'destructive' })
      } finally {
        setVerifying(false)
      }
    }

    verifyEmail()
  }, [searchParams, navigate, toast])

  return (
    <div style={{ backgroundColor: 'var(--off-white)', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <TopBar />
      <McRepairNav />

      <section style={{ flex: 1, padding: '80px 24px', maxWidth: '680px', width: '100%', margin: '0 auto' }}>
        <Card className="w-full shadow-xl border-0" style={{ borderRadius: 'var(--radius-lg)' }}>
          <CardHeader
            className="text-center space-y-2"
            style={{
              background: 'linear-gradient(135deg, var(--primary-blue), var(--primary-blue-light))',
              borderTopLeftRadius: 'var(--radius-lg)',
              borderTopRightRadius: 'var(--radius-lg)'
            }}
          >
            <CardTitle className="text-white">E-Mail Verifizierung</CardTitle>
            <CardDescription className="text-blue-100">
              Wir pruefen den Sicherheitslink fuer Ihr Kundenkonto.
            </CardDescription>
          </CardHeader>

          <CardContent className="pt-8 text-center">
          {verifying ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '24px' }}>
              <div style={{
                width: '80px',
                height: '80px',
                background: 'linear-gradient(135deg, var(--primary-blue), var(--primary-blue-light))',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <Loader style={{ width: '40px', height: '40px', color: 'white', animation: 'spin 2s linear infinite' }} />
              </div>
              <div>
                <h1 style={{ fontSize: '1.75rem', fontWeight: '700', color: 'var(--primary-blue)', marginBottom: '8px' }}>
                  E-Mail-Adresse wird verifiziert...
                </h1>
                <p style={{ color: 'var(--gray-600)', fontSize: '1rem' }}>
                  Bitte warten Sie, während wir Ihre E-Mail-Adresse bestätigen.
                </p>
              </div>
            </div>
          ) : success ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '24px' }}>
              <div style={{
                width: '80px',
                height: '80px',
                background: '#10b981',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <CheckCircle style={{ width: '40px', height: '40px', color: 'white' }} />
              </div>
              <div>
                <h1 style={{ fontSize: '1.75rem', fontWeight: '700', color: '#059669', marginBottom: '8px' }}>
                  Verifizierung erfolgreich!
                </h1>
                <p style={{ color: 'var(--gray-600)', fontSize: '1rem', marginBottom: '24px' }}>
                  Ihre E-Mail-Adresse wurde erfolgreich bestätigt. Ihr Konto ist jetzt aktiv und Sie können sich anmelden.
                </p>
                <p style={{ color: 'var(--gray-500)', fontSize: '0.9rem' }}>
                  Sie werden automatisch zur Anmeldung weitergeleitet...
                </p>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '24px' }}>
              <div style={{
                width: '80px',
                height: '80px',
                background: '#ef4444',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <AlertCircle style={{ width: '40px', height: '40px', color: 'white' }} />
              </div>
              <div>
                <h1 style={{ fontSize: '1.75rem', fontWeight: '700', color: '#dc2626', marginBottom: '8px' }}>
                  Verifizierung fehlgeschlagen
                </h1>
                <p style={{ color: 'var(--gray-600)', fontSize: '1rem', marginBottom: '24px' }}>
                  {error}
                </p>
                <Button
                  onClick={() => navigate('/register')}
                  style={{
                    background: 'var(--primary-blue)',
                    color: 'white',
                    padding: '12px 32px',
                    fontSize: '1rem',
                  }}
                >
                  Zurück zur Registrierung
                </Button>
              </div>
            </div>
          )}
          </CardContent>
        </Card>
      </section>

      <Footer />

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
}
