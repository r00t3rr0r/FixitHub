export interface LocationData {
  id: string
  name: string
  distance: string
  address: string
  phone: string
  email: string
  url: string
  logo: string
  lat: number
  lng: number
  hours: Record<string, string>
}

export const LOCATIONS: LocationData[] = [
  {
    id: 'A', name: 'Elektrik Vacha GmbH', distance: '33.6km',
    address: 'Bahnhofstraße 46, 36433 Bad Salzungen',
    phone: '03695693013', email: 'laden319@elektrik-vacha.de',
    url: '', logo: 'EV',
    lat: 50.8127, lng: 10.2257,
    hours: { Mo: '09:00 – 19:00', Di: '09:00 – 19:00', Mi: '09:00 – 19:00', Do: '09:00 – 19:00', Fr: '09:00 – 19:00', Sa: '09:00 – 13:00', So: 'geschlossen' }
  },
  {
    id: 'B', name: 'EP:Tettke', distance: '38.0km',
    address: 'Sondershäuser Straße 32, 99091 Erfurt',
    phone: '03617450540', email: 'info@tettke.de',
    url: 'https://www.ep.de/tettke/', logo: 'EP',
    lat: 51.0153, lng: 10.9883,
    hours: { Mo: '09:00 – 18:00', Di: '09:00 – 18:00', Mi: '09:00 – 18:00', Do: '09:00 – 18:00', Fr: '09:00 – 18:00', Sa: '09:00 – 12:00', So: 'geschlossen' }
  },
  {
    id: 'C', name: 'EP:Bierwirth', distance: '38.2km',
    address: 'Kupferstraße 26, 36205 Sontra-Hornel',
    phone: '05653911 40', email: 'ep-bierwirth@t-online.de',
    url: 'https://www.ep.de/bierwirth/', logo: 'EP',
    lat: 51.0549, lng: 9.9086,
    hours: { Mo: '09:00 – 18:00', Di: '09:00 – 18:00', Mi: '09:00 – 18:00', Do: '09:00 – 18:00', Fr: '09:00 – 18:00', Sa: '09:00 – 13:00', So: 'geschlossen' }
  },
  {
    id: 'D', name: 'Elektrik Vacha GmbH', distance: '41.4km',
    address: 'Heyligenstedtstr. 7, 36404 Vacha',
    phone: '03696224661', email: 'laden313@elektrik-vacha.de',
    url: '', logo: 'EV',
    lat: 50.8273, lng: 10.0214,
    hours: { Mo: '09:00 – 13:00 14:00 – 18:00', Di: '09:00 – 13:00 14:00 – 18:00', Mi: '09:00 – 13:00 14:00 – 18:00', Do: '09:00 – 13:00 14:00 – 18:00', Fr: '09:00 – 13:00 14:00 – 18:00', Sa: '09:00 – 12:00', So: 'geschlossen' }
  },
  {
    id: 'E', name: 'Elektrik Vacha GmbH', distance: '46.7km',
    address: 'An der Zehnt 3, 36466 Dermbach',
    phone: '03696482236', email: 'laden316@elektrik-vacha.de',
    url: '', logo: 'EV',
    lat: 50.7139, lng: 10.1244,
    hours: { Mo: '09:00 – 13:00 14:00 – 18:00', Di: '09:00 – 13:00 14:00 – 18:00', Mi: '09:00 – 13:00 14:00 – 18:00', Do: '09:00 – 13:00 14:00 – 18:00', Fr: '09:00 – 13:00 14:00 – 18:00', Sa: '09:00 – 13:00', So: 'geschlossen' }
  },
  {
    id: 'F', name: 'Elektrik Vacha GmbH', distance: '54.1km',
    address: 'Gartenstr. 1a, 36452 Kaltennordheim',
    phone: '03696 7468', email: 'laden317@elektrik-vacha.de',
    url: '', logo: 'EV',
    lat: 50.6287, lng: 10.1577,
    hours: { Mo: '09:00 – 13:00 14:00 – 18:00', Di: '09:00 – 13:00 14:00 – 18:00', Mi: '09:00 – 13:00 14:00 – 18:00', Do: '09:00 – 13:00 14:00 – 18:00', Fr: '09:00 – 13:00 14:00 – 18:00', Sa: '09:00 – 13:00', So: 'geschlossen' }
  },
  {
    id: 'G', name: 'PC Jumper', distance: '62.3km',
    address: 'Ludwig Chronegk Str. 9, 98617 Meiningen',
    phone: '03693478959', email: 'mobile@pc-jumper.de',
    url: 'https://pc-jumper.de/', logo: 'PJ',
    lat: 50.5688, lng: 10.4160,
    hours: { Mo: '10:00 – 12:30 13:30 – 16:30', Di: '10:00 – 12:30 13:30 – 16:30', Mi: 'geschlossen', Do: '10:00 – 12:30 13:30 – 16:30', Fr: '10:00 – 12:30 13:30 – 16:30', Sa: '10:00 – 12:00', So: 'geschlossen' }
  },
  {
    id: 'H', name: 'Fa. Radio Fürth GmbH', distance: '68.5km',
    address: 'Lange Geismarstr. 28, 37073 Göttingen',
    phone: '0551 44082', email: 'sven@radiofuerth.de',
    url: '', logo: 'RF',
    lat: 51.5318, lng: 9.9372,
    hours: { Mo: '09:00 – 12:00', Di: '09:00 – 12:00', Mi: '09:00 – 18:00', Do: '09:00 – 12:00', Fr: '09:00 – 12:00 14:00 – 18:00', Sa: 'geschlossen', So: 'geschlossen' }
  },
  {
    id: 'I', name: 'Phonelux Kassel', distance: '72.1km',
    address: 'Obere Königsstr. 43, 34117 Kassel',
    phone: '0561 7393828', email: 'info@phonelux-kassel.de',
    url: 'https://phonelux-kassel.de/', logo: 'PL',
    lat: 51.3147, lng: 9.4958,
    hours: { Mo: '10:00 – 19:00', Di: '10:00 – 19:00', Mi: '10:00 – 19:00', Do: '10:00 – 19:00', Fr: '10:00 – 19:00', Sa: '10:00 – 16:00', So: 'geschlossen' }
  },
  {
    id: 'J', name: 'EP:Müller Elektronik', distance: '78.9km',
    address: 'Hauptstraße 12, 99084 Erfurt-Nord',
    phone: '0361 5512340', email: 'info@mueller-elektronik.de',
    url: 'https://www.ep.de/mueller/', logo: 'EP',
    lat: 50.9787, lng: 11.0328,
    hours: { Mo: '09:00 – 18:00', Di: '09:00 – 18:00', Mi: '09:00 – 18:00', Do: '09:00 – 18:00', Fr: '09:00 – 18:00', Sa: '09:00 – 14:00', So: 'geschlossen' }
  },
  {
    id: 'K', name: 'Handy-Doc Frankfurt', distance: '85.2km',
    address: 'Berger Str. 132, 60316 Frankfurt am Main',
    phone: '069 90437821', email: 'service@handy-doc-ffm.de',
    url: 'https://handy-doc-ffm.de/', logo: 'HD',
    lat: 50.1184, lng: 8.6917,
    hours: { Mo: '10:00 – 19:00', Di: '10:00 – 19:00', Mi: '10:00 – 19:00', Do: '10:00 – 19:00', Fr: '10:00 – 19:00', Sa: '10:00 – 16:00', So: 'geschlossen' }
  },
  {
    id: 'L', name: 'TechPoint Leipzig', distance: '92.4km',
    address: 'Petersstraße 28, 04109 Leipzig',
    phone: '0341 9876543', email: 'kontakt@techpoint-leipzig.de',
    url: 'https://techpoint-leipzig.de/', logo: 'TP',
    lat: 51.3382, lng: 12.3746,
    hours: { Mo: '09:30 – 18:30', Di: '09:30 – 18:30', Mi: '09:30 – 18:30', Do: '09:30 – 18:30', Fr: '09:30 – 18:30', Sa: '10:00 – 14:00', So: 'geschlossen' }
  }
]
