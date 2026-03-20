import { useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ChevronRight, ChevronLeft, CheckCircle, RotateCcw, Wrench, Phone, MapPin } from 'lucide-react'
import { diagnoseData } from '@/data/diagnoseData'

interface VorabdiagnoseWizardProps {
  onResult?: (result: string) => void
  compact?: boolean
}

export function VorabdiagnoseWizard({ onResult, compact = false }: VorabdiagnoseWizardProps) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [currentStepId, setCurrentStepId] = useState('start')
  const [history, setHistory] = useState<string[]>([])

  const step = diagnoseData[currentStepId]
  const isResult = step?.answers.length === 0

  const getDepth = (stepId: string) => {
    if (stepId === 'start') return 0
    if (stepId.startsWith('q')) return 1
    if (stepId.startsWith('done_')) return 2
    return 1
  }

  const progress = isResult ? 100 : getDepth(currentStepId) === 0 ? 0 : getDepth(currentStepId) === 1 ? 40 : 75

  const handleAnswer = useCallback((nextStepId: string) => {
    setHistory(prev => [...prev, currentStepId])
    setCurrentStepId(nextStepId)
    const nextStep = diagnoseData[nextStepId]
    if (nextStep?.answers.length === 0 && onResult) {
      onResult(nextStep.question)
    }
  }, [currentStepId, onResult])

  const handleBack = useCallback(() => {
    if (history.length > 0) {
      const prev = history[history.length - 1]
      setHistory(h => h.slice(0, -1))
      setCurrentStepId(prev)
    }
  }, [history])

  const handleRestart = useCallback(() => {
    setHistory([])
    setCurrentStepId('start')
  }, [])

  if (!step) return null

  return (
    <div className="diagnose-wizard">
      {/* Progress bar */}
      <div className="diagnose-progress">
        <div className="diagnose-progress-bar" style={{ width: `${progress}%` }} />
      </div>

      {isResult ? (
        /* Result view */
        <div className="diagnose-result">
          <div className="diagnose-result-card">
            <div className="diagnose-result-icon">
              <CheckCircle className="w-5 h-5" />
            </div>
            <h3>{t('vorabdiagnose.result', 'Unsere Einschätzung')}</h3>
            <p>{step.question}</p>
          </div>

          <div className="diagnose-contact-box">
            <h4>{t('vorabdiagnose.needHelp', 'Sie brauchen Hilfe?')}</h4>
            <p><strong><Phone className="inline w-3.5 h-3.5" /> {t('vorabdiagnose.phone', 'Telefon')}:</strong> <a href="tel:+4930403688951">030 / 403 68 89 51</a></p>
            <p><strong>{t('vorabdiagnose.hotlineHours', 'Hotline-Zeiten')}:</strong> 10–12 Uhr, 14–16 Uhr</p>
            <p><strong>✉️ {t('vorabdiagnose.contact', 'Kontakt')}:</strong> <a href="mailto:kontakt@mcrepair.de">kontakt@mcrepair.de</a></p>
          </div>

          <div className="diagnose-cta-row">
            <button
              className="diagnose-cta-primary"
              onClick={() => navigate('/#hero')}
            >
              <Wrench className="w-4 h-4" />
              {t('vorabdiagnose.bookRepair', 'Reparatur buchen')}
            </button>
            <button
              className="diagnose-cta-secondary"
              onClick={handleRestart}
            >
              <RotateCcw className="w-4 h-4" />
              {t('vorabdiagnose.newDiagnosis', 'Neue Diagnose')}
            </button>
          </div>
        </div>
      ) : (
        /* Question view */
        <>
          <div className="diagnose-wizard-header">
            <div className="diagnose-step-badge">
              {getDepth(currentStepId) === 0
                ? t('vorabdiagnose.step', 'Schritt') + ' 1'
                : t('vorabdiagnose.step', 'Schritt') + ' ' + (getDepth(currentStepId) + 1)}
            </div>
            <h2>{step.question}</h2>
          </div>

          <div className="diagnose-wizard-body">
            {step.answers.map((answer, idx) => (
              <button
                key={idx}
                className="diagnose-answer-btn"
                onClick={() => handleAnswer(answer.next)}
              >
                <ChevronRight className="w-4 h-4 flex-shrink-0" />
                {answer.text}
              </button>
            ))}
          </div>

          {history.length > 0 && (
            <div className="diagnose-wizard-footer">
              <button className="diagnose-back-btn" onClick={handleBack}>
                <ChevronLeft className="w-4 h-4" />
                {t('vorabdiagnose.back', 'Zurück')}
              </button>
            </div>
          )}
        </>
      )}

      {/* Info cards below wizard (only on non-compact mode) */}
      {!compact && !isResult && (
        <div className="diagnose-info-row-inside">
          <div className="diagnose-info-mini">
            <Phone className="w-4 h-4" />
            <span><a href="tel:+4930403688951">030 / 403 68 89 51</a></span>
          </div>
          <div className="diagnose-info-mini">
            <MapPin className="w-4 h-4" />
            <span><a href="/about">108 Annahmestellen</a></span>
          </div>
        </div>
      )}
    </div>
  )
}
