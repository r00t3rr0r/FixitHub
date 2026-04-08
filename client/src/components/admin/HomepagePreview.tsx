import React, { useMemo } from 'react'
import { TopBar } from '@/components/home/TopBar'
import { McRepairNav } from '@/components/home/McRepairNav'
import { DeviceSelectionHero } from '@/components/home/DeviceSelectionHero'
import { TrustRow } from '@/components/home/TrustRow'
import { SpecialOffers } from '@/components/home/SpecialOffers'
import { ServicesOverview } from '@/components/home/ServicesOverview'
import { ShopSection } from '@/components/home/ShopSectionSimple'
import { BlogSection } from '@/components/home/BlogSection'
import { Footer } from '@/components/Footer'
import { CookieBanner } from '@/components/CookieBanner'
import { MobileCTAFab } from '@/components/home/MobileCTAFab'
import type { HomepageSection } from '@/api/homepage'
import { useTranslation } from 'react-i18next'
import { localizeHomepageValue, resolveHomepageField } from '@/lib/homepageLocalization'

interface HomepagePreviewProps {
  sections: HomepageSection[]
  device?: 'desktop' | 'tablet' | 'mobile'
  highlightedBlockId?: string
}

/**
 * Live preview component that renders the actual homepage
 * with all components in their current design
 */
export const HomepagePreview: React.FC<HomepagePreviewProps> = ({ sections, device = 'desktop', highlightedBlockId }) => {
  const { i18n } = useTranslation()
  const toSafeSelectorSuffix = (value: string) => value.replace(/[^a-zA-Z0-9_-]/g, '_')

  const buildScopedCustomCss = (css: string | undefined, selector: string) => {
    if (!css || !css.trim()) return ''
    const trimmed = css.trim()

    // If the admin uses "&", replace it with the scope selector.
    if (trimmed.includes('&')) {
      return trimmed.replace(/&/g, selector)
    }

    // Fallback: treat input as declarations and scope them to the selector.
    return `${selector} { ${trimmed} }`
  }

  const deviceStyles = useMemo(() => {
    const isMobile = device === 'mobile'
    const isTablet = device === 'tablet'

    return {
      width: isMobile ? '390px' : isTablet ? '820px' : '1440px',
      height: isMobile ? '844px' : isTablet ? '1080px' : '900px',
      margin: '0 auto',
      border: '2px solid #e2e8f0',
      borderRadius: isMobile ? '24px' : '16px',
      overflow: 'auto',
      backgroundColor: '#ffffff',
      boxShadow: '0 20px 60px rgba(0, 0, 0, 0.15)',
      position: 'relative' as const,
      fontSize: isMobile ? '12px' : isTablet ? '13px' : '14px'
    }
  }, [device])

  const activeSections = useMemo(
    () => [...sections].filter((section) => section.isActive).sort((a, b) => a.order - b.order),
    [sections]
  )

  const buildFilterString = (settings?: HomepageSection['settings'] | any) => {
    const filters: string[] = []

    if (settings?.filter && settings.filter !== 'none') {
      filters.push(settings.filter)
    }

    if (settings?.visualEffects?.blur) {
      filters.push(`blur(${settings.visualEffects.blur}px)`)
    }

    if (settings?.visualEffects?.brightness) {
      filters.push(`brightness(${settings.visualEffects.brightness})`)
    }

    if (settings?.visualEffects?.contrast) {
      filters.push(`contrast(${settings.visualEffects.contrast})`)
    }

    if (settings?.visualEffects?.saturate) {
      filters.push(`saturate(${settings.visualEffects.saturate})`)
    }

    if (settings?.visualEffects?.hueRotate) {
      filters.push(`hue-rotate(${settings.visualEffects.hueRotate}deg)`)
    }

    if (settings?.visualEffects?.sepia) {
      filters.push(`sepia(${settings.visualEffects.sepia})`)
    }

    if (settings?.visualEffects?.grayscale) {
      filters.push(`grayscale(${settings.visualEffects.grayscale})`)
    }

    return filters.length > 0 ? filters.join(' ') : undefined
  }

  const getSectionKind = (section: HomepageSection) => {
    const localizedName = resolveHomepageField(section.name, section.nameTranslations, i18n.language, section.name) || ''
    const name = localizedName.toLowerCase()
    const id = section._id?.toLowerCase() || ''
    const blockTypes = section.blocks?.map((block) => block.type) || []

    if (id.includes('topbar') || name.includes('top bar')) return 'topbar'
    if (id.includes('navigation') || name.includes('navigation')) return 'navigation'
    if (id.includes('hero') || blockTypes.includes('hero')) return 'hero'
    if (id.includes('trust') || name.includes('trust')) return 'trust'
    if (id.includes('offers') || name.includes('offer')) return 'offers'
    if (id.includes('services') || name.includes('service') || blockTypes.includes('services')) return 'services'
    if (id.includes('shop') || name.includes('shop') || blockTypes.includes('shop' as any)) return 'shop'
    if (id.includes('blog') || name.includes('blog') || blockTypes.includes('blog' as any)) return 'blog'
    if (id.includes('cta') || name.includes('call to action') || blockTypes.includes('cta')) return 'cta'
    if (id.includes('footer') || name.includes('footer') || blockTypes.includes('footer' as any)) return 'footer'

    return 'generic'
  }

  const getSectionStyle = (section: HomepageSection) => {
    const baseStyle: React.CSSProperties = {
      backgroundColor: section.settings?.backgroundColor || '#ffffff',
      color: section.settings?.textColor || '#2d3748',
      padding: section.settings?.padding || '40px 0',
      margin: section.settings?.margin || '0',
      minHeight: section.settings?.minHeight,
      maxWidth: '100%',
      opacity: section.settings?.opacity || 1,
      borderRadius: section.settings?.borderRadius || '0px',
      borderWidth: section.settings?.borderWidth,
      borderColor: section.settings?.borderColor,
      borderStyle: section.settings?.borderStyle,
      boxShadow: section.settings?.boxShadow || 'none',
      transform: section.settings?.transform || 'none',
      transition: section.settings?.transition || 'all 0.3s ease',
      filter: buildFilterString(section.settings),
      backdropFilter: section.settings?.backdropFilter,
      overflow: section.settings?.overflow || 'visible'
    }

    if (section.settings?.gradient?.enabled) {
      const { direction, colors } = section.settings.gradient
      const colorStop = colors?.join(', ') || '#ffffff, #f8f9fc'
      baseStyle.background = `linear-gradient(${direction || 'to right'}, ${colorStop})`
    }

    if (section.settings?.backgroundImage) {
      baseStyle.backgroundImage = `url(${section.settings.backgroundImage})`
      baseStyle.backgroundSize = 'cover'
      baseStyle.backgroundPosition = 'center'
    }

    return baseStyle
  }

  const getBlockStyle = (block: any): React.CSSProperties => {
    const animation = block.settings?.animation
    const animationDuration = block.settings?.animationDuration || 0.6
    const animationDelay = block.settings?.animationDelay || 0

    return {
      backgroundColor: block.settings?.backgroundColor,
      color: block.settings?.textColor,
      padding: block.settings?.padding || '16px',
      margin: block.settings?.margin,
      textAlign: block.settings?.alignment,
      opacity: block.settings?.opacity,
      transform: block.settings?.transform,
      transition: block.settings?.transition || block.settings?.hover?.transition || 'all 0.3s ease',
      borderRadius: block.settings?.borderRadius || '8px',
      borderWidth: block.settings?.borderWidth,
      borderColor: block.settings?.borderColor,
      borderStyle: block.settings?.borderStyle,
      boxShadow: block.settings?.boxShadow,
      filter: buildFilterString(block.settings),
      backdropFilter: block.settings?.backdropFilter,
      animation: animation ? `${animation} ${animationDuration}s ease ${animationDelay}s both` : undefined,
      ['--hp-hover-transform' as any]: block.settings?.hover?.transform || 'translateY(-2px)',
      ['--hp-hover-opacity' as any]: block.settings?.hover?.opacity,
      ['--hp-hover-background' as any]: block.settings?.hover?.backgroundColor,
      ['--hp-hover-color' as any]: block.settings?.hover?.textColor,
    }
  }

  const getBlockLayoutClass = (layout?: HomepageSection['layout']) => {
    if (layout === 'two-column') return 'hp-preview-block-content hp-layout-two-column'
    if (layout === 'three-column') return 'hp-preview-block-content hp-layout-three-column'
    if (layout === 'grid') return 'hp-preview-block-content hp-layout-grid'
    return 'hp-preview-block-content hp-layout-single'
  }

  const renderGenericBlock = (block: any, blockIdx: number) => {
    const localizedContent = localizeHomepageValue(block.content, i18n.language) || {}
    const localizedTitle = resolveHomepageField(block.title, block.titleTranslations, i18n.language, block.title)
    const localizedHtml = resolveHomepageField(
      localizedContent?.html,
      block.settings?.customHTMLTranslations,
      i18n.language,
      localizedContent?.html
    )
    const ctaText = localizedContent?.ctaText || localizedContent?.buttonText
    const blockClassName = `hp-preview-block--${toSafeSelectorSuffix(String(block._id || `idx_${blockIdx}`))}`
    const blockScopedCss = buildScopedCustomCss(block.settings?.customCSS, `.${blockClassName}`)
    const isHighlighted = highlightedBlockId && block._id === highlightedBlockId

    return (
      <div
        key={block._id || blockIdx}
        className={`hp-preview-block ${blockClassName} ${isHighlighted ? 'hp-preview-block-highlighted' : ''}`}
        style={getBlockStyle(block)}
      >
        {localizedTitle && (
          <h3 style={{ margin: '0 0 12px 0', fontSize: '18px', fontWeight: 600 }}>
            {localizedTitle}
          </h3>
        )}

        {localizedContent?.heading && (
          <h4 style={{ margin: '8px 0', fontSize: '16px', fontWeight: 600 }}>
            {localizedContent.heading}
          </h4>
        )}

        {localizedContent?.subheading && (
          <p style={{ margin: '8px 0', fontSize: '14px', lineHeight: '1.6', opacity: 0.9 }}>
            {localizedContent.subheading}
          </p>
        )}

        {localizedContent?.description && (
          <p style={{ margin: '8px 0', fontSize: '14px', lineHeight: '1.6' }}>
            {localizedContent.description}
          </p>
        )}

        {localizedContent?.text && (
          <p style={{ margin: '8px 0', fontSize: '14px', lineHeight: '1.6' }}>
            {localizedContent.text}
          </p>
        )}

        {localizedHtml && (
          <div
            style={{ marginTop: '12px' }}
            dangerouslySetInnerHTML={{ __html: localizedHtml }}
          />
        )}

        {ctaText && (
          <button style={{
            marginTop: '12px',
            padding: '10px 18px',
            backgroundColor: '#1a2a5e',
            color: '#ffffff',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: 500
          }}>
            {ctaText}
          </button>
        )}

        {blockScopedCss && <style>{blockScopedCss}</style>}
      </div>
    )
  }

  const renderSectionContent = (section: HomepageSection) => {
    const sectionKind = getSectionKind(section)
    const localizedCustomHtml = resolveHomepageField(
      section.settings?.customHTML,
      section.settings?.customHTMLTranslations,
      i18n.language,
      section.settings?.customHTML
    )

    if (typeof localizedCustomHtml === 'string' && localizedCustomHtml.trim().length > 0) {
      return (
        <div
          className="container"
          style={{
            maxWidth: section.settings?.maxWidth || '1200px',
          }}
          dangerouslySetInnerHTML={{ __html: localizedCustomHtml }}
        />
      )
    }

    const hasCustomHtmlOrCssBlock = !!section.blocks?.some((block) =>
      block.isVisible !== false && (
        (typeof block.content?.html === 'string' && block.content.html.trim().length > 0) ||
        (typeof block.settings?.customCSS === 'string' && block.settings.customCSS.trim().length > 0)
      )
    )

    if (hasCustomHtmlOrCssBlock) {
      return (
        <div
          className="container"
          style={{
            maxWidth: section.settings?.maxWidth || '1200px',
          }}
        >
          <div
            className={getBlockLayoutClass(section.layout)}
            style={{ gap: section.settings?.gap || '16px' }}
          >
            {section.blocks?.filter((block) => block.isVisible !== false).map(renderGenericBlock)}
          </div>
        </div>
      )
    }

    switch (sectionKind) {
      case 'topbar':
        return <TopBar />
      case 'navigation':
        return <McRepairNav />
      case 'hero':
        return <DeviceSelectionHero />
      case 'trust':
        return <TrustRow />
      case 'offers':
        return <SpecialOffers />
      case 'services':
        return (
          <section id="process" className="section">
            <ServicesOverview />
          </section>
        )
      case 'shop':
        return (
          <section id="shop" className="section section-alt">
            <ShopSection />
          </section>
        )
      case 'blog':
        return (
          <section id="blog" className="section">
            <BlogSection />
          </section>
        )
      case 'footer':
        return <Footer />
      default:
        return (
          <div
            className="container"
            style={{
              maxWidth: section.settings?.maxWidth || '1200px',
            }}
          >
            <div
              className={getBlockLayoutClass(section.layout)}
              style={{ gap: section.settings?.gap || '16px' }}
            >
              {section.blocks?.filter((block) => block.isVisible !== false).map(renderGenericBlock)}
            </div>
          </div>
        )
    }
  }

  return (
    <div style={deviceStyles} className="homepage-preview-container">
      <div className="homepage-preview-wrapper">
        {activeSections.map((section, idx) => {
          const sectionClassName = `hp-preview-section--${toSafeSelectorSuffix(String(section._id || `idx_${idx}`))}`
          const sectionScopedCss = buildScopedCustomCss(section.settings?.customCSS, `.${sectionClassName}`)

          return (
            <div
              key={section._id || idx}
              style={getSectionStyle(section)}
              className={`hp-preview-section hp-section-${idx} ${sectionClassName}`}
              data-section-id={section._id}
            >
              {renderSectionContent(section)}
              {sectionScopedCss && <style>{sectionScopedCss}</style>}
            </div>
          )
        })}

        <CookieBanner />
        <MobileCTAFab />
      </div>

      <style>{`
        .homepage-preview-container {
          overflow-y: auto;
          scroll-behavior: smooth;
        }

        .homepage-preview-wrapper {
          width: 100%;
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
          line-height: 1.6;
        }

        .hp-preview-section {
          width: 100%;
          transition: all 0.3s ease;
        }

        .hp-preview-block-content {
          display: grid;
          gap: 16px;
        }

        .hp-layout-single {
          grid-template-columns: minmax(0, 1fr);
        }

        .hp-layout-two-column {
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }

        .hp-layout-three-column {
          grid-template-columns: repeat(3, minmax(0, 1fr));
        }

        .hp-layout-grid {
          grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
        }

        .hp-preview-block {
          padding: 16px;
          border-radius: 8px;
          border: 1px solid #e2e8f0;
          transition: all 0.3s ease;
        }

        .hp-preview-block-highlighted {
          outline: 3px solid #f5b800;
          outline-offset: 2px;
          box-shadow: 0 0 0 6px rgba(245, 184, 0, 0.2), 0 10px 28px rgba(26, 42, 94, 0.2);
          animation: hpHighlightPulse 1.2s ease-in-out infinite;
        }

        @keyframes hpHighlightPulse {
          0%, 100% {
            transform: translateY(0);
          }
          50% {
            transform: translateY(-2px);
          }
        }

        /* Animation Classes */
        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        @keyframes slideInLeft {
          from {
            opacity: 0;
            transform: translateX(-30px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }

        @keyframes slideInRight {
          from {
            opacity: 0;
            transform: translateX(30px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }

        @keyframes scaleIn {
          from {
            opacity: 0;
            transform: scale(0.95);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }

        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.8; }
        }

        @keyframes bounce {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-10px); }
        }

        @keyframes wiggle {
          0%, 100% { transform: rotate(0deg); }
          25% { transform: rotate(-1deg); }
          75% { transform: rotate(1deg); }
        }

        .hp-anim-fadeInUp {
          animation: fadeInUp 0.6s ease-out !important;
        }

        .hp-anim-fadeIn {
          animation: fadeIn 0.6s ease-out !important;
        }

        .hp-anim-slideInLeft {
          animation: slideInLeft 0.6s ease-out !important;
        }

        .hp-anim-slideInRight {
          animation: slideInRight 0.6s ease-out !important;
        }

        .hp-anim-scaleIn {
          animation: scaleIn 0.6s ease-out !important;
        }

        .hp-anim-pulse {
          animation: pulse 2s infinite !important;
        }

        .hp-anim-bounce {
          animation: bounce 1s infinite !important;
        }

        .hp-anim-wiggle {
          animation: wiggle 0.5s infinite !important;
        }

        /* Container */
        .container {
          max-width: 1200px;
          margin: 0 auto;
          padding: 0 20px;
        }

        /* Hover effects */
        .hp-preview-block:hover {
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
          transform: var(--hp-hover-transform, translateY(-2px));
          opacity: var(--hp-hover-opacity, 1);
          background: var(--hp-hover-background, initial);
          color: var(--hp-hover-color, inherit);
        }

        @media (max-width: 1024px) {
          .hp-layout-two-column,
          .hp-layout-three-column,
          .hp-layout-grid {
            grid-template-columns: 1fr;
          }
        }

        /* Scrollbar styling */
        .homepage-preview-container::-webkit-scrollbar {
          width: 8px;
        }

        .homepage-preview-container::-webkit-scrollbar-track {
          background: #f1f5f9;
          border-radius: 10px;
        }

        .homepage-preview-container::-webkit-scrollbar-thumb {
          background: #cbd5e0;
          border-radius: 10px;
        }

        .homepage-preview-container::-webkit-scrollbar-thumb:hover {
          background: #a0aec0;
        }
      `}</style>
    </div>
  )
}

export default HomepagePreview
