import { Construction } from 'lucide-react';

export function WorkerExpensesPage() {
  return (
    <div className="bg-white rounded-2xl shadow-card p-12 flex flex-col items-center text-center">
      <div className="w-16 h-16 rounded-2xl bg-amber-100 text-amber-600 flex items-center justify-center mb-4">
        <Construction size={28} />
      </div>
      <h2 className="text-lg font-bold text-gray-800 mb-2">Viáticos en construcción</h2>
      <p className="text-sm text-gray-500 max-w-md">
        Próximamente: los vendedores podrán registrar sus gastos de viaje y el admin podrá aprobar/rechazar al cierre de mes.
      </p>
    </div>
  );
}
