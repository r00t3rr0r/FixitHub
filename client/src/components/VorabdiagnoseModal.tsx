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
    if (!isOpen) return

    const scrollY = window.scrollY
    const bodyStyle = document.body.style
    const htmlStyle = document.documentElement.style

    const prevBodyOverflow = bodyStyle.overflow
    const prevBodyPosition = bodyStyle.position
    const prevBodyTop = bodyStyle.top
    const prevBodyWidth = bodyStyle.width
    const prevBodyTouchAction = bodyStyle.touchAction
    const prevHtmlOverflow = htmlStyle.overflow

    document.addEventListener('keydown', handleKeyDown)

    // Freeze background scroll on all major browsers, including iOS Safari.
    bodyStyle.overflow = 'hidden'
    bodyStyle.position = 'fixed'
    bodyStyle.top = `-${scrollY}px`
    bodyStyle.width = '100%'
    bodyStyle.touchAction = 'none'
    htmlStyle.overflow = 'hidden'

    return () => {
      document.removeEventListener('keydown', handleKeyDown)

      bodyStyle.overflow = prevBodyOverflow
      bodyStyle.position = prevBodyPosition
      bodyStyle.top = prevBodyTop
      bodyStyle.width = prevBodyWidth
      bodyStyle.touchAction = prevBodyTouchAction
      htmlStyle.overflow = prevHtmlOverflow

      window.scrollTo(0, scrollY)
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
