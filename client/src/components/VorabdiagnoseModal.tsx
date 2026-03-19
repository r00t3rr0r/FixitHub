import { useEffect, useCallback } from 'react'
import { X, ClipboardCheck } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { VorabdiagnoseWizard } from './VorabdiagnoseWizard'

interface VorabdiagnoseModalProps {
  isOpen: boolean
  onClose: () => void
}

export function VorabdiagnoseModal({ isOpen, onClose }: VorabdiagnoseModalProps) {
  const { t } = useTranslation()

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') onClose()
  }, [onClose])

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown)
      document.body.style.overflow = 'hidden'
    }
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = ''
    }
  }, [isOpen, handleKeyDown])

  if (!isOpen) return null

  return (
    <div
      className="diagnose-modal-overlay open"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="diagnose-modal" onClick={(e) => e.stopPropagation()}>
        <div className="diagnose-modal-header">
          <h3>
            <ClipboardCheck className="w-5 h-5" />
            {t('vorabdiagnose.title', 'Vorabdiagnose')}
          </h3>
          <button className="diagnose-modal-close" onClick={onClose} aria-label="Schließen">
            <X className="w-[18px] h-[18px]" />
          </button>
        </div>
        <div className="diagnose-modal-body">
          <VorabdiagnoseWizard compact />
        </div>
      </div>
    </div>
  )
}
