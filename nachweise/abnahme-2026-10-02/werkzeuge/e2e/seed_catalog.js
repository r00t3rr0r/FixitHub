// Minimaler Geraetekatalog in der Wegwerf-DB ueber die echte Admin-API (Typ Smartphone, Marke Apple, Modell iPhone 15).
const { apiLogin, api } = require('./flowlib');
(async () => {
  const a = await apiLogin('admin');
  const types = await api(a, 'GET', '/api/devices/types');
  console.log('types before', types.status, JSON.stringify(types.data).slice(0, 200));
  let t = await api(a, 'POST', '/api/devices/types', { name: 'Smartphone', key: 'smartphone', slug: 'smartphone', isActive: true });
  console.log('type', t.status, JSON.stringify(t.data).slice(0, 200));
  const b = await api(a, 'POST', '/api/devices/brands', { name: 'Apple', isActive: true, deviceTypes: ['Smartphone'] });
  console.log('brand', b.status, JSON.stringify(b.data).slice(0, 200));
  const brandId = b.data?.brand?._id || b.data?.data?._id || b.data?._id;
  const m = await api(a, 'POST', '/api/devices/models', { name: 'iPhone 15', brandId, deviceType: 'Smartphone', isActive: true });
  console.log('model', m.status, JSON.stringify(m.data).slice(0, 200));
  const after = await api(null, 'GET', '/api/devices/types');
  console.log('types after', JSON.stringify(after.data).slice(0, 300));
})();
