import { useEffect, useState } from 'react'
import { CheckCircle, Loader2, Search, UserPlus, Wrench } from 'lucide-react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { RepairOrderConfigurator } from '@/components/home/RepairOrderConfigurator'
import { createManualRepairBooking } from '@/api/bookings'
import { CustomerSearchResult, searchCustomers } from '@/api/financial'
import { useToast } from '@/hooks/useToast'

interface CustomerData {
  firstName: string
  lastName: string
  email: string
  phone: string
  street: string
  zipCode: string
  city: string
  country: string
}

interface AddressData {
  street: string
  zipCode: string
  city: string
  country: string
}

interface ManualRepairOrderDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated: () => void
}

const initialCustomerData: CustomerData = {
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  street: '',
  zipCode: '',
  city: '',
  country: 'Deutschland',
}

export function ManualRepairOrderDialog({ open, onOpenChange, onCreated }: ManualRepairOrderDialogProps) {
  const { toast } = useToast()
  const [customer, setCustomer] = useState(initialCustomerData)
  const [shippingAddress, setShippingAddress] = useState<AddressData>({
    street: '',
    zipCode: '',
    city: '',
    country: 'Deutschland',
  })
  const [shippingAddressSameAsBilling, setShippingAddressSameAsBilling] = useState(true)
  const [createShippingLabel, setCreateShippingLabel] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [customerSearchQuery, setCustomerSearchQuery] = useState('')
  const [customerSearchResults, setCustomerSearchResults] = useState<CustomerSearchResult[]>([])
  const [isSearchingCustomers, setIsSearchingCustomers] = useState(false)

  useEffect(() => {
    const query = customerSearchQuery.trim()
    if (query.length < 2) {
      setCustomerSearchResults([])
      setIsSearchingCustomers(false)
      return
    }

    let cancelled = false
    const timeoutId = window.setTimeout(async () => {
      setIsSearchingCustomers(true)
      try {
        const response = await searchCustomers(query)
        if (!cancelled) setCustomerSearchResults(Array.isArray(response.customers) ? response.customers : [])
      } catch {
        if (!cancelled) setCustomerSearchResults([])
      } finally {
        if (!cancelled) setIsSearchingCustomers(false)
      }
    }, 300)

    return () => {
      cancelled = true
      window.clearTimeout(timeoutId)
    }
  }, [customerSearchQuery])

  const updateCustomer = (field: keyof CustomerData, value: string) => {
    setCustomer((current) => ({ ...current, [field]: value }))
  }

  const updateShippingAddress = (field: keyof AddressData, value: string) => {
    setShippingAddress((current) => ({ ...current, [field]: value }))
  }

  const selectCustomer = (selectedCustomer: CustomerSearchResult) => {
    const nameParts = selectedCustomer.name?.trim().split(/\s+/) || []
    const billingAddress = selectedCustomer.invoiceAddress || selectedCustomer.paymentAddress
    setCustomer({
      firstName: selectedCustomer.firstName || nameParts[0] || '',
      lastName: selectedCustomer.lastName || nameParts.slice(1).join(' ') || '',
      email: selectedCustomer.email || '',
      phone: selectedCustomer.phone || '',
      street: billingAddress?.street || '',
      zipCode: billingAddress?.zipCode || '',
      city: billingAddress?.city || '',
      country: billingAddress?.country || 'Deutschland',
    })
    setCustomerSearchQuery('')
    setCustomerSearchResults([])
  }

  const handleComplete = async (repairOrders: any[]) => {
    if (!customer.firstName.trim() || !customer.lastName.trim() || !customer.email.trim() || !customer.phone.trim()) {
      toast({ title: 'Kundendaten fehlen', description: 'Bitte erfasse Name, E-Mail-Adresse und Telefonnummer.', variant: 'destructive' })
      return
    }

    if (!customer.street.trim() || !customer.zipCode.trim() || !customer.city.trim()) {
      toast({ title: 'Adresse fehlt', description: 'Bitte erfasse Straße, PLZ und Ort für den manuellen Auftrag.', variant: 'destructive' })
      return
    }

    if (!shippingAddressSameAsBilling && (!shippingAddress.street.trim() || !shippingAddress.zipCode.trim() || !shippingAddress.city.trim())) {
      toast({ title: 'Lieferadresse fehlt', description: 'Bitte erfasse Straße, PLZ und Ort der Lieferadresse.', variant: 'destructive' })
      return
    }

    setIsSubmitting(true)
    try {
      const billingAddress = {
        street: customer.street,
        zipCode: customer.zipCode,
        city: customer.city,
        country: customer.country,
      }
      const resolvedShippingAddress = shippingAddressSameAsBilling ? billingAddress : shippingAddress

      await createManualRepairBooking({
        repairOrders,
        guestInfo: {
          ...customer,
          isGuest: true,
          billingAddress,
          shippingAddress: resolvedShippingAddress,
        },
        createShippingLabel,
      })
      toast({ title: 'Auftrag angelegt', description: 'Der manuelle Reparaturauftrag wurde erfolgreich erstellt.' })
      setCustomer(initialCustomerData)
      setShippingAddress({ street: '', zipCode: '', city: '', country: 'Deutschland' })
      setShippingAddressSameAsBilling(true)
      setCreateShippingLabel(true)
      onOpenChange(false)
      onCreated()
    } catch (error: any) {
      toast({ title: 'Auftrag konnte nicht angelegt werden', description: error.message, variant: 'destructive' })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="manual-repair-dialog max-w-6xl max-h-[94vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-[#1a2a5e]">
            <Wrench className="h-5 w-5 text-[#f5b800]" />
            Manuellen Reparaturauftrag anlegen
          </DialogTitle>
          <DialogDescription>
            Erfasse zuerst die Kundendaten und konfiguriere anschließend alle Reparaturdetails.
          </DialogDescription>
        </DialogHeader>

        <section className="manual-repair-customer-form" aria-labelledby="manual-repair-customer-heading">
          <h2 id="manual-repair-customer-heading" className="manual-repair-section-title">
            <UserPlus className="h-4 w-4" /> Kundendaten
          </h2>
          <div className="manual-repair-customer-search">
            <Label htmlFor="manual-customer-search">Bestehenden Kunden suchen</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="manual-customer-search"
                className="pl-9"
                value={customerSearchQuery}
                onChange={(event) => setCustomerSearchQuery(event.target.value)}
                placeholder="E-Mail, Vorname, Nachname oder Kundennummer"
              />
              {isSearchingCustomers && <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />}
            </div>
            {customerSearchQuery.trim().length >= 2 && !isSearchingCustomers && customerSearchResults.length > 0 && (
              <div className="manual-repair-customer-results" role="listbox" aria-label="Gefundene Kunden">
                {customerSearchResults.map((searchResult) => (
                  <button key={searchResult._id} type="button" className="manual-repair-customer-result" onClick={() => selectCustomer(searchResult)}>
                    <span>{[searchResult.firstName, searchResult.lastName].filter(Boolean).join(' ') || searchResult.name}</span>
                    <span>{searchResult.email}{searchResult.customerNumber ? ` | ${searchResult.customerNumber}` : ''}</span>
                  </button>
                ))}
              </div>
            )}
            {customerSearchQuery.trim().length >= 2 && !isSearchingCustomers && customerSearchResults.length === 0 && (
              <p className="text-sm text-muted-foreground">Keine passenden Kunden gefunden.</p>
            )}
          </div>
          <div className="manual-repair-fields">
            {([
              ['firstName', 'Vorname', true],
              ['lastName', 'Nachname', true],
              ['email', 'E-Mail', true],
              ['phone', 'Telefon', true],
              ['street', 'Straße und Hausnummer', true],
              ['zipCode', 'PLZ', true],
              ['city', 'Ort', true],
              ['country', 'Land', false],
            ] as Array<[keyof CustomerData, string, boolean]>).map(([field, label, required]) => (
              <div key={field} className={field === 'street' ? 'manual-repair-field-wide' : ''}>
                <Label htmlFor={`manual-${field}`}>{label}{required ? ' *' : ''}</Label>
                <Input
                  id={`manual-${field}`}
                  type={field === 'email' ? 'email' : 'text'}
                  value={customer[field]}
                  onChange={(event) => updateCustomer(field, event.target.value)}
                  required={required}
                />
              </div>
            ))}
          </div>
          <label className="manual-repair-label-option" htmlFor="manual-shipping-same-as-billing">
            <Checkbox
              id="manual-shipping-same-as-billing"
              checked={shippingAddressSameAsBilling}
              onCheckedChange={(checked) => setShippingAddressSameAsBilling(checked === true)}
            />
            <span>Lieferadresse ist gleich Rechnungsadresse</span>
          </label>
          {!shippingAddressSameAsBilling && (
            <div className="manual-repair-delivery-fields">
              <h3 className="manual-repair-subsection-title">Lieferadresse</h3>
              <div className="manual-repair-fields">
                {([
                  ['street', 'Straße und Hausnummer'],
                  ['zipCode', 'PLZ'],
                  ['city', 'Ort'],
                  ['country', 'Land'],
                ] as Array<[keyof AddressData, string]>).map(([field, label]) => (
                  <div key={field} className={field === 'street' ? 'manual-repair-field-wide' : ''}>
                    <Label htmlFor={`manual-shipping-${field}`}>{label}{field !== 'country' ? ' *' : ''}</Label>
                    <Input
                      id={`manual-shipping-${field}`}
                      value={shippingAddress[field]}
                      onChange={(event) => updateShippingAddress(field, event.target.value)}
                      required={field !== 'country'}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>

        <label className="manual-repair-label-option" htmlFor="manual-create-shipping-label">
          <Checkbox
            id="manual-create-shipping-label"
            checked={createShippingLabel}
            onCheckedChange={(checked) => setCreateShippingLabel(checked === true)}
          />
          <span>Einsende-Label für den Auftrag erstellen</span>
        </label>

        <section className="manual-repair-configurator" aria-labelledby="manual-repair-configurator-heading">
          <h2 id="manual-repair-configurator-heading" className="manual-repair-section-title">
            <Wrench className="h-4 w-4" /> Reparatur konfigurieren
          </h2>
          <RepairOrderConfigurator onComplete={handleComplete} />
        </section>

        {isSubmitting && (
          <div className="manual-repair-submitting" role="status">
            <Loader2 className="h-4 w-4 animate-spin" /> Auftrag wird angelegt...
          </div>
        )}
        {!isSubmitting && (
          <div className="manual-repair-hint">
            <CheckCircle className="h-4 w-4" /> Der Auftrag wird am Ende des Konfigurators angelegt.
          </div>
        )}

        <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
          Abbrechen
        </Button>
      </DialogContent>
    </Dialog>
  )
}
