const customerBrands = [
  {
    name: 'BMW',
    src: '/assets/customer-brands/bmw.png',
  },
  {
    name: 'EP',
    src: '/assets/customer-brands/ep.png',
  },
  {
    name: 'Friedrichstadtpalast',
    src: '/assets/customer-brands/friedrichstadtpalast.png',
  },
  {
    name: 'Groupon',
    src: '/assets/customer-brands/groupon.png',
  },
  {
    name: 'Handyreparaturvergleich',
    src: '/assets/customer-brands/handyreparaturvergleich.png',
  },
  {
    name: 'TSG',
    src: '/assets/customer-brands/tsg.png',
  },
  {
    name: 'Service Partner',
    src: '/assets/customer-brands/servicepartner.jpg',
  },
];

const looped = (items: typeof customerBrands) => [...items, ...items];

export function SatisfiedCustomersSection() {
  return (
    <div className="container">
      <div className="section-title">
        <h2>Kundenstimmen & Vertrauen</h2>
        <p>Vertrauen von starken Marken und Partnern.</p>
        <div className="accent-line"></div>
      </div>

      <div className="customers-logo-wall" aria-label="Zufriedene Kunden und Partnerlogos">
        <div className="customers-logo-row">
          <div className="customers-logo-track customers-logo-track-left">
            {looped(customerBrands).map((brand, index) => (
              <div className="customers-logo-card" key={`logo-${brand.name}-${index}`}>
                <img src={brand.src} alt={`${brand.name} Logo`} loading="lazy" decoding="async" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}