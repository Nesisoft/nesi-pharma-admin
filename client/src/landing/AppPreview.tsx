// A drawn preview of the app's point-of-sale screen for the landing page hero
// (illustration only: no real data)

const products = [
  { name: 'Paracetamol 500 mg', batch: 'Exp 03/2027', price: '5.00', stock: 'In stock' },
  { name: 'Amoxicillin 250 mg', batch: 'Exp 11/2026', price: '18.50', stock: 'Sell first' },
  { name: 'Vitamin C 1000 mg', batch: 'Exp 08/2027', price: '12.00', stock: 'In stock' },
  { name: 'ORS sachets', batch: 'Exp 01/2027', price: '3.50', stock: 'Low stock' },
];

const cart = [
  { name: 'Paracetamol 500 mg', qty: 2, total: '10.00' },
  { name: 'Amoxicillin 250 mg', qty: 1, total: '18.50' },
  { name: 'ORS sachets', qty: 4, total: '14.00' },
];

const badge: Record<string, string> = {
  'In stock': 'bg-emerald-50 text-emerald-700',
  'Sell first': 'bg-amber-50 text-amber-700',
  'Low stock': 'bg-rose-50 text-rose-700',
};

export default function AppPreview() {
  return (
    <div
      className="overflow-hidden rounded-xl border border-white/20 bg-white shadow-2xl shadow-sky-900/30"
      role="img"
      aria-label="Preview of the Adurofie PMS point-of-sale screen: products with batch expiry dates, a cart and a GH₵ 42.50 total"
    >
      {/* Window bar */}
      <div className="flex items-center gap-1.5 border-b border-slate-200 bg-slate-100 px-3 py-2" aria-hidden="true">
        <span className="h-2.5 w-2.5 rounded-full bg-rose-400" />
        <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
        <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
        <span className="ml-3 text-[11px] font-medium text-slate-500">Adurofie PMS: Point of Sale</span>
      </div>

      <div className="grid grid-cols-5 text-left" aria-hidden="true">
        {/* Products */}
        <div className="col-span-3 border-r border-slate-100 p-3">
          <div className="mb-3 rounded-md border border-slate-200 px-2 py-1.5 text-[11px] text-slate-400">
            Scan a barcode or search products…
          </div>
          <ul className="space-y-1.5">
            {products.map((product) => (
              <li key={product.name} className="flex items-center justify-between rounded-md bg-slate-50 px-2 py-1.5">
                <div>
                  <p className="text-[11px] font-semibold text-slate-800">{product.name}</p>
                  <p className="text-[10px] text-slate-500">{product.batch}</p>
                </div>
                <div className="text-right">
                  <p className="text-[11px] font-semibold text-slate-800">GH₵ {product.price}</p>
                  <span className={`rounded px-1 py-0.5 text-[9px] font-medium ${badge[product.stock]}`}>{product.stock}</span>
                </div>
              </li>
            ))}
          </ul>
        </div>

        {/* Cart */}
        <div className="col-span-2 flex flex-col bg-white p-3">
          <p className="text-[11px] font-semibold text-slate-800">Current sale</p>
          <ul className="mt-2 flex-1 space-y-1.5">
            {cart.map((line) => (
              <li key={line.name} className="flex justify-between text-[10px] text-slate-600">
                <span>
                  {line.qty} × {line.name}
                </span>
                <span className="font-medium text-slate-800">{line.total}</span>
              </li>
            ))}
          </ul>
          <div className="mt-3 border-t border-slate-100 pt-2">
            <div className="flex justify-between text-[11px] font-bold text-slate-900">
              <span>Total</span>
              <span>GH₵ 42.50</span>
            </div>
            <div className="mt-2 grid grid-cols-2 gap-1 text-[9px] font-medium">
              <span className="rounded bg-slate-100 py-1 text-center text-slate-600">Cash</span>
              <span className="rounded bg-sky-100 py-1 text-center text-sky-700">Mobile Money</span>
            </div>
            <div className="mt-2 rounded-md bg-sky-600 py-1.5 text-center text-[11px] font-semibold text-white">Complete sale</div>
          </div>
        </div>
      </div>
    </div>
  );
}
