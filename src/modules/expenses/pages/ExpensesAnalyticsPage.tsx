import { BarChart3 } from 'lucide-react';

export function ExpensesAnalyticsPage() {
  return (
    <div className="bg-white rounded-2xl shadow-card p-12 flex flex-col items-center text-center">
      <div className="w-16 h-16 rounded-2xl bg-blue-100 text-blue-600 flex items-center justify-center mb-4">
        <BarChart3 size={28} />
      </div>
      <h2 className="text-lg font-bold text-gray-800 mb-2">Analítica próximamente</h2>
      <p className="text-sm text-gray-500 max-w-md">
        Aquí verás tendencias por categoría, comparativa caja vs viáticos, y gasto por vendedor mes a mes.
      </p>
    </div>
  );
}
