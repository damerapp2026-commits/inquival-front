import { useAuth } from '../../../app/providers/AuthProvider';
import { WorkerExpenseAdminView } from '../components/WorkerExpenseAdminView';
import { WorkerExpenseWorkerView } from '../components/WorkerExpenseWorkerView';

export function WorkerExpensesPage() {
  const { user } = useAuth();

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Viáticos</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          {user?.role === 'ADMIN'
            ? 'Configura los topes mensuales por categoría y revisa los reportes enviados por el equipo.'
            : 'Registra tus gastos de viaje del mes y envíalos para revisión.'}
        </p>
      </div>
      {user?.role === 'ADMIN' ? <WorkerExpenseAdminView /> : <WorkerExpenseWorkerView />}
    </div>
  );
}
