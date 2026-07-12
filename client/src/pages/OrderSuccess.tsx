import { useEffect, useState } from 'react'
import { SEO } from '@/components/SEO'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { TopBar } from '@/components/home/TopBar'
import { McRepairNav } from '@/components/home/McRepairNav'
import { Footer } from '@/components/Footer'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { CheckCircle } from 'lucide-react'
import { useTranslation } from 'react-i18next'

export function OrderSuccessPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [orderData, setOrderData] = useState<any>(null)

  useEffect(() => {
    // Extract order data from search params or sessionStorage
    const orderNumbersParam = searchParams.get('orderNumbers')
    const bookingNumberParam = searchParams.get('bookingNumber')
    const totalParam = searchParams.get('total')

    const storedOrderData = sessionStorage.getItem('lastOrderData')
    
    if (storedOrderData) {
      try {
        setOrderData(JSON.parse(storedOrderData))
        sessionStorage.removeItem('lastOrderData')
      } catch (e) {
        console.error('Failed to parse stored order data:', e)
      }
    } else if (orderNumbersParam) {
      setOrderData({
        orderNumbers: orderNumbersParam.split(','),
        bookingNumber: bookingNumberParam,
        total: totalParam ? parseFloat(totalParam) : null,
      })
    }
  }, [searchParams])

  const handleBackToHome = () => {
    navigate('/')
  }

  const handleBackToShop = () => {
    navigate('/shop')
  }

  return (
    <div style={{ backgroundColor: 'var(--off-white)', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <SEO
        title="Bestellung erfolgreich – FixitHub"
        description="Vielen Dank für Ihre Bestellung! Alle Details finden Sie in Ihrer Bestätigungs-E-Mail. FixitHub kümmert sich um Ihren Auftrag."
        canonical="/order-success"
        noindex={true}
      />
      <TopBar />
      <McRepairNav />

      <section style={{ flex: 1, padding: '80px 24px', maxWidth: '680px', width: '100%', margin: '0 auto' }}>
        <Card className="w-full shadow-xl border-0" style={{ borderRadius: 'var(--radius-lg)' }}>
          {/* Header with gradient */}
          <div
            className="text-center space-y-2 p-8"
            style={{
              background: 'linear-gradient(135deg, var(--primary-blue), var(--primary-blue-light))',
              borderTopLeftRadius: 'var(--radius-lg)',
              borderTopRightRadius: 'var(--radius-lg)'
            }}
          >
            {/* Large green checkmark */}
            <div className="flex justify-center mb-4">
              <div className="relative">
                <div 
                  className="p-6 rounded-full flex items-center justify-center"
                  style={{ backgroundColor: 'rgba(255, 255, 255, 0.15)' }}
                >
                  <CheckCircle 
                    className="h-24 w-24" 
                    style={{ color: '#22c55e', strokeWidth: 1.5 }}
                  />
                </div>
              </div>
            </div>
            <h1 className="text-3xl font-bold text-white">
              {t('orderSuccess.title', { defaultValue: 'Bestellung erfolgreich!' })}
            </h1>
            <p className="text-base text-white/90">
              {t('orderSuccess.subtitle', { defaultValue: 'Vielen Dank für deine Bestellung bei McRepair.de' })}
            </p>
          </div>

          <CardContent className="p-8 space-y-6">
            {/* Thank you message */}
            <div className="text-center space-y-3 border-b border-gray-200 pb-6">
              <p className="text-base" style={{ color: 'var(--gray-700)' }}>
                {t('orderSuccess.thankYouMessage', { 
                  defaultValue: 'Deine Bestellung wurde erfolgreich aufgegeben und verarbeitet. Ein Bestätigungslink wurde an deine E-Mail-Adresse gesendet.' 
                })}
              </p>
              <p className="text-sm" style={{ color: 'var(--gray-600)' }}>
                {t('orderSuccess.trackingMessage', { 
                  defaultValue: 'Du kannst den Status deiner Bestellung jederzeit unter "Meine Bestellungen" verfolgen.' 
                })}
              </p>
            </div>

            {/* Order details if available */}
            {orderData && (orderData.orderNumbers || orderData.bookingNumber) && (
              <div 
                className="p-4 rounded-lg"
                style={{ backgroundColor: 'var(--gray-50)' }}
              >
                <h3 className="text-sm font-semibold mb-3" style={{ color: 'var(--primary-blue)' }}>
                  {t('orderSuccess.orderDetails', { defaultValue: 'Bestelldetails' })}
                </h3>
                <div className="space-y-2">
                  {orderData.bookingNumber && (
                    <div className="flex justify-between items-center text-sm">
                      <span style={{ color: 'var(--gray-600)' }}>
                        {t('orderSuccess.bookingNumber', { defaultValue: 'Buchungsnummer' })}:
                      </span>
                      <span className="font-semibold" style={{ color: 'var(--primary-blue)' }}>
                        {orderData.bookingNumber}
                      </span>
                    </div>
                  )}
                  {orderData.orderNumbers && orderData.orderNumbers.length > 0 && (
                    <div className="flex justify-between items-start text-sm">
                      <span style={{ color: 'var(--gray-600)' }}>
                        {t('orderSuccess.orderNumbers', { defaultValue: 'Bestellnummern' })}:
                      </span>
                      <div className="text-right">
                        {orderData.orderNumbers.map((num: string, idx: number) => (
                          <div key={idx} className="font-semibold" style={{ color: 'var(--primary-blue)' }}>
                            {num}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {orderData.total && (
                    <div className="flex justify-between items-center text-sm border-t border-gray-300 pt-2">
                      <span className="font-semibold" style={{ color: 'var(--gray-700)' }}>
                        {t('orderSuccess.total', { defaultValue: 'Gesamtbetrag' })}:
                      </span>
                      <span className="text-lg font-bold" style={{ color: 'var(--primary-blue)' }}>
                        {orderData.total.toFixed(2)} €
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Next steps */}
            <div 
              className="p-4 rounded-lg border-l-4"
              style={{ 
                backgroundColor: 'var(--gray-50)',
                borderLeftColor: 'var(--accent-yellow)'
              }}
            >
              <h3 className="text-sm font-semibold mb-2" style={{ color: 'var(--primary-blue)' }}>
                {t('orderSuccess.nextSteps', { defaultValue: 'Nächste Schritte' })}
              </h3>
              <ul className="text-sm space-y-1" style={{ color: 'var(--gray-700)' }}>
                <li>✓ {t('orderSuccess.step1', { defaultValue: 'Bestätigungsmail erhalten' })}</li>
                <li>✓ {t('orderSuccess.step2', { defaultValue: 'Bestellung in Bearbeitung' })}</li>
                <li>✓ {t('orderSuccess.step3', { defaultValue: 'Versand mit Tracking-Link' })}</li>
              </ul>
            </div>

            {/* Action buttons */}
            <div className="flex flex-col gap-3 pt-4">
              <Button
                onClick={handleBackToHome}
                className="h-11 w-full font-semibold text-base rounded-lg transition-all duration-300"
                style={{
                  backgroundColor: 'var(--accent-yellow)',
                  color: 'var(--primary-blue)',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--accent-yellow-hover, #e5ab00)')}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'var(--accent-yellow)')}
              >
                {t('orderSuccess.backToHome', { defaultValue: 'Zur Homepage' })}
              </Button>
              <Button
                onClick={handleBackToShop}
                variant="outline"
                className="h-11 w-full font-semibold text-base rounded-lg transition-all duration-300"
                style={{
                  borderColor: 'var(--primary-blue)',
                  color: 'var(--primary-blue)',
                }}
              >
                {t('orderSuccess.continueShopping', { defaultValue: 'Weiter einkaufen' })}
              </Button>
            </div>

            {/* Support info */}
            <div className="text-center pt-4 border-t border-gray-200">
              <p className="text-xs" style={{ color: 'var(--gray-600)' }}>
                {t('orderSuccess.needHelp', { defaultValue: 'Benötigst du Hilfe?' })}{' '}
                <a 
                  href="/contact" 
                  className="font-semibold underline"
                  style={{ color: 'var(--primary-blue)' }}
                >
                  {t('orderSuccess.contactUs', { defaultValue: 'Kontaktiere uns' })}
                </a>
              </p>
            </div>
          </CardContent>
        </Card>
      </section>

      <Footer />
    </div>
  )
}
