import { useState } from "react"
import { SEO } from '@/components/SEO'
import { useForm } from "react-hook-form"
import { useNavigate } from "react-router-dom"
import { useTranslation } from "react-i18next"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useToast } from "@/hooks/useToast"
import { UserPlus, Mail, Phone, Lock, User, ArrowRight, CheckCircle } from "lucide-react"
import { useAuth } from "@/contexts/AuthContext"
import { TopBar } from "@/components/home/TopBar"
import { McRepairNav } from "@/components/home/McRepairNav"
import { Footer } from "@/components/Footer"

type RegisterForm = {
  email: string
  password: string
  firstName: string
  lastName: string
  phone: string
}

export function Register() {
  const { t } = useTranslation()
  const [loading, setLoading] = useState(false)
  const [registrationSuccess, setRegistrationSuccess] = useState(false)
  const [registeredEmail, setRegisteredEmail] = useState('')
  const { toast } = useToast()
  const { register: registerUser } = useAuth()
  const navigate = useNavigate()
  const { register, handleSubmit, formState: { errors } } = useForm<RegisterForm>()

  const onSubmit = async (data: RegisterForm) => {
    try {
      setLoading(true)
      console.log('Registering user with data:', data);
      await registerUser(data.email, data.password, data.firstName, data.lastName, data.phone);
      setRegisteredEmail(data.email)
      setRegistrationSuccess(true)
      toast({
        title: t('register.success', 'Erfolgreich registriert'),
        description: t('register.successMessage', 'Eine Bestätigungsmail wurde an Ihre E-Mail-Adresse gesendet'),
      })
    } catch (error) {
      console.log("Register error:", error)
      toast({
        variant: "destructive",
        title: t('register.error', 'Fehler'),
        description: error?.message || t('register.errorMessage', 'Registrierung fehlgeschlagen'),
      })
    } finally {
      setLoading(false)
    }
  }

  // Show success screen after registration
  if (registrationSuccess) {
    return (
      <div style={{ backgroundColor: 'var(--off-white)', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
        <TopBar />
        <McRepairNav />

        <section style={{ flex: 1, padding: '80px 24px', maxWidth: '600px', margin: '0 auto' }}>
          <div style={{
            background: 'white',
            padding: '48px',
            borderRadius: 'var(--radius-lg)',
            boxShadow: 'var(--shadow-lg)',
            textAlign: 'center'
          }}>
            <div style={{ marginBottom: '32px' }}>
              <div style={{
                width: '80px',
                height: '80px',
                background: 'linear-gradient(135deg, var(--primary-blue), var(--primary-blue-light))',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 24px'
              }}>
                <Mail style={{ width: '40px', height: '40px', color: 'white' }} />
              </div>

              <h1 style={{ fontSize: '2rem', fontWeight: '700', color: 'var(--primary-blue)', marginBottom: '16px' }}>
                {t('register.checkEmail', 'Überprüfen Sie Ihre E-Mail')}
              </h1>

              <p style={{
                color: 'var(--gray-600)',
                fontSize: '1.05rem',
                lineHeight: '1.6',
                marginBottom: '24px'
              }}>
                {t('register.checkEmailMessage', `Wir haben eine Bestätigungsmail an <strong>${registeredEmail}</strong> gesendet. Bitte klicken Sie auf den Link in der E-Mail, um Ihr Konto zu aktivieren.`)}
              </p>

              <div style={{
                background: 'var(--off-white)',
                padding: '24px',
                borderRadius: 'var(--radius-md)',
                marginBottom: '32px',
                textAlign: 'left'
              }}>
                <h3 style={{ fontSize: '1rem', fontWeight: '600', marginBottom: '16px', color: 'var(--primary-blue)' }}>
                  {t('register.nextSteps', 'Nächste Schritte:')}
                </h3>
                <ol style={{ paddingLeft: '24px', color: 'var(--gray-600)', lineHeight: '2' }}>
                  <li>{t('register.step1', 'Öffnen Sie Ihr E-Mail-Postfach')}</li>
                  <li>{t('register.step2', 'Suchen Sie nach einer E-Mail von uns (prüfen Sie auch Ihren Spam-Ordner)')}</li>
                  <li>{t('register.step3', 'Klicken Sie auf den Verifizierungslink in der E-Mail')}</li>
                  <li>{t('register.step4', 'Ihr Konto ist jetzt aktiviert und Sie können sich anmelden')}</li>
                </ol>
              </div>

              <p style={{ fontSize: '0.9rem', color: 'var(--gray-500)', marginBottom: '32px' }}>
                {t('register.didNotReceive', 'E-Mail nicht erhalten?')}{' '}
                <span style={{ color: 'var(--primary-blue)', fontWeight: '600' }}>
                  {t('register.checkSpam', 'Überprüfen Sie Ihren Spam-Ordner oder probieren Sie es später erneut.')}
                </span>
              </p>

              <button
                onClick={() => navigate('/login')}
                style={{
                  background: 'var(--primary-blue)',
                  color: 'white',
                  padding: '14px 48px',
                  borderRadius: 'var(--radius-md)',
                  fontSize: '1rem',
                  fontWeight: '600',
                  border: 'none',
                  cursor: 'pointer',
                  transition: 'var(--transition)',
                  marginRight: '16px'
                }}
                onMouseEnter={(e) => e.currentTarget.style.opacity = '0.8'}
                onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}
              >
                {t('register.backToLogin', 'Zur Anmeldung')}
              </button>

              <button
                onClick={() => setRegistrationSuccess(false)}
                style={{
                  background: 'transparent',
                  color: 'var(--primary-blue)',
                  padding: '14px 48px',
                  borderRadius: 'var(--radius-md)',
                  fontSize: '1rem',
                  fontWeight: '600',
                  border: '2px solid var(--primary-blue)',
                  cursor: 'pointer',
                  transition: 'var(--transition)'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'var(--primary-blue)'
                  e.currentTarget.style.color = 'white'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'transparent'
                  e.currentTarget.style.color = 'var(--primary-blue)'
                }}
              >
                {t('register.registerAnother', 'Ein weiteres Konto erstellen')}
              </button>
            </div>
          </div>
        </section>

        <Footer />
      </div>
    )
  }

  const benefits = [
    { icon: CheckCircle, text: t('register.benefit1', 'Schneller Reparatur-Service') },
    { icon: CheckCircle, text: t('register.benefit2', 'Statusverfolgung Ihrer Reparaturen') },
    { icon: CheckCircle, text: t('register.benefit3', 'Persönlicher Kundenbereich') },
    { icon: CheckCircle, text: t('register.benefit4', 'Exklusive Angebote & Rabatte') },
  ]

  return (
    <div style={{ backgroundColor: 'var(--off-white)', minHeight: '100vh' }}>
      <SEO
        title="Konto erstellen – FixitHub Registrierung"
        description="Jetzt kostenlos bei FixitHub registrieren. Aufträge online verwalten, Reparaturstatus verfolgen und exklusive Vorteile genießen."
        canonical="/register"
      />
      {/* Top Bar */}
      <TopBar />

      {/* Main Navigation */}
      <McRepairNav />

      {/* Register Section */}
      <section style={{ 
        padding: '80px 24px',
        maxWidth: '1200px',
        margin: '0 auto'
      }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr',
          gap: '48px',
          alignItems: 'start'
        }}
        className="register-grid">
          {/* Left Column - Benefits & Info */}
          <div style={{ order: 2 }} className="register-info">
            <div style={{
              background: 'linear-gradient(135deg, var(--primary-blue) 0%, var(--primary-blue-dark) 100%)',
              padding: '48px',
              borderRadius: 'var(--radius-lg)',
              color: 'var(--white)',
              boxShadow: 'var(--shadow-lg)'
            }}>
              <div style={{ marginBottom: '32px' }}>
                <h1 style={{
                  fontSize: '2.5rem',
                  fontWeight: '700',
                  marginBottom: '16px',
                  lineHeight: '1.2'
                }}>
                  {t('register.title', 'Konto erstellen')}
                </h1>
                <p style={{
                  fontSize: '1.1rem',
                  opacity: '0.9',
                  lineHeight: '1.6'
                }}>
                  {t('register.subtitle', 'Registrieren Sie sich jetzt und profitieren Sie von unserem professionellen Reparatur-Service')}
                </p>
              </div>

              <div style={{ 
                display: 'flex',
                flexDirection: 'column',
                gap: '20px'
              }}>
                {benefits.map((benefit, index) => (
                  <div key={index} style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '16px'
                  }}>
                    <benefit.icon style={{
                      width: '24px',
                      height: '24px',
                      color: 'var(--accent-yellow)',
                      flexShrink: 0
                    }} />
                    <span style={{ fontSize: '1rem' }}>{benefit.text}</span>
                  </div>
                ))}
              </div>

              <div style={{
                marginTop: '40px',
                paddingTop: '32px',
                borderTop: '1px solid rgba(255, 255, 255, 0.2)'
              }}>
                <p style={{ 
                  fontSize: '0.9rem',
                  opacity: '0.8',
                  marginBottom: '16px'
                }}>
                  {t('register.hasAccount', 'Haben Sie bereits ein Konto?')}
                </p>
                <button
                  onClick={() => navigate("/login")}
                  style={{
                    background: 'transparent',
                    border: '2px solid var(--accent-yellow)',
                    color: 'var(--accent-yellow)',
                    padding: '12px 32px',
                    borderRadius: 'var(--radius-md)',
                    fontSize: '1rem',
                    fontWeight: '600',
                    cursor: 'pointer',
                    transition: 'var(--transition)',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'var(--accent-yellow)'
                    e.currentTarget.style.color = 'var(--primary-blue)'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'transparent'
                    e.currentTarget.style.color = 'var(--accent-yellow)'
                  }}
                >
                  {t('register.signIn', 'Jetzt anmelden')}
                  <ArrowRight style={{ width: '18px', height: '18px' }} />
                </button>
              </div>
            </div>
          </div>

          {/* Right Column - Registration Form */}
          <div style={{ order: 1 }} className="register-form">
            <div style={{
              background: 'var(--white)',
              padding: '48px',
              borderRadius: 'var(--radius-lg)',
              boxShadow: 'var(--shadow-lg)'
            }}>
              <div style={{ marginBottom: '32px', textAlign: 'center' }}>
                <div style={{
                  width: '64px',
                  height: '64px',
                  background: 'linear-gradient(135deg, var(--primary-blue), var(--primary-blue-light))',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 20px'
                }}>
                  <UserPlus style={{ width: '32px', height: '32px', color: 'var(--white)' }} />
                </div>
                <h2 style={{
                  fontSize: '1.75rem',
                  fontWeight: '700',
                  color: 'var(--primary-blue)',
                  marginBottom: '8px'
                }}>
                  {t('register.formTitle', 'Registrierung')}
                </h2>
                <p style={{
                  color: 'var(--gray-500)',
                  fontSize: '0.95rem'
                }}>
                  {t('register.formSubtitle', 'Füllen Sie das Formular aus, um Ihr Konto zu erstellen')}
                </p>
              </div>

              <form onSubmit={handleSubmit(onSubmit)} style={{ 
                display: 'flex',
                flexDirection: 'column',
                gap: '24px'
              }}>
                <div style={{ 
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                  gap: '16px'
                }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <Label htmlFor="firstName" style={{
                      fontSize: '0.9rem',
                      fontWeight: '600',
                      color: 'var(--gray-700)'
                    }}>
                      <User style={{ width: '16px', height: '16px', display: 'inline', marginRight: '6px' }} />
                      {t('register.firstName', 'Vorname')}
                    </Label>
                    <Input
                      id="firstName"
                      placeholder={t('register.firstNamePlaceholder', 'Ihr Vorname')}
                      {...register("firstName", { required: t('register.firstNameRequired', 'Vorname ist erforderlich') })}
                      style={{
                        padding: '12px',
                        fontSize: '1rem',
                        borderRadius: 'var(--radius-md)',
                        border: '2px solid var(--gray-200)',
                        transition: 'var(--transition)'
                      }}
                    />
                    {errors.firstName && (
                      <p style={{ fontSize: '0.85rem', color: 'var(--danger)' }}>
                        {errors.firstName.message}
                      </p>
                    )}
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <Label htmlFor="lastName" style={{
                      fontSize: '0.9rem',
                      fontWeight: '600',
                      color: 'var(--gray-700)'
                    }}>
                      <User style={{ width: '16px', height: '16px', display: 'inline', marginRight: '6px' }} />
                      {t('register.lastName', 'Nachname')}
                    </Label>
                    <Input
                      id="lastName"
                      placeholder={t('register.lastNamePlaceholder', 'Ihr Nachname')}
                      {...register("lastName", { required: t('register.lastNameRequired', 'Nachname ist erforderlich') })}
                      style={{
                        padding: '12px',
                        fontSize: '1rem',
                        borderRadius: 'var(--radius-md)',
                        border: '2px solid var(--gray-200)',
                        transition: 'var(--transition)'
                      }}
                    />
                    {errors.lastName && (
                      <p style={{ fontSize: '0.85rem', color: 'var(--danger)' }}>
                        {errors.lastName.message}
                      </p>
                    )}
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <Label htmlFor="email" style={{
                    fontSize: '0.9rem',
                    fontWeight: '600',
                    color: 'var(--gray-700)'
                  }}>
                    <Mail style={{ width: '16px', height: '16px', display: 'inline', marginRight: '6px' }} />
                    {t('register.email', 'E-Mail')}
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder={t('register.emailPlaceholder', 'ihre@email.de')}
                    {...register("email", { 
                      required: t('register.emailRequired', 'E-Mail ist erforderlich'),
                      pattern: {
                        value: /^\S+@\S+$/i,
                        message: t('register.emailInvalid', 'Ungültige E-Mail-Adresse')
                      }
                    })}
                    style={{
                      padding: '12px',
                      fontSize: '1rem',
                      borderRadius: 'var(--radius-md)',
                      border: '2px solid var(--gray-200)',
                      transition: 'var(--transition)'
                    }}
                  />
                  {errors.email && (
                    <p style={{ fontSize: '0.85rem', color: 'var(--danger)' }}>
                      {errors.email.message}
                    </p>
                  )}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <Label htmlFor="phone" style={{
                    fontSize: '0.9rem',
                    fontWeight: '600',
                    color: 'var(--gray-700)'
                  }}>
                    <Phone style={{ width: '16px', height: '16px', display: 'inline', marginRight: '6px' }} />
                    {t('register.phone', 'Telefonnummer')}
                  </Label>
                  <Input
                    id="phone"
                    type="tel"
                    placeholder={t('register.phonePlaceholder', '+49 170 1234567')}
                    {...register("phone")}
                    style={{
                      padding: '12px',
                      fontSize: '1rem',
                      borderRadius: 'var(--radius-md)',
                      border: '2px solid var(--gray-200)',
                      transition: 'var(--transition)'
                    }}
                  />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <Label htmlFor="password" style={{
                    fontSize: '0.9rem',
                    fontWeight: '600',
                    color: 'var(--gray-700)'
                  }}>
                    <Lock style={{ width: '16px', height: '16px', display: 'inline', marginRight: '6px' }} />
                    {t('register.password', 'Passwort')}
                  </Label>
                  <Input
                    id="password"
                    type="password"
                    placeholder={t('register.passwordPlaceholder', 'Sicheres Passwort wählen')}
                    {...register("password", { 
                      required: t('register.passwordRequired', 'Passwort ist erforderlich'),
                      minLength: {
                        value: 6,
                        message: t('register.passwordMinLength', 'Passwort muss mindestens 6 Zeichen lang sein')
                      }
                    })}
                    style={{
                      padding: '12px',
                      fontSize: '1rem',
                      borderRadius: 'var(--radius-md)',
                      border: '2px solid var(--gray-200)',
                      transition: 'var(--transition)'
                    }}
                  />
                  {errors.password && (
                    <p style={{ fontSize: '0.85rem', color: 'var(--danger)' }}>
                      {errors.password.message}
                    </p>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  style={{
                    background: loading ? 'var(--gray-300)' : 'linear-gradient(135deg, var(--accent-yellow), var(--accent-yellow-hover))',
                    color: 'var(--primary-blue)',
                    padding: '16px 32px',
                    borderRadius: 'var(--radius-md)',
                    fontSize: '1.1rem',
                    fontWeight: '700',
                    border: 'none',
                    cursor: loading ? 'not-allowed' : 'pointer',
                    transition: 'var(--transition)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '12px',
                    width: '100%',
                    boxShadow: loading ? 'none' : 'var(--shadow-md)',
                    marginTop: '8px'
                  }}
                  onMouseEnter={(e) => {
                    if (!loading) {
                      e.currentTarget.style.transform = 'translateY(-2px)'
                      e.currentTarget.style.boxShadow = 'var(--shadow-lg)'
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!loading) {
                      e.currentTarget.style.transform = 'translateY(0)'
                      e.currentTarget.style.boxShadow = 'var(--shadow-md)'
                    }
                  }}
                >
                  {loading ? (
                    <>
                      <div style={{
                        width: '20px',
                        height: '20px',
                        border: '3px solid var(--primary-blue)',
                        borderTopColor: 'transparent',
                        borderRadius: '50%',
                        animation: 'spin 0.8s linear infinite'
                      }} />
                      {t('register.loading', 'Wird erstellt...')}
                    </>
                  ) : (
                    <>
                      <UserPlus style={{ width: '20px', height: '20px' }} />
                      {t('register.submit', 'Konto erstellen')}
                    </>
                  )}
                </button>
              </form>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <Footer />

      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        @media (min-width: 768px) {
          .register-grid {
            grid-template-columns: 1fr 1fr !important;
          }
          .register-info {
            order: 1 !important;
          }
          .register-form {
            order: 2 !important;
          }
        }

        input:focus {
          outline: none;
          border-color: var(--primary-blue) !important;
          box-shadow: 0 0 0 3px rgba(26, 42, 94, 0.1) !important;
        }
      `}</style>
    </div>
  )
}