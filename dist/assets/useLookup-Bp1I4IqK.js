import{c as i,a as r,d as t,z as n}from"./index-CN3Sb0aY.js";/**
 * @license lucide-react v0.400.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const c=i("LoaderCircle",[["path",{d:"M21 12a9 9 0 1 1-6.219-8.56",key:"13zald"}]]),s={searchByDni:o=>r.get(`/lookup/dni/${o}`).then(a=>a.data.data),searchByRuc:o=>r.get(`/lookup/ruc/${o}`).then(a=>a.data.data),getTipoCambio:o=>r.get("/lookup/tipo-cambio",{params:o?{date:o}:{}}).then(a=>a.data.data)};function p(){return t({mutationFn:s.searchByDni,onError:o=>{var a,e;return n.error(((e=(a=o.response)==null?void 0:a.data)==null?void 0:e.message)||"DNI no encontrado")}})}function d(){return t({mutationFn:s.searchByRuc,onError:o=>{var a,e;return n.error(((e=(a=o.response)==null?void 0:a.data)==null?void 0:e.message)||"RUC no encontrado")}})}function m(){return t({mutationFn:o=>s.getTipoCambio(o),onError:o=>{var a,e;return n.error(((e=(a=o.response)==null?void 0:a.data)==null?void 0:e.message)||"No se pudo obtener el tipo de cambio")}})}export{c as L,m as a,p as b,d as u};
