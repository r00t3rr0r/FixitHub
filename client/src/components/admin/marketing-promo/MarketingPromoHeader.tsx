import { Link } from 'react-router-dom'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'
import './marketing-promo.css'

interface MarketingPromoHeaderProps {
  title: string
  description: string
  current: string
}

export function MarketingPromoHeader({ title, description, current }: MarketingPromoHeaderProps) {
  const links = [
    { label: 'Uebersicht', to: '/admin/marketing-promo' },
    { label: 'Newsletter', to: '/admin/marketing-promo/newsletters' },
    { label: 'Promo Codes', to: '/admin/marketing-promo/promo-codes' },
    { label: 'Segmente', to: '/admin/marketing-promo/segments' },
    { label: 'Reports', to: '/admin/marketing-promo/reports' },
    { label: 'Einstellungen', to: '/admin/marketing-promo/settings' },
    { label: 'ADCELL Tracking', to: '/admin/marketing-promo/adcell' },
  ]

  return (
    <div className="marketing-promo-header space-y-3">
      <Breadcrumb className="text-xs text-white/85">
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link className="text-white/90 hover:text-white" to="/admin">Admin</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator className="text-white/70" />
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link className="text-white/90 hover:text-white" to="/admin/marketing-promo">Marketing/Promo</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator className="text-white/70" />
          <BreadcrumbItem>
            <BreadcrumbPage className="text-[#f5b800]">{current}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div className="space-y-2">
        <div>
          <h1 className="font-bold">{title}</h1>
          <p>{description}</p>
        </div>

        <div className="flex flex-wrap gap-2">
          {links.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              className={`marketing-promo-nav-link ${current === link.label ? 'active' : ''}`}
            >
              {link.label}
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
