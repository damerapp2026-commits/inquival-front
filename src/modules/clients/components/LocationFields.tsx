import { MapPin } from 'lucide-react';
import { PERU_UBIGEO } from '../constants/peruRegions';

export interface LocationValue {
  department?: string;
  province?: string;
  district?: string;
  hamlet?: string;
}

interface LocationFieldsProps {
  value: LocationValue;
  onChange: (next: LocationValue) => void;
}

const SELECT_CLASS =
  'w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:bg-gray-50 disabled:text-gray-400 disabled:cursor-not-allowed';
const INPUT_CLASS =
  'w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500';
const LABEL_CLASS = 'block text-[11px] font-medium text-gray-400 mb-1';

export function LocationFields({ value, onChange }: LocationFieldsProps) {
  const dept = PERU_UBIGEO.find((d) => d.name === value.department);
  const prov = dept?.provinces.find((p) => p.name === value.province);

  return (
    <div>
      <div className="flex items-center gap-2 mb-1.5">
        <MapPin size={13} className="text-primary-600" />
        <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">Ubicación</span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className={LABEL_CLASS}>Departamento</label>
          <select
            value={value.department || ''}
            onChange={(e) =>
              onChange({
                department: e.target.value || undefined,
                province: undefined,
                district: undefined,
                hamlet: value.hamlet,
              })
            }
            className={SELECT_CLASS}
          >
            <option value="">— Sin asignar —</option>
            {PERU_UBIGEO.map((d) => (
              <option key={d.id} value={d.name}>{d.name}</option>
            ))}
          </select>
        </div>

        <div>
          <label className={LABEL_CLASS}>Provincia</label>
          <select
            value={value.province || ''}
            disabled={!dept}
            onChange={(e) =>
              onChange({
                ...value,
                province: e.target.value || undefined,
                district: undefined,
              })
            }
            className={SELECT_CLASS}
          >
            <option value="">{dept ? '— Sin asignar —' : 'Selecciona departamento'}</option>
            {dept?.provinces.map((p) => (
              <option key={p.id} value={p.name}>{p.name}</option>
            ))}
          </select>
        </div>

        <div>
          <label className={LABEL_CLASS}>Distrito</label>
          <select
            value={value.district || ''}
            disabled={!prov}
            onChange={(e) => onChange({ ...value, district: e.target.value || undefined })}
            className={SELECT_CLASS}
          >
            <option value="">{prov ? '— Sin asignar —' : 'Selecciona provincia'}</option>
            {prov?.districts.map((di) => (
              <option key={di.id} value={di.name}>{di.name}</option>
            ))}
          </select>
        </div>

        <div>
          <label className={LABEL_CLASS}>Caserío / Centro poblado</label>
          <input
            value={value.hamlet || ''}
            onChange={(e) => onChange({ ...value, hamlet: e.target.value })}
            className={INPUT_CLASS}
            placeholder="Ej: La Florida, Quiruvilca…"
          />
        </div>
      </div>
    </div>
  );
}
